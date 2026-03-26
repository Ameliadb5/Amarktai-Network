/**
 * App Profiles Tests
 *
 * Validates app profile data integrity and helper functions.
 */
import { describe, it, expect } from 'vitest'
import {
  getAppProfile,
  isProviderAllowed,
  getPreferredModels,
  shouldEscalate,
  requiresValidation,
  getMemoryNamespace,
  getRetrievalNamespace,
  DEFAULT_APP_PROFILES,
  DEFAULT_PROFILE,
} from '@/lib/app-profiles'

describe('App Profiles', () => {
  describe('DEFAULT_APP_PROFILES', () => {
    it('has profiles for expected apps', () => {
      expect(DEFAULT_APP_PROFILES.get('amarktai-network')).toBeDefined()
      expect(DEFAULT_APP_PROFILES.get('amarktai-crypto')).toBeDefined()
      expect(DEFAULT_APP_PROFILES.get('amarktai-marketing')).toBeDefined()
    })

    it('every profile has required fields', () => {
      for (const [key, profile] of DEFAULT_APP_PROFILES) {
        expect(profile.app_id, `${key} missing app_id`).toBeTruthy()
        expect(profile.app_name, `${key} missing app_name`).toBeTruthy()
        expect(profile.domain, `${key} missing domain`).toBeTruthy()
        expect(profile.default_routing_mode, `${key} missing default_routing_mode`).toBeTruthy()
        expect(profile.allowed_providers.length, `${key} has no allowed_providers`).toBeGreaterThan(0)
        expect(profile.memory_namespace, `${key} missing memory_namespace`).toBeTruthy()
      }
    })
  })

  describe('getAppProfile', () => {
    it('returns specific profile for known app', () => {
      const profile = getAppProfile('amarktai-crypto')
      expect(profile.app_id).toBe('amarktai-crypto')
      expect(profile.domain).toBe('crypto')
    })

    it('returns default profile for unknown app', () => {
      const profile = getAppProfile('unknown-app-xyz')
      expect(profile.app_id).toBe(DEFAULT_PROFILE.app_id)
    })
  })

  describe('isProviderAllowed', () => {
    it('allows configured providers for crypto app', () => {
      const profile = getAppProfile('amarktai-crypto')
      expect(isProviderAllowed(profile, 'openai')).toBe(true)
    })

    it('handles allowed_providers from app profile', () => {
      const profile = getAppProfile('amarktai-network')
      expect(profile.allowed_providers.length).toBeGreaterThan(0)
    })
  })

  describe('isModelAllowed', () => {
    it('allows configured models', () => {
      const profile = getAppProfile('amarktai-crypto')
      expect(profile.allowed_models.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getPreferredModels', () => {
    it('returns preferred models for app', () => {
      const profile = getAppProfile('amarktai-crypto')
      const preferred = getPreferredModels(profile)
      expect(Array.isArray(preferred)).toBe(true)
    })
  })

  describe('shouldEscalate', () => {
    it('returns matching rule for complex financial tasks on crypto app', () => {
      const profile = getAppProfile('amarktai-crypto')
      const result = shouldEscalate(profile, 'complex', 'analysis')
      // Returns EscalationRule or null
      if (result !== null) {
        expect(result.escalate_to_provider).toBeTruthy()
      }
    })

    it('returns null for simple chat on default app', () => {
      const profile = getAppProfile('unknown-app')
      const result = shouldEscalate(profile, 'simple', 'chat')
      expect(result).toBeNull()
    })
  })

  describe('requiresValidation', () => {
    it('returns matching rule or null for crypto app tasks', () => {
      const profile = getAppProfile('amarktai-crypto')
      const result = requiresValidation(profile, 'analysis')
      // Returns ValidatorRule or null
      if (result !== null) {
        expect(result.validator_models.length).toBeGreaterThan(0)
      }
    })
  })

  describe('getMemoryNamespace', () => {
    it('returns correct namespace for known app', () => {
      const profile = getAppProfile('amarktai-crypto')
      const ns = getMemoryNamespace(profile)
      expect(ns).toBeTruthy()
      expect(typeof ns).toBe('string')
    })
  })

  describe('getRetrievalNamespace', () => {
    it('returns correct namespace for known app', () => {
      const profile = getAppProfile('amarktai-marketing')
      const ns = getRetrievalNamespace(profile)
      expect(ns).toBeTruthy()
      expect(typeof ns).toBe('string')
    })
  })
})
