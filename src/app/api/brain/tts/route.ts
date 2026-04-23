import { NextRequest, NextResponse } from 'next/server';
import { getVaultApiKey } from '@/lib/brain';
import { buildAffectiveVoiceConfig, type TTSProvider, type AffectiveVoiceConfig } from '@/lib/ssml-voice';
import { detectEmotions } from '@/lib/emotion-engine';
import { recordUsage } from '@/lib/usage-meter';
import { estimateCostUsd } from '@/lib/budget-tracker';
import { saveMemory } from '@/lib/memory';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/brain/tts — Text-to-Speech endpoint
 *
 * Multi-provider support:
 *   - Groq TTS (low-cost, fast — playai-tts / playai-tts-arabic)
 *   - OpenAI TTS (premium — tts-1 / tts-1-hd)
 *   - Gemini TTS (premium multimodal — gemini-2.5-flash-preview-tts)
 *   - HuggingFace TTS (free fallback — facebook/mms-tts-eng / facebook/mms-tts-fra)
 *
 * Emotion-aware voice: When `emotionAware` is true (default: false), the
 * endpoint runs the Emotion Engine on the input text and adapts voice/speed
 * based on detected emotion. For Gemini, SSML prosody markup is generated.
 *
 * API keys are resolved from the DB vault first, then env var fallback.
 *
 * Accepts a JSON body with:
 *   - text (string, required) — the text to synthesise
 *   - voiceId (string, optional) — voice identifier (default: provider-specific)
 *   - gender (string, optional) — 'male' | 'female' — maps to a default voice for the provider
 *   - accent (string, optional) — accent hint used for model/voice selection
 *   - model (string, optional) — TTS model (default: auto-selected by provider)
 *   - speed (number, optional) — playback speed 0.25–4.0 (default: 1.0)
 *   - provider (string, optional) — 'groq' | 'openai' | 'gemini' | 'huggingface' | 'auto' (default: 'auto')
 *   - emotionAware (boolean, optional) — enable emotion-adaptive voice (default: false)
 *
 * Returns audio/mpeg stream on success.
 *
 * STRICT RULE: Never fakes success. Returns error if no provider configured.
 */

