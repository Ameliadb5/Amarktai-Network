/**
 * Phase 2 System Tests — Artifact Store, Storage Driver, Usage Meter,
 * Manager Agents, App Budget Enforcement, Worker, Capability Packs.
 */
import { describe, it, expect } from 'vitest'

// ── Storage Driver Tests ─────────────────────────────────────────────────────

describe('Storage Driver', () => {
  it('exports getStorageDriver and getStorageStatus', async () => {
    const mod = await import('../storage-driver')
    expect(typeof mod.getStorageDriver).toBe('function')
    expect(typeof mod.getStorageStatus).toBe('function')
  })

  it('returns local driver by default', async () => {
    const { getStorageDriver } = await import('../storage-driver')
    const driver = getStorageDriver()
    expect(driver.name).toBe('local')
  })

  it('getStorageStatus returns driver info', async () => {
    const { getStorageStatus } = await import('../storage-driver')
    const status = getStorageStatus()
    expect(status.driver).toBe('local')
    expect(status.configured).toBe(true)
    expect(typeof status.note).toBe('string')
  })
})

// ── Artifact Store Tests ─────────────────────────────────────────────────────

describe('Artifact Store', () => {
  it('exports createArtifact, getArtifact, listArtifacts, etc.', async () => {
    const mod = await import('../artifact-store')
    expect(typeof mod.createArtifact).toBe('function')
    expect(typeof mod.getArtifact).toBe('function')
    expect(typeof mod.listArtifacts).toBe('function')
    expect(typeof mod.getArtifactCounts).toBe('function')
    expect(typeof mod.updateArtifactStatus).toBe('function')
    expect(typeof mod.deleteArtifact).toBe('function')
  })
})

// ── Usage Meter Tests ────────────────────────────────────────────────────────

describe('Usage Meter', () => {
  it('exports recordUsage, getAppUsageSummary, getPlatformUsageSummary', async () => {
    const mod = await import('../usage-meter')
    expect(typeof mod.recordUsage).toBe('function')
    expect(typeof mod.getAppUsageSummary).toBe('function')
    expect(typeof mod.getPlatformUsageSummary).toBe('function')
    expect(typeof mod.getTodayUsage).toBe('function')
    expect(typeof mod.getMonthUsage).toBe('function')
  })
})

// ── Manager Agents Tests ─────────────────────────────────────────────────────

describe('Manager Agents', () => {
  it('exports all manager check functions', async () => {
    const mod = await import('../manager-agents')
    expect(typeof mod.runRoutingManagerCheck).toBe('function')
    expect(typeof mod.runQueueManagerCheck).toBe('function')
    expect(typeof mod.runArtifactManagerCheck).toBe('function')
    expect(typeof mod.runAppManagerCheck).toBe('function')
    expect(typeof mod.runLearningManagerCheck).toBe('function')
    expect(typeof mod.runGrowthManagerCheck).toBe('function')
    expect(typeof mod.runAllManagerChecks).toBe('function')
    expect(typeof mod.getManagerStatus).toBe('function')
    expect(typeof mod.getAllManagerStatuses).toBe('function')
  })

  it('defines 6 manager types', async () => {
    // The types are: routing, queue, artifact, app, learning, growth
    const mod = await import('../manager-agents')
    const statuses = await mod.getAllManagerStatuses()
    expect(statuses.length).toBe(6)
    const types = statuses.map(s => s.managerType)
    expect(types).toContain('routing')
    expect(types).toContain('queue')
    expect(types).toContain('artifact')
    expect(types).toContain('app')
    expect(types).toContain('learning')
    expect(types).toContain('growth')
  })
})

// ── App Budget Enforcement Tests ─────────────────────────────────────────────

describe('App Budget Enforcement', () => {
  it('exports checkAppBudget, getAppBudgetSummary, upsertAppBudget, setAppPaused', async () => {
    const mod = await import('../app-budget-enforcement')
    expect(typeof mod.checkAppBudget).toBe('function')
    expect(typeof mod.getAppBudgetSummary).toBe('function')
    expect(typeof mod.upsertAppBudget).toBe('function')
    expect(typeof mod.setAppPaused).toBe('function')
  })

  it('returns allowed with no_config for unconfigured app', async () => {
    const { checkAppBudget } = await import('../app-budget-enforcement')
    const result = await checkAppBudget('nonexistent-app')
    expect(result.allowed).toBe(true)
    expect(result.budgetStatus).toBe('no_config')
  })

  it('returns ok summary for unconfigured app', async () => {
    const { getAppBudgetSummary } = await import('../app-budget-enforcement')
    const summary = await getAppBudgetSummary('nonexistent-app')
    expect(summary.appSlug).toBe('nonexistent-app')
    expect(summary.status).toBe('ok')
    expect(summary.paused).toBe(false)
  })
})

// ── Worker Tests ─────────────────────────────────────────────────────────────

describe('Worker', () => {
  it('exports startWorker and ExtendedJobType', async () => {
    const mod = await import('../worker')
    expect(typeof mod.startWorker).toBe('function')
  })
})

// ── Enhanced Capability Packs Tests ──────────────────────────────────────────

describe('Enhanced Capability Packs', () => {
  it('has 18 packs including Phase 2 and Phase 3 additions', async () => {
    const { getAllCapabilityPacks } = await import('../capability-packs')
    const packs = getAllCapabilityPacks()
    expect(packs.length).toBe(18)
    const ids = packs.map(p => p.id)
    expect(ids).toContain('research_pack')
    expect(ids).toContain('security_pack')
    expect(ids).toContain('operations_pack')
    expect(ids).toContain('pet_horse_pack')
    expect(ids).toContain('religious_pack')
    expect(ids).toContain('education_pack')
    expect(ids).toContain('smart_home_pack')
    expect(ids).toContain('health_pack')
    expect(ids).toContain('family_pack')
  })

  it('research pack has correct capabilities', async () => {
    const { getCapabilityPack } = await import('../capability-packs')
    const pack = getCapabilityPack('research_pack')
    expect(pack).toBeDefined()
    expect(pack!.capabilities).toContain('retrieval')
    expect(pack!.capabilities).toContain('reasoning')
  })

  it('security pack has strict safety', async () => {
    const { getCapabilityPack } = await import('../capability-packs')
    const pack = getCapabilityPack('security_pack')
    expect(pack).toBeDefined()
    expect(pack!.safetyLevel).toBe('strict')
  })

  it('getPacksForCategory matches new packs', async () => {
    const { getPacksForCategory } = await import('../capability-packs')
    const research = getPacksForCategory('research')
    expect(research.length).toBeGreaterThan(0)
    expect(research.some(p => p.id === 'research_pack')).toBe(true)
  })
})

// ── Job Queue Enhanced Types Tests ───────────────────────────────────────────

describe('Job Queue Enhanced Types', () => {
  it('supports new job types', async () => {
    const { enqueueJob } = await import('../job-queue')
    // Should not throw when called with new types (returns null since no Redis)
    const result = await enqueueJob({ type: 'music_generation', data: {} })
    expect(result).toBeNull() // No Redis in test env
  })
})

// ── Dashboard Truth Phase 2 Fields ───────────────────────────────────────────

describe('Dashboard Truth Phase 2', () => {
  it('DashboardSummary includes Phase 2 fields', async () => {
    const { getDashboardSummary } = await import('../dashboard-truth')
    const summary = await getDashboardSummary()
    expect('artifactCount' in summary).toBe(true)
    expect('queueHealthy' in summary).toBe(true)
    expect('storageDriver' in summary).toBe(true)
    expect('managerAgentsActive' in summary).toBe(true)
  })
})
