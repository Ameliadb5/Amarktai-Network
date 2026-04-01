/**
 * Core Intelligence Tests — AmarktAI Network
 *
 * Tests for:
 *  - Capability Engine (classification, routing, missing-dependency messaging)
 *  - Strategy Engine (goals, KPIs, recommendations)
 *  - Cross-App Learning (pattern discovery, transfer, application)
 *  - HuggingFace Fallback (fallback resolution, status)
 *  - Connector SDK (class structure, snippet generation)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
  getCapabilityStatus,
  getDetailedCapabilityStatus,
  isCapabilityAvailable,
  CAPABILITY_MAP,
  BACKEND_ROUTE_EXISTS,
  type CapabilityClass,
} from '../capability-engine'
import {
  initializeStrategy,
  getAppStrategy,
  updateKpis,
  generateRecommendations,
  addGoal,
  removeGoal,
  setStrategyState,
  getAllStrategies,
  getStrategySummary,
  resetStrategies,
} from '../strategy-engine'
import {
  recordPattern,
  discoverPatterns,
  getApplicablePatterns,
  recordPatternApplication,
  getCrossAppLearningStatus,
  getAllPatterns,
  resetPatterns,
} from '../cross-app-learning'
import {
  getHfFallback,
  getHfFallbacksForGaps,
  getHfFallbackStatus,
  HF_FALLBACK_MODELS,
} from '../hf-fallback'
import {
  AmarktAIConnector,
  generateConnectorSnippet,
} from '../connector-sdk'

/* ================================================================
 * CAPABILITY ENGINE
 * ================================================================ */

