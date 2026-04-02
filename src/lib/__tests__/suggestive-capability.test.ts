/**
 * Suggestive Capability Tests
 *
 * Verifies:
 *  - suggestive_image_generation and suggestive_video_planning capabilities are available
 *  - suggestiveMode defaults to false (all apps start safe)
 *  - suggestiveMode requires safeMode=false
 *  - per-app isolation works
 *  - validateSuggestivePrompt() blocks nudity, explicit acts, and minors
 *  - validateSuggestivePrompt() allows legitimate suggestive prompts
 *  - validateSuggestivePrompt() sanitizes soft terms
 *  - capability engine gates suggestive capabilities correctly
 *  - HF fallback includes suggestive_image_generation
 *  - no fake generation claims for suggestive_video_planning
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  setAppSafetyConfig,
  getAppSafetyConfig,
  validateSuggestivePrompt,
} from '../content-filter'
import {
  resolveCapabilityRoutes,
  BACKEND_ROUTE_EXISTS,
  CAPABILITY_MAP,
  classifyCapabilities,
  getDetailedCapabilityStatus,
} from '../capability-engine'
import { HF_FALLBACK_MODELS, getHfFallback } from '../hf-fallback'

/* ================================================================
 * CAPABILITY MAP TRUTH
 * ================================================================ */

describe('Suggestive Capability Map Truth', () => {
  it('suggestive_image_generation has a backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.suggestive_image_generation).toBe(true)
  })

  it('suggestive_video_planning has a backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.suggestive_video_planning).toBe(true)
  })

  it('suggestive_image_generation is in CAPABILITY_MAP', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.suggestive_image_generation).toBeDefined()
    expect(map.suggestive_image_generation.label).toContain('suggestive')
    expect(map.suggestive_image_generation.label).toContain('non-explicit')
  })

  it('suggestive_video_planning is in CAPABILITY_MAP', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.suggestive_video_planning).toBeDefined()
    expect(map.suggestive_video_planning.label).toContain('suggestive')
    expect(map.suggestive_video_planning.label).toContain('planning')
    expect(map.suggestive_video_planning.label).not.toContain('generation')
  })

  it('suggestive capabilities appear in detailed status', () => {
    const status = getDetailedCapabilityStatus()
    const img = status.find((s) => s.capability === 'suggestive_image_generation')
    const vid = status.find((s) => s.capability === 'suggestive_video_planning')
    expect(img).toBeDefined()
    expect(vid).toBeDefined()
    expect(img!.routeExists).toBe(true)
    expect(vid!.routeExists).toBe(true)
  })
})

/* ================================================================
 * GATING — SUGGESTIVE MODE DEFAULT
 * ================================================================ */

describe('Suggestive Mode Default State', () => {
  beforeEach(() => {
    // Reset to a fresh app
    setAppSafetyConfig('test-suggestive-default', { safeMode: true, adultMode: false, suggestiveMode: false })
  })

  it('new apps default to safeMode=true, suggestiveMode=false', () => {
    const config = getAppSafetyConfig('brand-new-app-suggest')
    expect(config.safeMode).toBe(true)
    expect(config.suggestiveMode).toBe(false)
  })

  it('suggestiveMode cannot be enabled while safeMode is on', () => {
    const result = setAppSafetyConfig('test-suggestive-default', { safeMode: true, suggestiveMode: true })
    // setAppSafetyConfig clears suggestiveMode when safeMode is on
    expect(result.suggestiveMode).toBe(false)
    expect(result.safeMode).toBe(true)
  })

  it('suggestiveMode can be enabled when safeMode=false', () => {
    const result = setAppSafetyConfig('test-suggestive-default', { safeMode: false, suggestiveMode: true })
    expect(result.safeMode).toBe(false)
    expect(result.suggestiveMode).toBe(true)
  })
})

/* ================================================================
 * GATING — CAPABILITY ROUTE RESOLUTION
 * ================================================================ */

