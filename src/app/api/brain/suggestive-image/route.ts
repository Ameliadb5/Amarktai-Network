import { NextRequest, NextResponse } from 'next/server';
import { getAppSafetyConfig, validateSuggestivePrompt } from '@/lib/content-filter';

/**
 * POST /api/brain/suggestive-image — Suggestive (non-explicit) image generation
 *
 * Generates tasteful suggestive images: lingerie, swimwear, fashion poses,
 * attractive people, lifestyle photography. No nudity. No explicit acts.
 * No minors. All prompts are validated and sanitized before generation.
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

/** Prepend a style prefix to the prompt to reinforce tasteful imagery. */
function enforceStylePrefix(prompt: string): string {
  const prefix =
    'Tasteful fashion photograph, professional lighting, no nudity, no explicit content:';
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
    const openaiKey = process.env.OPENAI_API_KEY;
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

    // ── Provider fallback: HuggingFace SDXL ────────────────────────────
    const hfKey = process.env.HUGGINGFACE_API_KEY;
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

    // ── No provider available ───────────────────────────────────────────
    return NextResponse.json(
      {
        capability: 'suggestive_image_generation',
        executed: false,
        error:
          'No image generation provider is configured. ' +
          'Add OPENAI_API_KEY or HUGGINGFACE_API_KEY to enable suggestive image generation.',
        providers_checked: ['openai', 'huggingface'],
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