describe('Capability Engine', () => {
  describe('classifyCapabilities', () => {
    it('classifies image generation tasks', () => {
      const caps = classifyCapabilities('image_gen', 'generate an image of a cat')
      expect(caps).toContain('image_generation')
    })

    it('classifies coding tasks', () => {
      const caps = classifyCapabilities('coding', 'write a function to sort an array')
      expect(caps).toContain('coding')
    })

    it('classifies deep reasoning tasks', () => {
      const caps = classifyCapabilities('analysis', 'analyze the logical implications')
      expect(caps).toContain('deep_reasoning')
    })

    it('classifies voice input tasks', () => {
      const caps = classifyCapabilities('stt', 'transcribe this audio')
      expect(caps).toContain('voice_input')
    })

    it('classifies video generation tasks', () => {
      const caps = classifyCapabilities('video', 'generate a video of a sunset')
      expect(caps).toContain('video_generation')
    })

    it('classifies video planning tasks', () => {
      const caps = classifyCapabilities('media', 'plan a video storyboard for marketing')
      expect(caps).toContain('video_planning')
    })

    it('classifies video planning from reel/animation patterns', () => {
      const caps = classifyCapabilities('content', 'create a reel animation for instagram')
      expect(caps).toContain('video_planning')
    })

    it('classifies voice output / TTS tasks', () => {
      const caps = classifyCapabilities('media', 'text to speech for this article')
      expect(caps).toContain('voice_output')
    })

    it('classifies summarization tasks', () => {
      const caps = classifyCapabilities('summarize', 'summarize this article briefly')
      expect(caps).toContain('summarization')
    })

    it('classifies adult tasks', () => {
      const caps = classifyCapabilities('nsfw', 'adult 18+ content')
      expect(caps).toContain('adult_18plus_image')
    })

    it('defaults to general_chat when no specific pattern matches', () => {
      const caps = classifyCapabilities('misc', 'hello how are you')
      expect(caps).toEqual(['general_chat'])
    })

    it('can detect multiple capabilities in one request', () => {
      const caps = classifyCapabilities('multimodal', 'analyze this image and summarize')
      expect(caps.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('resolveCapabilityRoutes', () => {
    it('returns routes for requested capabilities', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['general_chat'],
      })
      expect(result.routes).toHaveLength(1)
      expect(result.routes[0].capability).toBe('general_chat')
    })

    it('blocks adult capability without adult mode', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['adult_18plus_image'],
        adultMode: false,
      })
      expect(result.routes[0].available).toBe(false)
      // Backend route guard fires first since no reliable provider exists
      expect(result.routes[0].missingMessage).toContain('Route not implemented')
    })

    it('respects execution preference', () => {
      const cheap = resolveCapabilityRoutes({
        capabilities: ['general_chat'],
        preference: 'cheap',
      })
      expect(cheap.appliedPreference).toBe('cheap')

      const premium = resolveCapabilityRoutes({
        capabilities: ['general_chat'],
        preference: 'premium',
      })
      expect(premium.appliedPreference).toBe('premium')
    })

    it('handles unknown capability gracefully', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['nonexistent_cap' as CapabilityClass],
      })
      expect(result.allSatisfied).toBe(false)
      expect(result.missingCapabilities.length).toBeGreaterThan(0)
    })

    it('returns missing message with suggested providers', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['general_chat'],
        allowedProviders: ['nonexistent_provider'],
      })
      // No models from nonexistent provider
      expect(result.routes[0].available).toBe(false)
      expect(result.routes[0].missingMessage).toBeTruthy()
    })
  })

  describe('capability status', () => {
    it('returns status for all capability classes', () => {
      const status = getCapabilityStatus()
      const allCaps = Object.keys(CAPABILITY_MAP) as CapabilityClass[]
      for (const cap of allCaps) {
        expect(typeof status[cap]).toBe('boolean')
      }
    })
  })

  describe('backend route existence', () => {
    it('has a route entry for every capability class', () => {
      const allCaps = Object.keys(CAPABILITY_MAP) as CapabilityClass[]
      for (const cap of allCaps) {
        expect(typeof BACKEND_ROUTE_EXISTS[cap]).toBe('boolean')
      }
    })

    it('marks realtime_voice as having no backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.realtime_voice).toBe(false)
    })

    it('marks video_generation as having no backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(false)
    })

    it('marks reranking as having no backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.reranking).toBe(false)
    })

    it('marks adult_18plus_image as having no backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.adult_18plus_image).toBe(false)
    })

    it('marks general_chat as having a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.general_chat).toBe(true)
    })

    it('marks voice_input as having a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.voice_input).toBe(true)
    })

    it('marks voice_output as having a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.voice_output).toBe(true)
    })

    it('marks image_generation as having a backend route', () => {
      expect(BACKEND_ROUTE_EXISTS.image_generation).toBe(true)
    })

    it('marks video_planning as having a backend route (always possible via chat)', () => {
      expect(BACKEND_ROUTE_EXISTS.video_planning).toBe(true)
    })

    it('marks video_generation as having no backend route (no real provider wired)', () => {
      expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(false)
    })
  })

  describe('isCapabilityAvailable', () => {
    it('returns false for capabilities without backend routes', () => {
      expect(isCapabilityAvailable('realtime_voice')).toBe(false)
      expect(isCapabilityAvailable('video_generation')).toBe(false)
      expect(isCapabilityAvailable('reranking')).toBe(false)
      expect(isCapabilityAvailable('adult_18plus_image')).toBe(false)
    })
  })

  describe('resolveCapabilityRoutes — backend route guard', () => {
    it('blocks capabilities without backend routes with specific message', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['realtime_voice'],
      })
      expect(result.routes[0].available).toBe(false)
      expect(result.routes[0].missingMessage).toContain('Route not implemented')
    })

    it('blocks video_generation with route not implemented message', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['video_generation'],
      })
      expect(result.routes[0].available).toBe(false)
      expect(result.routes[0].missingMessage).toContain('Route not implemented')
    })

    it('blocks reranking with route not implemented message', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['reranking'],
      })
      expect(result.routes[0].available).toBe(false)
      expect(result.routes[0].missingMessage).toContain('Route not implemented')
    })
  })

  describe('getDetailedCapabilityStatus', () => {
    it('returns entries for all capability classes', () => {
      const entries = getDetailedCapabilityStatus()
      const allCaps = Object.keys(CAPABILITY_MAP) as CapabilityClass[]
      expect(entries.length).toBe(allCaps.length)
    })

    it('each entry has capability, available, reason, and routeExists fields', () => {
      const entries = getDetailedCapabilityStatus()
      for (const entry of entries) {
        expect(typeof entry.capability).toBe('string')
        expect(typeof entry.available).toBe('boolean')
        expect(typeof entry.routeExists).toBe('boolean')
        if (!entry.available) {
          expect(typeof entry.reason).toBe('string')
          expect(entry.reason!.length).toBeGreaterThan(0)
        } else {
          expect(entry.reason).toBeNull()
        }
      }
    })

    it('unavailable capabilities without routes have "Route not implemented" reason', () => {
      const entries = getDetailedCapabilityStatus()
      const noRouteEntries = entries.filter(e => !e.routeExists)
      for (const entry of noRouteEntries) {
        expect(entry.available).toBe(false)
        expect(entry.reason).toContain('Route not implemented')
      }
    })

    it('marks realtime_voice, video_generation, reranking, adult_18plus as unavailable', () => {
      const entries = getDetailedCapabilityStatus()
      const mustBeUnavailable = ['realtime_voice', 'video_generation', 'reranking', 'adult_18plus_image']
      for (const capName of mustBeUnavailable) {
        const entry = entries.find(e => e.capability === capName)
        expect(entry).toBeDefined()
        expect(entry!.available).toBe(false)
        expect(entry!.reason).toBeTruthy()
      }
    })

    it('video_planning exists as a capability class', () => {
      const entries = getDetailedCapabilityStatus()
      const planning = entries.find(e => e.capability === 'video_planning')
      expect(planning).toBeDefined()
      expect(planning!.routeExists).toBe(true)
    })

    it('video_generation is truthfully marked unavailable (no real provider)', () => {
      const entries = getDetailedCapabilityStatus()
      const gen = entries.find(e => e.capability === 'video_generation')
      expect(gen).toBeDefined()
      expect(gen!.available).toBe(false)
      expect(gen!.routeExists).toBe(false)
      expect(gen!.reason).toContain('Route not implemented')
    })

    it('voice_input route exists and is truthfully tracked', () => {
      const entries = getDetailedCapabilityStatus()
      const stt = entries.find(e => e.capability === 'voice_input')
      expect(stt).toBeDefined()
      expect(stt!.routeExists).toBe(true)
    })

    it('voice_output route exists and is truthfully tracked', () => {
      const entries = getDetailedCapabilityStatus()
      const tts = entries.find(e => e.capability === 'voice_output')
      expect(tts).toBeDefined()
      expect(tts!.routeExists).toBe(true)
    })
  })
})

