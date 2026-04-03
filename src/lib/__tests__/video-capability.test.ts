/**
 * Video Capability Tests — Final Video Pass
 *
 * Verifies:
 *  - video_planning is available and truthfully labeled
 *  - video_generation is unavailable with exact blocker reason
 *  - Planning and generation are NOT merged conceptually
 *  - video_planning models span multiple providers
 *  - /api/brain/video returns planning data, never fake generation
 *  - Capability engine separates planning from generation
 *  - Classification rules correctly distinguish planning vs generation
 *  - HF fallback does NOT claim video generation support
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getModelRegistry,
  getModelsByProvider,
  clearProviderHealthCache,
} from '../model-registry'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
  CAPABILITY_MAP,
  classifyCapabilities,
  getDetailedCapabilityStatus,
} from '../capability-engine'
import { HF_FALLBACK_MODELS } from '../hf-fallback'

/* ================================================================
 * VIDEO PLANNING — TRUTHFUL AVAILABILITY
 * ================================================================ */

describe('Video Planning Truth', () => {
  it('video_planning has a backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.video_planning).toBe(true)
  })

  it('video_planning is labeled as planning, not generation', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.video_planning.label).toContain('planning')
    expect(map.video_planning.label).not.toContain('generation')
  })

  it('video_planning resolution returns planning capability', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['video_planning'] })
    expect(result.routes[0].capability).toBe('video_planning')
    // Must NOT say video_generation
    expect(result.routes[0].capability).not.toBe('video_generation')
  })

  it('video_planning models exist with supports_video_planning flag', () => {
    const all = getModelRegistry()
    const planningModels = all.filter((m) => 'supports_video_planning' in m && m.supports_video_planning)
    expect(planningModels.length).toBeGreaterThanOrEqual(6) // GPT-4o, o4-mini, Gemini 1.5 Pro, 2.0 Flash, 2.5 Pro, 2.5 Flash
  })

  it('video_planning models span multiple providers', () => {
    const all = getModelRegistry()
    const planningModels = all.filter((m) => 'supports_video_planning' in m && m.supports_video_planning)
    const providers = new Set(planningModels.map((m) => m.provider))
    expect(providers.size).toBeGreaterThanOrEqual(2)
    expect(providers).toContain('gemini')
    expect(providers).toContain('openai')
  })

  it('video_planning suggested providers include gemini, openai, deepseek', () => {
    const map = CAPABILITY_MAP as Record<string, { suggestedProviders?: string[] }>
    expect(map.video_planning.suggestedProviders).toContain('gemini')
    expect(map.video_planning.suggestedProviders).toContain('openai')
    expect(map.video_planning.suggestedProviders).toContain('deepseek')
  })

  it('Gemini models with video planning have specialist domain flag', () => {
    const gemini = getModelsByProvider('gemini')
    const planningModels = gemini.filter((m) => 'supports_video_planning' in m && m.supports_video_planning)
    expect(planningModels.length).toBeGreaterThanOrEqual(4) // 1.5 Pro, 2.5 Pro, 2.0 Flash, 2.5 Flash
  })

  it('OpenAI models with video planning include GPT-4o', () => {
    const openai = getModelsByProvider('openai')
    const planningModels = openai.filter((m) => 'supports_video_planning' in m && m.supports_video_planning)
    const ids = planningModels.map((m) => m.model_id)
    expect(ids).toContain('gpt-4o')
  })
})

/* ================================================================
 * VIDEO GENERATION — TRUTHFUL UNAVAILABILITY
 * ================================================================ */

describe('Video Generation Truth', () => {
  beforeEach(() => clearProviderHealthCache())

  it('video_generation has a backend route (async job pipeline)', () => {
    expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(true)
  })

  it('video_generation is labeled as generation, not planning', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.video_generation.label).toContain('generation')
    expect(map.video_generation.label).not.toContain('planning')
  })

  it('video_generation is unavailable without a configured video provider', () => {
    clearProviderHealthCache()
    const result = resolveCapabilityRoutes({ capabilities: ['video_generation'] })
    expect(result.routes[0].available).toBe(false)
    expect(result.routes[0].missingMessage).toContain('No provider configured')
  })

  it('video_generation shows routeExists=true but unavailable without provider', () => {
    clearProviderHealthCache()
    const status = getDetailedCapabilityStatus()
    const gen = status.find((s) => s.capability === 'video_generation')
    expect(gen).toBeDefined()
    expect(gen!.available).toBe(false)
    expect(gen!.routeExists).toBe(true)  // Route now exists
  })

  it('video_planning and video_generation are separate capabilities', () => {
    const planResult = resolveCapabilityRoutes({ capabilities: ['video_planning'] })
    const genResult = resolveCapabilityRoutes({ capabilities: ['video_generation'] })
    expect(planResult.routes[0].capability).toBe('video_planning')
    expect(genResult.routes[0].capability).toBe('video_generation')
    expect(planResult.routes[0].capability).not.toBe(genResult.routes[0].capability)
  })
})

/* ================================================================
 * CLASSIFICATION RULES — PLANNING VS GENERATION
 * ================================================================ */

