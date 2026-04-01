import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/tts — Text-to-Speech endpoint
 *
 * Dual-provider support:
 *   - Groq TTS (low-cost, fast — playai-tts / playai-tts-arabic)
 *   - OpenAI TTS (premium — tts-1 / tts-1-hd)
 *
 * Accepts a JSON body with:
 *   - text (string, required) — the text to synthesise
 *   - voiceId (string, optional) — voice identifier (default: provider-specific)
 *   - model (string, optional) — TTS model (default: auto-selected by provider)
 *   - speed (number, optional) — playback speed 0.25–4.0 (default: 1.0)
 *   - provider (string, optional) — 'groq' | 'openai' | 'auto' (default: 'auto')
 *
 * Returns audio/mpeg stream on success.
 *
 * STRICT RULE: Never fakes success. Returns error if no provider configured.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, model: requestedModel, speed = 1.0, provider: requestedProvider = 'auto' } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'text is required and must be a non-empty string', executed: false },
        { status: 400 },
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Determine provider
    let provider: 'groq' | 'openai';
    if (requestedProvider === 'groq') {
      if (!groqKey) {
        return NextResponse.json(
          { error: 'Groq TTS requested but GROQ_API_KEY is not configured.', executed: false, provider: 'groq', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'groq';
    } else if (requestedProvider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI TTS requested but OPENAI_API_KEY is not configured.', executed: false, provider: 'openai', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'openai';
    } else {
      // Auto: prefer Groq (low-cost, fast), fallback to OpenAI
      if (groqKey) {
        provider = 'groq';
      } else if (openaiKey) {
        provider = 'openai';
      } else {
        return NextResponse.json(
          { error: 'No TTS provider configured. Set GROQ_API_KEY (low cost) or OPENAI_API_KEY (premium) to enable voice output.', executed: false, capability: 'voice_output' },
          { status: 503 },
        );
      }
    }

    if (provider === 'groq') {
      // Groq TTS via OpenAI-compatible endpoint
      const model = requestedModel ?? 'playai-tts';
      const voice = voiceId ?? 'Arista-PlayAI';

      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json(
          { error: 'Groq TTS generation failed', detail: err, executed: false, provider: 'groq', model },
          { status: response.status },
        );
      }

      const audioBuffer = await response.arrayBuffer();
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'X-Provider': 'groq',
          'X-Model': model,
        },
      });
    }

    // OpenAI TTS (premium path)
    const model = requestedModel ?? 'tts-1';
    const voice = voiceId ?? 'alloy';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: 'OpenAI TTS generation failed', detail: err, executed: false, provider: 'openai', model },
        { status: response.status },
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'X-Provider': 'openai',
        'X-Model': model,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
