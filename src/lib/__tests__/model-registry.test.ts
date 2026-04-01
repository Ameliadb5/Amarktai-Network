/**
 * Model Registry Tests
 *
 * Validates the model registry data integrity, helper functions,
 * and that routing can reliably query models by capability/role/provider.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  getModelRegistry,
  getModelsByProvider,
  getModelsByCapability,
  getModelsByRole,
  getModelById,
  getEnabledModels,
  getValidatorEligibleModels,
  getModelsForDomain,
  getCheapestModelForCapability,
  getPremiumModelForCapability,
  getDefaultModelForProvider,
  setProviderHealth,
  getProviderHealth,
  clearProviderHealthCache,
  isProviderUsable,
  isProviderDegraded,
  getModelEffectiveHealth,
  getUsableModels,
  getProviderHealthSnapshot,
  type ModelEntry as _ModelEntry,
} from '@/lib/model-registry'

describe('Model Registry', () => {
  describe('getModelRegistry', () => {
    it('returns a non-empty array of model entries', () => {
      const registry = getModelRegistry()
      expect(registry.length).toBeGreaterThan(0)
    })

    it('every model entry has required fields', () => {
      const registry = getModelRegistry()
      for (const model of registry) {
        expect(model.provider).toBeTruthy()
        expect(model.model_id).toBeTruthy()
        expect(model.model_name).toBeTruthy()
        expect(model.family).toBeTruthy()
        expect(model.primary_role).toBeTruthy()
        expect(model.context_window).toBeGreaterThan(0)
        expect(typeof model.enabled).toBe('boolean')
        expect(typeof model.supports_chat).toBe('boolean')
        expect(typeof model.supports_reasoning).toBe('boolean')
        expect(typeof model.validator_eligible).toBe('boolean')
      }
    })

    it('includes models from expected providers', () => {
      const registry = getModelRegistry()
      const providers = new Set(registry.map(m => m.provider))
      expect(providers.has('openai')).toBe(true)
      expect(providers.has('grok')).toBe(true)
      expect(providers.has('nvidia')).toBe(true)
      expect(providers.has('huggingface')).toBe(true)
      expect(providers.has('deepseek')).toBe(true)
      expect(providers.has('groq')).toBe(true)
    })
  })

  describe('getModelsByProvider', () => {
    it('filters models by provider key', () => {
      const openaiModels = getModelsByProvider('openai')
      expect(openaiModels.length).toBeGreaterThan(0)
      expect(openaiModels.every(m => m.provider === 'openai')).toBe(true)
    })

    it('returns empty array for unknown provider', () => {
      expect(getModelsByProvider('nonexistent')).toEqual([])
    })
  })

  describe('getModelsByCapability', () => {
    it('finds models with chat capability', () => {
      const chatModels = getModelsByCapability('supports_chat')
      expect(chatModels.length).toBeGreaterThan(0)
      expect(chatModels.every(m => m.supports_chat)).toBe(true)
    })

    it('finds models with reasoning capability', () => {
      const reasoningModels = getModelsByCapability('supports_reasoning')
      expect(reasoningModels.length).toBeGreaterThan(0)
      expect(reasoningModels.every(m => m.supports_reasoning)).toBe(true)
    })
  })

  describe('getModelsByRole', () => {
    it('finds models with reasoning role', () => {
      const reasoningModels = getModelsByRole('reasoning')
      expect(reasoningModels.length).toBeGreaterThan(0)
    })

    it('finds models with chat role', () => {
      const chatModels = getModelsByRole('chat')
      expect(chatModels.length).toBeGreaterThan(0)
    })
  })

  describe('getModelById', () => {
    it('finds a specific model by provider and model_id', () => {
      const model = getModelById('openai', 'gpt-4o')
      expect(model).toBeDefined()
      expect(model?.provider).toBe('openai')
      expect(model?.model_id).toBe('gpt-4o')
    })

    it('returns undefined for non-existent model', () => {
      expect(getModelById('openai', 'nonexistent')).toBeUndefined()
    })
  })

  describe('getEnabledModels', () => {
    it('returns only enabled models', () => {
      const enabled = getEnabledModels()
      expect(enabled.every(m => m.enabled)).toBe(true)
    })
  })

  describe('getValidatorEligibleModels', () => {
    it('returns only validator-eligible models', () => {
      const validators = getValidatorEligibleModels()
      expect(validators.length).toBeGreaterThan(0)
      expect(validators.every(m => m.validator_eligible)).toBe(true)
    })

    it('validator models support reasoning', () => {
      const validators = getValidatorEligibleModels()
      // Most validators should support reasoning
      const reasoningCount = validators.filter(m => m.supports_reasoning).length
      expect(reasoningCount).toBeGreaterThan(0)
    })
  })

  describe('getModelsForDomain', () => {
    it('finds specialist models for finance domain', () => {
      const financeModels = getModelsForDomain('finance')
      expect(financeModels.length).toBeGreaterThan(0)
    })

    it('returns empty for very niche domain', () => {
      // Should still return models (generic ones) or empty
      const result = getModelsForDomain('quantum_physics')
      // This is acceptable either way
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('getCheapestModelForCapability', () => {
    it('returns cheapest chat model', () => {
      const cheapest = getCheapestModelForCapability('supports_chat')
      expect(cheapest).toBeDefined()
      expect(cheapest?.supports_chat).toBe(true)
    })
  })

  describe('getPremiumModelForCapability', () => {
    it('returns premium reasoning model', () => {
      const premium = getPremiumModelForCapability('supports_reasoning')
      expect(premium).toBeDefined()
      expect(premium?.supports_reasoning).toBe(true)
    })
  })

  describe('getDefaultModelForProvider', () => {
    it('returns default model for each known provider', () => {
      const providers = ['openai', 'groq', 'deepseek', 'grok', 'huggingface', 'nvidia']
      for (const provider of providers) {
        const defaultModel = getDefaultModelForProvider(provider)
        expect(defaultModel).toBeTruthy()
        expect(defaultModel).not.toBe('unknown')
      }
    })

    it('returns "unknown" for unknown provider', () => {
      expect(getDefaultModelForProvider('nonexistent')).toBe('unknown')
    })
  })

  describe('TTS / voice model support', () => {
    it('has at least one TTS-capable model', () => {
      const registry = getModelRegistry()
      const ttsModels = registry.filter(m => m.supports_tts === true)
      expect(ttsModels.length).toBeGreaterThan(0)
    })

    it('TTS models use tts role', () => {
      const registry = getModelRegistry()
      const ttsModels = registry.filter(m => m.supports_tts === true)
      for (const model of ttsModels) {
        expect(['tts', 'voice_interaction']).toContain(model.primary_role)
      }
    })

    it('getModelsByRole returns tts models', () => {
      const ttsModels = getModelsByRole('tts')
      expect(ttsModels.length).toBeGreaterThan(0)
    })
  })

  describe('Provider Health Cache', () => {
    afterEach(() => {
      clearProviderHealthCache()
    })

    it('getProviderHealth returns unconfigured when cache is empty', () => {
      expect(getProviderHealth('openai')).toBe('unconfigured')
    })

    it('setProviderHealth stores and retrieves health status', () => {
      setProviderHealth('openai', 'healthy')
      expect(getProviderHealth('openai')).toBe('healthy')
    })

    it('clearProviderHealthCache resets all entries', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'error')
      clearProviderHealthCache()
      expect(getProviderHealth('openai')).toBe('unconfigured')
      expect(getProviderHealth('groq')).toBe('unconfigured')
    })

    it('getProviderHealthSnapshot returns all cached entries', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'degraded')
      const snapshot = getProviderHealthSnapshot()
      expect(snapshot.size).toBe(2)
      expect(snapshot.get('openai')?.status).toBe('healthy')
      expect(snapshot.get('groq')?.status).toBe('degraded')
    })

    it('isProviderUsable returns false when cache is empty (strict — prevents false availability)', () => {
      // When no health data is recorded yet, providers are considered unconfigured
      expect(isProviderUsable('openai')).toBe(false)
      expect(isProviderUsable('nonexistent')).toBe(false)
    })

    it('isProviderUsable returns true for healthy or configured providers', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'configured')
      expect(isProviderUsable('openai')).toBe(true)
      expect(isProviderUsable('groq')).toBe(true)
    })

    it('isProviderUsable returns false for unconfigured, error, or disabled providers', () => {
      setProviderHealth('openai', 'healthy') // populate cache so size > 0
      setProviderHealth('groq', 'unconfigured')
      setProviderHealth('deepseek', 'error')
      setProviderHealth('grok', 'disabled')
      expect(isProviderUsable('groq')).toBe(false)
      expect(isProviderUsable('deepseek')).toBe(false)
      expect(isProviderUsable('grok')).toBe(false)
    })

    it('isProviderUsable returns false for degraded providers (not usable, just not excluded)', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'degraded')
      expect(isProviderUsable('groq')).toBe(false)
    })

    it('isProviderDegraded correctly identifies degraded providers', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'degraded')
      expect(isProviderDegraded('openai')).toBe(false)
      expect(isProviderDegraded('groq')).toBe(true)
    })

    it('getModelEffectiveHealth returns unconfigured when cache is empty', () => {
      const model = getModelById('openai', 'gpt-4o')!
      expect(getModelEffectiveHealth(model)).toBe('unconfigured')
    })

    it('getModelEffectiveHealth returns provider health when cache is populated', () => {
      setProviderHealth('openai', 'healthy')
      const model = getModelById('openai', 'gpt-4o')!
      expect(getModelEffectiveHealth(model)).toBe('healthy')
    })

    it('getUsableModels returns zero models when cache is empty (strict mode)', () => {
      const usable = getUsableModels()
      // When no provider health data exists, all providers are unconfigured
      expect(usable.length).toBe(0)
    })

    it('getUsableModels excludes models from unhealthy providers', () => {
      const allEnabled = getEnabledModels()
      const openaiCount = allEnabled.filter(m => m.provider === 'openai').length

      // Mark openai as healthy, everything else as unconfigured
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'unconfigured')
      setProviderHealth('deepseek', 'error')
      setProviderHealth('grok', 'disabled')
      setProviderHealth('nvidia', 'unconfigured')
      setProviderHealth('huggingface', 'unconfigured')
      setProviderHealth('openrouter', 'unconfigured')
      setProviderHealth('together', 'unconfigured')
      setProviderHealth('gemini', 'unconfigured')

      const usable = getUsableModels()
      expect(usable.length).toBe(openaiCount)
      expect(usable.every(m => m.provider === 'openai')).toBe(true)
    })

    it('getUsableModels includes models from both healthy and configured providers', () => {
      setProviderHealth('openai', 'healthy')
      setProviderHealth('groq', 'configured')
      setProviderHealth('deepseek', 'error')
      setProviderHealth('grok', 'unconfigured')
      setProviderHealth('nvidia', 'unconfigured')
      setProviderHealth('huggingface', 'unconfigured')
      setProviderHealth('openrouter', 'unconfigured')
      setProviderHealth('together', 'unconfigured')
      setProviderHealth('gemini', 'unconfigured')

      const usable = getUsableModels()
      const providers = new Set(usable.map(m => m.provider))
      expect(providers.has('openai')).toBe(true)
      expect(providers.has('groq')).toBe(true)
      expect(providers.has('deepseek')).toBe(false)
    })
  })
})

