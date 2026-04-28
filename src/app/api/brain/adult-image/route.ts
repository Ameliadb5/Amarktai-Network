/**
 * POST /api/brain/adult-image — Adult 18+ image generation
 *
 * Generates adult content images using HuggingFace diffusion models.
 *
 * POLICY REQUIREMENTS:
 *   1. The requesting app must have `adultMode = true` (safeMode must be false).
 *   2. All prompts are scanned for ALWAYS_BLOCKED categories before any provider call.
 *      ALWAYS_BLOCKED categories are never permitted regardless of adultMode:
 *        - CSAM (child sexual abuse material) — immediate rejection
 *        - Non-consensual content
 *        - Real-person identification in sexual context
 *        - Violence / gore
 *        - Self-harm facilitation
 *        - Hate speech / extremism
 *        - Terrorism / radicalization
 *   3. Prompts that pass the content filter are sent to HuggingFace image models.
 *   4. A HuggingFace API key with access to the chosen models is required.
 *
 * PROVIDERS (in order):
 *   1. xAI / Grok image generation (grok-2-image) — uses existing Grok vault key
 *   2. Together AI (FLUX.1-schnell-Free, FLUX.1-schnell, SDXL) — disable_safety_checker
 *   3. HuggingFace (RealVisXL, DreamShaper, SDXL) — private endpoint recommended
 *
 * NOTE: HuggingFace standard Inference API may apply its own content moderation.
 * For unrestricted adult content, configure a private HuggingFace Inference Endpoint
 * (see https://huggingface.co/docs/inference-endpoints) and set HUGGINGFACE_API_KEY
 * to a key with endpoint access.
 *
 * Accepts JSON body:
 *   - prompt          (string, required) — description of the image to generate
 *   - appSlug         (string, required) — app identifier for per-app adult mode check
 *   - size            (string, optional) — '512x512' | '768x768' | '1024x1024' (default: '768x768')
 *   - negative_prompt (string, optional) — terms to exclude from generation
 *
 * Returns:
 *   { capability, executed, imageBase64?, provider, model, promptUsed, size }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAppSafetyConfig, loadAppSafetyConfigFromDB, scanContent } from '@/lib/content-filter';
import { getVaultApiKey } from '@/lib/brain';

const ALLOWED_SIZES = ['512x512', '768x768', '1024x1024'] as const;
type AdultImageSize = (typeof ALLOWED_SIZES)[number];

/**
 * HuggingFace models for adult content in preference order.
 * The operator must ensure their HuggingFace API key has appropriate model access.
 * For fully unrestricted adult content, a private Inference Endpoint is recommended.
 */
const HF_ADULT_MODELS: ReadonlyArray<{
  id: string;
  steps: number;
  cfgScale: number;
  label: string;
}> = [
  {
    id: 'SG161222/RealVisXL_V4.0',
    steps: 30,
    cfgScale: 7.0,
    label: 'RealVisXL v4',
  },
  {
    id: 'Lykon/dreamshaper-8',
    steps: 25,
    cfgScale: 7.0,
    label: 'DreamShaper 8',
  },
  {
    id: 'stabilityai/stable-diffusion-xl-base-1.0',
    steps: 30,
    cfgScale: 7.5,
    label: 'SDXL Base',
  },
] as const;

