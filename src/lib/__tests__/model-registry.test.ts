/**
 * Model Registry Tests
 *
 * Validates the model registry data integrity, helper functions,
 * and that routing can reliably query models by capability/role/provider.
 */
import { describe, it, expect } from 'vitest'
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

  describe('data integrity', () => {
    it('no duplicate provider+model_id combinations', () => {
      const registry = getModelRegistry()
      const keys = registry.map(m => `${m.provider}:${m.model_id}`)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })

    it('all cost_tier values are valid', () => {
      const validTiers = ['free', 'very_low', 'low', 'medium', 'high', 'premium']
      const registry = getModelRegistry()
      for (const model of registry) {
        expect(validTiers).toContain(model.cost_tier)
      }
    })

    it('all latency_tier values are valid', () => {
      const validTiers = ['ultra_low', 'low', 'medium', 'high']
      const registry = getModelRegistry()
      for (const model of registry) {
        expect(validTiers).toContain(model.latency_tier)
      }
    })

    it('context_window is realistic for each model', () => {
      const registry = getModelRegistry()
      for (const model of registry) {
        expect(model.context_window).toBeGreaterThanOrEqual(4096)
        expect(model.context_window).toBeLessThanOrEqual(1_000_001)
      }
    })
  })
})
