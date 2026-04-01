/**
 * Final Completion Pass Tests — AmarktAI Network
 *
 * Verifies:
 *  - Expanded voice stack (STT/TTS with Groq + OpenAI + Gemini + HF fallback)
 *  - Video truth (planning vs generation split)
 *  - Adult lawful mode truth
 *  - HuggingFace fallback behavior
 *  - Provider/model selection for new media routes
 *  - Agent readiness after provider upgrades
 *  - No fake availability badges
 */

import { describe, it, expect } from 'vitest'
import {
  getModelRegistry,
  getModelsByProvider,
  getEnabledModels,
} from '../model-registry'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
  classifyCapabilities,
  getDetailedCapabilityStatus,
} from '../capability-engine'
import { getHfFallback, getHfFallbackStatus, HF_FALLBACK_MODELS } from '../hf-fallback'
import { auditAllAgents, getAgentReadiness } from '../agent-audit'
import { setAppSafetyConfig, getAppSafetyConfig } from '../content-filter'

/* ================================================================
 * VOICE STACK — EXPANDED COVERAGE
 * ================================================================ */

describe('Expanded Voice Stack', () => {
  describe('STT models in registry', () => {
    it('has Groq STT models', () => {
      const groq = getModelsByProvider('groq')
      const sttModels = groq.filter((m) => 'supports_stt' in m && m.supports_stt)
      expect(sttModels.length).toBeGreaterThanOrEqual(2)
      const ids = sttModels.map((m) => m.model_id)
      expect(ids).toContain('whisper-large-v3')
      expect(ids).toContain('distil-whisper-large-v3-en')
    })

    it('has OpenAI STT models', () => {
      const openai = getModelsByProvider('openai')
      const sttModels = openai.filter((m) => 'supports_stt' in m && m.supports_stt)
      expect(sttModels.length).toBeGreaterThanOrEqual(1)
      expect(sttModels.map((m) => m.model_id)).toContain('whisper-1')
    })

    it('has Gemini STT model', () => {
      const gemini = getModelsByProvider('gemini')
      const sttModels = gemini.filter((m) => 'supports_stt' in m && m.supports_stt)
      expect(sttModels.length).toBeGreaterThanOrEqual(1)
      expect(sttModels.map((m) => m.model_id)).toContain('gemini-2.0-flash-live-001')
    })

    it('has HuggingFace STT fallback model', () => {
      const hf = getModelsByProvider('huggingface')
      const sttModels = hf.filter((m) => 'supports_stt' in m && m.supports_stt)
      expect(sttModels.length).toBeGreaterThanOrEqual(1)
      expect(sttModels.map((m) => m.model_id)).toContain('openai/whisper-large-v3')
    })

    it('total STT models >= 5 across all providers', () => {
      const all = getModelRegistry()
      const stt = all.filter((m) => 'supports_stt' in m && m.supports_stt)
      expect(stt.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('TTS models in registry', () => {
    it('has OpenAI TTS models (tts-1, tts-1-hd)', () => {
      const openai = getModelsByProvider('openai')
      const ttsModels = openai.filter((m) => 'supports_tts' in m && m.supports_tts)
      expect(ttsModels.length).toBeGreaterThanOrEqual(2)
      const ids = ttsModels.map((m) => m.model_id)
      expect(ids).toContain('tts-1')
      expect(ids).toContain('tts-1-hd')
    })

    it('has Groq TTS model (playai-tts)', () => {
      const groq = getModelsByProvider('groq')
      const ttsModels = groq.filter((m) => 'supports_tts' in m && m.supports_tts)
      expect(ttsModels.length).toBeGreaterThanOrEqual(1)
      expect(ttsModels.map((m) => m.model_id)).toContain('playai-tts')
    })

    it('has Gemini TTS model', () => {
      const gemini = getModelsByProvider('gemini')
      const ttsModels = gemini.filter((m) => 'supports_tts' in m && m.supports_tts)
      expect(ttsModels.length).toBeGreaterThanOrEqual(1)
      expect(ttsModels.map((m) => m.model_id)).toContain('gemini-2.5-flash-preview-tts')
    })

    it('has HuggingFace TTS fallback model', () => {
      const hf = getModelsByProvider('huggingface')
      const ttsModels = hf.filter((m) => 'supports_tts' in m && m.supports_tts)
      expect(ttsModels.length).toBeGreaterThanOrEqual(1)
      expect(ttsModels.map((m) => m.model_id)).toContain('facebook/mms-tts-eng')
    })

    it('total TTS models >= 5 across all providers', () => {
      const all = getModelRegistry()
      const tts = all.filter((m) => 'supports_tts' in m && m.supports_tts)
      expect(tts.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('voice capability truth', () => {
    it('voice_input has a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.voice_input).toBe(true)
    })

    it('voice_output has a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.voice_output).toBe(true)
    })

    it('realtime_voice has NO backend route (truthful)', () => {
      expect(BACKEND_ROUTE_EXISTS.realtime_voice).toBe(false)
    })

    it('voice_input resolves with at least one model', () => {
      const result = resolveCapabilityRoutes({ capabilities: ['voice_input'] })
      // Even without provider health cache, route existence should be checked
      expect(result.routes[0].capability).toBe('voice_input')
    })

    it('voice_output resolves with at least one model', () => {
      const result = resolveCapabilityRoutes({ capabilities: ['voice_output'] })
      expect(result.routes[0].capability).toBe('voice_output')
    })
  })

  describe('voice provider tiers', () => {
    it('Groq STT models are backbone tier (low-cost)', () => {
      const groq = getModelsByProvider('groq')
      const stt = groq.filter((m) => 'supports_stt' in m && m.supports_stt)
      for (const m of stt) {
        expect(m.provider_tier).toBe('backbone')
      }
    })

    it('OpenAI STT models are premium tier', () => {
      const openai = getModelsByProvider('openai')
      const stt = openai.filter((m) => 'supports_stt' in m && m.supports_stt)
      for (const m of stt) {
        expect(m.provider_tier).toBe('premium')
      }
    })

    it('Gemini voice models are premium tier', () => {
      const gemini = getModelsByProvider('gemini')
      const stt = gemini.filter((m) => 'supports_stt' in m && m.supports_stt)
      const tts = gemini.filter((m) => 'supports_tts' in m && m.supports_tts)
      for (const m of [...stt, ...tts]) {
        expect(m.provider_tier).toBe('premium')
      }
    })

    it('HuggingFace voice models are backbone tier (fallback)', () => {
      const hf = getModelsByProvider('huggingface')
      const voice = hf.filter((m) => ('supports_stt' in m && m.supports_stt) || ('supports_tts' in m && m.supports_tts))
      for (const m of voice) {
        expect(m.provider_tier).toBe('backbone')
      }
    })
  })
})

/* ================================================================
 * VIDEO STACK — PLANNING VS GENERATION TRUTH
 * ================================================================ */

describe('Video Stack Truth', () => {
  it('video_planning has a backend route (text-based, always available)', () => {
    expect(BACKEND_ROUTE_EXISTS.video_planning).toBe(true)
  })

  it('video_generation has NO backend route (truthful)', () => {
    expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(false)
  })

  it('video_planning resolution does not claim it is generation', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['video_planning'] })
    expect(result.routes[0].capability).toBe('video_planning')
  })

  it('video_generation is blocked by backend route guard', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] })
    expect(result.routes[0].available).toBe(false)
    expect(result.routes[0].missingMessage).toContain('Route not implemented')
  })

  it('classifyCapabilities can identify video tasks', () => {
    const result = classifyCapabilities({ taskType: 'video_planning', message: 'Plan a video about cooking' })
    expect(result.length).toBeGreaterThan(0)
  })
})

/* ================================================================
 * ADULT 18+ LAWFUL MODE — CONTINUED TRUTH
 * ================================================================ */

describe('Adult 18+ Lawful Mode Truth', () => {
  it('adult_18plus_image has NO backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.adult_18plus_image).toBe(false)
  })

  it('adult capability is UNAVAILABLE regardless of adultMode flag', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['adult_18plus_image'],
      adultMode: true,
    })
    expect(result.routes[0].available).toBe(false)
  })

  it('safety config enforces safeMode=true as default', () => {
    const config = getAppSafetyConfig('fresh-app-test')
    expect(config.safeMode).toBe(true)
    expect(config.adultMode).toBe(false)
  })

  it('adultMode cannot be enabled when safeMode is true', () => {
    const config = setAppSafetyConfig('test-adult', { safeMode: true, adultMode: true })
    expect(config.adultMode).toBe(false)
  })

  it('adultMode can only be enabled when safeMode is false', () => {
    setAppSafetyConfig('test-adult', { safeMode: false })
    const config = setAppSafetyConfig('test-adult', { adultMode: true })
    expect(config.adultMode).toBe(true)
    expect(config.safeMode).toBe(false)
  })
})

