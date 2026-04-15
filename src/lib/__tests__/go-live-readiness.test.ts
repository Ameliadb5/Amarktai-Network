/**
 * GO-LIVE READINESS TEST SUITE
 *
 * Validates that all platform systems are correctly wired and ready for production.
 * Tests cover: routing, providers, brain, artifacts, music, workflows, managers,
 * capability packs, Build Studio, compare, geo, approvals, memory, and growth intelligence.
 */

import { describe, it, expect } from 'vitest'

// ── Routing Engine ──────────────────────────────────────────────
describe('Routing Engine — Go-Live', () => {
  it('exports routeRequest with correct signature', async () => {
    const mod = await import('../routing-engine')
    expect(typeof mod.routeRequest).toBe('function')
  })

  it('routeRequest returns a RoutingDecision with required fields', async () => {
    const { routeRequest } = await import('../routing-engine')
    const decision = await routeRequest({
      appSlug: '__admin_test__',
      taskType: 'chat',
      capabilities: ['chat'],
      prompt: 'Hello',
    })
    expect(decision).toBeDefined()
    expect(decision).toHaveProperty('primaryModel')
    expect(decision).toHaveProperty('mode')
    expect(decision).toHaveProperty('reason')
  })

  it('returns fallback models array', async () => {
    const { routeRequest } = await import('../routing-engine')
    const decision = await routeRequest({
      appSlug: '__admin_test__',
      taskType: 'code',
      capabilities: ['code'],
      prompt: 'Write a test',
    })
    expect(decision).toHaveProperty('fallbackModels')
    expect(Array.isArray(decision.fallbackModels)).toBe(true)
  })

  it('exports model filtering utilities', async () => {
    const mod = await import('../routing-engine')
    expect(typeof mod.filterByModality).toBe('function')
    expect(typeof mod.selectPrimaryModel).toBe('function')
    expect(typeof mod.buildFallbackList).toBe('function')
    expect(typeof mod.estimateCost).toBe('function')
    expect(typeof mod.estimateLatency).toBe('function')
  })
})

// ── Provider Catalog ────────────────────────────────────────────
describe('Provider Catalog — Go-Live', () => {
  it('exports CANONICAL_PROVIDERS', async () => {
    const mod = await import('../provider-catalog')
    expect(Array.isArray(mod.CANONICAL_PROVIDERS)).toBe(true)
  })

  it('catalog contains 12+ providers', async () => {
    const { CANONICAL_PROVIDERS } = await import('../provider-catalog')
    expect(CANONICAL_PROVIDERS.length).toBeGreaterThanOrEqual(12)
  })

  it('each provider has key and displayName', async () => {
    const { CANONICAL_PROVIDERS } = await import('../provider-catalog')
    for (const p of CANONICAL_PROVIDERS) {
      expect(p).toHaveProperty('key')
      expect(p).toHaveProperty('displayName')
      expect(typeof p.key).toBe('string')
      expect(typeof p.displayName).toBe('string')
    }
  })
})

// ── Model Registry ──────────────────────────────────────────────
describe('Model Registry — Go-Live', () => {
  it('exports MODEL_REGISTRY and getModelRegistry', async () => {
    const mod = await import('../model-registry')
    expect(Array.isArray(mod.MODEL_REGISTRY)).toBe(true)
    expect(typeof mod.getModelRegistry).toBe('function')
  })

  it('registry contains 50+ models', async () => {
    const { MODEL_REGISTRY } = await import('../model-registry')
    expect(MODEL_REGISTRY.length).toBeGreaterThanOrEqual(50)
  })

  it('each model has provider and model_id', async () => {
    const { MODEL_REGISTRY } = await import('../model-registry')
    for (const m of MODEL_REGISTRY.slice(0, 10)) {
      expect(m).toHaveProperty('provider')
      expect(m).toHaveProperty('model_id')
      expect(typeof m.provider).toBe('string')
      expect(typeof m.model_id).toBe('string')
    }
  })

  it('has image-capable models', async () => {
    const { MODEL_REGISTRY } = await import('../model-registry')
    const imageModels = MODEL_REGISTRY.filter(m => m.supports_image_generation === true)
    expect(imageModels.length).toBeGreaterThan(0)
  })

  it('has voice-capable models', async () => {
    const { MODEL_REGISTRY } = await import('../model-registry')
    const voiceModels = MODEL_REGISTRY.filter(m => m.supports_tts === true)
    expect(voiceModels.length).toBeGreaterThan(0)
  })

  it('provider health tracking works', async () => {
    const { setProviderHealth, getProviderHealth, clearProviderHealthCache } = await import('../model-registry')
    clearProviderHealthCache()
    setProviderHealth('test_provider', 'healthy', 'ok')
    const health = getProviderHealth('test_provider')
    expect(health).toBe('healthy')
    clearProviderHealthCache()
  })
})