/* ================================================================
 * STRATEGY ENGINE
 * ================================================================ */

describe('Strategy Engine', () => {
  beforeEach(() => {
    resetStrategies()
  })

  describe('initializeStrategy', () => {
    it('creates strategy with template goals and KPIs for marketing app', () => {
      const strategy = initializeStrategy('app1', 'Marketing App', 'marketing')
      expect(strategy.appSlug).toBe('app1')
      expect(strategy.appType).toBe('marketing')
      expect(strategy.goals.length).toBeGreaterThan(0)
      expect(strategy.kpis.length).toBeGreaterThan(0)
      expect(strategy.strategyState).toBe('setup')
    })

    it('creates strategy with general template for unknown app type', () => {
      const strategy = initializeStrategy('app2', 'My App', 'unknown_type')
      expect(strategy.goals.length).toBeGreaterThan(0)
      expect(strategy.kpis.length).toBeGreaterThan(0)
    })

    it('creates strategy with support template', () => {
      const strategy = initializeStrategy('support1', 'Help Desk', 'support')
      expect(strategy.goals.some(g => g.metric === 'unresolved_tickets')).toBe(true)
      expect(strategy.kpis.some(k => k.metric === 'csat')).toBe(true)
    })

    it('creates strategy with trading template', () => {
      const strategy = initializeStrategy('trade1', 'Trading Bot', 'trading')
      expect(strategy.goals.some(g => g.metric === 'decision_accuracy')).toBe(true)
    })
  })

  describe('getAppStrategy', () => {
    it('returns null for non-existent app', () => {
      expect(getAppStrategy('nonexistent')).toBeNull()
    })

    it('returns initialized strategy', () => {
      initializeStrategy('app1', 'My App', 'general')
      const strategy = getAppStrategy('app1')
      expect(strategy).not.toBeNull()
      expect(strategy!.appSlug).toBe('app1')
    })
  })

  describe('updateKpis', () => {
    it('updates KPI current values and computes status', () => {
      initializeStrategy('app1', 'My App', 'general')
      const updated = updateKpis('app1', { task_success_rate: 98 })
      expect(updated).not.toBeNull()
      const kpi = updated!.kpis.find(k => k.metric === 'task_success_rate')
      expect(kpi!.currentValue).toBe(98)
      expect(kpi!.status).toBe('achieved')
    })

    it('marks KPI as behind when far from target', () => {
      initializeStrategy('app1', 'My App', 'general')
      const updated = updateKpis('app1', { task_success_rate: 30 })
      const kpi = updated!.kpis.find(k => k.metric === 'task_success_rate')
      expect(kpi!.status).toBe('behind')
    })

    it('returns null for unknown app', () => {
      expect(updateKpis('nonexistent', { x: 1 })).toBeNull()
    })
  })

  describe('goals management', () => {
    it('adds a custom goal', () => {
      initializeStrategy('app1', 'My App', 'general')
      const updated = addGoal('app1', {
        label: 'Custom Goal',
        metric: 'custom',
        targetValue: 100,
        currentValue: null,
        direction: 'increase',
        priority: 'high',
      })
      expect(updated!.goals.some(g => g.label === 'Custom Goal')).toBe(true)
    })

    it('removes a goal', () => {
      initializeStrategy('app1', 'My App', 'general')
      const strategy = getAppStrategy('app1')!
      const goalId = strategy.goals[0].id
      expect(removeGoal('app1', goalId)).toBe(true)
      expect(getAppStrategy('app1')!.goals.find(g => g.id === goalId)).toBeUndefined()
    })

    it('returns false when removing nonexistent goal', () => {
      initializeStrategy('app1', 'My App', 'general')
      expect(removeGoal('app1', 'fake_id')).toBe(false)
    })
  })

  describe('generateRecommendations', () => {
    it('generates recommendations based on KPI state', () => {
      initializeStrategy('app1', 'My App', 'general')
      updateKpis('app1', { task_success_rate: 30 })
      const recs = generateRecommendations('app1')
      expect(recs.length).toBeGreaterThan(0)
      expect(recs.some(r => r.title.includes('behind'))).toBe(true)
    })

    it('generates recommendations from outcome data', () => {
      initializeStrategy('app1', 'My App', 'general')
      const recs = generateRecommendations('app1', {
        successRate: 70,
        fallbackRate: 25,
        avgLatencyMs: 3000,
      })
      expect(recs.some(r => r.type === 'routing')).toBe(true)
    })

    it('returns empty for unknown app', () => {
      expect(generateRecommendations('nonexistent')).toEqual([])
    })
  })

  describe('strategy state and summary', () => {
    it('sets strategy state', () => {
      initializeStrategy('app1', 'My App', 'general')
      expect(setStrategyState('app1', 'active')).toBe(true)
      expect(getAppStrategy('app1')!.strategyState).toBe('active')
    })

    it('returns false for unknown app', () => {
      expect(setStrategyState('nonexistent', 'active')).toBe(false)
    })

    it('provides summary across all strategies', () => {
      initializeStrategy('app1', 'App 1', 'general')
      initializeStrategy('app2', 'App 2', 'marketing')
      const summary = getStrategySummary()
      expect(summary.totalApps).toBe(2)
    })

    it('lists all strategies', () => {
      initializeStrategy('app1', 'App 1', 'general')
      initializeStrategy('app2', 'App 2', 'support')
      expect(getAllStrategies()).toHaveLength(2)
    })
  })
})