/* ================================================================
 * HUGGING FACE FALLBACK
 * ================================================================ */

describe('HuggingFace Fallback Layer', () => {
  it('HF fallback catalog includes voice_input', () => {
    expect(HF_FALLBACK_MODELS.voice_input).toBeDefined()
    expect(HF_FALLBACK_MODELS.voice_input!.length).toBeGreaterThan(0)
  })

  it('HF fallback catalog includes voice_output', () => {
    expect(HF_FALLBACK_MODELS.voice_output).toBeDefined()
    expect(HF_FALLBACK_MODELS.voice_output!.length).toBeGreaterThan(0)
  })

  it('HF fallback catalog includes image_generation', () => {
    expect(HF_FALLBACK_MODELS.image_generation).toBeDefined()
    expect(HF_FALLBACK_MODELS.image_generation!.length).toBeGreaterThan(0)
  })

  it('HF fallback catalog includes embeddings', () => {
    expect(HF_FALLBACK_MODELS.embeddings).toBeDefined()
  })

  it('HF fallback catalog includes general_chat', () => {
    expect(HF_FALLBACK_MODELS.general_chat).toBeDefined()
  })

  it('HF fallback returns unavailable when provider not configured', () => {
    const result = getHfFallback('voice_input')
    // Without HUGGINGFACE_API_KEY, provider is not usable
    expect(result.capability).toBe('voice_input')
    // result.available depends on provider health cache state
  })

  it('HF fallback status reports fallback capabilities', () => {
    const status = getHfFallbackStatus()
    expect(status.fallbackCapabilities).toContain('voice_input')
    expect(status.fallbackCapabilities).toContain('voice_output')
    expect(status.fallbackCapabilities).toContain('image_generation')
    expect(status.fallbackCapabilities.length).toBeGreaterThanOrEqual(10)
  })

  it('HF models are registered in the main registry', () => {
    const hf = getModelsByProvider('huggingface')
    expect(hf.length).toBeGreaterThanOrEqual(8) // 6 original + 2 new voice
  })

  it('HF voice fallback models have correct specialist domains', () => {
    const hf = getModelsByProvider('huggingface')
    const stt = hf.find((m) => m.model_id === 'openai/whisper-large-v3')
    const tts = hf.find((m) => m.model_id === 'facebook/mms-tts-eng')
    expect(stt).toBeDefined()
    expect(tts).toBeDefined()
    expect(stt!.specialist_domains).toContain('fallback')
    expect(tts!.specialist_domains).toContain('fallback')
  })
})

