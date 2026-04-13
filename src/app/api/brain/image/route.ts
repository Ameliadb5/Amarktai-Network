import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey, OPENAI_IMAGE_MODELS } from '@/lib/brain';

/**
 * POST /api/brain/image — Standard image generation
 *
 * Prefers GPT Image models (gpt-image-1.5 → gpt-image-1 → gpt-image-1-mini),
 * then falls back to DALL-E 3 → DALL-E 2, then Together AI FLUX.
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
 * Ordered: highest-capability first.
 */
const GPT_IMAGE_MODELS_ORDERED = [
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
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
    } = body as {
      prompt?: string;
      model?: string;
      size?: string;
      quality?: string;
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

    // ── Provider 1: OpenAI — GPT Image family + DALL-E fallback ────────
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey) {
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
    if (togetherKey) {
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

    // ── No provider available — structured failure, never falls back to text ──
    const candidateModels = [...GPT_IMAGE_MODELS_ORDERED, 'dall-e-3', 'dall-e-2'];
    const rejectionReasons: string[] = [];
    if (!openaiKey) rejectionReasons.push('openai: no API key configured');
    if (!togetherKey) rejectionReasons.push('together: no API key configured');

    return NextResponse.json(
      {
        executed: false,
        capability: 'image_generation',
        code: 'no_eligible_image_model',
        error:
          'No image generation provider is configured. ' +
          'Add an OpenAI API key (Admin → AI Providers) to enable GPT Image models. ' +
          'Supported: gpt-image-1.5, gpt-image-1, gpt-image-1-mini, dall-e-3, Together AI FLUX.',
        candidate_models: candidateModels,
        rejection_reasons: rejectionReasons,
        providers_checked: ['openai', 'together'],
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
