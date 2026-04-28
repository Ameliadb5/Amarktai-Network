import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey, OPENAI_IMAGE_MODELS } from '@/lib/brain';
import { callGenXMedia, GENX_IMAGE_MODELS } from '@/lib/genx-client';

/**
 * POST /api/brain/image — Standard image generation
 *
 * Provider chain (first configured key that succeeds wins):
 *   0. GenX — gpt-image-2, nano-banana-2, nano-banana-pro, etc. (primary)
 *   1. OpenAI — gpt-image-1 → dall-e-3 → dall-e-2
 *   2. Together AI — FLUX.1-schnell-Free → FLUX.1-schnell
 *   3. Gemini — imagen-3.0-generate-002 (Gemini API Prediction endpoint)
 *   4. Qwen/DashScope — wanx2.1-t2i-turbo → wanx-v1 (async AIGC endpoint with polling)
 *
 * Returns a structured error with code=no_eligible_image_model when no
 * image-capable provider is configured — never silently falls back to text.
 *
 * Accepts JSON body:
 *   - prompt  (string, required)
 *   - model   (string, optional) — override model (must be an image model)
 *   - size    (string, optional) — '1024x1024' | '1024x1792' | '1792x1024'
 *   - quality (string, optional) — 'standard' | 'hd' (DALL-E 3 only)
 *
 * Returns:
 *   { executed, imageUrl?, imageBase64?, provider, model, error? }
 */

const ALLOWED_SIZES = ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'] as const;
type ImageSize = (typeof ALLOWED_SIZES)[number];

/** Sizes supported by DALL-E 2 (subset of ALLOWED_SIZES). */
const DALLE2_SIZES = new Set<string>(['256x256', '512x512', '1024x1024']);

/**
 * GPT Image family — the canonical OpenAI image-generation models.
 * These must NEVER be routed to the chat/completions endpoint.
 * Only real, currently-valid model IDs are listed here.
 */
const GPT_IMAGE_MODELS_ORDERED = [
  'gpt-image-1',
] as const;