/* ================================================================
 * CROSS-APP LEARNING
 * ================================================================ */

describe('Cross-App Learning', () => {
  beforeEach(() => {
    resetPatterns()
  })

  describe('recordPattern', () => {
    it('records a pattern with auto-generated id', () => {
      const pattern = recordPattern({
        patternType: 'model_performance',
        sourceApp: 'app1',
        relevantAppTypes: ['marketing'],
        capability: 'general_chat',
        description: 'GPT-4o-mini works great for marketing chat',
        confidence: 0.9,
        evidence: {
          sampleSize: 100,
          metric: 'success_rate',
          before: null,
          after: 0.95,
          improvement: null,
          model: 'gpt-4o-mini',
        },
      })
      expect(pattern.id).toBeTruthy()
      expect(pattern.applicationCount).toBe(0)
      expect(pattern.applicationSuccessRate).toBeNull()
    })
  })

  describe('discoverPatterns', () => {
    it('discovers model performance patterns from outcome data', () => {
      const outcomes = Array.from({ length: 10 }, () => ({
        appSlug: 'app1',
        appType: 'marketing',
        taskType: 'chat',
        capability: 'general_chat',
        providerKey: 'openai',
        model: 'gpt-4o-mini',
        success: true,
        latencyMs: 200,
        costUsd: 0.001,
        fallbackUsed: false,
      }))
      const patterns = discoverPatterns(outcomes)
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns.some(p => p.patternType === 'model_performance')).toBe(true)
    })

    it('discovers cost-saving patterns', () => {
      const outcomes = Array.from({ length: 10 }, () => ({
        appSlug: 'app1',
        appType: 'general',
        taskType: 'chat',
        capability: 'general_chat',
        providerKey: 'groq',
        model: 'llama-3.3-70b-versatile',
        success: true,
        latencyMs: 100,
        costUsd: 0.001,
        fallbackUsed: false,
      }))
      const patterns = discoverPatterns(outcomes)
      expect(patterns.some(p => p.patternType === 'cost_saving')).toBe(true)
    })

    it('discovers latency improvement patterns', () => {
      const outcomes = Array.from({ length: 10 }, () => ({
        appSlug: 'app1',
        appType: 'support',
        taskType: 'chat',
        capability: 'general_chat',
        providerKey: 'groq',
        model: 'llama-fast',
        success: true,
        latencyMs: 100,
        costUsd: 0.002,
        fallbackUsed: false,
      }))
      const patterns = discoverPatterns(outcomes)
      expect(patterns.some(p => p.patternType === 'latency_improvement')).toBe(true)
    })

    it('discovers fallback path patterns', () => {
      const outcomes = Array.from({ length: 5 }, () => ({
        appSlug: 'app1',
        appType: 'general',
        taskType: 'chat',
        capability: 'general_chat',
        providerKey: 'deepseek',
        model: 'deepseek-chat',
        success: true,
        latencyMs: 300,
        costUsd: 0.002,
        fallbackUsed: true,
      }))
      const patterns = discoverPatterns(outcomes)
      expect(patterns.some(p => p.patternType === 'fallback_path')).toBe(true)
    })

    it('returns empty for insufficient data', () => {
      const patterns = discoverPatterns([])
      expect(patterns).toEqual([])
    })
  })

  describe('getApplicablePatterns', () => {
    it('returns patterns relevant to target app type', () => {
      recordPattern({
        patternType: 'model_performance',
        sourceApp: 'app1',
        relevantAppTypes: ['marketing'],
        capability: 'general_chat',
        description: 'Great model for marketing',
        confidence: 0.9,
        evidence: { sampleSize: 50, metric: 'success_rate', before: null, after: 0.95, improvement: null, model: 'gpt-4o-mini' },
      })
      const insights = getApplicablePatterns('app2', 'marketing')
      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0].targetApp).toBe('app2')
    })

    it('excludes patterns from the same app', () => {
      recordPattern({
        patternType: 'model_performance',
        sourceApp: 'app1',
        relevantAppTypes: [],
        capability: 'general_chat',
        description: 'Universal pattern',
        confidence: 0.9,
        evidence: { sampleSize: 50, metric: 'success_rate', before: null, after: 0.95, improvement: null },
      })
      const insights = getApplicablePatterns('app1', 'general')
      expect(insights).toHaveLength(0)
    })

    it('reduces confidence for non-matching app types', () => {
      recordPattern({
        patternType: 'model_performance',
        sourceApp: 'app1',
        relevantAppTypes: ['marketing'],
        capability: 'general_chat',
        description: 'Marketing-specific',
        confidence: 0.9,
        evidence: { sampleSize: 50, metric: 'success_rate', before: null, after: 0.95, improvement: null },
      })
      const insights = getApplicablePatterns('app2', 'support')
      // Should still include but with lower score
      if (insights.length > 0) {
        expect(insights[0].applicabilityScore).toBeLessThan(0.9)
      }
    })
  })

  describe('recordPatternApplication', () => {
    it('tracks application count and success rate', () => {
      const pattern = recordPattern({
        patternType: 'cost_saving',
        sourceApp: 'app1',
        relevantAppTypes: [],
        capability: 'general_chat',
        description: 'Cost saving pattern',
        confidence: 0.8,
        evidence: { sampleSize: 20, metric: 'cost', before: null, after: 0.001, improvement: null },
      })
      recordPatternApplication(pattern.id, true)
      recordPatternApplication(pattern.id, true)
      recordPatternApplication(pattern.id, false)

      const all = getAllPatterns()
      const updated = all.find(p => p.id === pattern.id)!
      expect(updated.applicationCount).toBe(3)
      expect(updated.applicationSuccessRate).toBeCloseTo(0.667, 1)
    })

    it('returns false for unknown pattern', () => {
      expect(recordPatternApplication('nonexistent', true)).toBe(false)
    })
  })

  describe('getCrossAppLearningStatus', () => {
    it('provides status summary', () => {
      recordPattern({
        patternType: 'model_performance',
        sourceApp: 'app1',
        relevantAppTypes: [],
        capability: 'general_chat',
        description: 'Test',
        confidence: 0.9,
        evidence: { sampleSize: 10, metric: 'x', before: null, after: 1, improvement: null },
      })
      const status = getCrossAppLearningStatus()
      expect(status.totalPatterns).toBe(1)
      expect(status.patternsByType.model_performance).toBe(1)
    })
  })
})