const TOGETHER_ADULT_MODELS: ReadonlyArray<{ id: string; steps: number }> = [
  { id: 'black-forest-labs/FLUX.1-schnell-Free', steps: 4 },
  { id: 'black-forest-labs/FLUX.1-schnell', steps: 4 },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', steps: 30 },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      appSlug,
      size = '768x768',
      negative_prompt,
    } = body as {
      prompt?: string;
      appSlug?: string;
      size?: string;
      negative_prompt?: string;
    };

    // ── Validate prompt ──────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (!appSlug || typeof appSlug !== 'string') {
      return NextResponse.json(
        {
          capability: 'adult_18plus_image',
          executed: false,
          error:
            'appSlug is required. Adult 18+ image generation is only available on apps ' +
            'with adult mode explicitly enabled.',
          code: 'app_slug_required',
        },
        { status: 400 },
      );
    }

    // ── Per-app adult mode enforcement ───────────────────────────────────
    // Adult mode requires the operator to explicitly configure the app with
    // safeMode=false AND adultMode=true. This cannot be bypassed.
    // Always hydrate from DB first so cold-start / server restart doesn't
    // incorrectly default to safeMode=true / adultMode=false.
    await loadAppSafetyConfigFromDB(appSlug);
    const safetyConfig = getAppSafetyConfig(appSlug);
    if (safetyConfig.safeMode || !safetyConfig.adultMode) {
      return NextResponse.json(
        {
          capability: 'adult_18plus_image',
          executed: false,
          error:
            'Adult 18+ image generation requires adultMode=true (and safeMode=false) ' +
            'to be enabled for this app. Configure the app in Admin → App Agents → Settings.',
          code: 'adult_mode_required',
          gating_required: true,
          current_config: {
            safeMode: safetyConfig.safeMode,
            adultMode: safetyConfig.adultMode,
          },
        },
        { status: 403 },
      );
    }

    // ── Content safety scan — ALWAYS_BLOCKED categories cannot be bypassed ──
    // Even with adultMode enabled, certain categories are NEVER permitted:
    // CSAM, non-consensual, violence, self-harm, hate-speech, terrorism.
    const scanResult = scanContent(prompt.trim());
    if (scanResult.flagged) {
      return NextResponse.json(
        {
          capability: 'adult_18plus_image',
          executed: false,
          error:
            'Prompt blocked by content safety filter. ' +
            `Detected: ${scanResult.categories.join(', ')}. ` +
            'CSAM, non-consensual content, violence, self-harm, hate speech, and ' +
            'terrorism content are never permitted regardless of adult mode settings.',
          code: 'prompt_blocked',
          categories: scanResult.categories,
          prompt_blocked: true,
        },
        { status: 422 },
      );
    }

    const resolvedSize: AdultImageSize = ALLOWED_SIZES.includes(size as AdultImageSize)
      ? (size as AdultImageSize)
      : '768x768';

    // Parse width/height from size string.
    // resolvedSize is always a member of ALLOWED_SIZES so parseInt will never produce NaN,
    // but guard defensively in case of future extension.
    const [widthStr, heightStr] = resolvedSize.split('x');
    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      return NextResponse.json(
        { error: `Invalid size: "${resolvedSize}". Use one of: ${ALLOWED_SIZES.join(', ')}.` },
        { status: 400 },
      );
    }

    // ── Provider 1: xAI / Grok image generation ─────────────────────────
    // Reuses the existing Grok/xAI vault key — no separate adult key needed.
    const grokKey = await getVaultApiKey('grok');
    if (grokKey) {
      try {
        const xaiModel = 'grok-2-image';
        const xaiResponse = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${grokKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: xaiModel, prompt: prompt.trim(), n: 1 }),
          signal: AbortSignal.timeout(60_000),
        });

        if (xaiResponse.ok) {
          const xaiData = await xaiResponse.json().catch(() => ({})) as {
            data?: Array<{ url?: string; b64_json?: string }>;
          };
          const xaiUrl = xaiData.data?.[0]?.url ?? null;
          const xaiB64 = xaiData.data?.[0]?.b64_json
            ? `data:image/png;base64,${xaiData.data[0].b64_json}`
            : null;
          const xaiOutput = xaiUrl ?? xaiB64;
          if (xaiOutput) {
            return NextResponse.json({
              capability: 'adult_18plus_image',
              executed: true,
              imageUrl: xaiUrl ?? undefined,
              imageBase64: xaiB64 ?? undefined,
              provider: 'xai',
              model: xaiModel,
              modelLabel: 'Grok-2 Image',
              size: resolvedSize,
              promptUsed: prompt.trim(),
            });
          }
        } else {
          const xaiErr = await xaiResponse.text().catch(() => '');
          console.warn(`[brain/adult-image] xAI/Grok failed (${xaiResponse.status}): ${xaiErr.slice(0, 200)}`);
        }
      } catch (xaiErr) {
        console.warn('[brain/adult-image] xAI/Grok error:', xaiErr instanceof Error ? xaiErr.message : xaiErr);
      }
    }

    // ── Provider 2: Together AI (disable_safety_checker) ─────────────────
    const togetherKey = await getVaultApiKey('together');
    if (togetherKey) {
      for (const model of TOGETHER_ADULT_MODELS) {
        try {
          const response = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${togetherKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model.id,
              prompt: prompt.trim(),
              n: 1,
              steps: model.steps,
              width,
              height,
              // Required to bypass Together AI's built-in safety checker for adult content.
              // Hard guardrails (CSAM, minors, non-consensual, violence) are enforced
              // upstream in content-filter.ts and checkAdultGuardrails() before reaching here.
              disable_safety_checker: true,
            }),
            signal: AbortSignal.timeout(60_000),
          });

          if (response.ok) {
            const data = await response.json().catch(() => ({})) as { data?: Array<{ url?: string }> };
            const imageUrl = data.data?.[0]?.url;
            if (imageUrl) {
              return NextResponse.json({
                capability: 'adult_18plus_image',
                executed: true,
                imageUrl,
                provider: 'together',
                model: model.id,
                modelLabel: model.id,
                size: resolvedSize,
                promptUsed: prompt.trim(),
              });
            }
          } else if (response.status === 422) {
            // Safety checker triggered or model does not support this operation
            const errBody = await response.text().catch(() => '');
            console.warn(`[brain/adult-image] Together ${model.id} blocked (422): ${errBody.slice(0, 200)}`);
            continue;
          }
        } catch (err) {
          console.warn(
            `[brain/adult-image] Together ${model.id} error:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // ── Provider 3: HuggingFace (private endpoint recommended for adult) ─
    const hfKey = await getVaultApiKey('huggingface');
    if (hfKey) {
      for (const model of HF_ADULT_MODELS) {
        try {
          const hfPayload: Record<string, unknown> = {
            inputs: prompt.trim(),
            parameters: {
              num_inference_steps: model.steps,
              guidance_scale: model.cfgScale,
              width,
              height,
            },
          };

          if (negative_prompt && typeof negative_prompt === 'string' && negative_prompt.trim()) {
            (hfPayload.parameters as Record<string, unknown>).negative_prompt =
              negative_prompt.trim();
          }

          const hfResponse = await fetch(
            `https://api-inference.huggingface.co/models/${model.id}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${hfKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(hfPayload),
              signal: AbortSignal.timeout(120_000),
            },
          );

          if (hfResponse.ok) {
            const contentType = hfResponse.headers.get('content-type') ?? 'image/png';
            if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
              const buffer = await hfResponse.arrayBuffer();
              if (buffer.byteLength > 0) {
                const base64 = Buffer.from(buffer).toString('base64');
                const mimeType = contentType.startsWith('image/') ? contentType : 'image/png';
                return NextResponse.json({
                  capability: 'adult_18plus_image',
                  executed: true,
                  imageBase64: `data:${mimeType};base64,${base64}`,
                  provider: 'huggingface',
                  model: model.id,
                  modelLabel: model.label,
                  size: resolvedSize,
                  promptUsed: prompt.trim(),
                });
              }
            }
            // HF can return JSON even on 200 for loading/error states
            const json = await hfResponse.json().catch(() => null) as { error?: string } | null;
            if (json?.error) {
              console.warn(`[brain/adult-image] HF ${model.id} returned JSON error: ${json.error}`);
              if (json.error.toLowerCase().includes('loading')) continue;
              break;
            }
          } else if (hfResponse.status === 503) {
            // Model loading — try next
            console.warn(`[brain/adult-image] HF ${model.id} loading (503), trying next`);
            continue;
          } else {
            const errText = await hfResponse.text().catch(() => '');
            console.warn(
              `[brain/adult-image] HF ${model.id} failed (${hfResponse.status}): ${errText.slice(0, 200)}`,
            );
            // 401/403 means key issue — no point trying other models
            if (hfResponse.status === 401 || hfResponse.status === 403) break;
          }
        } catch (err) {
          console.warn(
            `[brain/adult-image] HF ${model.id} error:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // ── No provider available ────────────────────────────────────────────
    const rejectionReasons: string[] = [];
    if (!grokKey) {
      rejectionReasons.push('xai: no Grok/xAI API key configured (Admin → AI Providers → xAI / Grok).');
    } else {
      rejectionReasons.push('xai: grok-2-image generation failed — key may not have image access.');
    }
    if (!togetherKey) {
      rejectionReasons.push('together: no API key configured (Admin → AI Providers → Together AI).');
    } else {
      rejectionReasons.push('together: all model attempts failed or blocked by safety policy.');
    }
    if (!hfKey) {
      rejectionReasons.push(
        'huggingface: no API key configured (Admin → AI Providers → HuggingFace). ' +
        'For unrestricted adult content, use a private HuggingFace Inference Endpoint.',
      );
    } else {
      rejectionReasons.push(
        'huggingface: all model attempts failed. Models may be loading, or the standard ' +
        'Inference API may be blocking content. Consider a private Inference Endpoint.',
      );
    }

    return NextResponse.json(
      {
        capability: 'adult_18plus_image',
        executed: false,
        code: 'no_eligible_adult_image_model',
        error:
          'No adult image generation provider is available. ' +
          'Configure at least one of: xAI/Grok, Together AI, or HuggingFace (Admin → AI Providers). ' +
          'This route never falls back to normal image generation.',
        providers_checked: ['xai', 'together', 'huggingface'],
        rejection_reasons: rejectionReasons,
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