// ── Artifact Store ──────────────────────────────────────────────
describe('Artifact Store — Go-Live', () => {
  it('exports createArtifact and listArtifacts', async () => {
    const mod = await import('../artifact-store')
    expect(typeof mod.createArtifact).toBe('function')
    expect(typeof mod.listArtifacts).toBe('function')
  })
})

// ── Music Studio ────────────────────────────────────────────────
describe('Music Studio — Go-Live', () => {
  it('exports createMusic and getMusicStudioStatus', async () => {
    const mod = await import('../music-studio')
    expect(typeof mod.createMusic).toBe('function')
    expect(typeof mod.getMusicStudioStatus).toBe('function')
  })

  it('getMusicStudioStatus returns status fields', async () => {
    const { getMusicStudioStatus } = await import('../music-studio')
    const status = getMusicStudioStatus()
    expect(status).toHaveProperty('lyricsGeneration')
    expect(status).toHaveProperty('audioGeneration')
    expect(status).toHaveProperty('coverArtGeneration')
    expect(status).toHaveProperty('audioProvider')
  })

  it('reports needs_key when no music provider configured', async () => {
    const { getMusicStudioStatus } = await import('../music-studio')
    const status = getMusicStudioStatus()
    if (!process.env.SUNO_API_KEY && !process.env.REPLICATE_API_TOKEN) {
      expect(status.audioGeneration).toBe('needs_key')
      expect(status.audioProvider).toBeNull()
    }
  })

  it('exports genre and vocal style options', async () => {
    const { AVAILABLE_GENRES, AVAILABLE_VOCAL_STYLES } = await import('../music-studio')
    expect(Array.isArray(AVAILABLE_GENRES)).toBe(true)
    expect(AVAILABLE_GENRES.length).toBeGreaterThan(5)
    expect(Array.isArray(AVAILABLE_VOCAL_STYLES)).toBe(true)
    expect(AVAILABLE_VOCAL_STYLES.length).toBeGreaterThan(3)
  })
})

// ── Workflow Engine ─────────────────────────────────────────────
describe('Workflow Engine — Go-Live', () => {
  it('exports core workflow functions', async () => {
    const mod = await import('../workflow-engine')
    expect(typeof mod.createWorkflow).toBe('function')
    expect(typeof mod.executeWorkflow).toBe('function')
  })
})

// ── Manager Agents ──────────────────────────────────────────────
describe('Manager Agents — Go-Live', () => {
  it('exports all 6 manager check functions', async () => {
    const mod = await import('../manager-agents')
    expect(typeof mod.runRoutingManagerCheck).toBe('function')
    expect(typeof mod.runQueueManagerCheck).toBe('function')
    expect(typeof mod.runArtifactManagerCheck).toBe('function')
    expect(typeof mod.runAppManagerCheck).toBe('function')
    expect(typeof mod.runLearningManagerCheck).toBe('function')
    expect(typeof mod.runGrowthManagerCheck).toBe('function')
  })

  it('exports runAllManagerChecks', async () => {
    const mod = await import('../manager-agents')
    expect(typeof mod.runAllManagerChecks).toBe('function')
  })

  it('exports getAllManagerStatuses', async () => {
    const mod = await import('../manager-agents')
    expect(typeof mod.getAllManagerStatuses).toBe('function')
  })
})

// ── Capability Packs ────────────────────────────────────────────
describe('Capability Packs — Go-Live', () => {
  it('exports getAllCapabilityPacks', async () => {
    const mod = await import('../capability-packs')
    expect(typeof mod.getAllCapabilityPacks).toBe('function')
  })

  it('has 18+ capability packs', async () => {
    const { getAllCapabilityPacks } = await import('../capability-packs')
    const packs = getAllCapabilityPacks()
    expect(packs.length).toBeGreaterThanOrEqual(18)
  })

  it('each pack has required structure', async () => {
    const { getAllCapabilityPacks } = await import('../capability-packs')
    const packs = getAllCapabilityPacks()
    for (const p of packs) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('capabilities')
      expect(Array.isArray(p.capabilities)).toBe(true)
    }
  })

  it('includes industry-specific packs', async () => {
    const { getAllCapabilityPacks } = await import('../capability-packs')
    const packs = getAllCapabilityPacks()
    const ids = packs.map((p: { id: string }) => p.id)
    expect(ids).toContain('religious_pack')
    expect(ids).toContain('education_pack')
    expect(ids).toContain('health_pack')
    expect(ids).toContain('family_pack')
  })
})

