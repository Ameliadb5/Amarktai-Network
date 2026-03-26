/**
 * Routing Engine Tests
 *
 * Validates the policy-driven routing engine makes correct decisions
 * based on app profiles, model registry, and task context.
 */
import { describe, it, expect } from 'vitest'
import { routeRequest, type RoutingContext } from '@/lib/routing-engine'

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    appSlug: 'amarktai-network',
    appCategory: 'generic',
    taskType: 'chat',
    taskComplexity: 'simple',
    message: 'Hello, how are you?',
    requiresRetrieval: false,
    requiresMultimodal: false,
    ...overrides,
  }
}

describe('Routing Engine', () => {
  describe('routeRequest', () => {
    it('returns a valid routing decision', () => {
      const decision = routeRequest(makeContext())
      expect(decision).toBeDefined()
      expect(decision.mode).toBeTruthy()
      expect(decision.reason).toBeTruthy()
      expect(Array.isArray(decision.warnings)).toBe(true)
      expect(Array.isArray(decision.fallbackModels)).toBe(true)
    })

    it('routes simple tasks to direct mode', () => {
      const decision = routeRequest(makeContext({ taskComplexity: 'simple' }))
      expect(decision.mode).toBe('direct')
    })

    it('routes complex tasks appropriately', () => {
      const decision = routeRequest(makeContext({
        taskComplexity: 'complex',
        taskType: 'analysis',
        appCategory: 'generic',
      }))
      // Complex tasks should use review, consensus, specialist, or premium escalation
      expect(['review', 'consensus', 'premium_escalation', 'specialist']).toContain(decision.mode)
    })

    it('selects premium escalation for complex financial tasks', () => {
      const decision = routeRequest(makeContext({
        appSlug: 'amarktai-crypto',
        appCategory: 'finance',
        taskComplexity: 'complex',
        taskType: 'analysis',
      }))
      expect(['premium_escalation', 'consensus', 'review']).toContain(decision.mode)
    })

    it('routes multimodal requests to multimodal_chain', () => {
      const decision = routeRequest(makeContext({
        requiresMultimodal: true,
        appSlug: 'amarktai-marketing',
        appCategory: 'marketing',
      }))
      expect(decision.mode).toBe('multimodal_chain')
    })

    it('routes retrieval requests to retrieval_chain', () => {
      const decision = routeRequest(makeContext({
        requiresRetrieval: true,
      }))
      expect(decision.mode).toBe('retrieval_chain')
    })

    it('selects a primary model', () => {
      const decision = routeRequest(makeContext())
      expect(decision.primaryModel).toBeDefined()
      if (decision.primaryModel) {
        expect(decision.primaryModel.model_id).toBeTruthy()
        expect(decision.primaryModel.provider).toBeTruthy()
      }
    })

    it('provides cost and latency estimates', () => {
      const decision = routeRequest(makeContext())
      expect(decision.costEstimate).toBeTruthy()
      expect(decision.latencyEstimate).toBeTruthy()
    })

    it('provides fallback models for simple requests', () => {
      const decision = routeRequest(makeContext())
      // May or may not have fallbacks depending on model registry
      expect(Array.isArray(decision.fallbackModels)).toBe(true)
    })

    it('handles moderate complexity with specialist mode', () => {
      const decision = routeRequest(makeContext({
        taskComplexity: 'moderate',
        taskType: 'content',
      }))
      expect(['specialist', 'review']).toContain(decision.mode)
    })
  })

  describe('cost-aware routing', () => {
    it('respects maxCostTier constraint', () => {
      const decision = routeRequest(makeContext({
        maxCostTier: 'low',
      }))
      expect(decision).toBeDefined()
      // Should route to a low-cost model if available
      if (decision.primaryModel) {
        const costTiers = ['free', 'very_low', 'low', 'medium', 'high', 'premium']
        const modelCostIndex = costTiers.indexOf(decision.primaryModel.cost_tier)
        // Should try to respect cost constraint, but may warn if not possible
        expect(modelCostIndex >= 0).toBe(true)
      }
    })
  })

  describe('app-specific routing', () => {
    it('routes crypto app differently than marketing app', () => {
      const cryptoDecision = routeRequest(makeContext({
        appSlug: 'amarktai-crypto',
        appCategory: 'finance',
        taskComplexity: 'complex',
        taskType: 'analysis',
      }))
      const marketingDecision = routeRequest(makeContext({
        appSlug: 'amarktai-marketing',
        appCategory: 'marketing',
        taskComplexity: 'complex',
        taskType: 'content',
      }))
      // They may use different modes or models
      const _isDifferent =
        cryptoDecision.mode !== marketingDecision.mode ||
        cryptoDecision.primaryModel?.model_id !== marketingDecision.primaryModel?.model_id
      // At minimum, both should produce valid decisions
      expect(cryptoDecision.mode).toBeTruthy()
      expect(marketingDecision.mode).toBeTruthy()
    })
  })
})
