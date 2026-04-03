/**
 * Voice Expansion Tests — Final Voice Pass
 *
 * Verifies:
 *  - Expanded STT coverage (7 models across 4 providers)
 *  - Expanded TTS coverage (7 models across 4 providers)
 *  - Fallback depth across provider chain
 *  - Realtime voice truthful unavailability with blocker reason
 *  - Provider tiering correctness
 *  - Cost tier accuracy
 *  - HF fallback catalog depth
 *  - Capability engine provider suggestions
 */

import { describe, it, expect } from 'vitest'
import {
  getModelRegistry,
  getModelsByProvider,
} from '../model-registry'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
  CAPABILITY_MAP,
  classifyCapabilities,
} from '../capability-engine'
import { getHfFallback, HF_FALLBACK_MODELS } from '../hf-fallback'

/* ================================================================
 * STT EXPANSION TRUTH
 * ================================================================ */

describe('STT Expansion', () => {
  it('has >= 7 total STT models across all providers', () => {
    const all = getModelRegistry()
    const stt = all.filter((m) => 'supports_stt' in m && m.supports_stt)
    expect(stt.length).toBeGreaterThanOrEqual(7)
  })

  it('has 3 Groq STT models (whisper-large-v3, distil-whisper, whisper-large-v3-turbo)', () => {
    const groq = getModelsByProvider('groq')
    const stt = groq.filter((m) => 'supports_stt' in m && m.supports_stt)
    expect(stt.length).toBeGreaterThanOrEqual(3)
    const ids = stt.map((m) => m.model_id)
    expect(ids).toContain('whisper-large-v3')
    expect(ids).toContain('distil-whisper-large-v3-en')
    expect(ids).toContain('whisper-large-v3-turbo')
  })

  it('whisper-large-v3-turbo has correct properties', () => {
    const groq = getModelsByProvider('groq')
    const turbo = groq.find((m) => m.model_id === 'whisper-large-v3-turbo')
    expect(turbo).toBeDefined()
    expect(turbo!.provider_tier).toBe('backbone')
    expect(turbo!.cost_tier).toBe('free')
    expect(turbo!.latency_tier).toBe('ultra_low')
    expect(turbo!.supports_stt).toBe(true)
    expect(turbo!.supports_multilingual).toBe(true)
    expect(turbo!.specialist_domains).toContain('fast_stt')
  })

  it('has 2 HuggingFace STT models (whisper-large-v3, whisper-small)', () => {
    const hf = getModelsByProvider('huggingface')
    const stt = hf.filter((m) => 'supports_stt' in m && m.supports_stt)
    expect(stt.length).toBeGreaterThanOrEqual(2)
    const ids = stt.map((m) => m.model_id)
    expect(ids).toContain('openai/whisper-large-v3')
    expect(ids).toContain('openai/whisper-small')
  })

  it('whisper-small HF model is lightweight fallback', () => {
    const hf = getModelsByProvider('huggingface')
    const small = hf.find((m) => m.model_id === 'openai/whisper-small')
    expect(small).toBeDefined()
    expect(small!.cost_tier).toBe('free')
    expect(small!.specialist_domains).toContain('lightweight')
    expect(small!.specialist_domains).toContain('fallback')
    expect(small!.fallback_priority).toBeGreaterThanOrEqual(9)
  })

  it('STT models span 4 providers', () => {
    const all = getModelRegistry()
    const stt = all.filter((m) => 'supports_stt' in m && m.supports_stt)
    const providers = new Set(stt.map((m) => m.provider))
    expect(providers.size).toBe(4)
    expect(providers).toContain('groq')
    expect(providers).toContain('openai')
    expect(providers).toContain('gemini')
    expect(providers).toContain('huggingface')
  })
})

/* ================================================================
 * TTS EXPANSION TRUTH
 * ================================================================ */

