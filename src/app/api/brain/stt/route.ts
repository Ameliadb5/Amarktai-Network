import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/stt — Speech-to-Text endpoint
 *
 * Accepts multipart/form-data with:
 *   - file (audio file, required) — audio to transcribe
 *   - model (string, optional) — Whisper model (default: 'whisper-1')
 *   - language (string, optional) — ISO language code
 *
 * Returns the transcript JSON when the OpenAI API key is configured,
 * or a JSON stub indicating the endpoint is available.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data with an audio file' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'An audio file is required in the "file" field' },
        { status: 400 },
      );
    }

    const model = (formData.get('model') as string) || 'whisper-1';
    const language = formData.get('language') as string | null;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        status: 'stub',
        message: 'STT endpoint is available but OPENAI_API_KEY is not configured.',
        params: { model, language, fileSize: file.size },
      });
    }

    // Forward to OpenAI Whisper API
    const upstream = new FormData();
    upstream.append('file', file, 'audio.webm');
    upstream.append('model', model);
    if (language) upstream.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: 'Transcription failed', detail: err },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json({ transcript: result.text, model, language });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 },
    );
  }
}