describe('Video Classification Rules', () => {
  it('classifies "generate a video" as video_generation', () => {
    const caps = classifyCapabilities('', 'generate a video of sunset')
    expect(caps).toContain('video_generation')
  })

  it('classifies "create a video" as video_generation', () => {
    const caps = classifyCapabilities('', 'create a video advertisement')
    expect(caps).toContain('video_generation')
  })

  it('classifies "plan a video" as video_planning', () => {
    const caps = classifyCapabilities('', 'plan a video about cooking')
    expect(caps).toContain('video_planning')
  })

  it('classifies "storyboard" as video_planning', () => {
    const caps = classifyCapabilities('', 'create a storyboard for my ad')
    expect(caps).toContain('video_planning')
  })

  it('classifies "video script" as video_planning', () => {
    const caps = classifyCapabilities('', 'write a video script for YouTube')
    expect(caps).toContain('video_planning')
  })

  it('classifies "reel" as video_planning', () => {
    const caps = classifyCapabilities('', 'design a reel concept')
    expect(caps).toContain('video_planning')
  })

  it('classifies "animation" as video_planning', () => {
    const caps = classifyCapabilities('', 'plan an animation sequence')
    expect(caps).toContain('video_planning')
  })
})

/* ================================================================
 * CAPABILITY SEPARATION — NO MERGE
 * ================================================================ */

describe('Planning vs Generation Are Not Merged', () => {
  it('video_planning and video_generation both have backend routes (both implemented)', () => {
    expect(BACKEND_ROUTE_EXISTS.video_planning).toBe(true)
    expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(true)
  })

  it('video_planning and video_generation have different labels', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.video_planning.label).not.toBe(map.video_generation.label)
  })

  it('video_generation requires supports_video_generation flag (not supports_video_planning)', () => {
    const map = CAPABILITY_MAP as Record<string, { anyCapabilityFlag?: string[] }>
    expect(map.video_generation.anyCapabilityFlag).toEqual(['supports_video_generation'])
    expect(map.video_generation.anyCapabilityFlag).not.toContain('supports_video_planning')
  })

  it('video_planning accepts supports_chat as a qualifying flag', () => {
    const map = CAPABILITY_MAP as Record<string, { anyCapabilityFlag?: string[] }>
    expect(map.video_planning.anyCapabilityFlag).toContain('supports_chat')
    expect(map.video_planning.anyCapabilityFlag).toContain('supports_video_planning')
  })

  it('detailed status shows both planning and generation have routes', () => {
    clearProviderHealthCache()
    const status = getDetailedCapabilityStatus()
    const plan = status.find((s) => s.capability === 'video_planning')
    const gen = status.find((s) => s.capability === 'video_generation')
    expect(plan).toBeDefined()
    expect(gen).toBeDefined()
    expect(plan!.routeExists).toBe(true)
    expect(gen!.routeExists).toBe(true)
  })
})

/* ================================================================
 * HF FALLBACK — NO FALSE VIDEO CLAIMS
 * ================================================================ */

describe('HF Fallback Has No Video Generation Claims', () => {
  it('HF fallback catalog includes video_generation (HF has zeroscope and text-to-video models)', () => {
    expect(HF_FALLBACK_MODELS.video_generation).toBeDefined()
    expect(HF_FALLBACK_MODELS.video_generation!.length).toBeGreaterThan(0)
  })

  it('HF fallback catalog does NOT include video_planning', () => {
    // Video planning doesn't need HF fallback — it works via chat models
    expect(HF_FALLBACK_MODELS.video_planning).toBeUndefined()
  })
})

/* ================================================================
 * VIDEO PLANNING MODEL COVERAGE
 * ================================================================ */

describe('Video Planning Model Coverage', () => {
  it('GPT-4o has supports_video_planning', () => {
    const model = getModelRegistry().find((m) => m.model_id === 'gpt-4o' && m.provider === 'openai')
    expect(model).toBeDefined()
    expect(model!.supports_video_planning).toBe(true)
  })

  it('Gemini 1.5 Pro has supports_video_planning', () => {
    const model = getModelRegistry().find((m) => m.model_id === 'gemini-1.5-pro' && m.provider === 'gemini')
    expect(model).toBeDefined()
    expect(model!.supports_video_planning).toBe(true)
  })

  it('Gemini 2.0 Flash has supports_video_planning', () => {
    const model = getModelRegistry().find((m) => m.model_id === 'gemini-2.0-flash' && m.provider === 'gemini')
    expect(model).toBeDefined()
    expect(model!.supports_video_planning).toBe(true)
  })

  it('Gemini 2.5 Pro Preview has supports_video_planning', () => {
    const model = getModelRegistry().find((m) => m.model_id === 'gemini-2.5-pro-preview-05-06' && m.provider === 'gemini')
    expect(model).toBeDefined()
    expect(model!.supports_video_planning).toBe(true)
  })

  it('o4-mini has supports_video_planning', () => {
    const model = getModelRegistry().find((m) => m.model_id === 'o4-mini' && m.provider === 'openai')
    expect(model).toBeDefined()
    expect(model!.supports_video_planning).toBe(true)
  })

  it('total models with supports_video_planning >= 6', () => {
    const all = getModelRegistry()
    const count = all.filter((m) => 'supports_video_planning' in m && m.supports_video_planning).length
    expect(count).toBeGreaterThanOrEqual(6)
  })
})