describe('TTS Expansion', () => {
  it('has >= 7 total TTS models across all providers', () => {
    const all = getModelRegistry()
    const tts = all.filter((m) => 'supports_tts' in m && m.supports_tts)
    expect(tts.length).toBeGreaterThanOrEqual(7)
  })

  it('has 2 Groq TTS models (playai-tts, playai-tts-arabic)', () => {
    const groq = getModelsByProvider('groq')
    const tts = groq.filter((m) => 'supports_tts' in m && m.supports_tts)
    expect(tts.length).toBeGreaterThanOrEqual(2)
    const ids = tts.map((m) => m.model_id)
    expect(ids).toContain('playai-tts')
    expect(ids).toContain('playai-tts-arabic')
  })

  it('playai-tts-arabic has correct properties', () => {
    const groq = getModelsByProvider('groq')
    const arabic = groq.find((m) => m.model_id === 'playai-tts-arabic')
    expect(arabic).toBeDefined()
    expect(arabic!.provider_tier).toBe('backbone')
    expect(arabic!.cost_tier).toBe('very_low')
    expect(arabic!.latency_tier).toBe('ultra_low')
    expect(arabic!.supports_tts).toBe(true)
    expect(arabic!.specialist_domains).toContain('arabic')
  })

  it('has 2 HuggingFace TTS models (mms-tts-eng, mms-tts-fra)', () => {
    const hf = getModelsByProvider('huggingface')
    const tts = hf.filter((m) => 'supports_tts' in m && m.supports_tts)
    expect(tts.length).toBeGreaterThanOrEqual(2)
    const ids = tts.map((m) => m.model_id)
    expect(ids).toContain('facebook/mms-tts-eng')
    expect(ids).toContain('facebook/mms-tts-fra')
  })

  it('mms-tts-fra HF model is French language fallback', () => {
    const hf = getModelsByProvider('huggingface')
    const fra = hf.find((m) => m.model_id === 'facebook/mms-tts-fra')
    expect(fra).toBeDefined()
    expect(fra!.cost_tier).toBe('free')
    expect(fra!.specialist_domains).toContain('french')
    expect(fra!.specialist_domains).toContain('fallback')
  })

  it('TTS models span 4 providers', () => {
    const all = getModelRegistry()
    const tts = all.filter((m) => 'supports_tts' in m && m.supports_tts)
    const providers = new Set(tts.map((m) => m.provider))
    expect(providers.size).toBe(4)
    expect(providers).toContain('groq')
    expect(providers).toContain('openai')
    expect(providers).toContain('gemini')
    expect(providers).toContain('huggingface')
  })
})

/* ================================================================
 * FALLBACK CHAIN DEPTH
 * ================================================================ */

describe('Fallback Chain Depth', () => {
  it('STT fallback chain covers 4 providers: Groq → OpenAI → Gemini → HuggingFace', () => {
    const all = getModelRegistry()
    const stt = all.filter((m) => 'supports_stt' in m && m.supports_stt)
    const byProvider = new Map<string, number>()
    for (const m of stt) {
      byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1)
    }
    expect(byProvider.get('groq')).toBeGreaterThanOrEqual(3)
    expect(byProvider.get('openai')).toBeGreaterThanOrEqual(1)
    expect(byProvider.get('gemini')).toBeGreaterThanOrEqual(1)
    expect(byProvider.get('huggingface')).toBeGreaterThanOrEqual(2)
  })

  it('TTS fallback chain covers 4 providers: Groq → OpenAI → Gemini → HuggingFace', () => {
    const all = getModelRegistry()
    const tts = all.filter((m) => 'supports_tts' in m && m.supports_tts)
    const byProvider = new Map<string, number>()
    for (const m of tts) {
      byProvider.set(m.provider, (byProvider.get(m.provider) ?? 0) + 1)
    }
    expect(byProvider.get('groq')).toBeGreaterThanOrEqual(2)
    expect(byProvider.get('openai')).toBeGreaterThanOrEqual(2)
    expect(byProvider.get('gemini')).toBeGreaterThanOrEqual(1)
    expect(byProvider.get('huggingface')).toBeGreaterThanOrEqual(2)
  })

  it('Groq STT models have lowest fallback_priority (preferred)', () => {
    const groq = getModelsByProvider('groq')
    const stt = groq.filter((m) => 'supports_stt' in m && m.supports_stt)
    for (const m of stt) {
      expect(m.fallback_priority).toBeLessThanOrEqual(2)
    }
  })

  it('HuggingFace voice models have highest fallback_priority (last resort)', () => {
    const hf = getModelsByProvider('huggingface')
    const voice = hf.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    for (const m of voice) {
      expect(m.fallback_priority).toBeGreaterThanOrEqual(8)
    }
  })
})

/* ================================================================
 * REALTIME VOICE TRUTH
 * ================================================================ */

describe('Realtime Voice Truth', () => {
  it('realtime_voice has a backend route (session endpoint + WS service implemented)', () => {
    expect(BACKEND_ROUTE_EXISTS.realtime_voice).toBe(true)
  })

  it('realtime_voice is blocked when REALTIME_SERVICE_URL not set', () => {
    delete process.env.REALTIME_SERVICE_URL
    const result = resolveCapabilityRoutes({ capabilities: ['realtime_voice'] })
    expect(result.routes[0].available).toBe(false)
    expect(result.routes[0].missingMessage).toContain('REALTIME_SERVICE_URL')
  })

  it('realtime_voice classification patterns match via taskType', () => {
    // When taskType explicitly contains "realtime_voice", the pattern matches
    const r1 = classifyCapabilities('realtime_voice', 'start a session')
    expect(r1).toContain('realtime_voice')
  })

  it('voice_input and voice_output ARE available (not blocked)', () => {
    expect(BACKEND_ROUTE_EXISTS.voice_input).toBe(true)
    expect(BACKEND_ROUTE_EXISTS.voice_output).toBe(true)
  })
})

