import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/video — Video planning & scene decomposition endpoint
 *
 * This endpoint provides **video planning** capabilities:
 *   - Script → scene decomposition
 *   - Visual direction per scene
 *   - Audio direction per scene
 *   - Production metadata (style, duration, aspect ratio)
 *
 * It does **NOT** generate actual video files. Video generation
 * (e.g. via Gemini Veo, Runway, Pika, Stability AI) is not yet
 * integrated — no provider SDK processes the scenes into rendered
 * video. The capability engine truthfully reports video_generation
 * as unavailable.
 *
 * Accepts a JSON body with:
 *   - script (string, required) — the video script or description
 *   - style (string, optional) — visual style ('cinematic' | 'animated' | 'realistic' | 'marketing' | 'social_reel', default: 'cinematic')
 *   - duration (number, optional) — desired duration in seconds (default: 15)
 *   - aspectRatio (string, optional) — '16:9' | '9:16' | '1:1' (default: '16:9')
 *   - scenes (array, optional) — pre-defined scene list
 *
 * Returns:
 *   { capability: 'video_planning', executed: true, scenes, params }
 *
 * Pipeline: script → scene decomposition → structured planning output
 */

/** Scene in the script→scenes planning pipeline. */
interface VideoScene {
  sceneNumber: number
  description: string
  duration: number
  visualDirection: string
  audioDirection?: string
  textOverlay?: string
}

/**
 * Decompose a script into scenes for the planning pipeline.
 * Returns 1-6 scenes depending on total duration.
 */
function decomposeScriptToScenes(script: string, duration: number, style: string): VideoScene[] {
  const sceneCount = Math.max(1, Math.min(6, Math.ceil(duration / 5)))
  const sceneDuration = Math.round(duration / sceneCount)
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0)

  const scenes: VideoScene[] = []
  for (let i = 0; i < sceneCount; i++) {
    const sentenceSlice = sentences.slice(
      Math.floor((i / sceneCount) * sentences.length),
      Math.floor(((i + 1) / sceneCount) * sentences.length),
    )
    const sceneDesc = sentenceSlice.join('. ').trim() || `Scene ${i + 1} of the ${style} video`

    const visualDirections: Record<string, string> = {
      cinematic: 'Wide establishing shot with dramatic lighting, shallow depth of field',
      animated: 'Smooth motion graphics with bold colours and dynamic transitions',
      realistic: 'Natural lighting, documentary-style framing, authentic textures',
      marketing: 'Product-focused hero shot, brand colours, clean typography overlay',
      social_reel: 'Vertical frame, fast cuts, trend-aligned transitions, bold text overlays',
    }

    scenes.push({
      sceneNumber: i + 1,
      description: sceneDesc,
      duration: i === sceneCount - 1 ? duration - sceneDuration * (sceneCount - 1) : sceneDuration,
      visualDirection: visualDirections[style] || visualDirections.cinematic,
      audioDirection: i === 0 ? 'Fade in background music' : i === sceneCount - 1 ? 'Music crescendo and fade out' : undefined,
      textOverlay: style === 'social_reel' || style === 'marketing' ? sceneDesc.slice(0, 50) : undefined,
    })
  }

  return scenes
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      style = 'cinematic',
      duration = 15,
      aspectRatio = '16:9',
      scenes: providedScenes,
    } = body;

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

    const validStyles = ['cinematic', 'animated', 'realistic', 'marketing', 'social_reel'];
    if (!validStyles.includes(style)) {
      return NextResponse.json(
        { error: `style must be one of: ${validStyles.join(', ')}` },
        { status: 400 },
      );
    }

    const validAspectRatios = ['16:9', '9:16', '1:1'];
    if (!validAspectRatios.includes(aspectRatio)) {
      return NextResponse.json(
        { error: `aspectRatio must be one of: ${validAspectRatios.join(', ')}` },
        { status: 400 },
      );
    }

    // ── Script → Scenes pipeline ──────────────────────────────────────
    const scenes = Array.isArray(providedScenes) && providedScenes.length > 0
      ? providedScenes as VideoScene[]
      : decomposeScriptToScenes(script, duration, style)

    // ── Return planning output ────────────────────────────────────────
    // This is video PLANNING, not generation. The scenes are a structured
    // storyboard — no actual video file is rendered.
    return NextResponse.json({
      capability: 'video_planning',
      executed: true,
      fallback_used: false,
      message: 'Video planning complete. Scenes decomposed from script. Note: actual video generation (rendering) is not yet available — no provider integration is wired.',
      generation_available: false,
      generation_blocker: 'No video generation provider SDK is integrated. Candidates: Gemini Veo 2, Runway Gen-3, Pika, Stability AI Stable Video Diffusion. Provider API key alone is not sufficient — the rendering pipeline must be implemented.',
      params: {
        script: script.slice(0, 200),
        style,
        duration,
        aspectRatio,
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
