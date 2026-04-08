import { NextRequest, NextResponse } from 'next/server';
import { callProvider, getVaultApiKey } from '@/lib/brain';

/**
 * POST /api/brain/video — Video planning & scene decomposition endpoint
 *
 * This endpoint provides **video planning** capabilities:
 *   - Script → scene decomposition (via real LLM when provider available)
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
 *   { capability: 'video_planning', executed: boolean, ai_generated: boolean, scenes, params }
 *
 * Pipeline: script → LLM scene decomposition (fallback: rule-based) → structured planning output
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

    // ── Pre-defined scenes provided ───────────────────────────────────
    if (Array.isArray(providedScenes) && providedScenes.length > 0) {
      return NextResponse.json({
        capability: 'video_planning',
        executed: true,
        ai_generated: false,
        message: 'Video planning complete using provided scenes.',
        generation_available: false,
        generation_blocker: 'No video generation provider SDK is integrated. Candidates: Gemini Veo 2, Runway Gen-3, Pika, Stability AI Stable Video Diffusion.',
        params: { script: script.slice(0, 200), style, duration, aspectRatio },
        scenes: providedScenes as VideoScene[],
      });
    }

    // ── Attempt real LLM scene decomposition ─────────────────────────
    // Prefer OpenAI (gpt-4o-mini for speed/cost), fall back to Gemini, then template.
    const sceneCount = Math.max(1, Math.min(6, Math.ceil(duration / 5)));
    const llmPrompt =
      `You are a professional video director. Decompose the following video script into exactly ${sceneCount} scene(s) for a ${duration}-second ${style} video (aspect ratio: ${aspectRatio}).

Script:
"""
${script.slice(0, 2000)}
"""

Return ONLY a valid JSON array with ${sceneCount} objects. Each object MUST have:
- "sceneNumber" (integer, 1-based)
- "description" (string, max 150 chars — what is visually shown in this scene)
- "duration" (number in seconds; all durations must sum to ${duration})
- "visualDirection" (string, 1 sentence — camera angle, lighting, motion style for ${style})
- "audioDirection" (string or null — music/sound for this scene)
- "textOverlay" (string or null — on-screen text for this scene, null if not needed)

No markdown, no explanation — raw JSON array only.`;

    let aiScenes: VideoScene[] | null = null;
    let aiProvider: string | null = null;
    let aiModel: string | null = null;

    // Try OpenAI
    const openaiKey = await getVaultApiKey('openai');
    if (openaiKey) {
      try {
        const aiResult = await callProvider('openai', 'gpt-4o-mini', llmPrompt);
        if (aiResult.ok && aiResult.output) {
          const cleaned = aiResult.output.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
          const parsed = JSON.parse(cleaned) as VideoScene[];
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sceneNumber) {
            aiScenes = parsed;
            aiProvider = 'openai';
            aiModel = 'gpt-4o-mini';
          }
        }
      } catch {
        // OpenAI call failed — try Gemini
      }
    }

    // Try Gemini if OpenAI failed
    if (!aiScenes) {
      const geminiKey = await getVaultApiKey('gemini');
      if (geminiKey) {
        try {
          const aiResult = await callProvider('gemini', 'gemini-2.0-flash', llmPrompt);
          if (aiResult.ok && aiResult.output) {
            const cleaned = aiResult.output.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
            const parsed = JSON.parse(cleaned) as VideoScene[];
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sceneNumber) {
              aiScenes = parsed;
              aiProvider = 'gemini';
              aiModel = 'gemini-2.0-flash';
            }
          }
        } catch {
          // Gemini call failed — fall through to template
        }
      }
    }

    // ── Fallback: rule-based template decomposition ───────────────────
    const scenes: VideoScene[] = aiScenes ?? decomposeScriptToScenes(script, duration, style);
    const aiGenerated = aiScenes !== null;

    return NextResponse.json({
      capability: 'video_planning',
      executed: true,
      ai_generated: aiGenerated,
      ai_provider: aiProvider,
      ai_model: aiModel,
      message: aiGenerated
        ? `Video planning complete. ${sceneCount} scenes generated by ${aiProvider}/${aiModel}.`
        : 'Video planning complete using rule-based scene decomposition (no AI provider configured). Add an OpenAI or Gemini key for AI-generated scene breakdowns.',
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
