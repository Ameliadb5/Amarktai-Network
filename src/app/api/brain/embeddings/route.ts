import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey } from '@/lib/brain';

/**
 * POST /api/brain/embeddings — Create text embeddings
 *
 * Provider chain (first configured key that succeeds wins):
 *   1. OpenAI — text-embedding-3-small → text-embedding-3-large → text-embedding-ada-002
 *   2. Qwen/DashScope — text-embedding-v3 (OpenAI-compatible endpoint, batch supported)
 *   3. Gemini — gemini-embedding-exp-03-07 (one text at a time; batch handled in loop)
 *
 * Accepts JSON body:
 *   - input  (string | string[], required) — text(s) to embed
 *   - model  (string, optional) — override model (default: text-embedding-3-small)
 *
 * Returns:
 *   { executed, embeddings?, provider, model, dimensions?, error?, capability }
 */

const OPENAI_EMBEDDING_MODELS = new Set([
  'text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-ada-002',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, model: requestedModel } = body as {
      input?: string | string[];
      model?: string;
    };

    if (!input || (typeof input !== 'string' && !Array.isArray(input))) {
      return NextResponse.json(
        { error: 'input is required and must be a string or array of strings', capability: 'embeddings' },
        { status: 400 },
      );
    }

    // ── Provider 1: OpenAI Embeddings (primary) ────────────────────────
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey) {
      const model =
        requestedModel && OPENAI_EMBEDDING_MODELS.has(requestedModel)
          ? requestedModel
          : 'text-embedding-3-small';

      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, input }),
          signal: AbortSignal.timeout(30_000),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            data?: Array<{ embedding?: number[]; index?: number }>;
            model?: string;
            usage?: { prompt_tokens?: number; total_tokens?: number };
          };
          const embeddings = data.data?.map((d) => d.embedding) ?? [];
          return NextResponse.json({
            executed: true,
            embeddings,
            provider: 'openai',
            model,
            dimensions: embeddings[0]?.length ?? 0,
            usage: data.usage,
            capability: 'embeddings',
          });
        } else {
          const errBody = (await response.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          console.warn(
            `[brain/embeddings] OpenAI ${model} failed: ${errBody?.error?.message ?? response.status}`,
          );
        }
      } catch (err) {
        console.warn(
          '[brain/embeddings] OpenAI call failed:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    // ── Provider 2: Qwen/DashScope text-embedding-v3 (OpenAI-compatible) ─
    // Supports batch input in a single request — same format as OpenAI embeddings.
    const qwenKey = await getVaultApiKey('qwen');
    if (qwenKey) {
      try {
        const response = await fetch(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/embeddings',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qwenKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-v3',
              input,
              encoding_format: 'float',
            }),
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (response.ok) {
          const data = (await response.json()) as {
            data?: Array<{ embedding?: number[]; index?: number }>;
            model?: string;
            usage?: { prompt_tokens?: number; total_tokens?: number };
          };
          const embeddings = data.data?.map((d) => d.embedding) ?? [];
          if (embeddings.length > 0) {
            return NextResponse.json({
              executed: true,
              embeddings,
              provider: 'qwen',
              model: 'text-embedding-v3',
              dimensions: embeddings[0]?.length ?? 0,
              usage: data.usage,
              capability: 'embeddings',
            });
          }
        } else {
          const errBody = (await response.json().catch(() => ({}))) as { message?: string };
          console.warn(`[brain/embeddings] Qwen text-embedding-v3 failed (${response.status}): ${errBody?.message ?? ''}`);
        }
      } catch (err) {
        console.warn('[brain/embeddings] Qwen call failed:', err instanceof Error ? err.message : err);
      }
    }

    // ── Provider 3: Gemini embeddings (one text per request; parallel fetch for batches) ─
    // Uses the embedContent endpoint with the experimental embedding model.
    const geminiKey = await getVaultApiKey('gemini');
    if (geminiKey) {
      const GEMINI_EMBED_MODEL = 'gemini-embedding-exp-03-07';
      try {
        const inputs = Array.isArray(input) ? input : [input];

        // Issue all embedding requests in parallel to avoid sequential latency on batches.
        const responses = await Promise.all(
          inputs.map((text) =>
            fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${encodeURIComponent(geminiKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: `models/${GEMINI_EMBED_MODEL}`,
                  content: { parts: [{ text }] },
                }),
                signal: AbortSignal.timeout(30_000),
              },
            ),
          ),
        );

        const embeddingResults: number[][] = [];
        for (const res of responses) {
          if (!res.ok) {
            const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
            console.warn(`[brain/embeddings] Gemini embed failed (${res.status}): ${errBody?.error?.message ?? ''}`);
            embeddingResults.length = 0; // invalidate partial results
            break;
          }
          const data = (await res.json()) as { embedding?: { values?: number[] } };
          const values = data?.embedding?.values;
          if (!values || values.length === 0) {
            embeddingResults.length = 0;
            break;
          }
          embeddingResults.push(values);
        }

        if (embeddingResults.length === inputs.length) {
          return NextResponse.json({
            executed: true,
            embeddings: embeddingResults,
            provider: 'gemini',
            model: GEMINI_EMBED_MODEL,
            dimensions: embeddingResults[0]?.length ?? 0,
            capability: 'embeddings',
          });
        }
      } catch (err) {
        console.warn('[brain/embeddings] Gemini call failed:', err instanceof Error ? err.message : err);
      }
    }

    // ── No provider available ──────────────────────────────────────────
    return NextResponse.json(
      {
        executed: false,
        error:
          'No embeddings provider is configured. ' +
          'Add an API key via Admin → AI Providers. ' +
          'Supported: OpenAI (text-embedding-3-small), Qwen/DashScope (text-embedding-v3), Gemini (gemini-embedding-exp-03-07).',
        providers_checked: ['openai', 'qwen', 'gemini'],
        capability: 'embeddings',
      },
      { status: 503 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false, capability: 'embeddings' },
      { status: 500 },
    );
  }
}
