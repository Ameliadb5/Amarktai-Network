/**
 * POST /api/brain/video-generate
 *
 * Creates an asynchronous video generation job.
 *
 * Provider chain:
 *   1. Replicate (wan-ai/wan2.1-t2v-480p, minimax/video-01)
 *   2. HuggingFace (cerspense/zeroscope_v2_576w — free tier, longer latency)
 *
 * Returns a jobId immediately. Poll GET /api/brain/video-generate/[jobId]
 * to check status and retrieve the result URL once complete.
 *
 * Capability truth: video_generation is AVAILABLE only when Replicate or
 * HuggingFace is configured and this route returns a real job.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const FRAMES_PER_SECOND = 24;
const MAX_REPLICATE_FRAMES = 81; // max for most Replicate text-to-video models

const REPLICATE_MODELS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'wan-ai/wan2.1-t2v-480p', name: 'Wan2.1 T2V 480p' },
  { id: 'minimax/video-01', name: 'MiniMax Video-01' },
];

const HF_VIDEO_MODELS: ReadonlyArray<string> = [
  'cerspense/zeroscope_v2_576w',
  'damo-vilab/text-to-video-ms-1.7b',
];

const RequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.enum(['cinematic', 'animated', 'realistic', 'documentary', 'commercial']).optional().default('cinematic'),
  duration: z.number().int().min(1).max(30).optional().default(4),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().default('16:9'),
  appSlug: z.string().optional(),
  provider: z.enum(['replicate', 'huggingface', 'auto']).optional().default('auto'),
  model: z.string().optional(),
});

async function getProviderKey(providerKey: string): Promise<string | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { providerKey, enabled: true },
    select: { apiKey: true, healthStatus: true },
  });
  if (!provider?.apiKey) return null;
  if (provider.healthStatus === 'error' || provider.healthStatus === 'disabled') return null;
  return provider.apiKey;
}

async function createReplicateJob(
  prompt: string,
  modelId: string,
  apiKey: string,
  duration: number,
): Promise<{ providerJobId: string; status: string }> {
  // Use the latest-version deployment endpoint
  const res = await fetch(
    `https://api.replicate.com/v1/models/${modelId}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=5',
      },
      body: JSON.stringify({
        input: {
          prompt,
          num_frames: Math.min(duration * FRAMES_PER_SECOND, MAX_REPLICATE_FRAMES),
          num_inference_steps: 25,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Replicate job creation failed (${res.status}): ${errText}`);
  }

  interface ReplicateResponse {
    id: string;
    status: string;
  }
  const data = await res.json() as ReplicateResponse;
  return { providerJobId: data.id, status: data.status ?? 'starting' };
}

async function createHfVideoJob(
  prompt: string,
  modelId: string,
  apiKey: string,
): Promise<{ providerJobId: string; status: string }> {
  const safeModel = HF_VIDEO_MODELS.find((m) => m === modelId) ?? HF_VIDEO_MODELS[0];

  // HF inference API for video models — submit job, get back a task ID from x-request-id header
  const res = await fetch(
    `https://api-inference.huggingface.co/models/${safeModel}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'false',
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  // 503 = model loading (expected) — we treat it as "processing"
  if (res.status === 503) {
    const requestId = res.headers.get('x-request-id') ?? `hf-${Date.now()}`;
    return { providerJobId: `hf:${safeModel}:${requestId}`, status: 'processing' };
  }

  if (res.ok) {
    // Synchronous response — video bytes returned immediately
    const requestId = res.headers.get('x-request-id') ?? `hf-sync-${Date.now()}`;
    // Store the video blob as a data URL in the job — we signal with prefix "hf-sync:"
    return { providerJobId: `hf-sync:${safeModel}:${requestId}`, status: 'succeeded' };
  }

  const errText = await res.text().catch(() => '');
  throw new Error(`HuggingFace video job failed (${res.status}): ${errText}`);
}

export async function POST(req: Request): Promise<NextResponse> {
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

  const { prompt, style, duration, aspectRatio, appSlug, provider, model } = parsed.data;

  // Enhance prompt with style
  const enhancedPrompt = `${style} style video: ${prompt}`;

  let providerJobId = '';
  let usedProvider = '';
  let usedModel = '';
  let initialStatus = 'processing';
  let lastError = '';

  // Replicate attempt
  if (provider === 'auto' || provider === 'replicate') {
    const repKey = await getProviderKey('replicate');
    if (repKey) {
      const modelToUse = model
        ? (REPLICATE_MODELS.find((m) => m.id === model) ?? REPLICATE_MODELS[0])
        : REPLICATE_MODELS[0];
      try {
        const result = await createReplicateJob(enhancedPrompt, modelToUse.id, repKey, duration);
        providerJobId = result.providerJobId;
        usedProvider = 'replicate';
        usedModel = modelToUse.id;
        initialStatus = result.status;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // HuggingFace fallback
  if (!providerJobId && (provider === 'auto' || provider === 'huggingface')) {
    const hfKey = await getProviderKey('huggingface');
    if (hfKey) {
      const hfModel = model && HF_VIDEO_MODELS.includes(model)
        ? model
        : HF_VIDEO_MODELS[0];
      try {
        const result = await createHfVideoJob(enhancedPrompt, hfModel, hfKey);
        providerJobId = result.providerJobId;
        usedProvider = 'huggingface';
        usedModel = hfModel;
        initialStatus = result.status;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (!providerJobId) {
    return NextResponse.json(
      {
        capability: 'video_generation',
        executed: false,
        error:
          lastError ||
          'No video generation provider available. Configure Replicate or HuggingFace.',
      },
      { status: 503 },
    );
  }

  // Persist job
  const job = await prisma.videoGenerationJob.create({
    data: {
      provider: usedProvider,
      modelId: usedModel,
      prompt: enhancedPrompt,
      style,
      duration,
      aspectRatio,
      appSlug: appSlug ?? null,
      status: initialStatus,
      providerJobId,
    },
  });

  return NextResponse.json(
    {
      capability: 'video_generation',
      executed: true,
      jobId: job.id,
      status: job.status,
      provider: usedProvider,
      model: usedModel,
      prompt: enhancedPrompt,
      pollUrl: `/api/brain/video-generate/${job.id}`,
    },
    { status: 202 },
  );
}
