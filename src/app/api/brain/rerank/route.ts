/**
 * POST /api/brain/rerank
 *
 * Standalone reranking endpoint.
 * Scores and re-orders a list of candidate documents by relevance to a query
 * using a cross-encoder model.
 *
 * Provider chain: HuggingFace (cross-encoder/ms-marco-MiniLM-L-6-v2)
 *              → NVIDIA (nv-rerankqa-mistral-4b-v3)
 *
 * Returns the documents sorted by descending relevance score.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ALLOWED_HF_RERANK_MODELS = [
  'cross-encoder/ms-marco-MiniLM-L-6-v2',
  'BAAI/bge-reranker-base',
  'BAAI/bge-reranker-large',
] as const;

const ALLOWED_NVIDIA_RERANK_MODELS = [
  'nvidia/nv-rerankqa-mistral-4b-v3',
] as const;

const RequestSchema = z.object({
  query: z.string().min(1).max(2048),
  documents: z.array(z.string().min(1).max(4096)).min(1).max(100),
  maxResults: z.number().int().min(1).max(100).optional(),
  model: z.string().optional(),
  provider: z.enum(['huggingface', 'nvidia', 'auto']).optional().default('auto'),
});

export interface RerankResult {
  capability: 'reranking';
  executed: boolean;
  query: string;
  ranked: Array<{
    document: string;
    score: number;
    originalIndex: number;
  }>;
  provider: string;
  model: string;
  latencyMs: number;
}

async function getProviderKey(providerKey: string): Promise<string | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { providerKey, enabled: true },
    select: { apiKey: true, healthStatus: true },
  });
  if (!provider?.apiKey) return null;
  if (provider.healthStatus === 'error' || provider.healthStatus === 'disabled') return null;
  return provider.apiKey;
}

async function rerankWithHuggingFace(
  query: string,
  documents: string[],
  apiKey: string,
  modelId: string,
): Promise<Array<{ score: number }>> {
  const safeModel = ALLOWED_HF_RERANK_MODELS.find((m) => m === modelId)
    ?? ALLOWED_HF_RERANK_MODELS[0];

  const pairs = documents.map((doc) => [query, doc]);

  const res = await fetch(
    `https://api-inference.huggingface.co/models/${safeModel}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: pairs }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HuggingFace reranking failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as unknown;

  // HF cross-encoder returns array of scores (numbers) or array of [{score}]
  if (Array.isArray(data)) {
    return (data as unknown[]).map((item) => ({
      score: typeof item === 'number' ? item : (item as Record<string, number>).score ?? 0,
    }));
  }

  throw new Error('Unexpected HuggingFace response format for reranking');
}

async function rerankWithNvidia(
  query: string,
  documents: string[],
  apiKey: string,
): Promise<Array<{ score: number }>> {
  const safeModel = ALLOWED_NVIDIA_RERANK_MODELS[0];

  const res = await fetch(
    `https://integrate.api.nvidia.com/v1/ranking`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: safeModel,
        query: { text: query },
        passages: documents.map((doc) => ({ text: doc })),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`NVIDIA reranking failed (${res.status}): ${errText}`);
  }

  interface NvidiaRankingResponse {
    rankings: Array<{ index: number; logit: number }>;
  }
  const data = await res.json() as NvidiaRankingResponse;
  const rankings = data.rankings ?? [];

  // NVIDIA returns rankings in order with index references — map back to document order
  const scores: Array<{ score: number }> = documents.map(() => ({ score: -Infinity }));
  for (const r of rankings) {
    if (r.index >= 0 && r.index < scores.length) {
      scores[r.index] = { score: r.logit };
    }
  }
  return scores;
}

export async function POST(req: Request): Promise<NextResponse> {
  const startTime = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { query, documents, maxResults, model, provider } = parsed.data;

  let scores: Array<{ score: number }> | null = null;
  let usedProvider = '';
  let usedModel = '';
  let lastError = '';

  // HuggingFace attempt
  if (provider === 'auto' || provider === 'huggingface') {
    const hfKey = await getProviderKey('huggingface');
    if (hfKey) {
      const hfModel = model && ALLOWED_HF_RERANK_MODELS.includes(model as typeof ALLOWED_HF_RERANK_MODELS[number])
        ? model
        : ALLOWED_HF_RERANK_MODELS[0];
      try {
        scores = await rerankWithHuggingFace(query, documents, hfKey, hfModel);
        usedProvider = 'huggingface';
        usedModel = hfModel;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // NVIDIA fallback
  if (!scores && (provider === 'auto' || provider === 'nvidia')) {
    const nvKey = await getProviderKey('nvidia');
    if (nvKey) {
      try {
        scores = await rerankWithNvidia(query, documents, nvKey);
        usedProvider = 'nvidia';
        usedModel = ALLOWED_NVIDIA_RERANK_MODELS[0];
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!scores) {
    return NextResponse.json(
      {
        capability: 'reranking',
        executed: false,
        error: lastError || 'No reranking provider available. Configure HuggingFace or NVIDIA.',
        query,
      },
      { status: 503 },
    );
  }

  // Build ranked result
  const indexed = documents.map((doc, i) => ({
    document: doc,
    score: scores![i]?.score ?? 0,
    originalIndex: i,
  }));

  indexed.sort((a, b) => b.score - a.score);

  const ranked = maxResults ? indexed.slice(0, maxResults) : indexed;

  const result: RerankResult = {
    capability: 'reranking',
    executed: true,
    query,
    ranked,
    provider: usedProvider,
    model: usedModel,
    latencyMs: Date.now() - startTime,
  };

  return NextResponse.json(result);
}