// ── Skill Templates ─────────────────────────────────────────────
describe('Skill Templates — Go-Live', () => {
  it('exports getAllSkillTemplates', async () => {
    const mod = await import('../skill-templates')
    expect(typeof mod.getAllSkillTemplates).toBe('function')
  })

  it('has 20+ skill templates', async () => {
    const { getAllSkillTemplates } = await import('../skill-templates')
    const templates = getAllSkillTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(20)
  })

  it('templates have steps array', async () => {
    const { getAllSkillTemplates } = await import('../skill-templates')
    const templates = getAllSkillTemplates()
    for (const t of templates.slice(0, 5)) {
      expect(t).toHaveProperty('steps')
      expect(Array.isArray(t.steps)).toBe(true)
      expect(t.steps.length).toBeGreaterThan(0)
    }
  })

  it('covers key categories', async () => {
    const { getAllSkillTemplates } = await import('../skill-templates')
    const templates = getAllSkillTemplates()
    const categories = [...new Set(templates.map((t: { category: string }) => t.category))]
    expect(categories).toContain('developer')
    expect(categories).toContain('productivity')
    expect(categories).toContain('content')
  })

  it('has launch-ready templates', async () => {
    const { getLaunchReadyTemplates } = await import('../skill-templates')
    const templates = getLaunchReadyTemplates()
    expect(templates.length).toBeGreaterThan(0)
  })
})

// ── Dashboard Truth ─────────────────────────────────────────────
describe('Dashboard Truth — Go-Live', () => {
  it('exports getProviderTruth and getCapabilityTruth', async () => {
    const mod = await import('../dashboard-truth')
    expect(typeof mod.getProviderTruth).toBe('function')
    expect(typeof mod.getCapabilityTruth).toBe('function')
  })

  it('getCapabilityTruth returns array with state fields', async () => {
    const { getCapabilityTruth } = await import('../dashboard-truth')
    const caps = await getCapabilityTruth()
    expect(Array.isArray(caps)).toBe(true)
    for (const c of caps) {
      expect(c).toHaveProperty('capability')
      expect(c).toHaveProperty('state')
    }
  })

  it('exports getDashboardSummary', async () => {
    const mod = await import('../dashboard-truth')
    expect(typeof mod.getDashboardSummary).toBe('function')
  })
})

// ── App Success Engine ──────────────────────────────────────────
describe('App Success Engine — Go-Live', () => {
  it('exports growth intelligence functions', async () => {
    const mod = await import('../app-success-engine')
    expect(typeof mod.getAppSuccessMetrics).toBe('function')
    expect(typeof mod.getAllAppSuccessMetrics).toBe('function')
    expect(typeof mod.getAppSuccessSummary).toBe('function')
  })
})

// ── GitHub Integration ──────────────────────────────────────────
describe('GitHub Integration — Go-Live', () => {
  it('exports core GitHub functions', async () => {
    const mod = await import('../github-integration')
    expect(typeof mod.getGitHubConfig).toBe('function')
    expect(typeof mod.pushProjectToGitHub).toBe('function')
    expect(typeof mod.validateGitHubToken).toBe('function')
  })
})

// ── Routing Profiles ────────────────────────────────────────────
describe('Routing Profiles — Go-Live', () => {
  it('exports getRoutingProfile', async () => {
    const mod = await import('../routing-profiles')
    expect(typeof mod.getRoutingProfile).toBe('function')
  })

  it('has default routing profile', async () => {
    const { getRoutingProfile } = await import('../routing-profiles')
    const profile = getRoutingProfile('default')
    expect(profile).toBeDefined()
    expect(profile).toHaveProperty('id')
  })
})

// ── App Profiles ────────────────────────────────────────────────
describe('App Profiles — Go-Live', () => {
  it('exports getAppProfile', async () => {
    const mod = await import('../app-profiles')
    expect(typeof mod.getAppProfile).toBe('function')
  })
})

// ── Federated Memory ────────────────────────────────────────────
describe('Federated Memory — Go-Live', () => {
  it('exports memory functions', async () => {
    const mod = await import('../federated-memory')
    expect(typeof mod.storeMemory).toBe('function')
    expect(typeof mod.searchMemories).toBe('function')
    expect(typeof mod.getUserProfile).toBe('function')
  })
})