/* ================================================================
 * PROVIDER TIER & COST VERIFICATION
 * ================================================================ */

describe('Provider Tier & Cost Accuracy', () => {
  it('all Groq voice models are backbone tier with low cost', () => {
    const groq = getModelsByProvider('groq')
    const voice = groq.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    expect(voice.length).toBeGreaterThanOrEqual(5)
    for (const m of voice) {
      expect(m.provider_tier).toBe('backbone')
      expect(['free', 'very_low']).toContain(m.cost_tier)
    }
  })

  it('all OpenAI voice models are premium tier', () => {
    const openai = getModelsByProvider('openai')
    const voice = openai.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    for (const m of voice) {
      expect(m.provider_tier).toBe('premium')
    }
  })

  it('all Gemini voice models are premium tier with low cost', () => {
    const gemini = getModelsByProvider('gemini')
    const voice = gemini.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    for (const m of voice) {
      expect(m.provider_tier).toBe('premium')
      expect(m.cost_tier).toBe('low')
    }
  })

  it('all HuggingFace voice models are free or very low cost', () => {
    const hf = getModelsByProvider('huggingface')
    const voice = hf.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    for (const m of voice) {
      expect(['free', 'very_low']).toContain(m.cost_tier)
    }
  })
})

/* ================================================================
 * HF FALLBACK CATALOG DEPTH
 * ================================================================ */

describe('HF Fallback Catalog Depth', () => {
  it('voice_input has >= 3 HF fallback models in catalog', () => {
    expect(HF_FALLBACK_MODELS.voice_input).toBeDefined()
    expect(HF_FALLBACK_MODELS.voice_input!.length).toBeGreaterThanOrEqual(3)
  })

  it('voice_output has >= 2 HF fallback models in catalog', () => {
    expect(HF_FALLBACK_MODELS.voice_output).toBeDefined()
    expect(HF_FALLBACK_MODELS.voice_output!.length).toBeGreaterThanOrEqual(2)
  })

  it('HF voice_input fallback includes whisper-base, whisper-small, and whisper-large-v3', () => {
    const models = HF_FALLBACK_MODELS.voice_input!.map((m) => m.model)
    expect(models).toContain('openai/whisper-base')
    expect(models).toContain('openai/whisper-small')
    expect(models).toContain('openai/whisper-large-v3')
  })

  it('HF voice_output fallback includes mms-tts-eng and mms-tts-fra', () => {
    const models = HF_FALLBACK_MODELS.voice_output!.map((m) => m.model)
    expect(models).toContain('facebook/mms-tts-eng')
    expect(models).toContain('facebook/mms-tts-fra')
  })

  it('HF fallback resolution returns capability for voice_input', () => {
    const result = getHfFallback('voice_input')
    expect(result.capability).toBe('voice_input')
  })

  it('HF fallback resolution returns capability for voice_output', () => {
    const result = getHfFallback('voice_output')
    expect(result.capability).toBe('voice_output')
  })
})

/* ================================================================
 * CAPABILITY ENGINE PROVIDER SUGGESTIONS
 * ================================================================ */

describe('Capability Engine Voice Suggestions', () => {
  it('voice_input suggests 4 providers', () => {
    const map = CAPABILITY_MAP as Record<string, { suggestedProviders?: string[] }>
    expect(map.voice_input.suggestedProviders).toEqual(['groq', 'openai', 'gemini', 'huggingface'])
  })

  it('voice_output suggests 4 providers', () => {
    const map = CAPABILITY_MAP as Record<string, { suggestedProviders?: string[] }>
    expect(map.voice_output.suggestedProviders).toEqual(['groq', 'openai', 'gemini', 'huggingface'])
  })

  it('realtime_voice suggests openai only', () => {
    const map = CAPABILITY_MAP as Record<string, { suggestedProviders?: string[] }>
    expect(map.realtime_voice.suggestedProviders).toEqual(['openai'])
  })
})

/* ================================================================
 * TOTAL MODEL COUNT VERIFICATION
 * ================================================================ */

describe('Total Voice Model Count', () => {
  it('total voice models (STT + TTS) is >= 14', () => {
    const all = getModelRegistry()
    const voice = all.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    expect(voice.length).toBeGreaterThanOrEqual(14)
  })

  it('no duplicate voice model IDs within same provider', () => {
    const all = getModelRegistry()
    const voice = all.filter(
      (m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts)
    )
    const seen = new Set<string>()
    for (const m of voice) {
      const key = `${m.provider}:${m.model_id}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})