/** Together AI FLUX models tried in order for fallback image generation. */
const FLUX_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell-Free', steps: 4 },
  { id: 'black-forest-labs/FLUX.1-schnell', steps: 4 },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model: requestedModel,
      size = '1024x1024',
      quality = 'standard',
      providerOverride,
      modelOverride,
    } = body as {
      prompt?: string;
      model?: string;
      size?: string;
      quality?: string;
      providerOverride?: string;
      modelOverride?: string;
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const resolvedSize: ImageSize = ALLOWED_SIZES.includes(size as ImageSize)
      ? (size as ImageSize)
      : '1024x1024';

    // ── Provider 0: GenX — primary image generation ─────────────────────
    if (!providerOverride || providerOverride === 'genx') {
      const genxModel = modelOverride ?? requestedModel ?? GENX_IMAGE_MODELS[0];
      try {
        const genxResult = await callGenXMedia({ model: genxModel, prompt: prompt.trim(), type: 'image' });
        if (genxResult.success && genxResult.url) {
          return NextResponse.json({
            executed: true,
            imageUrl: genxResult.url,
            provider: 'genx',
            model: genxResult.model,
            size: resolvedSize,
          });
        }
      } catch (genxErr) {
        console.warn('[brain/image] GenX image failed:', genxErr instanceof Error ? genxErr.message : genxErr);
      }
    }

    // ── Provider 1: OpenAI — GPT Image family + DALL-E fallback ────────
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey && (!providerOverride || providerOverride === 'openai')) {
      // Resolve the model to use:
      //   1. If the caller requested a specific image model, honour it.
      //   2. Otherwise try each GPT Image model in capability order.
      //   3. Fall back to DALL-E 3 → DALL-E 2 for legacy compatibility.
      const modelCandidates: string[] = requestedModel && OPENAI_IMAGE_MODELS.has(requestedModel)
        ? [requestedModel]
        : [...GPT_IMAGE_MODELS_ORDERED, 'dall-e-3', 'dall-e-2'];

      // Validate: only allow image-generation models.
      // When OpenAI key is present, always try the full ordered candidate list —
      // the health cache may not be synced yet (it is populated lazily by the
      // orchestrator's syncProviderHealthCache).  We call the OpenAI images API
      // directly here so health-cache state is irrelevant; all model-not-found
      // responses are handled per-model below.
      const candidates = modelCandidates;

      for (const model of candidates) {
        try {
          const effectiveSize = model === 'dall-e-2'
            ? (DALLE2_SIZES.has(resolvedSize) ? resolvedSize : '1024x1024') as ImageSize
            : resolvedSize;

          const requestBody: Record<string, unknown> = {
            model,
            prompt: prompt.trim(),
            n: 1,
            size: effectiveSize,
          };
          // DALL-E 3 supports quality; GPT Image models do not use this field.
          if (model === 'dall-e-3') {
            requestBody.quality = quality === 'hd' ? 'hd' : 'standard';
          }
          // DALL-E 3 and DALL-E 2 support b64_json response format so we get
          // a stable base64 payload instead of a temporary CDN URL.
          // GPT Image models (gpt-image-1.x) do NOT accept response_format.
          if (model === 'dall-e-3' || model === 'dall-e-2') {
            requestBody.response_format = 'b64_json';
          }

          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60_000),
          });

          if (response.ok) {
            const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
            const imageUrl = data.data?.[0]?.url ?? null;
            const imageBase64 = data.data?.[0]?.b64_json
              ? `data:image/png;base64,${data.data[0].b64_json}`
              : null;
            if (imageUrl || imageBase64) {
              return NextResponse.json({
                executed: true,
                imageUrl,
                imageBase64,
                provider: 'openai',
                model,
                size: effectiveSize,
              });
            }
          } else {
            const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
            const errMsg = errBody?.error?.message ?? String(response.status);
            console.warn(`[brain/image] OpenAI ${model} failed: ${errMsg}`);
            // If the model is not supported by this account (404 / model_not_found),
            // try the next candidate. For other errors stop (rate-limit, auth, etc.).
            if (response.status !== 404 && !errMsg.includes('model_not_found') && !errMsg.includes('does not exist')) {
              break;
            }
          }
        } catch (err) {
          console.warn(`[brain/image] OpenAI ${model} error:`, err instanceof Error ? err.message : err);
          break;
        }
      }
    }

    // ── Provider 2: Together AI FLUX (fallback) ────────────────────────
    const togetherKey = await getVaultApiKey('together');
    if (togetherKey && (!providerOverride || providerOverride === 'together')) {
      for (const { id: fluxModel, steps } of FLUX_MODELS) {
        try {
          const response = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${togetherKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: fluxModel,
              prompt: prompt.trim(),
              n: 1,
              steps,
              width: 1024,
              height: 1024,
            }),
            signal: AbortSignal.timeout(60_000),
          });
          if (response.ok) {
            const data = await response.json() as { data?: Array<{ url?: string }> };
            const imageUrl = data.data?.[0]?.url ?? null;
            if (imageUrl) {
              return NextResponse.json({
                executed: true,
                imageUrl,
                provider: 'together',
                model: fluxModel,
                size: '1024x1024',
              });
            }
          }
        } catch (fluxErr) {
          console.warn(`[brain/image] Together AI ${fluxModel} failed:`, fluxErr instanceof Error ? fluxErr.message : fluxErr);
        }
      }
    }

    // ── Provider 3: Gemini — Imagen 3.0 (Prediction API) ──────────────
    // Available to Gemini API keys that have Imagen access enabled.
    // The endpoint uses the same API key as chat but the `:predict` action.
    // Access may be gated by account tier — fails gracefully when denied.
    const geminiKey = await getVaultApiKey('gemini');
    if (geminiKey && (!providerOverride || providerOverride === 'gemini')) {
      try {
        const imagenEndpoint =
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(geminiKey)}`;
        const imagenRes = await fetch(imagenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: prompt.trim() }],
            parameters: { sampleCount: 1, aspectRatio: '1:1' },
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (imagenRes.ok) {
          const imagenData = await imagenRes.json() as {
            predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
          };
          const b64 = imagenData?.predictions?.[0]?.bytesBase64Encoded;
          const mime = imagenData?.predictions?.[0]?.mimeType ?? 'image/png';
          if (b64) {
            return NextResponse.json({
              executed: true,
              imageBase64: `data:${mime};base64,${b64}`,
              provider: 'gemini',
              model: 'imagen-3.0-generate-002',
              size: '1024x1024',
            });
          }
        } else {
          const errBody = await imagenRes.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
          console.warn(`[brain/image] Gemini Imagen failed (${imagenRes.status}): ${errBody?.error?.message ?? 'unknown'}`);
          // 403 = account not enabled for Imagen; keep going to next provider
        }
      } catch (gErr) {
        console.warn('[brain/image] Gemini Imagen error:', gErr instanceof Error ? gErr.message : gErr);
      }
    }

    // ── Provider 4: Qwen/DashScope — Wanx image generation (async) ────
    // Uses the DashScope International AIGC text-to-image endpoint.
    // Polls until the job succeeds or the deadline is reached.
    const qwenKey = await getVaultApiKey('qwen');
    if (qwenKey && (!providerOverride || providerOverride === 'qwen')) {
      const WANX_MODELS = [
        { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo' },
        { id: 'wanx-v1',           label: 'Wanx v1' },
      ] as const;
      const WANX_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';
      // Parse size string to Wanx format (e.g. '1024x1024' → '1024*1024')
      const wanxSize = resolvedSize.replace('x', '*');

      for (const wanxModel of WANX_MODELS) {
        try {
          // Step 1: submit async task
          const submitRes = await fetch(`${WANX_BASE}/services/aigc/text2image/image-synthesis`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${qwenKey}`,
              'Content-Type': 'application/json',
              'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify({
              model: wanxModel.id,
              input: { prompt: prompt.trim() },
              parameters: { size: wanxSize, n: 1 },
            }),
            signal: AbortSignal.timeout(15_000),
          });

          if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            console.warn(`[brain/image] Qwen ${wanxModel.id} submit failed (${submitRes.status}): ${errText.slice(0, 200)}`);
            // 401/403 = key issue — no point trying next model
            if (submitRes.status === 401 || submitRes.status === 403) break;
            continue;
          }

          const submitData = await submitRes.json() as { output?: { task_id?: string; task_status?: string } };
          const taskId = submitData?.output?.task_id;
          if (!taskId) {
            console.warn('[brain/image] Qwen Wanx: no task_id in submit response');
            continue;
          }

          // Step 2: poll until succeeded or deadline
          const POLL_INTERVAL_MS = 2_000;
          const POLL_DEADLINE = Date.now() + 50_000; // leave buffer before 60s overall timeout

          let taskResult: { output?: { task_status?: string; results?: Array<{ url?: string }> } } = {};
          while (Date.now() < POLL_DEADLINE) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
            const pollRes = await fetch(`${WANX_BASE}/tasks/${taskId}`, {
              headers: { Authorization: `Bearer ${qwenKey}` },
              signal: AbortSignal.timeout(10_000),
            }).catch(() => null);
            if (!pollRes?.ok) continue;
            taskResult = await pollRes.json().catch(() => ({})) as typeof taskResult;
            const status = taskResult?.output?.task_status;
            if (status === 'SUCCEEDED' || status === 'FAILED') break;
          }

          const resultUrl = taskResult?.output?.results?.[0]?.url;
          if (resultUrl) {
            return NextResponse.json({
              executed: true,
              imageUrl: resultUrl,
              provider: 'qwen',
              model: wanxModel.id,
              size: resolvedSize,
            });
          }
          // Task failed or timed out — try next Wanx model
        } catch (qErr) {
          console.warn(`[brain/image] Qwen ${wanxModel.id} error:`, qErr instanceof Error ? qErr.message : qErr);
        }
      }
    }

    // ── No provider available — structured failure, never falls back to text ──
    const candidateModels = [...GENX_IMAGE_MODELS, ...GPT_IMAGE_MODELS_ORDERED, 'dall-e-3', 'dall-e-2'];
    const rejectionReasons: string[] = ['genx: not configured or returned no image'];
    if (!openaiKey) rejectionReasons.push('openai: no API key configured');
    if (!togetherKey) rejectionReasons.push('together: no API key configured');
    if (!geminiKey) rejectionReasons.push('gemini: no API key configured (Imagen 3.0)');
    if (!qwenKey) rejectionReasons.push('qwen: no API key configured (Wanx image generation)');

    return NextResponse.json(
      {
        executed: false,
        capability: 'image_generation',
        code: 'no_eligible_image_model',
        error:
          'No image generation provider is configured. ' +
          'Configure at least one of: GenX, OpenAI (gpt-image-1/dall-e-3), Together AI (FLUX), ' +
          'Gemini (Imagen 3.0), or Qwen/DashScope (Wanx) in Admin → AI Providers.',
        candidate_models: candidateModels,
        rejection_reasons: rejectionReasons,
        providers_checked: ['genx', 'openai', 'together', 'gemini', 'qwen'],
      },
      { status: 503 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
