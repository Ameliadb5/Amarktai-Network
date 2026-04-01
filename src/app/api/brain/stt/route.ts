import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/stt — Speech-to-Text endpoint
 *
 * Dual-provider support:
 *   - Groq STT (low-cost, fast — whisper-large-v3 / distil-whisper-large-v3-en)
 *   - OpenAI STT (premium — whisper-1)
 *
 * Accepts multipart/form-data with:
 *   - file (audio file, required) — audio to transcribe
 *   - model (string, optional) — Whisper model (default: auto-selected by provider)
 *   - language (string, optional) — ISO language code
 *   - provider (string, optional) — 'groq' | 'openai' | 'auto' (default: 'auto')
 *
 * Returns:
 *   { transcript, model, language, provider, executed: true }
 *   or { error, executed: false } on failure.
 *
 * STRICT RULE: Never fakes success. Returns error if no provider configured.
 */

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data with an audio file', executed: false },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'An audio file is required in the "file" field', executed: false },
        { status: 400 },
      );
    }

    const requestedModel = formData.get('model') as string | null;
    const language = formData.get('language') as string | null;
    const requestedProvider = (formData.get('provider') as string | null) ?? 'auto';

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Determine provider
    let provider: 'groq' | 'openai';
    if (requestedProvider === 'groq') {
      if (!groqKey) {
        return NextResponse.json(
          { error: 'Groq STT requested but GROQ_API_KEY is not configured.', executed: false, provider: 'groq', capability: 'voice_input' },
          { status: 503 },
        );
      }
      provider = 'groq';
    } else if (requestedProvider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI STT requested but OPENAI_API_KEY is not configured.', executed: false, provider: 'openai', capability: 'voice_input' },
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
          { error: 'No STT provider configured. Set GROQ_API_KEY (low cost) or OPENAI_API_KEY (premium) to enable voice input.', executed: false, capability: 'voice_input' },
          { status: 503 },
        );
      }
    }

    // Select model
    const model = requestedModel
      ?? (provider === 'groq' ? 'whisper-large-v3' : 'whisper-1');

    if (provider === 'groq') {
      // Groq STT via OpenAI-compatible endpoint
      const upstream = new FormData();
      upstream.append('file', file, 'audio.webm');
      upstream.append('model', model);
      if (language) upstream.append('language', language);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: upstream,
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json(
          { error: 'Groq transcription failed', detail: err, executed: false, provider: 'groq', model },
          { status: response.status },
        );
      }

      const result = await response.json();
      return NextResponse.json({
        transcript: result.text,
        model,
        language,
        provider: 'groq',
        executed: true,
        fallback_used: false,
        capability: 'voice_input',
      });
    }

    // OpenAI STT (premium path)
    const upstream = new FormData();
    upstream.append('file', file, 'audio.webm');
    upstream.append('model', model);
    if (language) upstream.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: upstream,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: 'OpenAI transcription failed', detail: err, executed: false, provider: 'openai', model },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json({
      transcript: result.text,
      model,
      language,
      provider: 'openai',
      executed: true,
      fallback_used: false,
      capability: 'voice_input',
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
