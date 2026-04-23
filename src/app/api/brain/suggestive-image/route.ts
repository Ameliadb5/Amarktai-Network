import { NextRequest, NextResponse } from 'next/server';
import { getAppSafetyConfig, loadAppSafetyConfigFromDB, validateSuggestivePrompt } from '@/lib/content-filter';
import { getVaultApiKey } from '@/lib/brain';

/**
 * POST /api/brain/suggestive-image — Suggestive (non-explicit) image generation
 *
 * Generates tasteful suggestive images: lingerie, swimwear, fashion poses,
 * attractive people, lifestyle photography, topless nudity. No explicit acts.
 * No minors. No genitalia. All prompts are validated and sanitized before generation.
 *
 * GATING:
 *   - App must have safeMode=false AND suggestiveMode=true
 *   - All prompts pass through validateSuggestivePrompt() before provider call
 *
 * PROVIDERS (in order):
 *   1. OpenAI DALL-E 3 (primary — safe prompt enforcement built-in)
 *   2. HuggingFace SDXL Base (fallback — controlled prompts)
 *
 * Accepts JSON body:
 *   - prompt (string, required) — description of the image to generate
 *   - appSlug (string, optional) — app identifier for per-app gating
 *   - size (string, optional) — '1024x1024' | '1024x1792' | '1792x1024' (default: '1024x1024')
 *   - style (string, optional) — 'vivid' | 'natural' (default: 'natural', OpenAI only)
 *
 * Returns:
 *   { capability, executed, imageUrl?, imageBase64?, provider, model, promptUsed, promptRewritten }
 */

const ALLOWED_SIZES = ['1024x1024', '1024x1792', '1792x1024'] as const;
type ImageSize = (typeof ALLOWED_SIZES)[number];

const ALLOWED_STYLES = ['vivid', 'natural'] as const;

const ALLOWED_HF_IMAGE_MODELS = [
  'stabilityai/stable-diffusion-xl-base-1.0',
  'stabilityai/stable-diffusion-2-1',
] as const;

/** Steps used for FLUX models (distilled diffusion — high quality at 4 steps). */
const FLUX_DEFAULT_STEPS = 4;
/** Steps used for SDXL-based models (needs more diffusion steps for quality). */
const SDXL_DEFAULT_STEPS = 30;

/** Together AI image models in preference order (FLUX first, then SDXL). */
const TOGETHER_IMAGE_MODELS: ReadonlyArray<{ id: string; steps: number }> = [
  { id: 'black-forest-labs/FLUX.1-schnell-Free', steps: FLUX_DEFAULT_STEPS },
  { id: 'black-forest-labs/FLUX.1-schnell', steps: FLUX_DEFAULT_STEPS },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', steps: SDXL_DEFAULT_STEPS },
];

