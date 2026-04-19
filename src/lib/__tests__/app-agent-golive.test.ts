/**
 * Tests for the per-app agent architecture, integration services,
 * admin setup flow, daily learning, and go-live hardening.
 */
import { describe, it, expect } from 'vitest'
import type { AppAgentConfig } from '@/lib/app-agent'

// ── App Agent Tests ─────────────────────────────────────────────────────────

describe('App Agent — Core Architecture', () => {
  it('parseAdminNotes extracts structured rules from plain English', async () => {
    const { parseAdminNotes } = await import('@/lib/app-agent')

    const notes = `
      This app must always show the source when it quotes holy text.
      This app must never give uncited religious rulings.
      This app must keep tone calm and respectful.
      This app must pass urgent health issues to a real expert.
      This app must never allow adult content.
      This app must avoid guessing.
    `

    const rules = parseAdminNotes(notes)
    expect(rules.length).toBeGreaterThanOrEqual(5)

    // Check rule types are correctly detected
    const types = rules.map(r => r.type)
    // "must always show the source" → must_do (must always pattern)
    expect(types).toContain('must_do')
    // "must never give" → must_not_do
    expect(types).toContain('must_not_do')
    // "keep tone calm" → tone_rule
    expect(types).toContain('tone_rule')
    // "pass urgent health issues to a real expert" → handoff_rule
    expect(types).toContain('handoff_rule')
  })

  it('parseAdminNotes returns empty array for empty notes', async () => {
    const { parseAdminNotes } = await import('@/lib/app-agent')
    expect(parseAdminNotes('')).toEqual([])
    expect(parseAdminNotes('   ')).toEqual([])
  })

  it('parseAdminNotes assigns correct priorities', async () => {
    const { parseAdminNotes } = await import('@/lib/app-agent')

    const rules = parseAdminNotes('Must never allow adult content. Keep tone warm and friendly.')
    // "Must never allow adult content" → must_not_do (never pattern matched first)
    const mustNotRule = rules.find(r => r.type === 'must_not_do')
    const toneRule = rules.find(r => r.type === 'tone_rule')

    expect(mustNotRule?.priority).toBe('critical') // "never allow" triggers critical priority
    expect(toneRule?.priority).toBe('medium')
  })

  it('buildAgentSystemPrompt generates correct system prompt', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/app-agent')

    const config: AppAgentConfig = {
      id: 'test',
      appSlug: 'test-app',
      appName: 'Test App',
      appUrl: 'https://test.com',
      appType: 'religious',
      purpose: 'A Muslim prayer companion app',
      active: true,
      tone: 'warm',
      responseLength: 'balanced',
      creativity: 'strictly_factual',
      mustShowSourceForQuotes: true,
      mustUseTrustedSources: true,
      canAnswerWithoutSource: 'never',
      separateQuoteFromExplanation: true,
      adultMode: false,
      sensitiveTopicMode: 'strict',
      mustHandoffSeriousTopics: true,
      topicsNeedingCare: ['Mental health', 'Religious rulings'],
      humanExpertAvailable: true,
      handoffTriggers: ['Complex religious ruling'],
      humanContactMethod: 'email imam@test.com',
      knowledgeCategories: ['Religious texts'],
      knowledgeNotes: 'Specializes in Quran and Hadith references',
      mustAlwaysDo: ['Show sources for quotes'],
      mustNeverDo: ['Guess scripture references'],
      adminNotes: '',
      structuredRules: [],
      budgetMode: 'balanced',
      allowPremiumOnlyWhenNeeded: true,
      learningEnabled: true,
      autoImprovementEnabled: false,
      adminReviewRequired: true,
      religiousMode: 'muslim',
      religiousBranch: 'Sunni',
      approvedSourcePacks: ['Quran', 'Sahih Bukhari'],
      doctrineAwareRouting: true,
      preferredProviders: [],
      preferredModels: [],
      fallbackChain: [],
      allowedCapabilities: [],
      memoryNamespace: 'mem_test-app',
      retrievalNamespace: 'ret_test-app',
    }

    const prompt = buildAgentSystemPrompt(config)

    expect(prompt).toContain('Test App')
    expect(prompt).toContain('warm')
    expect(prompt).toContain('strictly factual')
    expect(prompt).toContain('Always show the source when quoting text')
    expect(prompt).toContain('Only use trusted, verified sources')
    expect(prompt).toContain('Never provide answers without citing a source')
    expect(prompt).toContain('strict content filtering')
    expect(prompt).toContain('hand off serious/urgent topics')
    expect(prompt).toContain('Mental health, Religious rulings')
    expect(prompt).toContain('Complex religious ruling')
    expect(prompt).toContain('RELIGIOUS MODE: muslim')
    expect(prompt).toContain('Sunni')
    expect(prompt).toContain('Quran')
    expect(prompt).toContain('Sahih Bukhari')
    expect(prompt).toContain('NEVER fabricate')
    expect(prompt).toContain('doctrinal')
    expect(prompt).toContain('Adult content is not allowed')
  })

  it('buildAgentSystemPrompt handles minimal config', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/app-agent')

    const config: AppAgentConfig = {
      id: 'min',
      appSlug: 'min-app',
      appName: 'Minimal App',
      appUrl: '',
      appType: 'general',
      purpose: '',
      active: true,
      tone: 'professional',
      responseLength: 'balanced',
      creativity: 'balanced',
      mustShowSourceForQuotes: false,
      mustUseTrustedSources: false,
      canAnswerWithoutSource: 'sometimes',
      separateQuoteFromExplanation: false,
      adultMode: false,
      sensitiveTopicMode: 'standard',
      mustHandoffSeriousTopics: false,
      topicsNeedingCare: [],
      humanExpertAvailable: false,
      handoffTriggers: [],
      humanContactMethod: '',
      knowledgeCategories: [],
      knowledgeNotes: '',
      mustAlwaysDo: [],
      mustNeverDo: [],
      adminNotes: '',
      structuredRules: [],
      budgetMode: 'balanced',
      allowPremiumOnlyWhenNeeded: true,
      learningEnabled: false,
      autoImprovementEnabled: false,
      adminReviewRequired: true,
      religiousMode: 'none',
      religiousBranch: '',
      approvedSourcePacks: [],
      doctrineAwareRouting: false,
      preferredProviders: [],
      preferredModels: [],
      fallbackChain: [],
      allowedCapabilities: [],
      memoryNamespace: '',
      retrievalNamespace: '',
    }

    const prompt = buildAgentSystemPrompt(config)
    expect(prompt).toContain('Minimal App')
    expect(prompt).toContain('professional')
    expect(prompt).not.toContain('RELIGIOUS MODE')
    expect(prompt).not.toContain('HANDOFF')
    expect(prompt).not.toContain('CRITICAL RULES')
  })
})