/** Default voice mappings per provider and gender */
const VOICE_BY_GENDER: Record<string, { male: string; female: string; default: string }> = {
  groq: {
    male:    'Atlas-PlayAI',
    female:  'Arista-PlayAI',
    default: 'Arista-PlayAI',
  },
  openai: {
    male:    'onyx',
    female:  'nova',
    default: 'alloy',
  },
  gemini: {
    male:    'Charon',
    female:  'Kore',
    default: 'Kore',
  },
  huggingface: {
    male:    'facebook/mms-tts-eng',
    female:  'facebook/mms-tts-eng',
    default: 'facebook/mms-tts-eng',
  },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      model: requestedModel,
      speed: rawSpeed,
      provider: requestedProvider = 'auto',
      emotionAware = false,
      // Optional appSlug: when provided, usage is metered back to that app/workspace
      // and voice persona settings are auto-loaded from the AppAgent record.
      appSlug: meterAppSlug,
    } = body;

    // ── Load voice persona from DB (Phase 1 fix) ─────────────────────────────
    // When an appSlug is provided, load the persisted voice persona settings
    // from the AppAgent table and use them as the baseline for this TTS call.
    // Explicit per-call params (voiceId, gender, accent, speed) always win.
    let personaVoiceId: string | undefined
    let personaGender: string | undefined
    let personaAccent: string | undefined
    let personaSpeed: number | undefined
    const personaApplied: Record<string, string> = {}

    if (meterAppSlug && typeof meterAppSlug === 'string') {
      try {
        const agent = await prisma.appAgent.findUnique({
          where: { appSlug: meterAppSlug },
          select: {
            voiceGender: true,
            voiceAccent: true,
            voiceSpeed: true,
          },
        })
        if (agent) {
          if (agent.voiceGender) {
            personaGender = agent.voiceGender === 'neutral' ? undefined : agent.voiceGender
            personaApplied.gender = agent.voiceGender
          }
          if (agent.voiceAccent) {
            personaAccent = agent.voiceAccent
            personaApplied.accent = agent.voiceAccent
          }
          if (agent.voiceSpeed) {
            personaSpeed = agent.voiceSpeed === 'slow' ? 0.85
              : agent.voiceSpeed === 'fast' ? 1.2
              : 1.0
            personaApplied.speed = agent.voiceSpeed
          }
        }
      } catch {
        // DB lookup failure → proceed with call-level defaults
      }
    }

    // Resolve final values: explicit call param wins over persona, persona wins over default
    const voiceId: string | undefined = body.voiceId ?? personaVoiceId
    const gender: string | undefined = body.gender ?? personaGender
    const accent: string | undefined = body.accent ?? personaAccent
    const speed: number = rawSpeed ?? personaSpeed ?? 1.0

    /**
     * Meter this TTS call back to the given appSlug if one was provided.
     * Called fire-and-forget (void) so it never blocks the audio response.
     */
    const meterCall = (provider: string, model: string, text: string, success: boolean) => {
      if (!meterAppSlug || typeof meterAppSlug !== 'string') return;
      const tokens = Math.max(1, Math.ceil(text.length / 4));
      const estimated = Math.round(estimateCostUsd(model, tokens) * 100);
      void recordUsage({
        appSlug: meterAppSlug,
        capability: 'tts',
        provider,
        model,
        success,
        costUsdCents: success ? Math.max(10, estimated) : 0,
        artifactCreated: success,
      });
    };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'text is required and must be a non-empty string', executed: false },
        { status: 400 },
      );
    }

    // Resolve API keys from DB vault (with env fallback)
    const groqKey  = await getVaultApiKey('groq');
    const openaiKey = await getVaultApiKey('openai');
    const geminiKey = await getVaultApiKey('gemini');
    const hfKey    = await getVaultApiKey('huggingface');

    // Determine provider
    let provider: 'groq' | 'openai' | 'gemini' | 'huggingface';
    if (requestedProvider === 'groq') {
      if (!groqKey) {
        return NextResponse.json(
          { error: 'Groq TTS requested but no Groq API key is configured. Add it via Admin → AI Providers.', executed: false, provider: 'groq', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'groq';
    } else if (requestedProvider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI TTS requested but no OpenAI API key is configured. Add it via Admin → AI Providers.', executed: false, provider: 'openai', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'openai';
    } else if (requestedProvider === 'gemini') {
      if (!geminiKey) {
        return NextResponse.json(
          { error: 'Gemini TTS requested but no Gemini API key is configured. Add it via Admin → AI Providers.', executed: false, provider: 'gemini', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'gemini';
    } else if (requestedProvider === 'huggingface') {
      if (!hfKey) {
        return NextResponse.json(
          { error: 'HuggingFace TTS requested but no HuggingFace API key is configured. Add it via Admin → AI Providers.', executed: false, provider: 'huggingface', capability: 'voice_output' },
          { status: 503 },
        );
      }
      provider = 'huggingface';
    } else {
      // Auto: OpenAI is the golden-path baseline. Groq is used as fallback when
      // Auto-select: prefer OpenAI (highest quality), then Groq (fastest/cheapest),
      // then Gemini (multimodal), then HuggingFace (free fallback).
      if (openaiKey) {
        provider = 'openai';
      } else if (groqKey) {
        provider = 'groq';
      } else if (geminiKey) {
        provider = 'gemini';
      } else if (hfKey) {
        provider = 'huggingface';
      } else {
        return NextResponse.json(
          {
            error: 'No TTS provider configured. Add an API key via Admin → AI Providers. Supported providers: OpenAI (premium), Groq (low cost), Gemini (multimodal), HuggingFace (free fallback).',
            executed: false,
            capability: 'voice_output',
          },
          { status: 503 },
        );
      }
    }

    // Resolve the effective voice ID based on gender preference (if no explicit voiceId given)
    const resolveVoice = (prov: string): string => {
      if (voiceId) return voiceId;
      const map = VOICE_BY_GENDER[prov];
      if (!map) return '';
      if (gender === 'male') return map.male;
      if (gender === 'female') return map.female;
      return map.default;
    };

    // ── Emotion-aware voice adaptation ─────────────────────────────────
    // When enabled, detects emotion in the text and adapts voice/speed/SSML.
    let affective: AffectiveVoiceConfig | null = null;
    if (emotionAware) {
      try {
        const emotionAnalysis = detectEmotions(text);
        affective = buildAffectiveVoiceConfig(text, emotionAnalysis, provider as TTSProvider);
      } catch {
        // Emotion detection failed — proceed with default voice settings
      }
    }

    if (provider === 'groq') {
      // Groq TTS via OpenAI-compatible endpoint
      const model = requestedModel ?? (accent === 'arabic' ? 'playai-tts-arabic' : 'playai-tts');
      const voice = affective?.voiceOverride ?? resolveVoice('groq');

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
      meterCall('groq', model, text, true);
      // Auto-memory: record lightweight TTS event for this app
      if (meterAppSlug) {
        void saveMemory({ appSlug: meterAppSlug, memoryType: 'event', key: 'tts', content: `TTS generated via groq/${model}: "${text.slice(0, 100)}"`, importance: 0.3, ttlDays: 30 });
      }
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'X-Provider': 'groq',
          'X-Model': model,
          ...(Object.keys(personaApplied).length ? { 'X-Persona-Applied': JSON.stringify(personaApplied) } : {}),
        },
      });
    }

    if (provider === 'gemini') {
      // Gemini TTS via Google Generative Language API
      // Gemini supports SSML — use affective SSML when emotion-aware is enabled
      const model = requestedModel ?? 'gemini-2.5-flash-preview-tts';
      const voice = affective?.voiceOverride ?? resolveVoice('gemini');
      const inputText = affective?.ssmlSupported && affective?.ssml ? affective.ssml : text;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: inputText }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json(
          { error: 'Gemini TTS generation failed', detail: err, executed: false, provider: 'gemini', model },
          { status: response.status },
        );
      }

      const result = await response.json();
      const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        return NextResponse.json(
          { error: 'Gemini TTS returned no audio data', executed: false, provider: 'gemini', model },
          { status: 502 },
        );
      }

      const audioBuffer = Buffer.from(audioData, 'base64');
      meterCall('gemini', model, text, true);
      // Auto-memory
      if (meterAppSlug) {
        void saveMemory({ appSlug: meterAppSlug, memoryType: 'event', key: 'tts', content: `TTS generated via gemini/${model}: "${text.slice(0, 100)}"`, importance: 0.3, ttlDays: 30 });
      }
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'X-Provider': 'gemini',
          'X-Model': model,
          ...(Object.keys(personaApplied).length ? { 'X-Persona-Applied': JSON.stringify(personaApplied) } : {}),
          ...(affective ? {
            'X-Emotion': affective.sourceEmotion,
            'X-Emotion-Confidence': String(affective.confidence),
            'X-SSML-Used': String(affective.ssmlSupported),
          } : {}),
        },
      });
    }

    if (provider === 'huggingface') {
      // HuggingFace Inference API — free fallback TTS
      const ALLOWED_HF_TTS_MODELS = ['facebook/mms-tts-eng', 'facebook/mms-tts-fra'] as const;
      const matched = ALLOWED_HF_TTS_MODELS.find((m) => m === requestedModel);
      const hfModel = matched ?? 'facebook/mms-tts-eng';

      const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json(
          { error: 'HuggingFace TTS generation failed', detail: err, executed: false, provider: 'huggingface', model: hfModel },
          { status: response.status },
        );
      }

      const audioBuffer = await response.arrayBuffer();
      meterCall('huggingface', hfModel, text, true);
      // Auto-memory
      if (meterAppSlug) {
        void saveMemory({ appSlug: meterAppSlug, memoryType: 'event', key: 'tts', content: `TTS generated via huggingface/${hfModel}: "${text.slice(0, 100)}"`, importance: 0.3, ttlDays: 30 });
      }
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
          'X-Provider': 'huggingface',
          'X-Model': hfModel,
        },
      });
    }

    // OpenAI TTS (premium path)
    // OpenAI does not support SSML — use voice and speed overrides from affective config
    const model = requestedModel ?? 'tts-1';
    const voice = affective?.voiceOverride ?? resolveVoice('openai');
    const effectiveSpeed = affective?.speedOverride ?? speed;

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
        speed: effectiveSpeed,
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
    meterCall('openai', model, text, true);
    // Auto-memory
    if (meterAppSlug) {
      void saveMemory({ appSlug: meterAppSlug, memoryType: 'event', key: 'tts', content: `TTS generated via openai/${model}: "${text.slice(0, 100)}"`, importance: 0.3, ttlDays: 30 });
    }
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'X-Provider': 'openai',
        'X-Model': model,
        ...(Object.keys(personaApplied).length ? { 'X-Persona-Applied': JSON.stringify(personaApplied) } : {}),
        ...(affective ? {
          'X-Emotion': affective.sourceEmotion,
          'X-Emotion-Confidence': String(affective.confidence),
        } : {}),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err), executed: false },
      { status: 500 },
    );
  }
}
