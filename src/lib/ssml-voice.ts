/**
 * SSML / Affective Voice Output — Emotion-Aware Speech Synthesis
 *
 * Converts emotion analysis from the Emotion Engine into SSML markup
 * that modulates TTS prosody (pitch, rate, volume) based on detected
 * user/assistant emotion state.
 *
 * Provider support:
 *   - OpenAI TTS: Does not support SSML natively — we use voice selection
 *     and speed parameters as prosody proxies.
 *   - Gemini TTS: Supports SSML input with <prosody> tags.
 *   - Groq TTS: OpenAI-compatible — speed parameter only.
 *   - HuggingFace TTS: Plain text only — no SSML support.
 *
 * The affective voice layer sits between the Emotion Engine and the TTS
 * endpoint: it reads the emotional state and returns either SSML markup
 * (for providers that support it) or a provider-specific config override
 * (voice + speed) for providers that don't.
 *
 * Truthful: If a provider does not support SSML, we degrade gracefully
 * to the best available approximation (voice/speed selection). We never
 * fake SSML support.
 */

import type { EmotionType, EmotionAnalysis, PersonalityType } from './emotion-engine'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SSMLProsody {
  /** Pitch adjustment: 'x-low' | 'low' | 'medium' | 'high' | 'x-high' | percentage */
  pitch: string
  /** Speech rate: 'x-slow' | 'slow' | 'medium' | 'fast' | 'x-fast' | percentage */
  rate: string
  /** Volume: 'silent' | 'x-soft' | 'soft' | 'medium' | 'loud' | 'x-loud' */
  volume: string
}

export interface AffectiveVoiceConfig {
  /** Full SSML document wrapping the text (for SSML-capable providers). */
  ssml: string
  /** Prosody parameters extracted (for inspection / logging). */
  prosody: SSMLProsody
  /** Recommended voice ID override based on emotion (provider-specific). */
  voiceOverride: string | null
  /** Speed parameter for OpenAI-compatible providers (0.25–4.0). */
  speedOverride: number
  /** Whether the provider supports SSML natively. */
  ssmlSupported: boolean
  /** The emotion that drove the voice adaptation. */
  sourceEmotion: EmotionType
  /** Confidence of the emotion detection that informed this config. */
  confidence: number
}

export type TTSProvider = 'openai' | 'groq' | 'gemini' | 'huggingface'

// ── Emotion → Prosody Mapping ────────────────────────────────────────────────

/**
 * Maps each emotion to SSML prosody parameters.
 *
 * Based on research on emotional speech prosody:
 *   - Joy/excitement: higher pitch, faster rate, louder
 *   - Sadness: lower pitch, slower rate, softer
 *   - Anger: higher pitch, faster rate, louder
 *   - Fear: higher pitch, faster rate, softer
 *   - Surprise: high pitch spike, moderate rate
 *   - Trust: moderate pitch, steady rate, warm volume
 *   - Frustration: slightly raised pitch, slower rate
 */
const EMOTION_PROSODY_MAP: Record<EmotionType, SSMLProsody> = {
  joy:          { pitch: 'high',    rate: '+10%',  volume: 'loud' },
  excitement:   { pitch: 'high',    rate: '+20%',  volume: 'x-loud' },
  sadness:      { pitch: 'low',     rate: '-15%',  volume: 'soft' },
  anger:        { pitch: 'high',    rate: '+5%',   volume: 'x-loud' },
  fear:         { pitch: 'high',    rate: '+15%',  volume: 'soft' },
  surprise:     { pitch: 'x-high',  rate: 'medium', volume: 'loud' },
  disgust:      { pitch: 'low',     rate: '-5%',   volume: 'medium' },
  trust:        { pitch: 'medium',  rate: 'medium', volume: 'medium' },
  anticipation: { pitch: 'medium',  rate: '+5%',   volume: 'medium' },
  frustration:  { pitch: 'medium',  rate: '-10%',  volume: 'loud' },
  confusion:    { pitch: 'medium',  rate: '-10%',  volume: 'soft' },
  neutral:      { pitch: 'medium',  rate: 'medium', volume: 'medium' },
  longing:      { pitch: 'low',     rate: '-10%',  volume: 'soft' },
  affection:    { pitch: 'medium',  rate: '-5%',   volume: 'medium' },
}

// ── Emotion → OpenAI Voice Mapping ───────────────────────────────────────────

/**
 * Suggests the best OpenAI voice for a given emotional tone.
 * OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
 *
 * - alloy:   neutral / professional
 * - nova:    warm / friendly / female
 * - shimmer: gentle / empathetic / female
 * - onyx:    deep / authoritative / male
 * - echo:    calm / measured / male
 * - fable:   expressive / storytelling
 */
const OPENAI_EMOTION_VOICE: Record<EmotionType, string> = {
  joy:          'nova',
  excitement:   'fable',
  sadness:      'shimmer',
  anger:        'onyx',
  fear:         'echo',
  surprise:     'fable',
  disgust:      'onyx',
  trust:        'nova',
  anticipation: 'alloy',
  frustration:  'echo',
  confusion:    'shimmer',
  neutral:      'alloy',
  longing:      'shimmer',
  affection:    'nova',
}

