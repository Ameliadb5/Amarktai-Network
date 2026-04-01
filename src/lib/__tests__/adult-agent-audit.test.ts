/**
 * Agent Audit & Adult Mode Tests — AmarktAI Network
 *
 * Tests for:
 *  - Agent Audit System (readiness classification, provider checks)
 *  - Adult Mode Enforcement (safety config, capability blocking)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { auditAllAgents, getAgentReadiness } from '../agent-audit'
import { setAppSafetyConfig, getAppSafetyConfig } from '../content-filter'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
} from '../capability-engine'

/* ================================================================
 * AGENT AUDIT SYSTEM
 * ================================================================ */

describe('Agent Audit System', () => {
  describe('auditAllAgents', () => {
    it('audits all 16 registered agents', () => {
      const result = auditAllAgents()
      expect(result.agents.length).toBe(16)
      expect(result.summary.total).toBe(16)
    })

    it('returns correct summary counts', () => {
      const result = auditAllAgents()
      const { ready, partial, notConnected, total } = result.summary
      expect(ready + partial + notConnected).toBe(total)
    })

    it('every agent has required audit fields', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        expect(agent.agentType).toBeTruthy()
        expect(agent.name).toBeTruthy()
        expect(['READY', 'PARTIAL', 'NOT_CONNECTED']).toContain(agent.readiness)
        expect(Array.isArray(agent.reasons)).toBe(true)
        expect(typeof agent.definitionExists).toBe('boolean')
        expect(typeof agent.providerRegistered).toBe('boolean')
        expect(typeof agent.providerCallable).toBe('boolean')
        expect(typeof agent.modelExists).toBe('boolean')
        expect(typeof agent.capabilityCount).toBe('number')
        expect(agent.defaultProvider).toBeTruthy()
      }
    })

    it('agents with callable + registered providers are at least PARTIAL', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        if (agent.providerCallable && agent.providerRegistered) {
          expect(['READY', 'PARTIAL']).toContain(agent.readiness)
        }
      }
    })

    it('agents with uncallable providers are NOT_CONNECTED', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        if (!agent.providerCallable) {
          expect(agent.readiness).toBe('NOT_CONNECTED')
        }
      }
    })

    it('READY agents have zero diagnostic reasons', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        if (agent.readiness === 'READY') {
          expect(agent.reasons.length).toBe(0)
        }
      }
    })

    it('non-READY agents have at least one diagnostic reason', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        if (agent.readiness !== 'READY') {
          expect(agent.reasons.length).toBeGreaterThan(0)
        }
      }
    })

    it('includes auditedAt timestamp in summary', () => {
      const result = auditAllAgents()
      expect(result.summary.auditedAt).toBeTruthy()
      // Should be a valid ISO date
      expect(new Date(result.summary.auditedAt).getTime()).toBeGreaterThan(0)
    })
  })

  describe('getAgentReadiness', () => {
    it('returns audit entry for known agent type', () => {
      const entry = getAgentReadiness('planner')
      expect(entry).not.toBeNull()
      expect(entry!.agentType).toBe('planner')
      expect(entry!.name).toBe('Planner')
    })

    it('returns null for unknown agent type', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = getAgentReadiness('nonexistent_agent' as any)
      expect(entry).toBeNull()
    })

    it('planner agent uses openai (callable) provider', () => {
      const entry = getAgentReadiness('planner')
      expect(entry!.defaultProvider).toBe('openai')
      expect(entry!.providerCallable).toBe(true)
    })

    it('retrieval agent uses openai (callable) provider', () => {
      const entry = getAgentReadiness('retrieval')
      expect(entry!.defaultProvider).toBe('openai')
      expect(entry!.providerCallable).toBe(true)
      // Previously used cohere (NOT callable); upgraded to openai
      expect(['READY', 'PARTIAL']).toContain(entry!.readiness)
    })

    it('creative agent uses gemini (callable) provider', () => {
      const entry = getAgentReadiness('creative')
      expect(entry!.defaultProvider).toBe('gemini')
      expect(entry!.providerCallable).toBe(true)
      // Previously used anthropic (NOT callable); upgraded to gemini
      expect(['READY', 'PARTIAL']).toContain(entry!.readiness)
    })

    it('security agent is openai-based (callable)', () => {
      const entry = getAgentReadiness('security')
      expect(entry!.defaultProvider).toBe('openai')
      expect(entry!.providerCallable).toBe(true)
    })

    it('travel_planner agent uses gemini (callable)', () => {
      const entry = getAgentReadiness('travel_planner')
      expect(entry!.defaultProvider).toBe('gemini')
      expect(entry!.providerCallable).toBe(true)
    })
  })

  describe('specific agent classifications', () => {
    it('classifies openai-based agents correctly', () => {
      const openaiAgents = ['planner', 'router', 'validator', 'memory', 'campaign',
        'trading_analyst', 'app_ops', 'learning', 'security', 'voice', 'developer',
        'support_community', 'healing'] as const

      for (const type of openaiAgents) {
        const entry = getAgentReadiness(type)
        if (entry?.defaultProvider === 'openai') {
          expect(entry.providerCallable).toBe(true)
          expect(entry.providerRegistered).toBe(true)
        }
      }
    })

    it('agents with handoff targets reference valid agents', () => {
      const result = auditAllAgents()
      for (const agent of result.agents) {
        // Handoff target validation is checked in audit
        if (agent.canHandoff.length > 0) {
          // Should not have "Handoff target not registered" in reasons
          for (const reason of agent.reasons) {
            expect(reason).not.toContain('Handoff target')
          }
        }
      }
    })
  })
})

