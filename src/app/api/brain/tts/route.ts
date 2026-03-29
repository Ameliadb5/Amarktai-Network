import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/tts — Text-to-Speech endpoint
 *
 * Accepts a JSON body with:
 *   - text (string, required) — the text to synthesise
 *   - voiceId (string, optional) — voice identifier (default: 'alloy')
 *   - model (string, optional) — TTS model (default: 'tts-1')
 *   - speed (number, optional) — playback speed 0.25–4.0 (default: 1.0)
 *
 * Returns audio/mpeg stream when the OpenAI API key is configured,
 * or a JSON stub indicating the endpoint is available.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId = 'alloy', model = 'tts-1', speed = 1.0 } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'text is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Return a stub response when no API key is configured
      return NextResponse.json({
        status: 'stub',
        message: 'TTS endpoint is available but OPENAI_API_KEY is not configured.',
        params: { text: text.slice(0, 100), voiceId, model, speed },
      });
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: voiceId,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: 'TTS generation failed', detail: err },
        { status: response.status },
      );
    }

    // Stream the audio back
    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 },
    );
  }
}