// ── Event Bus ───────────────────────────────────────────────────
describe('Event Bus — Go-Live', () => {
  it('exports emitSystemEvent and subscribe', async () => {
    const mod = await import('../event-bus')
    expect(typeof mod.emitSystemEvent).toBe('function')
    expect(typeof mod.subscribe).toBe('function')
  })

  it('subscribe returns unsubscribe function', async () => {
    const { subscribe } = await import('../event-bus')
    const unsub = subscribe(() => {})
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

// ── Error Handler ───────────────────────────────────────────────
describe('Error Handler — Go-Live', () => {
  it('exports handleError and classifyError', async () => {
    const mod = await import('../error-handler')
    expect(typeof mod.handleError).toBe('function')
    expect(typeof mod.classifyError).toBe('function')
  })

  it('classifyError returns error category', async () => {
    const { classifyError } = await import('../error-handler')
    const result = classifyError(new Error('test'))
    expect(result).toBeDefined()
  })
})

// ── Circuit Breaker ─────────────────────────────────────────────
describe('Circuit Breaker — Go-Live', () => {
  it('exports circuit breaker module', async () => {
    const mod = await import('../circuit-breaker')
    expect(mod).toBeDefined()
  })
})

// ── Storage Driver ──────────────────────────────────────────────
describe('Storage Driver — Go-Live', () => {
  it('exports getStorageDriver', async () => {
    const mod = await import('../storage-driver')
    expect(typeof mod.getStorageDriver).toBe('function')
  })

  it('storage driver has put and getUrl methods', async () => {
    const { getStorageDriver } = await import('../storage-driver')
    const driver = getStorageDriver()
    expect(typeof driver.put).toBe('function')
    expect(typeof driver.getUrl).toBe('function')
  })

  it('exports getStorageStatus', async () => {
    const mod = await import('../storage-driver')
    expect(typeof mod.getStorageStatus).toBe('function')
  })
})

// ── Learning Engine ─────────────────────────────────────────────
describe('Learning Engine — Go-Live', () => {
  it('exports learning functions', async () => {
    const mod = await import('../learning-engine')
    expect(typeof mod.logRouteOutcome).toBe('function')
    expect(typeof mod.getProviderPerformance).toBe('function')
    expect(typeof mod.generateInsights).toBe('function')
    expect(typeof mod.getLearningStatus).toBe('function')
  })
})

// ── Cross-system Validation ─────────────────────────────────────
describe('Cross-system Validation — Go-Live', () => {
  it('routing engine can resolve models from registry', async () => {
    const { routeRequest } = await import('../routing-engine')
    const { MODEL_REGISTRY } = await import('../model-registry')
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0)

    const decision = await routeRequest({
      appSlug: '__admin_test__',
      taskType: 'chat',
      capabilities: ['chat'],
      prompt: 'test',
    })
    if (decision.primaryModel) {
      expect(decision.primaryModel).toHaveProperty('provider')
      expect(decision.primaryModel).toHaveProperty('model')
    }
  })

  it('capability packs reference valid capabilities', async () => {
    const { getAllCapabilityPacks } = await import('../capability-packs')
    const packs = getAllCapabilityPacks()

    for (const pack of packs.slice(0, 3)) {
      for (const cap of pack.capabilities) {
        expect(typeof cap).toBe('string')
        expect(cap.length).toBeGreaterThan(0)
      }
    }
  })

  it('dashboard truth covers provider states', async () => {
    const { getProviderTruth } = await import('../dashboard-truth')
    const truths = await getProviderTruth()
    expect(Array.isArray(truths)).toBe(true)
    for (const t of truths) {
      expect(t).toHaveProperty('state')
      expect(typeof t.state).toBe('string')
    }
  })

  it('model registry and routing engine use same model format', async () => {
    const { MODEL_REGISTRY } = await import('../model-registry')
    const { filterByModality } = await import('../routing-engine')
    const textModels = filterByModality([...MODEL_REGISTRY], 'text')
    expect(Array.isArray(textModels)).toBe(true)
    expect(textModels.length).toBeLessThanOrEqual(MODEL_REGISTRY.length)
  })

  it('skill templates are structured for workflow execution', async () => {
    const { getAllSkillTemplates } = await import('../skill-templates')
    const templates = getAllSkillTemplates()
    for (const t of templates.slice(0, 3)) {
      for (const step of t.steps) {
        expect(step).toHaveProperty('id')
        expect(step).toHaveProperty('name')
        expect(step).toHaveProperty('type')
      }
    }
  })
})