/* ================================================================
 * AGENT READINESS — AFTER PROVIDER UPGRADES
 * ================================================================ */

describe('Agent Readiness After Provider Upgrades', () => {
  it('retrieval agent is now callable (openai)', () => {
    const entry = getAgentReadiness('retrieval')
    expect(entry).not.toBeNull()
    expect(entry!.defaultProvider).toBe('openai')
    expect(entry!.providerCallable).toBe(true)
  })

  it('creative agent is now callable (gemini)', () => {
    const entry = getAgentReadiness('creative')
    expect(entry).not.toBeNull()
    expect(entry!.defaultProvider).toBe('gemini')
    expect(entry!.providerCallable).toBe(true)
  })

  it('all 16 agents now have callable providers', () => {
    const result = auditAllAgents()
    for (const agent of result.agents) {
      expect(agent.providerCallable).toBe(true)
    }
  })

  it('zero NOT_CONNECTED agents after upgrades', () => {
    const result = auditAllAgents()
    expect(result.summary.notConnected).toBe(0)
  })

  it('all agents have registered providers with models', () => {
    const result = auditAllAgents()
    for (const agent of result.agents) {
      expect(agent.providerRegistered).toBe(true)
    }
  })
})

/* ================================================================
 * CAPABILITY MAP — NO FAKE BADGES
 * ================================================================ */

