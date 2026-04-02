/**
 * Research Capability Tests
 *
 * Verifies:
 *  - research_search capability is available with backend route
 *  - deep_research capability is available with backend route
 *  - classification rules map research queries to correct capabilities
 *  - both capabilities appear in detailed status
 *  - provider suggestion lists include OpenAI and Gemini
 */

import { describe, it, expect } from 'vitest'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
  CAPABILITY_MAP,
  classifyCapabilities,
  getDetailedCapabilityStatus,
} from '../capability-engine'

/* ================================================================
 * BACKEND ROUTE TRUTH
 * ================================================================ */

describe('Research Capability Backend Truth', () => {
  it('research_search has a backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.research_search).toBe(true)
  })

  it('deep_research has a backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.deep_research).toBe(true)
  })

  it('research_search is in CAPABILITY_MAP', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string; suggestedProviders?: string[] }>
    expect(map.research_search).toBeDefined()
    expect(map.research_search.label).toContain('research')
    expect(map.research_search.suggestedProviders).toContain('openai')
  })

  it('deep_research is in CAPABILITY_MAP', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string; suggestedProviders?: string[] }>
    expect(map.deep_research).toBeDefined()
    expect(map.deep_research.label).toContain('research')
    expect(map.deep_research.suggestedProviders).toContain('openai')
    expect(map.deep_research.suggestedProviders).toContain('gemini')
  })

  it('research capabilities appear in detailed status', () => {
    const status = getDetailedCapabilityStatus()
    const search = status.find((s) => s.capability === 'research_search')
    const deep = status.find((s) => s.capability === 'deep_research')
    expect(search).toBeDefined()
    expect(deep).toBeDefined()
    expect(search!.routeExists).toBe(true)
    expect(deep!.routeExists).toBe(true)
  })
})

/* ================================================================
 * ROUTE RESOLUTION
 * ================================================================ */

describe('Research Capability Route Resolution', () => {
  it('research_search resolves without being blocked by route guard', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['research_search'] })
    // Should NOT be blocked by the backend route guard
    const blockedByRouteGuard =
      result.routes[0].missingMessage?.includes('Route not implemented') ?? false
    expect(blockedByRouteGuard).toBe(false)
  })

  it('deep_research resolves without being blocked by route guard', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['deep_research'] })
    const blockedByRouteGuard =
      result.routes[0].missingMessage?.includes('Route not implemented') ?? false
    expect(blockedByRouteGuard).toBe(false)
  })

  it('deep_research is NOT blocked by adult mode guard', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['deep_research'],
      adultMode: false,
    })
    const blockedByAdultGuard =
      result.routes[0].missingMessage?.includes('adult mode') ?? false
    expect(blockedByAdultGuard).toBe(false)
  })

  it('deep_research is NOT blocked by suggestive mode guard', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['deep_research'],
      suggestiveMode: false,
    })
    const blockedBySuggestiveGuard =
      result.routes[0].missingMessage?.includes('suggestive mode') ?? false
    expect(blockedBySuggestiveGuard).toBe(false)
  })
})

/* ================================================================
 * CLASSIFICATION RULES
 * ================================================================ */

describe('Research Capability Classification', () => {
  it('classifies "research" as research_search', () => {
    const caps = classifyCapabilities('research', 'find information about climate change')
    expect(caps).toContain('research_search')
  })

  it('classifies "find info" as research_search', () => {
    const caps = classifyCapabilities('task', 'find info about the latest AI models')
    expect(caps).toContain('research_search')
  })

  it('classifies "deep research" as deep_research', () => {
    const caps = classifyCapabilities('research', 'do deep research on quantum computing')
    expect(caps).toContain('deep_research')
  })

  it('classifies "in-depth research" as deep_research', () => {
    const caps = classifyCapabilities('task', 'in-depth research into market trends')
    expect(caps).toContain('deep_research')
  })

  it('classifies "multi-step research" as deep_research', () => {
    const caps = classifyCapabilities('task', 'multi-step research on climate policy')
    expect(caps).toContain('deep_research')
  })

  it('classifies "thorough research" as deep_research', () => {
    const caps = classifyCapabilities('task', 'thorough research on renewable energy')
    expect(caps).toContain('deep_research')
  })

  it('does NOT classify general chat as deep_research', () => {
    const caps = classifyCapabilities('chat', 'tell me about the weather today')
    expect(caps).not.toContain('deep_research')
  })

  it('does NOT classify coding as research_search', () => {
    const caps = classifyCapabilities('code', 'write a Python function to sort a list')
    expect(caps).not.toContain('research_search')
  })
})

/* ================================================================
 * CAPABILITY DEPTH DISTINCTION
 * ================================================================ */

describe('Research vs Deep Research Distinction', () => {
  it('research_search and deep_research are distinct capabilities', () => {
    expect('research_search').not.toBe('deep_research')
    expect(BACKEND_ROUTE_EXISTS.research_search).toBe(true)
    expect(BACKEND_ROUTE_EXISTS.deep_research).toBe(true)
  })

  it('deep_research requires reasoning/chat flags (more powerful models)', () => {
    const map = CAPABILITY_MAP as Record<string, { anyCapabilityFlag?: string[] }>
    expect(map.deep_research.anyCapabilityFlag).toContain('supports_reasoning')
  })

  it('research_search works with chat-only models', () => {
    const map = CAPABILITY_MAP as Record<string, { anyCapabilityFlag?: string[] }>
    expect(map.research_search.anyCapabilityFlag).toContain('supports_chat')
  })
})