/* ================================================================
 * HUGGINGFACE FALLBACK
 * ================================================================ */

describe('HuggingFace Fallback', () => {
  describe('getHfFallback', () => {
    it('returns fallback models for image generation', () => {
      const result = getHfFallback('image_generation')
      // Result depends on whether HF is configured
      expect(result.capability).toBe('image_generation')
      expect(typeof result.available).toBe('boolean')
    })

    it('returns fallback models for embeddings', () => {
      const result = getHfFallback('embeddings')
      expect(result.capability).toBe('embeddings')
    })

    it('handles capability with no HF models', () => {
      const result = getHfFallback('deep_reasoning')
      expect(result.capability).toBe('deep_reasoning')
      // deep_reasoning has no HF fallback models — result is unavailable
      // either because HF is not configured or because no models are cataloged
      expect(result.available).toBe(false)
      expect(result.reason).toBeTruthy()
    })
  })

  describe('getHfFallbacksForGaps', () => {
    it('returns fallback options for multiple capabilities', () => {
      const results = getHfFallbacksForGaps(['image_generation', 'embeddings', 'reranking'])
      expect(results).toHaveLength(3)
      expect(results[0].capability).toBe('image_generation')
      expect(results[1].capability).toBe('embeddings')
      expect(results[2].capability).toBe('reranking')
    })
  })

  describe('getHfFallbackStatus', () => {
    it('returns status summary', () => {
      const status = getHfFallbackStatus()
      expect(typeof status.providerHealthy).toBe('boolean')
      expect(typeof status.registeredModels).toBe('number')
      expect(Array.isArray(status.fallbackCapabilities)).toBe(true)
      expect(status.fallbackCapabilities.length).toBeGreaterThan(0)
    })
  })

  describe('HF_FALLBACK_MODELS', () => {
    it('has models for key capabilities', () => {
      expect(HF_FALLBACK_MODELS.image_generation).toBeDefined()
      expect(HF_FALLBACK_MODELS.embeddings).toBeDefined()
      expect(HF_FALLBACK_MODELS.reranking).toBeDefined()
      expect(HF_FALLBACK_MODELS.voice_input).toBeDefined()
      expect(HF_FALLBACK_MODELS.voice_output).toBeDefined()
    })
  })
})

