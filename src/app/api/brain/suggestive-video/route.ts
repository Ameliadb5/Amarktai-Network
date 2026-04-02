import { NextRequest, NextResponse } from 'next/server';
import { getAppSafetyConfig, validateSuggestivePrompt } from '@/lib/content-filter';

/**
 * POST /api/brain/suggestive-video — Suggestive (non-explicit) video planning
 *
 * Generates structured video scene plans for fashion, lifestyle, beach,
 * and model-style content. No nudity. No explicit acts. No minors.
 *
 * This endpoint provides **video planning** capabilities only.
 * It does NOT generate actual video files. Video generation (e.g. via Gemini
 * Veo, Runway, Pika) is not yet integrated — the capability engine truthfully
 * reports suggestive_video_generation as unavailable (no BACKEND_ROUTE_EXISTS
 * entry). Only planning (scene decomposition) is available here.
 *
 * GATING:
 *   - App must have safeMode=false AND suggestiveMode=true
 *   - All prompts pass through validateSuggestivePrompt() before processing
 *
 * Accepts JSON body:
 *   - script (string, required) — description or script for the video
 *   - appSlug (string, optional) — app identifier for per-app gating
 *   - style (string, optional) — 'fashion' | 'beach' | 'gym' | 'lifestyle' | 'cinematic' (default: 'fashion')
 *   - duration (number, optional) — desired duration in seconds (default: 15)
 *   - aspectRatio (string, optional) — '9:16' | '16:9' | '1:1' (default: '9:16' — vertical/reel)
 *
 * Returns:
 *   { capability, executed, scenes, params, generation_available: false }
 */

interface SuggestiveVideoScene {
  sceneNumber: number;
  description: string;
  duration: number;
  visualDirection: string;
  clothingNotes?: string;
  cameraAngle?: string;
  audioDirection?: string;
  textOverlay?: string;
}

const VALID_STYLES = ['fashion', 'beach', 'gym', 'lifestyle', 'cinematic'] as const;
type SuggestiveStyle = (typeof VALID_STYLES)[number];

const VALID_ASPECT_RATIOS = ['9:16', '16:9', '1:1'] as const;

/** Number of seconds per scene for the planning decomposition. */
const SECONDS_PER_SCENE = 5;