/** Prepend a style prefix to the prompt to reinforce tasteful imagery. */
function enforceStylePrefix(prompt: string): string {
  const prefix =
    'Tasteful professional photograph, artistic lighting, no explicit sexual content, no genitalia:';
  return `${prefix} ${prompt}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      appSlug,
      size = '1024x1024',
      style = 'natural',
    } = body as {
      prompt?: string;
      appSlug?: string;
      size?: string;
      style?: string;
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (!ALLOWED_SIZES.includes(size as ImageSize)) {
      return NextResponse.json(
        { error: `size must be one of: ${ALLOWED_SIZES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!ALLOWED_STYLES.includes(style as typeof ALLOWED_STYLES[number])) {
      return NextResponse.json(
        { error: `style must be one of: ${ALLOWED_STYLES.join(', ')}` },
        { status: 400 },
      );
    }

    // ── Per-app gating check ────────────────────────────────────────────
    if (appSlug) {
      // Always hydrate from DB first so cold-start / server restart doesn't
      // incorrectly default to safeMode=true / suggestiveMode=false.
      await loadAppSafetyConfigFromDB(appSlug);
      const safetyConfig = getAppSafetyConfig(appSlug);
      if (safetyConfig.safeMode || !safetyConfig.suggestiveMode) {
        return NextResponse.json(
          {
            capability: 'suggestive_image_generation',
            executed: false,
            error:
              'Suggestive image generation is not enabled for this app. ' +
              'Set safeMode=false and suggestiveMode=true in app settings.',
            gating_required: true,
          },
          { status: 403 },
        );
      }
    }

    // ── Prompt safety validation ────────────────────────────────────────
    const validation = validateSuggestivePrompt(prompt.trim());
    if (!validation.allowed) {
      return NextResponse.json(
        {
          capability: 'suggestive_image_generation',
          executed: false,
          error: validation.reason ?? 'Prompt blocked by safety filter.',
          prompt_blocked: true,
        },
        { status: 422 },
      );
    }

    // Enforce style prefix on the sanitized prompt
    const finalPrompt = enforceStylePrefix(validation.sanitized);
    const promptRewritten = finalPrompt !== prompt.trim();

    // ── Provider: OpenAI DALL-E 3 ───────────────────────────────────────
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: finalPrompt,
            n: 1,
            size,
            style,
          }),
        });

        if (response.ok) {
          const data = await response.json() as { data?: { url?: string }[] };
          const imageUrl = data.data?.[0]?.url;
          if (imageUrl) {
            return NextResponse.json({
              capability: 'suggestive_image_generation',
              executed: true,
              fallback_used: false,
              imageUrl,
              provider: 'openai',
              model: 'dall-e-3',
              promptUsed: finalPrompt,
              promptRewritten,
              size,
            });
          }
        }
      } catch {
        // OpenAI unavailable — fall through to HuggingFace
      }
    }

    // ── Provider fallback: Together AI (FLUX / SDXL) ───────────────────
    const togetherKey = await getVaultApiKey('together');
    if (togetherKey) {
      for (const { id: modelId, steps } of TOGETHER_IMAGE_MODELS) {
        try {
          const response = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${togetherKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelId,
              prompt: finalPrompt,
              n: 1,
              steps,
              width: 1024,
              height: 1024,
            }),
          });

          if (response.ok) {
            const data = await response.json() as { data?: Array<{ url?: string }> };
            const imageUrl = data.data?.[0]?.url;
            if (imageUrl) {
              return NextResponse.json({
                capability: 'suggestive_image_generation',
                executed: true,
                fallback_used: true,
                imageUrl,
                provider: 'together',
                model: modelId,
                promptUsed: finalPrompt,
                promptRewritten,
                size,
              });
            }
          }
        } catch {
          // Try next Together model
        }
      }
    }

    // ── Provider fallback: HuggingFace SDXL ────────────────────────────
    const hfKey = await getVaultApiKey('huggingface');
    if (hfKey) {
      const hfModel = ALLOWED_HF_IMAGE_MODELS[0];
      try {
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${hfModel}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${hfKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: finalPrompt }),
          },
        );

        if (response.ok) {
          const contentType = response.headers.get('content-type') ?? 'image/png';
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          const imageBase64 = `data:${contentType};base64,${base64}`;

          return NextResponse.json({
            capability: 'suggestive_image_generation',
            executed: true,
            fallback_used: true,
            imageBase64,
            provider: 'huggingface',
            model: hfModel,
            promptUsed: finalPrompt,
            promptRewritten,
            size,
          });
        }
      } catch {
        // HuggingFace unavailable
      }
    }

    // ── Provider fallback: Gemini Imagen 3.0 ───────────────────────────
    // Imagen 3.0 enforces safety by default — suitable for suggestive (non-explicit) content.
    const geminiKey = await getVaultApiKey('gemini');
    if (geminiKey) {
      try {
        const imagenEndpoint =
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(geminiKey)}`;
        const imagenRes = await fetch(imagenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: finalPrompt }],
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
              capability: 'suggestive_image_generation',
              executed: true,
              fallback_used: true,
              imageBase64: `data:${mime};base64,${b64}`,
              provider: 'gemini',
              model: 'imagen-3.0-generate-002',
              promptUsed: finalPrompt,
              promptRewritten,
              size,
            });
          }
        } else {
          const errBody = await imagenRes.json().catch(() => ({})) as { error?: { message?: string } };
          console.warn(`[brain/suggestive-image] Gemini Imagen failed (${imagenRes.status}): ${errBody?.error?.message ?? ''}`);
        }
      } catch (gErr) {
        console.warn('[brain/suggestive-image] Gemini Imagen error:', gErr instanceof Error ? gErr.message : gErr);
      }
    }

    // ── Provider fallback: Qwen Wanx image generation (async) ─────────
    const qwenKey = await getVaultApiKey('qwen');
    if (qwenKey) {
      const WANX_MODELS = [
        { id: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 Turbo' },
        { id: 'wanx-v1',           label: 'Wanx v1' },
      ] as const;
      const WANX_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';
      const wanxSize = size.replace('x', '*');

      for (const wanxModel of WANX_MODELS) {
        try {
          const submitRes = await fetch(
            `${WANX_BASE}/services/aigc/text2image/image-synthesis`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${qwenKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
              },
              body: JSON.stringify({
                model: wanxModel.id,
                input: { prompt: finalPrompt },
                parameters: { size: wanxSize, n: 1 },
              }),
              signal: AbortSignal.timeout(15_000),
            },
          );

          if (!submitRes.ok) {
            if (submitRes.status === 401 || submitRes.status === 403) break;
            continue;
          }

          const submitData = await submitRes.json() as { output?: { task_id?: string } };
          const taskId = submitData?.output?.task_id;
          if (!taskId) continue;

          const POLL_DEADLINE = Date.now() + 50_000;
          let taskResult: { output?: { task_status?: string; results?: Array<{ url?: string }> } } = {};

          while (Date.now() < POLL_DEADLINE) {
            await new Promise(r => setTimeout(r, 2_000));
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
              capability: 'suggestive_image_generation',
              executed: true,
              fallback_used: true,
              imageUrl: resultUrl,
              provider: 'qwen',
              model: wanxModel.id,
              promptUsed: finalPrompt,
              promptRewritten,
              size,
            });
          }
        } catch (qErr) {
          console.warn(`[brain/suggestive-image] Qwen ${wanxModel.id} error:`, qErr instanceof Error ? qErr.message : qErr);
        }
      }
    }

    // ── No provider available ───────────────────────────────────────────
    return NextResponse.json(
      {
        capability: 'suggestive_image_generation',
        executed: false,
        error:
          'No image generation provider is configured. ' +
          'Add an API key via Admin → AI Providers. ' +
          'Supported: OpenAI (DALL-E 3), Together AI (FLUX/SDXL), HuggingFace (SDXL), Gemini (Imagen 3.0), Qwen/DashScope (Wanx).',
        providers_checked: ['openai', 'together', 'huggingface', 'gemini', 'qwen'],
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
