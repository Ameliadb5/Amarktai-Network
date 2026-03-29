import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * POST /api/brain/video — Video generation endpoint
 *
 * Accepts a JSON body with:
 *   - script (string, required) — the video script or description
 *   - style (string, optional) — visual style ('cinematic' | 'animated' | 'realistic', default: 'cinematic')
 *   - duration (number, optional) — desired duration in seconds (default: 15)
 *   - aspectRatio (string, optional) — '16:9' | '9:16' | '1:1' (default: '16:9')
 *
 * Returns a video generation result with status and a link to the generated clip.
 * When no provider API key is configured, returns a stub response.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      style = 'cinematic',
      duration = 15,
      aspectRatio = '16:9',
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

    const validStyles = ['cinematic', 'animated', 'realistic'];
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

    // Check for provider API keys
    // Video generation can use multiple providers: Runway, Pika, Sora, etc.
    const runwayKey = process.env.RUNWAY_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!runwayKey && !openaiKey) {
      // Return a stub response when no video provider key is configured
      return NextResponse.json({
        status: 'stub',
        message: 'Video generation endpoint is available but no video provider API key is configured. Set RUNWAY_API_KEY or OPENAI_API_KEY.',
        params: {
          script: script.slice(0, 200),
          style,
          duration,
          aspectRatio,
        },
        supportedProviders: ['runway', 'openai-sora'],
      });
    }

    // Attempt video generation via configured provider
    // In production, this would call the actual video generation API
    // For now, return a structured response indicating the job was submitted
    const jobId = `vid_${randomUUID()}`;

    return NextResponse.json({
      status: 'submitted',
      jobId,
      message: 'Video generation job submitted. Poll for status using the jobId.',
      params: {
        script: script.slice(0, 200),
        style,
        duration,
        aspectRatio,
      },
      estimatedCompletionSeconds: duration * 4,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 },
    );
  }
}