describe('Suggestive Capability Route Gating', () => {
  it('suggestive_image_generation blocked when suggestiveMode=false', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_image_generation'],
      suggestiveMode: false,
    })
    expect(result.routes[0].available).toBe(false)
    expect(result.routes[0].missingMessage).toContain('suggestive mode')
  })

  it('suggestive_image_generation blocked when suggestiveMode is undefined', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_image_generation'],
    })
    expect(result.routes[0].available).toBe(false)
  })

  it('suggestive_image_generation available when suggestiveMode=true (with configured providers)', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_image_generation'],
      suggestiveMode: true,
    })
    // Route should not be blocked by the suggestive mode guard
    // (may still be unavailable if no provider is configured, but should NOT have the suggestive mode message)
    const blockedBySuggestiveGuard =
      result.routes[0].missingMessage?.includes('suggestive mode') ?? false
    expect(blockedBySuggestiveGuard).toBe(false)
  })

  it('suggestive_video_planning blocked when suggestiveMode=false', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_video_planning'],
      suggestiveMode: false,
    })
    expect(result.routes[0].available).toBe(false)
    expect(result.routes[0].missingMessage).toContain('suggestive mode')
  })

  it('suggestive_video_planning available when suggestiveMode=true (with configured providers)', () => {
    const result = resolveCapabilityRoutes({
      capabilities: ['suggestive_video_planning'],
      suggestiveMode: true,
    })
    const blockedBySuggestiveGuard =
      result.routes[0].missingMessage?.includes('suggestive mode') ?? false
    expect(blockedBySuggestiveGuard).toBe(false)
  })
})

/* ================================================================
 * PER-APP ISOLATION
 * ================================================================ */

describe('Suggestive Mode Per-App Isolation', () => {
  it('enabling suggestive mode on one app does not affect another', () => {
    setAppSafetyConfig('app-suggest-a', { safeMode: false, suggestiveMode: true })
    setAppSafetyConfig('app-suggest-b', { safeMode: true })

    expect(getAppSafetyConfig('app-suggest-a').suggestiveMode).toBe(true)
    expect(getAppSafetyConfig('app-suggest-b').suggestiveMode).toBe(false)
  })

  it('disabling safe mode on one app does not affect another', () => {
    setAppSafetyConfig('app-safe-c', { safeMode: false, suggestiveMode: true })
    setAppSafetyConfig('app-safe-d', {})

    expect(getAppSafetyConfig('app-safe-c').safeMode).toBe(false)
    expect(getAppSafetyConfig('app-safe-d').safeMode).toBe(true)
    expect(getAppSafetyConfig('app-safe-d').suggestiveMode).toBe(false)
  })
})

/* ================================================================
 * PROMPT GUARD — ALLOWED PROMPTS
 * ================================================================ */

describe('validateSuggestivePrompt — Allowed Prompts', () => {
  it('allows swimwear/fashion prompts', () => {
    const result = validateSuggestivePrompt('A model in a red bikini on a beach at sunset')
    expect(result.allowed).toBe(true)
  })

  it('allows lingerie fashion prompts', () => {
    const result = validateSuggestivePrompt('Fashion model wearing elegant black lingerie in a studio')
    expect(result.allowed).toBe(true)
  })

  it('allows gym/athletic wear prompts', () => {
    const result = validateSuggestivePrompt('Fit woman in athletic wear doing a confident pose in a gym')
    expect(result.allowed).toBe(true)
  })

  it('allows lifestyle/fashion prompts with attractive people', () => {
    const result = validateSuggestivePrompt('Attractive man in a tailored suit, confident pose, city background')
    expect(result.allowed).toBe(true)
  })

  it('allows model pose descriptions', () => {
    const result = validateSuggestivePrompt('Female model in elegant swimsuit, professional photography, beach setting')
    expect(result.allowed).toBe(true)
  })

  it('returns sanitized version for soft unsafe terms', () => {
    const result = validateSuggestivePrompt('A sexy model in a bikini')
    expect(result.allowed).toBe(true)
    // "sexy" should be replaced with "attractive"
    expect(result.sanitized).toContain('attractive')
    expect(result.sanitized).not.toContain('sexy')
  })

  it('returns sanitized version when "seductive" is used', () => {
    const result = validateSuggestivePrompt('A seductive pose in swimwear')
    expect(result.allowed).toBe(true)
    expect(result.sanitized).toContain('confident')
    expect(result.sanitized).not.toContain('seductive')
  })
})

/* ================================================================
 * PROMPT GUARD — BLOCKED PROMPTS
 * ================================================================ */