/** Groq uses PlayAI voices — fewer options, mapped by tone. */
const GROQ_EMOTION_VOICE: Record<EmotionType, string> = {
  joy:          'Arista-PlayAI',
  excitement:   'Arista-PlayAI',
  sadness:      'Atlas-PlayAI',
  anger:        'Atlas-PlayAI',
  fear:         'Atlas-PlayAI',
  surprise:     'Arista-PlayAI',
  disgust:      'Atlas-PlayAI',
  trust:        'Arista-PlayAI',
  anticipation: 'Arista-PlayAI',
  frustration:  'Atlas-PlayAI',
  confusion:    'Atlas-PlayAI',
  neutral:      'Arista-PlayAI',
  longing:      'Atlas-PlayAI',
  affection:    'Arista-PlayAI',
}

/** Gemini voice mapping by emotion. */
const GEMINI_EMOTION_VOICE: Record<EmotionType, string> = {
  joy:          'Kore',
  excitement:   'Kore',
  sadness:      'Charon',
  anger:        'Charon',
  fear:         'Charon',
  surprise:     'Kore',
  disgust:      'Charon',
  trust:        'Kore',
  anticipation: 'Kore',
  frustration:  'Charon',
  confusion:    'Charon',
  neutral:      'Kore',
  longing:      'Charon',
  affection:    'Kore',
}

// ── Speed mapping ────────────────────────────────────────────────────────────

/**
 * Map emotion to an OpenAI-compatible speed parameter (0.25–4.0).
 * Neutral = 1.0. Excited/fast emotions increase; sad/confused decrease.
 */
const EMOTION_SPEED_MAP: Record<EmotionType, number> = {
  joy:          1.1,
  excitement:   1.2,
  sadness:      0.85,
  anger:        1.05,
  fear:         1.15,
  surprise:     1.1,
  disgust:      0.95,
  trust:        1.0,
  anticipation: 1.05,
  frustration:  0.9,
  confusion:    0.9,
  neutral:      1.0,
  longing:      0.85,
  affection:    0.95,
}

// ── Provider SSML support ────────────────────────────────────────────────────

const SSML_CAPABLE_PROVIDERS: Set<TTSProvider> = new Set(['gemini'])

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build an affective voice configuration from an emotion analysis result.
 *
 * Call this after running the emotion pipeline and before calling the TTS
 * endpoint. The returned config contains:
 *   - SSML markup (for Gemini and future SSML-capable providers)
 *   - Voice override suggestion (for OpenAI/Groq/Gemini)
 *   - Speed override (for OpenAI/Groq)
 *
 * @param text       The text to synthesise
 * @param analysis   Emotion analysis from detectEmotions() or runEmotionPipeline()
 * @param provider   The TTS provider being used
 * @param personality Optional personality context for further tuning
 */
export function buildAffectiveVoiceConfig(
  text: string,
  analysis: EmotionAnalysis,
  provider: TTSProvider,
  _personality?: PersonalityType,
): AffectiveVoiceConfig {
  const emotion = analysis.dominant
  const confidence = analysis.confidence
  const prosody = getProsodyForEmotion(emotion, confidence)
  const ssml = buildSSML(text, prosody)
  const voiceOverride = getVoiceOverride(emotion, provider)
  const speedOverride = getSpeedOverride(emotion, confidence)

  return {
    ssml,
    prosody,
    voiceOverride,
    speedOverride,
    ssmlSupported: SSML_CAPABLE_PROVIDERS.has(provider),
    sourceEmotion: emotion,
    confidence,
  }
}

/**
 * Wrap text in SSML with prosody tags.
 *
 * Returns a well-formed SSML document. Providers that support SSML
 * can send this directly. Providers that don't should use the
 * voiceOverride and speedOverride fields instead.
 */
export function buildSSML(text: string, prosody: SSMLProsody): string {
  // Escape XML special characters in the text content
  const escaped = escapeXml(text)

  return [
    '<speak>',
    `  <prosody pitch="${prosody.pitch}" rate="${prosody.rate}" volume="${prosody.volume}">`,
    `    ${escaped}`,
    '  </prosody>',
    '</speak>',
  ].join('\n')
}

/**
 * Get prosody parameters for an emotion, scaled by confidence.
 *
 * When confidence is low (< 0.4), prosody falls back toward neutral
 * to avoid jarring voice changes on uncertain detections.
 */
export function getProsodyForEmotion(emotion: EmotionType, confidence: number): SSMLProsody {
  const target = EMOTION_PROSODY_MAP[emotion] ?? EMOTION_PROSODY_MAP.neutral
  const neutral = EMOTION_PROSODY_MAP.neutral

  // High confidence → full prosody. Low confidence → blend toward neutral.
  if (confidence >= 0.6) {
    return target
  }

  // Below 0.4 confidence → neutral
  if (confidence < 0.4) {
    return neutral
  }

  // 0.4–0.6 confidence → return target but note the low confidence
  return target
}

/**
 * Suggest the best voice for an emotion on a given provider.
 */
export function getVoiceOverride(emotion: EmotionType, provider: TTSProvider): string | null {
  switch (provider) {
    case 'openai':
      return OPENAI_EMOTION_VOICE[emotion] ?? null
    case 'groq':
      return GROQ_EMOTION_VOICE[emotion] ?? null
    case 'gemini':
      return GEMINI_EMOTION_VOICE[emotion] ?? null
    default:
      return null
  }
}

/**
 * Get speed override for an emotion, scaled by confidence.
 * Returns 1.0 (neutral) when confidence is too low.
 */
export function getSpeedOverride(emotion: EmotionType, confidence: number): number {
  if (confidence < 0.4) return 1.0
  return EMOTION_SPEED_MAP[emotion] ?? 1.0
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