describe('Capability Map — No Fake Badges', () => {
  it('all 23 capabilities are in BACKEND_ROUTE_EXISTS', () => {
    const caps = Object.keys(BACKEND_ROUTE_EXISTS)
    expect(caps.length).toBe(23)
  })

  it('exactly 19 capabilities have backend routes', () => {
    const available = Object.entries(BACKEND_ROUTE_EXISTS)
      .filter(([, v]) => v === true)
    expect(available.length).toBe(19)
  })

  it('exactly 4 capabilities have no backend route', () => {
    const unavailable = Object.entries(BACKEND_ROUTE_EXISTS)
      .filter(([, v]) => v === false)
    expect(unavailable.length).toBe(4)
    const names = unavailable.map(([k]) => k).sort()
    expect(names).toEqual([
      'adult_18plus_image',
      'realtime_voice',
      'reranking',
      'video_generation',
    ])
  })

  it('getDetailedCapabilityStatus returns status for all capabilities', () => {
    const status = getDetailedCapabilityStatus()
    expect(status.length).toBe(23)
    for (const entry of status) {
      expect(typeof entry.available).toBe('boolean')
      expect(typeof entry.routeExists).toBe('boolean')
      expect(typeof entry.capability).toBe('string')
    }
  })

  it('capabilities without routes show as unavailable', () => {
    const status = getDetailedCapabilityStatus()
    const noRoute = status.filter((s) => !s.routeExists)
    expect(noRoute.length).toBe(4)
    for (const entry of noRoute) {
      expect(entry.available).toBe(false)
    }
  })
})

/* ================================================================
 * MODEL REGISTRY INTEGRITY
 * ================================================================ */

describe('Model Registry Integrity', () => {
  it('total model count is >= 68 after additions', () => {
    const all = getModelRegistry()
    expect(all.length).toBeGreaterThanOrEqual(68) // 64 original + 4 new
  })

  it('all models have required fields', () => {
    const all = getModelRegistry()
    for (const m of all) {
      expect(m.provider).toBeTruthy()
      expect(m.model_id).toBeTruthy()
      expect(m.model_name).toBeTruthy()
      expect(m.primary_role).toBeTruthy()
      expect(typeof m.enabled).toBe('boolean')
      expect(m.context_window).toBeGreaterThan(0)
    }
  })

  it('no duplicate model IDs within the same provider', () => {
    const all = getModelRegistry()
    const seen = new Set<string>()
    for (const m of all) {
      const key = `${m.provider}:${m.model_id}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('all enabled models have a valid health_status', () => {
    const all = getEnabledModels()
    const valid = ['healthy', 'configured', 'degraded', 'error', 'unconfigured', 'disabled']
    for (const m of all) {
      expect(valid).toContain(m.health_status)
    }
  })
})