/* ================================================================
 * CONNECTOR SDK
 * ================================================================ */

describe('Connector SDK', () => {
  describe('AmarktAIConnector', () => {
    it('creates connector with config', () => {
      const connector = new AmarktAIConnector({
        brainUrl: 'https://brain.example.com',
        appId: 'test-app',
        appSecret: 'test-secret',
      })
      expect(connector.isConnected()).toBe(false)
    })

    it('supports disconnect', () => {
      const connector = new AmarktAIConnector({
        brainUrl: 'https://brain.example.com',
        appId: 'test-app',
        appSecret: 'test-secret',
      })
      connector.disconnect()
      expect(connector.isConnected()).toBe(false)
    })
  })

  describe('generateConnectorSnippet', () => {
    it('generates valid TypeScript snippet with provided config', () => {
      const snippet = generateConnectorSnippet(
        'https://brain.example.com',
        'my-app',
        'my-secret',
      )
      expect(snippet).toContain('https://brain.example.com')
      expect(snippet).toContain('my-app')
      expect(snippet).toContain('my-secret')
      expect(snippet).toContain('AmarktAIConnector')
      expect(snippet).toContain('brain.connect()')
      expect(snippet).toContain('brain.request(')
      expect(snippet).toContain('brain.reportMetrics(')
      expect(snippet).toContain('brain.reportKpis(')
      expect(snippet).toContain('brain.reportOutcome(')
    })
  })
})