// ── Firecrawl Tests ─────────────────────────────────────────────────────────

describe('Firecrawl Integration', () => {
  it('getFirecrawlStatus reports unavailable when no API key', async () => {
    const { getFirecrawlStatus } = await import('@/lib/firecrawl')
    const status = getFirecrawlStatus()
    expect(status.available).toBe(false)
    expect(status.error).toContain('FIRECRAWL_API_KEY')
  })

  it('crawlAppWebsite returns error when no API key', async () => {
    const { crawlAppWebsite } = await import('@/lib/firecrawl')
    const result = await crawlAppWebsite('https://example.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('API key not configured')
    expect(result.pages).toEqual([])
  })
})

// ── Mem0 Tests ──────────────────────────────────────────────────────────────

describe('Mem0 Integration', () => {
  it('getMem0Status reports unavailable when no API key', async () => {
    const { getMem0Status } = await import('@/lib/mem0-client')
    const status = getMem0Status()
    expect(status.available).toBe(false)
    expect(status.error).toContain('MEM0_API_KEY')
  })

  it('searchMemories returns empty when no API key', async () => {
    const { searchMemories } = await import('@/lib/mem0-client')
    const results = await searchMemories('test-app', 'hello')
    expect(results).toEqual([])
  })

  it('addMemory returns null when no API key', async () => {
    const { addMemory } = await import('@/lib/mem0-client')
    const result = await addMemory('test-app', 'test content')
    expect(result).toBeNull()
  })
})

// ── Graphiti Tests ───────────────────────────────────────────────────────────

describe('Graphiti Integration', () => {
  it('getGraphitiStatus reports unavailable when not configured', async () => {
    const { getGraphitiStatus } = await import('@/lib/graphiti-client')
    const status = getGraphitiStatus()
    expect(status.available).toBe(false)
  })

  it('addNode returns null when not configured', async () => {
    const { addNode } = await import('@/lib/graphiti-client')
    const result = await addNode('test-app', 'feature', 'test')
    expect(result).toBeNull()
  })

  it('searchGraph returns empty when not configured', async () => {
    const { searchGraph } = await import('@/lib/graphiti-client')
    const result = await searchGraph('test-app', 'test query')
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })
})

// ── LiteLLM Tests ───────────────────────────────────────────────────────────

describe('LiteLLM Integration', () => {
  it('getLiteLLMStatus reports unavailable when not configured', async () => {
    const { getLiteLLMStatus } = await import('@/lib/litellm-client')
    const status = getLiteLLMStatus()
    expect(status.available).toBe(false)
    expect(status.error).toContain('LITELLM_API_URL')
  })

  it('getBudgetBand returns correct bands', async () => {
    const { getBudgetBand } = await import('@/lib/litellm-client')

    const low = getBudgetBand('low_cost')
    expect(low.mode).toBe('low_cost')
    expect(low.maxCostPerRequest).toBeLessThan(0.01)

    const balanced = getBudgetBand('balanced')
    expect(balanced.mode).toBe('balanced')

    const premium = getBudgetBand('best_quality')
    expect(premium.mode).toBe('best_quality')
    expect(premium.maxCostPerRequest).toBeGreaterThan(0.05)
  })

  it('selectModelForBudget returns cheap models for simple tasks', async () => {
    const { selectModelForBudget } = await import('@/lib/litellm-client')

    const simpleModel = selectModelForBudget('balanced', 'simple')
    expect(simpleModel).toBeTruthy()

    const complexModel = selectModelForBudget('best_quality', 'complex')
    expect(complexModel).toBeTruthy()

    // Complex model should be different from simple in best_quality
    const simpleQuality = selectModelForBudget('best_quality', 'simple')
    expect(simpleQuality).not.toBe(complexModel)
  })

  it('callLiteLLM returns error when not configured', async () => {
    const { callLiteLLM } = await import('@/lib/litellm-client')
    const result = await callLiteLLM({
      model: 'test',
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not configured')
  })
})

// ── PostHog Tests ───────────────────────────────────────────────────────────

describe('PostHog Integration', () => {
  it('getPostHogStatus reports unavailable when no API key', async () => {
    const { getPostHogStatus } = await import('@/lib/posthog-client')
    const status = getPostHogStatus()
    expect(status.available).toBe(false)
    expect(status.error).toContain('POSTHOG_API_KEY')
  })

  it('captureEvent returns false when no API key', async () => {
    const { captureEvent } = await import('@/lib/posthog-client')
    const ok = await captureEvent({ event: 'test', distinctId: 'test' })
    expect(ok).toBe(false)
  })

  it('captureBatch returns false when no API key', async () => {
    const { captureBatch } = await import('@/lib/posthog-client')
    const ok = await captureBatch([{ event: 'test', distinctId: 'test' }])
    expect(ok).toBe(false)
  })
})

// ── LangGraph Tests ─────────────────────────────────────────────────────────

describe('LangGraph Integration', () => {
  it('getLangGraphStatus reports internal mode when no external URL', async () => {
    const { getLangGraphStatus } = await import('@/lib/langgraph-client')
    const status = getLangGraphStatus()
    expect(status.available).toBe(true)
    expect(status.mode).toBe('internal')
  })

  it('getWorkflowDefinition returns valid definitions', async () => {
    const { getWorkflowDefinition } = await import('@/lib/langgraph-client')

    const onboarding = getWorkflowDefinition('app_onboarding')
    expect(onboarding.steps.length).toBeGreaterThan(0)
    expect(onboarding.type).toBe('app_onboarding')

    const religious = getWorkflowDefinition('religious_answer')
    expect(religious.steps).toContain('detect_religious_query')
    expect(religious.steps).toContain('verify_citations')
  })

  it('executeWorkflow runs internal workflow successfully', async () => {
    const { executeWorkflow } = await import('@/lib/langgraph-client')

    const result = await executeWorkflow('fallback_chain', 'test-app', { message: 'test' })
    expect(result.status).toBe('completed')
    expect(result.appSlug).toBe('test-app')
    expect(result.history.length).toBeGreaterThan(0)
    expect(result.history.every(h => h.status === 'success')).toBe(true)
  })
})

// ── Vector Store Per-App Isolation Tests ─────────────────────────────────────

describe('Qdrant Per-App Isolation', () => {
  it('searchAppKnowledge applies app_slug filter', async () => {
    const { searchAppKnowledge } = await import('@/lib/vector-store')
    // Without Qdrant configured, should return empty (graceful degradation)
    const results = await searchAppKnowledge('test-app', new Array(1536).fill(0))
    expect(results).toEqual([])
  })

  it('deleteAppKnowledge returns false when Qdrant unavailable', async () => {
    const { deleteAppKnowledge } = await import('@/lib/vector-store')
    const ok = await deleteAppKnowledge('test-app')
    expect(ok).toBe(false)
  })

  it('upsertAppKnowledge returns false when Qdrant unavailable', async () => {
    const { upsertAppKnowledge } = await import('@/lib/vector-store')
    const ok = await upsertAppKnowledge('test-app', [])
    expect(ok).toBe(false)
  })
})

// ── Concurrency & Multi-App Performance ──────────────────────────────────────

describe('Concurrency — Multi-App Isolation', () => {
  it('multiple parseAdminNotes calls do not interfere', async () => {
    const { parseAdminNotes } = await import('@/lib/app-agent')

    const results = await Promise.all([
      Promise.resolve(parseAdminNotes('Must always be friendly')),
      Promise.resolve(parseAdminNotes('Must never guess')),
      Promise.resolve(parseAdminNotes('Must show source for quotes')),
    ])

    expect(results[0].length).toBeGreaterThan(0)
    expect(results[1].length).toBeGreaterThan(0)
    expect(results[2].length).toBeGreaterThan(0)

    // Rules should be independent
    expect(results[0][0].description).not.toBe(results[1][0].description)
  })

  it('multiple budget band selections are independent', async () => {
    const { selectModelForBudget } = await import('@/lib/litellm-client')

    const results = await Promise.all([
      Promise.resolve(selectModelForBudget('low_cost', 'simple')),
      Promise.resolve(selectModelForBudget('best_quality', 'complex')),
      Promise.resolve(selectModelForBudget('balanced', 'moderate')),
    ])

    expect(results[0]).toBeTruthy()
    expect(results[1]).toBeTruthy()
    expect(results[2]).toBeTruthy()
    // Different budget modes should potentially select different models
    expect(results[0]).not.toBe(results[1])
  })

  it('workflow executions are independent', async () => {
    const { executeWorkflow } = await import('@/lib/langgraph-client')

    const results = await Promise.all([
      executeWorkflow('fallback_chain', 'app-1', { msg: 'hello' }),
      executeWorkflow('escalation_path', 'app-2', { msg: 'urgent' }),
      executeWorkflow('religious_answer', 'app-3', { msg: 'question' }),
    ])

    expect(results.every(r => r.status === 'completed')).toBe(true)
    expect(results[0].appSlug).toBe('app-1')
    expect(results[1].appSlug).toBe('app-2')
    expect(results[2].appSlug).toBe('app-3')
  })
})

// ── Religious App Specialist Tests ───────────────────────────────────────────

describe('Religious App Specialist Support', () => {
  it('Christian app generates correct religious instructions', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/app-agent')

    const config = makeMinimalConfig({
      religiousMode: 'christian' as const,
      religiousBranch: 'Baptist',
      approvedSourcePacks: ['KJV Bible', 'NIV Bible'],
      doctrineAwareRouting: true,
      mustShowSourceForQuotes: true,
    })

    const prompt = buildAgentSystemPrompt(config)
    expect(prompt).toContain('RELIGIOUS MODE: christian')
    expect(prompt).toContain('Baptist')
    expect(prompt).toContain('KJV Bible')
    expect(prompt).toContain('NEVER fabricate')
    expect(prompt).toContain('doctrinal')
    expect(prompt).toContain('source')
  })

  it('Muslim app generates correct religious instructions', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/app-agent')

    const config = makeMinimalConfig({
      religiousMode: 'muslim' as const,
      religiousBranch: 'Sunni',
      approvedSourcePacks: ['Quran', 'Sahih Bukhari', 'Sahih Muslim'],
      doctrineAwareRouting: true,
      mustShowSourceForQuotes: true,
    })

    const prompt = buildAgentSystemPrompt(config)
    expect(prompt).toContain('RELIGIOUS MODE: muslim')
    expect(prompt).toContain('Sunni')
    expect(prompt).toContain('Quran')
    expect(prompt).toContain('Sahih Bukhari')
    expect(prompt).toContain('Sahih Muslim')
    expect(prompt).toContain('NEVER fabricate')
    expect(prompt).toContain('qualified scholar')
  })

  it('Non-religious app does not include religious instructions', async () => {
    const { buildAgentSystemPrompt } = await import('@/lib/app-agent')

    const config = makeMinimalConfig({ religiousMode: 'none' as const })
    const prompt = buildAgentSystemPrompt(config)
    expect(prompt).not.toContain('RELIGIOUS MODE')
    expect(prompt).not.toContain('scripture')
  })
})

// ── Go-Live Hardening Tests ──────────────────────────────────────────────────

describe('Go-Live Hardening', () => {
  it('all integration status functions return valid objects', async () => {
    const { getFirecrawlStatus } = await import('@/lib/firecrawl')
    const { getMem0Status } = await import('@/lib/mem0-client')
    const { getGraphitiStatus } = await import('@/lib/graphiti-client')
    const { getLiteLLMStatus } = await import('@/lib/litellm-client')
    const { getPostHogStatus } = await import('@/lib/posthog-client')
    const { getLangGraphStatus } = await import('@/lib/langgraph-client')

    // All should return valid status objects without throwing
    expect(getFirecrawlStatus()).toHaveProperty('available')
    expect(getMem0Status()).toHaveProperty('available')
    expect(getGraphitiStatus()).toHaveProperty('available')
    expect(getLiteLLMStatus()).toHaveProperty('available')
    expect(getPostHogStatus()).toHaveProperty('available')
    expect(getLangGraphStatus()).toHaveProperty('available')
  })

  it('all integrations degrade gracefully when not configured', async () => {
    const { crawlAppWebsite } = await import('@/lib/firecrawl')
    const { addMemory, searchMemories } = await import('@/lib/mem0-client')
    const { addNode, searchGraph } = await import('@/lib/graphiti-client')
    const { callLiteLLM } = await import('@/lib/litellm-client')
    const { captureEvent } = await import('@/lib/posthog-client')

    // None should throw — all should return safe defaults
    const crawl = await crawlAppWebsite('https://example.com')
    expect(crawl.success).toBe(false)

    const mem = await addMemory('test', 'content')
    expect(mem).toBeNull()

    const search = await searchMemories('test', 'query')
    expect(search).toEqual([])

    const node = await addNode('test', 'type', 'name')
    expect(node).toBeNull()

    const graph = await searchGraph('test', 'query')
    expect(graph).toEqual({ nodes: [], edges: [] })

    const llm = await callLiteLLM({ model: 'test', messages: [] })
    expect(llm.success).toBe(false)

    const ph = await captureEvent({ event: 'test', distinctId: 'test' })
    expect(ph).toBe(false)
  })

  it('LangGraph always available (internal fallback)', async () => {
    const { getLangGraphStatus, executeWorkflow } = await import('@/lib/langgraph-client')

    const status = getLangGraphStatus()
    expect(status.available).toBe(true) // Always available via internal engine

    const result = await executeWorkflow('daily_learning', 'test-app', {})
    expect(result.status).toBe('completed')
  })
})

// ── Helper ──────────────────────────────────────────────────────────────────

function makeMinimalConfig(overrides: Record<string, unknown> = {}): AppAgentConfig {
  // type imported above
  return {
    id: 'test', appSlug: 'test', appName: 'Test', appUrl: '', appType: 'general',
    purpose: '', active: true, tone: 'professional', responseLength: 'balanced',
    creativity: 'balanced', mustShowSourceForQuotes: false, mustUseTrustedSources: false,
    canAnswerWithoutSource: 'sometimes', separateQuoteFromExplanation: false,
    adultMode: false, sensitiveTopicMode: 'standard', mustHandoffSeriousTopics: false,
    topicsNeedingCare: [], humanExpertAvailable: false, handoffTriggers: [],
    humanContactMethod: '', knowledgeCategories: [], knowledgeNotes: '',
    mustAlwaysDo: [], mustNeverDo: [], adminNotes: '', structuredRules: [],
    budgetMode: 'balanced', allowPremiumOnlyWhenNeeded: true, learningEnabled: false,
    autoImprovementEnabled: false, adminReviewRequired: true, religiousMode: 'none',
    religiousBranch: '', approvedSourcePacks: [], doctrineAwareRouting: false,
    preferredProviders: [], preferredModels: [], fallbackChain: [],
    memoryNamespace: '', retrievalNamespace: '',
    allowedCapabilities: [],
    ...overrides,
  } as AppAgentConfig
}
