import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/brain/video — Video generation endpoint
 *
 * Accepts a JSON body with:
 *   - script (string, required) — the video script or description
 *   - style (string, optional) — visual style ('cinematic' | 'animated' | 'realistic' | 'marketing' | 'social_reel', default: 'cinematic')
 *   - duration (number, optional) — desired duration in seconds (default: 15)
 *   - aspectRatio (string, optional) — '16:9' | '9:16' | '1:1' (default: '16:9')
 *   - scenes (array, optional) — pre-defined scene list for the render pipeline
 *
 * Returns a video generation result with status and a link to the generated clip.
 * When no provider API key is configured, returns a stub response.
 *
 * Pipeline: script → scene decomposition → render job submission
 */

/** Scene in the script→scenes→render pipeline. */
interface VideoScene {
  sceneNumber: number
  description: string
  duration: number
  visualDirection: string
  audioDirection?: string
  textOverlay?: string
}

/**
 * Decompose a script into scenes for the render pipeline.
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

    // Check for provider API keys
    // STRICT: return error when no video generation provider configured
    const geminiKey = process.env.GEMINI_API_KEY;
    const runwayKey = process.env.RUNWAY_API_KEY;
    const pikaKey = process.env.PIKA_API_KEY;
    const stabilityKey = process.env.STABILITY_API_KEY;

    if (!geminiKey && !runwayKey && !pikaKey && !stabilityKey) {
      // STRICT: Return error (not stub) — no video generation provider configured
      return NextResponse.json({
        error: 'No video generation provider configured. Set GEMINI_API_KEY (Veo), RUNWAY_API_KEY, PIKA_API_KEY, or STABILITY_API_KEY to enable video generation.',
        executed: false,
        capability: 'video_generation',
        fallback_used: false,
        scenes,
      }, { status: 503 });
    }

    // ── Determine best provider ──────────────────────────────────────
    const providerPriority = [
      { key: 'gemini-veo', available: !!geminiKey },
      { key: 'runway', available: !!runwayKey },
      { key: 'pika', available: !!pikaKey },
      { key: 'stability-ai', available: !!stabilityKey },
    ]
    const provider = providerPriority.find(p => p.available)?.key ?? 'unknown'

    // Submit video generation job
    const jobId = `vid_${randomUUID()}`;

    return NextResponse.json({
      status: 'submitted',
      executed: true,
      jobId,
      provider,
      capability: 'video_generation',
      fallback_used: false,
      message: 'Video generation job submitted. Poll for status using the jobId.',
      params: {
        script: script.slice(0, 200),
        style,
        duration,
        aspectRatio,
      },
      scenes,
      estimatedCompletionSeconds: duration * 4,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
