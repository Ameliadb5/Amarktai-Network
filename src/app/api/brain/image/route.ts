import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey, OPENAI_IMAGE_MODELS } from '@/lib/brain';

/**
 * POST /api/brain/image — Standard image generation
 *
 * Calls the OpenAI images endpoint (DALL-E 3 → DALL-E 2 fallback),
 * or Together AI FLUX as a second fallback.
 *
 * Unlike /api/brain/suggestive-image, this route has no suggestive-mode
 * gating and does not enforce a style prefix. It is intended for general
 * image generation requests (diagrams, product shots, illustrations, etc.).
 *
 * Accepts JSON body:
 *   - prompt  (string, required)
 *   - model   (string, optional) — override model (default: dall-e-3)
 *   - size    (string, optional) — '1024x1024' | '1024x1792' | '1792x1024'
 *   - quality (string, optional) — 'standard' | 'hd' (dall-e-3 only)
 *
 * Returns:
 *   { executed, imageUrl?, imageBase64?, provider, model, error? }
 */

const ALLOWED_SIZES = ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'] as const;
type ImageSize = (typeof ALLOWED_SIZES)[number];

/** Sizes supported by DALL-E 2 (subset of ALLOWED_SIZES). */
const DALLE2_SIZES = new Set<string>(['256x256', '512x512', '1024x1024']);

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

    // ── Provider 1: OpenAI DALL-E 3 (primary) ──────────────────────────
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey) {
      const model = requestedModel && OPENAI_IMAGE_MODELS.has(requestedModel)
        ? requestedModel
        : 'dall-e-3';

      try {
        const dalleSize = model === 'dall-e-2'
          ? (DALLE2_SIZES.has(resolvedSize) ? resolvedSize : '1024x1024') as ImageSize
          : resolvedSize;

        const requestBody: Record<string, unknown> = {
          model,
          prompt: prompt.trim(),
          n: 1,
          size: dalleSize,
        };
        if (model === 'dall-e-3') {
          requestBody.quality = quality === 'hd' ? 'hd' : 'standard';
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
              size: dalleSize,
            });
          }
        } else {
          const errBody = await response.json().catch(() => ({})) as { error?: { message?: string } };
          console.warn(`[brain/image] OpenAI ${model} failed: ${errBody?.error?.message ?? response.status}`);
        }
      } catch (err) {
        console.warn('[brain/image] OpenAI call failed:', err instanceof Error ? err.message : err);
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

    // ── No provider available ──────────────────────────────────────────
    return NextResponse.json(
      {
        executed: false,
        error:
          'No image generation provider is configured. ' +
          'Add an API key via Admin → AI Providers. Supported: OpenAI (DALL-E 3), Together AI (FLUX).',
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