function buildSuggestiveScenes(
  script: string,
  duration: number,
  style: SuggestiveStyle,
): SuggestiveVideoScene[] {
  const sceneCount = Math.max(1, Math.min(6, Math.ceil(duration / SECONDS_PER_SCENE)));
  const sceneDuration = Math.round(duration / sceneCount);
  const sentences = script.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const visualDirections: Record<SuggestiveStyle, string> = {
    fashion: 'Clean, well-lit studio shot with neutral background; model in elegant clothing',
    beach: 'Golden-hour beach setting, natural light, swimwear or casual summer attire',
    gym: 'Modern gym interior, dynamic lighting, athletic wear, confident pose',
    lifestyle: 'Lifestyle setting (café, city street, or home), candid pose, fashionable attire',
    cinematic: 'Cinematic framing, dramatic lighting, fashion-forward styling, editorial look',
  };

  const clothingNotesByStyle: Record<SuggestiveStyle, string> = {
    fashion: 'High-fashion clothing: designer dress, blazer, or coordinated outfit',
    beach: 'Swimwear or cover-up: one-piece, bikini top with shorts, or sarong',
    gym: 'Athletic wear: sports bra with leggings, or fitted gym outfit',
    lifestyle: 'Casual chic: jeans, crop top, or summer dress',
    cinematic: 'Editorial fashion: bold prints, tailored cuts, or monochromatic look',
  };

  const cameraAngles = [
    'Full-body wide shot',
    'Medium shot (waist up)',
    'Close-up (face and shoulders)',
    'Low-angle body shot',
    'Over-the-shoulder profile',
    'Tracking shot — subject walks toward camera',
  ];

  const scenes: SuggestiveVideoScene[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const sentenceSlice = sentences.slice(
      Math.floor((i / sceneCount) * sentences.length),
      Math.floor(((i + 1) / sceneCount) * sentences.length),
    );
    const sceneDesc =
      sentenceSlice.join('. ').trim() || `Scene ${i + 1}: ${style} sequence`;

    scenes.push({
      sceneNumber: i + 1,
      description: sceneDesc,
      duration:
        i === sceneCount - 1 ? duration - sceneDuration * (sceneCount - 1) : sceneDuration,
      visualDirection: visualDirections[style],
      clothingNotes: clothingNotesByStyle[style],
      cameraAngle: cameraAngles[i % cameraAngles.length],
      audioDirection:
        i === 0
          ? 'Fade in upbeat background music'
          : i === sceneCount - 1
            ? 'Music builds to climax and fades out'
            : undefined,
      textOverlay:
        style === 'fashion' || style === 'lifestyle'
          ? sceneDesc.slice(0, 40)
          : undefined,
    });
  }

  return scenes;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      appSlug,
      style = 'fashion',
      duration = 15,
      aspectRatio = '9:16',
      scenes: providedScenes,
    } = body as {
      script?: string;
      appSlug?: string;
      style?: string;
      duration?: number;
      aspectRatio?: string;
      scenes?: SuggestiveVideoScene[];
    };

    // ── Input validation ────────────────────────────────────────────────
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'script is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    if (duration < 1 || duration > 120) {
      return NextResponse.json(
        { error: 'duration must be between 1 and 120 seconds' },
        { status: 400 },
      );
    }

    if (!VALID_STYLES.includes(style as SuggestiveStyle)) {
      return NextResponse.json(
        { error: `style must be one of: ${VALID_STYLES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!VALID_ASPECT_RATIOS.includes(aspectRatio as typeof VALID_ASPECT_RATIOS[number])) {
      return NextResponse.json(
        { error: `aspectRatio must be one of: ${VALID_ASPECT_RATIOS.join(', ')}` },
        { status: 400 },
      );
    }

    // ── Per-app gating check ────────────────────────────────────────────
    if (appSlug) {
      const safetyConfig = getAppSafetyConfig(appSlug);
      if (safetyConfig.safeMode || !safetyConfig.suggestiveMode) {
        return NextResponse.json(
          {
            capability: 'suggestive_video_planning',
            executed: false,
            error:
              'Suggestive video planning is not enabled for this app. ' +
              'Set safeMode=false and suggestiveMode=true in app settings.',
            gating_required: true,
          },
          { status: 403 },
        );
      }
    }

    // ── Prompt safety validation ────────────────────────────────────────
    const validation = validateSuggestivePrompt(script.trim());
    if (!validation.allowed) {
      return NextResponse.json(
        {
          capability: 'suggestive_video_planning',
          executed: false,
          error: validation.reason ?? 'Script blocked by safety filter.',
          prompt_blocked: true,
        },
        { status: 422 },
      );
    }

    // ── Scene decomposition ─────────────────────────────────────────────
    const scenes =
      Array.isArray(providedScenes) && providedScenes.length > 0
        ? providedScenes
        : buildSuggestiveScenes(validation.sanitized, duration, style as SuggestiveStyle);

    return NextResponse.json({
      capability: 'suggestive_video_planning',
      executed: true,
      fallback_used: false,
      message:
        'Suggestive video planning complete. Scenes decomposed from script. ' +
        'Note: actual video generation (rendering) is not yet available — ' +
        'no provider integration is wired for video generation.',
      generation_available: false,
      generation_blocker:
        'No video generation provider SDK is integrated. ' +
        'Candidates: Gemini Veo 2, Runway Gen-3, Pika, Stability AI Stable Video Diffusion. ' +
        'Provider API key alone is not sufficient; a rendering pipeline must be implemented.',
      params: {
        script: validation.sanitized.slice(0, 200),
        style,
        duration,
        aspectRatio,
        content_type: 'suggestive_non_explicit',
      },
      scenes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