/* ================================================================
 * ADULT MODE ENFORCEMENT
 * ================================================================ */

describe('Adult Mode Enforcement', () => {
  beforeEach(() => {
    // Reset safety configs
    setAppSafetyConfig('test-app', { safeMode: true, adultMode: false })
  })

  describe('safety config management', () => {
    it('defaults to safe mode ON, adult mode OFF', () => {
      const config = getAppSafetyConfig('new-app')
      expect(config.safeMode).toBe(true)
      expect(config.adultMode).toBe(false)
    })

    it('can disable safe mode', () => {
      const config = setAppSafetyConfig('test-app', { safeMode: false })
      expect(config.safeMode).toBe(false)
    })

    it('can enable adult mode when safe mode is off', () => {
      setAppSafetyConfig('test-app', { safeMode: false })
      const config = setAppSafetyConfig('test-app', { adultMode: true })
      expect(config.adultMode).toBe(true)
      expect(config.safeMode).toBe(false)
    })

    it('adult mode is automatically disabled when safe mode is on', () => {
      const config = setAppSafetyConfig('test-app', { safeMode: true, adultMode: true })
      // Should force adultMode = false when safeMode = true
      expect(config.adultMode).toBe(false)
      expect(config.safeMode).toBe(true)
    })

    it('per-app configs are isolated', () => {
      setAppSafetyConfig('app-a', { safeMode: false, adultMode: true })
      const appA = getAppSafetyConfig('app-a')
      const appB = getAppSafetyConfig('app-b')
      expect(appA.adultMode).toBe(true)
      expect(appB.adultMode).toBe(false)
    })
  })

  describe('capability engine enforcement', () => {
    it('adult_18plus_image backend route does not exist', () => {
      expect(BACKEND_ROUTE_EXISTS.adult_18plus_image).toBe(false)
    })

    it('blocks adult capability even with adultMode=true (no backend route)', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['adult_18plus_image'],
        adultMode: true,
      })
      expect(result.routes[0].available).toBe(false)
      // Backend route guard fires before adult mode guard
      expect(result.routes[0].missingMessage).toContain('Route not implemented')
    })

    it('blocks adult capability without adultMode flag', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['adult_18plus_image'],
        adultMode: false,
      })
      expect(result.routes[0].available).toBe(false)
    })

    it('blocks adult capability without explicit adultMode (undefined)', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['adult_18plus_image'],
      })
      expect(result.routes[0].available).toBe(false)
    })

    it('non-adult capabilities are not affected by adultMode flag', () => {
      const result = resolveCapabilityRoutes({
        capabilities: ['general_chat'],
        adultMode: false,
      })
      // general_chat should be resolved independently of adultMode
      expect(result.routes[0].capability).toBe('general_chat')
    })
  })
})