describe('validateSuggestivePrompt — Blocked Prompts', () => {
  it('blocks nude/nudity prompts', () => {
    const result = validateSuggestivePrompt('A nude woman on a beach')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('blocks naked prompts', () => {
    const result = validateSuggestivePrompt('Naked man in a pool')
    expect(result.allowed).toBe(false)
  })

  it('blocks explicit sexual act descriptions', () => {
    const result = validateSuggestivePrompt('A sexual act between two adults')
    expect(result.allowed).toBe(false)
  })

  it('blocks pornography references', () => {
    const result = validateSuggestivePrompt('Create a pornography-style photo')
    expect(result.allowed).toBe(false)
  })

  it('blocks minors in suggestive contexts', () => {
    const result = validateSuggestivePrompt('A teen model in a bikini pose')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('blocks underage in swimsuit context', () => {
    const result = validateSuggestivePrompt('Underage girl in a swimsuit')
    expect(result.allowed).toBe(false)
  })

  it('blocks always-blocked categories (CSAM)', () => {
    const result = validateSuggestivePrompt('child sexual abuse material')
    expect(result.allowed).toBe(false)
  })

  it('blocks bare nipple/explicit body part references', () => {
    const result = validateSuggestivePrompt('Bare breasts visible in a photo')
    expect(result.allowed).toBe(false)
  })
})

/* ================================================================
 * CLASSIFICATION RULES
 * ================================================================ */

describe('Suggestive Capability Classification', () => {
  it('classifies "lingerie" as suggestive_image_generation', () => {
    const caps = classifyCapabilities('image', 'lingerie photo shoot')
    expect(caps).toContain('suggestive_image_generation')
  })

  it('classifies "swimwear" as suggestive_image_generation', () => {
    const caps = classifyCapabilities('generate', 'swimwear model photo')
    expect(caps).toContain('suggestive_image_generation')
  })

  it('classifies "fashion model" as suggestive_image_generation', () => {
    const caps = classifyCapabilities('create', 'fashion model pose image')
    expect(caps).toContain('suggestive_image_generation')
  })

  it('classifies "suggestive video" as suggestive_video_planning', () => {
    const caps = classifyCapabilities('create', 'suggestive video for fashion brand')
    expect(caps).toContain('suggestive_video_planning')
  })

  it('classifies "fashion video" as suggestive_video_planning', () => {
    const caps = classifyCapabilities('plan', 'fashion video shoot')
    expect(caps).toContain('suggestive_video_planning')
  })

  it('does NOT classify normal chat as suggestive', () => {
    const caps = classifyCapabilities('chat', 'tell me about fashion trends')
    expect(caps).not.toContain('suggestive_image_generation')
    expect(caps).not.toContain('suggestive_video_planning')
  })
})

/* ================================================================
 * HF FALLBACK
 * ================================================================ */

describe('HF Fallback for Suggestive Image', () => {
  it('HF_FALLBACK_MODELS includes suggestive_image_generation', () => {
    expect(HF_FALLBACK_MODELS.suggestive_image_generation).toBeDefined()
    expect(HF_FALLBACK_MODELS.suggestive_image_generation!.length).toBeGreaterThan(0)
  })

  it('getHfFallback returns models for suggestive_image_generation when HF available', () => {
    // This checks the structure — HF may not be configured in test env
    const fallback = getHfFallback('suggestive_image_generation')
    // Even if unavailable (no HF key), the result should be structured correctly
    expect(fallback.capability).toBe('suggestive_image_generation')
  })

  it('HF fallback notes mention safe-prompt enforcement', () => {
    const models = HF_FALLBACK_MODELS.suggestive_image_generation ?? []
    const notesMentionSafety = models.some(
      (m) => m.notes.toLowerCase().includes('safe') || m.notes.toLowerCase().includes('fashion') || m.notes.toLowerCase().includes('controlled'),
    )
    expect(notesMentionSafety).toBe(true)
  })
})

/* ================================================================
 * NO FAKE GENERATION CLAIMS
 * ================================================================ */

describe('No Fake Generation Claims', () => {
  it('suggestive_video_planning label does not contain "generation"', () => {
    const map = CAPABILITY_MAP as Record<string, { label?: string }>
    expect(map.suggestive_video_planning.label).not.toContain('generation')
  })

  it('adult_18plus_image still has no backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.adult_18plus_image).toBe(false)
  })

  it('video_generation still has no backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.video_generation).toBe(false)
  })

  it('realtime_voice still has no backend route', () => {
    expect(BACKEND_ROUTE_EXISTS.realtime_voice).toBe(false)
  })
})
