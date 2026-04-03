/**
 * POST /api/brain/suggestive-video-gen
 *
 * Suggestive (non-explicit) video generation.
 *
 * Generates tasteful video content: fashion, swimwear, lifestyle, model
 * poses. Strictly no nudity, no explicit acts, no minors.
 *
 * All prompts are validated and sanitized through the suggestive prompt
 * guard before being sent to any provider.
 *
 * GATING:
 *   - App must have safeMode=false AND suggestiveMode=true
 *   - All prompts pass through validateSuggestivePrompt() before generation
 *
 * PROVIDERS (in order):
 *   1. HuggingFace ZeroScope V2 576w (text-to-video, free)
 *   2. HuggingFace Text-to-Video MS 1.7B (fallback)
 *
 * The provider applies its own safety filters. The prompt is additionally
 * prefixed with a tasteful-content enforcement string.
 *
 * Returns:
 *   { capability, executed, videoBase64?, videoUrl?, provider, model,
 *     promptUsed, promptRewritten, duration }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAppSafetyConfig, validateSuggestivePrompt } from '@/lib/content-filter';
import { prisma } from '@/lib/prisma';

const ALLOWED_HF_VIDEO_MODELS: ReadonlyArray<string> = [
  'cerspense/zeroscope_v2_576w',
  'damo-vilab/text-to-video-ms-1.7b',
] as const;

const HF_VIDEO_FRAMES_PER_SECOND = 8;
const HF_VIDEO_MAX_FRAMES = 24;

const ALLOWED_STYLES = ['fashion', 'beach', 'gym', 'lifestyle', 'cinematic'] as const;

function enforceSafeVideoPrefix(prompt: string): string {
  return `Tasteful lifestyle video, professional production, fashion/model content, no nudity, no explicit content: ${prompt}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      appSlug,
      style = 'lifestyle',
      duration = 4,
    } = body as {
      prompt?: string;
      appSlug?: string;
      style?: string;
      duration?: number;
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: 'prompt must be 1000 characters or fewer' },
        { status: 400 },
      );
    }

    if (style && !ALLOWED_STYLES.includes(style as typeof ALLOWED_STYLES[number])) {
      return NextResponse.json(
        { error: `style must be one of: ${ALLOWED_STYLES.join(', ')}` },
        { status: 400 },
      );
    }

    if (duration !== undefined && (typeof duration !== 'number' || duration < 1 || duration > 30)) {
      return NextResponse.json(
        { error: 'duration must be a number between 1 and 30 seconds' },
        { status: 400 },
      );
    }

    // ── Per-app gating check ─────────────────────────────────────────────
    if (appSlug) {
      const safetyConfig = getAppSafetyConfig(appSlug);
      if (safetyConfig.safeMode || !safetyConfig.suggestiveMode) {
        return NextResponse.json(
          {
            capability: 'suggestive_video_generation',
            executed: false,
            error:
              'Suggestive video generation is not enabled for this app. ' +
              'Set safeMode=false and suggestiveMode=true in app settings.',
            gating_required: true,
          },
          { status: 403 },
        );
      }
    }

    // ── Prompt validation and sanitization ──────────────────────────────
    const validation = validateSuggestivePrompt(prompt.trim());
    if (!validation.allowed) {
      return NextResponse.json(
        {
          capability: 'suggestive_video_generation',
          executed: false,
          error: validation.reason ?? 'Prompt rejected by safety filter',
          promptBlocked: true,
        },
        { status: 422 },
      );
    }

    const sanitizedPrompt = validation.sanitized;
    const wasRewritten = sanitizedPrompt !== prompt.trim();
    const finalPrompt = enforceSafeVideoPrefix(sanitizedPrompt);

    // ── Get HuggingFace API key ──────────────────────────────────────────
    const hfProvider = await prisma.aiProvider.findFirst({
      where: { providerKey: 'huggingface', enabled: true },
      select: { apiKey: true, healthStatus: true },
    });

    if (
      !hfProvider?.apiKey ||
      hfProvider.healthStatus === 'error' ||
      hfProvider.healthStatus === 'disabled'
    ) {
      return NextResponse.json(
        {
          capability: 'suggestive_video_generation',
          executed: false,
          error:
            'No video generation provider available. Configure HuggingFace to enable suggestive video generation.',
        },
        { status: 503 },
      );
    }

    const apiKey = hfProvider.apiKey;

    // ── Provider attempt chain ───────────────────────────────────────────
    let videoBase64: string | null = null;
    let usedModel = '';
    let lastError = '';

    for (const modelId of ALLOWED_HF_VIDEO_MODELS) {
      try {
        const res = await fetch(
          `https://api-inference.huggingface.co/models/${modelId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputs: finalPrompt,
              parameters: {
                num_frames: Math.min(Math.round(duration * HF_VIDEO_FRAMES_PER_SECOND), HF_VIDEO_MAX_FRAMES),
                num_inference_steps: 25,
              },
            }),
            signal: AbortSignal.timeout(60_000),
          },
        );

        if (res.ok) {
          const contentType = res.headers.get('content-type') ?? '';
          if (contentType.startsWith('video/') || contentType === 'application/octet-stream') {
            const videoBytes = await res.arrayBuffer();
            videoBase64 = Buffer.from(videoBytes).toString('base64');
            usedModel = modelId;
            break;
          }
        } else if (res.status === 503) {
          // Model loading — try next model
          const responseText = await res.text().catch(() => '');
          lastError = `Model ${modelId} loading (503): ${responseText.slice(0, 200)}`;
          continue;
        } else {
          const errText = await res.text().catch(() => '');
          lastError = `${modelId} failed (${res.status}): ${errText.slice(0, 200)}`;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!videoBase64) {
      return NextResponse.json(
        {
          capability: 'suggestive_video_generation',
          executed: false,
          error:
            lastError ||
            'Video generation failed. The HuggingFace models may be loading. Retry in 30 seconds.',
          retryable: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      capability: 'suggestive_video_generation',
      executed: true,
      videoBase64,
      videoMimeType: 'video/mp4',
      provider: 'huggingface',
      model: usedModel,
      promptUsed: finalPrompt,
      promptRewritten: wasRewritten,
      style,
      duration,
    });
  } catch (err) {
    console.error('[suggestive-video-gen] Unhandled error:', err);
    return NextResponse.json(
      {
        capability: 'suggestive_video_generation',
        executed: false,
        error: 'Internal server error during suggestive video generation',
      },
      { status: 500 },
    );
  }
}
