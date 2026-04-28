import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey } from '@/lib/brain';

/**
 * POST /api/brain/stt — Speech-to-Text endpoint
 *
 * Multi-provider support:
 *   - Groq STT (low-cost, fast — whisper-large-v3 / distil-whisper-large-v3-en / whisper-large-v3-turbo)
 *   - OpenAI STT (premium — whisper-1)
 *   - Gemini STT (premium multimodal — gemini-2.0-flash-live-001)
 *   - Hugging Face STT (free fallback — openai/whisper-large-v3 / openai/whisper-small)
 *
 * API keys are resolved from the DB vault first, then env var fallback.
 *
 * Accepts multipart/form-data with:
 *   - file (audio file, required) — audio to transcribe
 *   - model (string, optional) — Whisper model (default: auto-selected by provider)
 *   - language (string, optional) — ISO language code
 *   - provider (string, optional) — 'groq' | 'openai' | 'gemini' | 'huggingface' | 'auto' (default: 'auto')
 *
 * Returns:
 *   { transcript, model, language, provider, executed: true }
 *   or { error, executed: false } on failure.
 *
 * STRICT RULE: Never fakes success. Returns error if no provider configured.
 */

export async function POST(request: NextRequest) {
  const unavailable = (
    reason: 'provider_not_configured' | 'all_providers_unavailable' | 'invalid_request' | 'transcription_failed',
    error: string,
    status: number,
    provider?: string,
  ) => NextResponse.json(
    {
      error,
      executed: false,
      capability: 'voice_input',
      available: false,
      reason,
      ...(provider ? { provider } : {}),
    },
    { status },
  );

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return unavailable('invalid_request', 'Content-Type must be multipart/form-data with an audio file', 400);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return unavailable('invalid_request', 'An audio file is required in the "file" field', 400);
    }

    const requestedModel = formData.get('model') as string | null;
    const language = formData.get('language') as string | null;
    const requestedProvider = (formData.get('provider') as string | null) ?? 'auto';

    // Resolve API keys from DB vault (with env fallback)
    const groqKey  = await getVaultApiKey('groq');
    const openaiKey = await getVaultApiKey('openai');
    const geminiKey = await getVaultApiKey('gemini');
    const hfKey    = await getVaultApiKey('huggingface');
    const qwenKey  = await getVaultApiKey('qwen');

    // ── GenX STT first attempt ────────────────────────────────────────────────
    // GenX STT accepts audio as base64 via the media generate endpoint.
    if (requestedProvider === 'auto' || requestedProvider === 'genx') {
      try {
        const { callGenXMedia, GENX_STT_MODELS } = await import('@/lib/genx-client');
        const genxModel = requestedModel ?? GENX_STT_MODELS[0];
        const audioBytes = await file.arrayBuffer();
        const audioBase64 = Buffer.from(audioBytes).toString('base64');
        const mimeType = (file as File).type || 'audio/mpeg';
        const genxResult = await callGenXMedia({
          model: genxModel,
          prompt: audioBase64,
          type: 'audio',
          metadata: { task: 'transcribe', mimeType, language: language ?? undefined },
        });
        if (genxResult.success && genxResult.url) {
          // GenX STT returns the transcript text in the url field for text-mode outputs
          const transcript = genxResult.url;
          return NextResponse.json({
            transcript,
            model: genxResult.model,
            language,
            provider: 'genx',
            executed: true,
            fallback_used: false,
            capability: 'voice_input',
          });
        }
        // GenX STT failed — fall through to other providers
      } catch { /* fall through */ }
      if (requestedProvider === 'genx') {
        return unavailable('provider_not_configured', 'GenX STT requested but GenX is not configured or returned no transcript. Add GENX_API_URL/GENX_API_KEY.', 503, 'genx');
      }
    }

    // Determine provider
    let provider: 'groq' | 'openai' | 'gemini' | 'huggingface' | 'qwen';
    if (requestedProvider === 'groq') {
      if (!groqKey) {
        return unavailable('provider_not_configured', 'Groq STT requested but no Groq API key is configured. Add it via Admin → AI Providers.', 503, 'groq');
      }
      provider = 'groq';
    } else if (requestedProvider === 'openai') {
      if (!openaiKey) {
        return unavailable('provider_not_configured', 'OpenAI STT requested but no OpenAI API key is configured. Add it via Admin → AI Providers.', 503, 'openai');
      }
      provider = 'openai';
    } else if (requestedProvider === 'gemini') {
      if (!geminiKey) {
        return unavailable('provider_not_configured', 'Gemini STT requested but no Gemini API key is configured. Add it via Admin → AI Providers.', 503, 'gemini');
      }
      provider = 'gemini';
    } else if (requestedProvider === 'huggingface') {
      if (!hfKey) {
        return unavailable('provider_not_configured', 'Hugging Face STT requested but no Hugging Face API key is configured. Add it via Admin → AI Providers.', 503, 'huggingface');
      }
      provider = 'huggingface';
    } else if (requestedProvider === 'qwen') {
      if (!qwenKey) {
        return unavailable('provider_not_configured', 'Qwen STT requested but no Qwen/DashScope API key is configured. Add it via Admin → AI Providers.', 503, 'qwen');
      }
      provider = 'qwen';
    } else {
      // Auto: OpenAI is the golden-path baseline. Groq is used as fallback when
      // OpenAI is not configured. Gemini, Qwen, and Hugging Face are last-resort options.
      if (openaiKey) {
        provider = 'openai';
      } else if (groqKey) {
        provider = 'groq';
      } else if (geminiKey) {
        provider = 'gemini';
      } else if (qwenKey) {
        provider = 'qwen';
      } else if (hfKey) {
        provider = 'huggingface';
      } else {
        return unavailable(
          'all_providers_unavailable',
          'Voice input is currently unavailable: no STT provider is configured. Add an API key via Admin → AI Providers (OpenAI, Groq, Gemini, Qwen, or Hugging Face).',
          503,
        );
      }
    }

    // Select model
    const model = requestedModel
      ?? (provider === 'groq' ? 'whisper-large-v3' : provider === 'gemini' ? 'gemini-2.0-flash-live-001' : provider === 'qwen' ? 'qwen-audio-turbo' : provider === 'huggingface' ? 'openai/whisper-large-v3' : 'whisper-1');

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
          return unavailable('transcription_failed', `Groq transcription failed: ${err}`, response.status, 'groq');
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

    if (provider === 'gemini') {
      // Gemini STT via Google Generative Language API
      const audioBytes = Buffer.from(await file.arrayBuffer());
      const audioBase64 = audioBytes.toString('base64');
      const mimeType = (file as File).type || 'audio/webm';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: audioBase64 } },
                  { text: language ? `Transcribe this audio. The language is ${language}.` : 'Transcribe this audio accurately.' },
                ],
              },
            ],
            generationConfig: { temperature: 0, maxOutputTokens: 8192 },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        return unavailable('transcription_failed', `Gemini transcription failed: ${err}`, response.status, 'gemini');
      }

      const result = await response.json();
      const transcript = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return NextResponse.json({
        transcript,
        model,
        language,
        provider: 'gemini',
        executed: true,
        fallback_used: false,
        capability: 'voice_input',
      });
    }

    if (provider === 'huggingface') {
      // Hugging Face Inference API — free fallback STT
      const ALLOWED_HF_STT_MODELS = ['openai/whisper-large-v3', 'openai/whisper-small', 'openai/whisper-base'] as const;
      const matched = ALLOWED_HF_STT_MODELS.find((m) => m === model);
      const hfModel = matched ?? 'openai/whisper-large-v3';
      const audioBytes = Buffer.from(await file.arrayBuffer());

      const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfKey}`,
          'Content-Type': (file as File).type || 'audio/webm',
        },
        body: audioBytes,
      });

      if (!response.ok) {
        const err = await response.text();
        return unavailable('transcription_failed', `Hugging Face transcription failed: ${err}`, response.status, 'huggingface');
      }

      const result = await response.json();
      return NextResponse.json({
        transcript: result.text ?? '',
        model: hfModel,
        language,
        provider: 'huggingface',
        executed: true,
        fallback_used: true,
        capability: 'voice_input',
      });
    }

    if (provider === 'qwen') {
      // Qwen Audio (qwen-audio-turbo / qwen-audio-chat) via DashScope compatible-mode.
      // The model accepts audio inline_data as base64 in the messages content array.
      const audioBytes = Buffer.from(await file.arrayBuffer());
      const audioBase64 = audioBytes.toString('base64');
      const mimeType = (file as File).type || 'audio/webm';
      const transcribeInstruction = language
        ? `Transcribe this audio accurately. The spoken language is ${language}. Output only the transcribed text.`
        : 'Transcribe this audio accurately. Output only the transcribed text.';

      const response = await fetch(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qwenKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'audio_url',
                    audio_url: { url: `data:${mimeType};base64,${audioBase64}` },
                  },
                  { type: 'text', text: transcribeInstruction },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        return unavailable('transcription_failed', `Qwen Audio transcription failed: ${err}`, response.status, 'qwen');
      }

      const result = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const transcript = result?.choices?.[0]?.message?.content ?? '';
      return NextResponse.json({
        transcript,
        model,
        language,
        provider: 'qwen',
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
      return unavailable('transcription_failed', `OpenAI transcription failed: ${err}`, response.status, 'openai');
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
    return unavailable('transcription_failed', `Internal server error: ${String(err)}`, 500);
  }
}
