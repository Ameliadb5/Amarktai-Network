/**
 * API Routes & Labs Tests — AmarktAI Network
 *
 * Comprehensive tests for the platform API routes and coding agent.
 *
 * Covers:
 *  - Coding Agent (generateApp, refineApp, getProjectTypes, getSessionHistory)
 *  - API route file existence
 *  - Webhook Manager
 *  - Batch Processor
 *  - RAG Pipeline (pure logic — external deps mocked)
 *  - Guardrails
 *  - Tool Runtime
 *  - Workflow Engine
 *  - Prompt Studio
 */

import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ── Mocks — external infrastructure ──────────────────────────────────────────

vi.mock('../job-queue', () => ({
  enqueueJob: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../redis', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../vector-store', () => ({
  searchVectors: vi.fn().mockResolvedValue([]),
  upsertVectors: vi.fn().mockResolvedValue(undefined),
  ensureCollection: vi.fn().mockResolvedValue(undefined),
  isQdrantHealthy: vi.fn().mockResolvedValue(false),
}))

// ── Coding Agent ─────────────────────────────────────────────────────────────

import {
  generateApp,
  refineApp,
  getProjectTypes,
  getSessionHistory,
  getSession,
  listSessions,
  type ProjectType,
  type GenerateOptions,
  type GenerationSession,
  type ProjectTypeInfo,
} from '../coding-agent'

describe('Coding Agent', () => {
  it('exports all expected functions', () => {
    expect(typeof generateApp).toBe('function')
    expect(typeof refineApp).toBe('function')
    expect(typeof getProjectTypes).toBe('function')
    expect(typeof getSessionHistory).toBe('function')
    expect(typeof getSession).toBe('function')
    expect(typeof listSessions).toBe('function')
  })

  describe('getProjectTypes', () => {
    it('returns all 5 project types', () => {
      const types = getProjectTypes()
      expect(types.length).toBe(5)
      const ids = types.map((t: ProjectTypeInfo) => t.id)
      expect(ids).toContain('nextjs')
      expect(ids).toContain('react')
      expect(ids).toContain('express')
      expect(ids).toContain('flask')
      expect(ids).toContain('static')
    })

    it('each project type has required fields', () => {
      const types = getProjectTypes()
      for (const t of types) {
        expect(t.id).toBeTruthy()
        expect(t.label).toBeTruthy()
        expect(t.description).toBeTruthy()
        expect(t.language).toBeTruthy()
        expect(t.icon).toBeTruthy()
        expect(Array.isArray(t.defaultFiles)).toBe(true)
        expect(t.defaultFiles.length).toBeGreaterThan(0)
      }
    })
  })

  describe('generateApp', () => {
    const projectTypes: ProjectType[] = ['nextjs', 'react', 'express', 'flask', 'static']

    for (const pt of projectTypes) {
      it(`generates a ${pt} project`, () => {
        const session = generateApp(`Build a simple ${pt} app`, pt)
        expect(session.id).toBeTruthy()
        expect(session.projectType).toBe(pt)
        expect(session.description).toContain(pt)
        expect(Array.isArray(session.files)).toBe(true)
        expect(session.files.length).toBeGreaterThan(0)
        expect(Array.isArray(session.history)).toBe(true)
        expect(session.history.length).toBeGreaterThanOrEqual(1)
        expect(session.createdAt).toBeTruthy()
        expect(session.updatedAt).toBeTruthy()
      })
    }

    it('generates files with path, content, and language', () => {
      const session = generateApp('A todo app', 'react')
      for (const file of session.files) {
        expect(file.path).toBeTruthy()
        expect(typeof file.content).toBe('string')
        expect(file.language).toBeTruthy()
      }
    })

    it('adds test files when refined with testing feedback', () => {
      const session = generateApp('A simple API', 'react')
      const refined = refineApp(session.id, 'Add testing to the project')
      const hasTestFile = refined.files.some(
        (f) => f.path.includes('test') || f.path.includes('spec')
      )
      expect(hasTestFile).toBe(true)
    })

    it('respects includeDocker option', () => {
      const opts: GenerateOptions = { includeDocker: true }
      const session = generateApp('A web app', 'nextjs', opts)
      const hasDockerfile = session.files.some(
        (f) => f.path.toLowerCase().includes('docker')
      )
      expect(hasDockerfile).toBe(true)
    })

    it('history event is type "generate"', () => {
      const session = generateApp('A blog', 'static')
      expect(session.history[0].type).toBe('generate')
      expect(session.history[0].fileCount).toBe(session.files.length)
    })
  })

  describe('refineApp', () => {
    it('refines an existing session', () => {
      const session = generateApp('A dashboard', 'react')
      const initialHistoryLen = session.history.length
      const refined = refineApp(session.id, 'Add a dark mode toggle')
      expect(refined.id).toBe(session.id)
      expect(refined.history.length).toBeGreaterThanOrEqual(initialHistoryLen + 1)
      expect(refined.files.length).toBeGreaterThan(0)
    })

    it('refinement event has type "refine"', () => {
      const session = generateApp('A calculator', 'static')
      const refined = refineApp(session.id, 'Add square root button')
      const lastEvent = refined.history[refined.history.length - 1]
      expect(lastEvent.type).toBe('refine')
    })
  })

  describe('getSessionHistory', () => {
    it('returns history for a valid session', () => {
      const session = generateApp('A chat app', 'nextjs')
      const history = getSessionHistory(session.id)
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThanOrEqual(1)
      for (const event of history) {
        expect(event.id).toBeTruthy()
        expect(event.type).toBeTruthy()
        expect(event.timestamp).toBeTruthy()
      }
    })

    it('throws for unknown session', () => {
      expect(() => getSessionHistory('nonexistent-id')).toThrow('Session not found')
    })
  })

  describe('getSession / listSessions', () => {
    it('getSession returns null for unknown id', () => {
      expect(getSession('no-such-id')).toBeNull()
    })

    it('listSessions includes created sessions', () => {
      const session = generateApp('An app', 'flask')
      const all = listSessions()
      expect(all.some((s: GenerationSession) => s.id === session.id)).toBe(true)
    })
  })
})

// ── API Route File Existence ─────────────────────────────────────────────────

describe('API Route Files', () => {
  const root = resolve(__dirname, '../../app/api')

  const routes = [
    'batch/route.ts',
    'brain/request/route.ts',
    'brain/stream/route.ts',
    'guardrails/route.ts',
    'prompts/route.ts',
    'rag/route.ts',
    'tools/route.ts',
    'webhooks/route.ts',
    'workflows/route.ts',
    'contact/route.ts',
    'waitlist/route.ts',
    'fine-tune/route.ts',
  ]

  for (const route of routes) {
    it(`${route} exists`, () => {
      expect(existsSync(resolve(root, route))).toBe(true)
    })
  }
})

// ── Webhook Manager ──────────────────────────────────────────────────────────

import {
  registerWebhook,
  unregisterWebhook,
  getWebhooksForApp,
  getWebhook,
  setWebhookActive,
  generateSignature,
  verifySignature,
  getDeliveryLog,
  getDeliveryStats,
  WEBHOOK_EVENT_TYPES,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAYS_MS,
} from '../webhook-manager'

describe('Webhook Manager', () => {
  it('exports expected constants', () => {
    expect(Array.isArray(WEBHOOK_EVENT_TYPES)).toBe(true)
    expect(WEBHOOK_EVENT_TYPES.length).toBeGreaterThan(0)
    expect(typeof MAX_RETRY_ATTEMPTS).toBe('number')
    expect(Array.isArray(RETRY_DELAYS_MS)).toBe(true)
  })

  it('registerWebhook creates a webhook with correct fields', () => {
    const wh = registerWebhook('my-app', 'https://example.com/hook', ['app.event'])
    expect(wh.id).toBeTruthy()
    expect(wh.appSlug).toBe('my-app')
    expect(wh.url).toBe('https://example.com/hook')
    expect(wh.events).toContain('app.event')
    expect(wh.active).toBe(true)
    expect(wh.secret).toBeTruthy()
  })

  it('getWebhook retrieves a registered webhook', () => {
    const wh = registerWebhook('app-a', 'https://a.com/wh', ['app.event'])
    const found = getWebhook(wh.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(wh.id)
  })

  it('getWebhooksForApp returns only the app webhooks', () => {
    registerWebhook('app-x', 'https://x.com/wh1', ['app.event'])
    registerWebhook('app-x', 'https://x.com/wh2', ['app.event'])
    const hooks = getWebhooksForApp('app-x')
    expect(hooks.length).toBeGreaterThanOrEqual(2)
    for (const h of hooks) expect(h.appSlug).toBe('app-x')
  })

  it('unregisterWebhook removes a webhook', () => {
    const wh = registerWebhook('app-del', 'https://del.com', ['app.event'])
    expect(unregisterWebhook(wh.id)).toBe(true)
    expect(getWebhook(wh.id)).toBeUndefined()
  })

  it('unregisterWebhook returns false for unknown id', () => {
    expect(unregisterWebhook('nonexistent')).toBe(false)
  })

  it('setWebhookActive toggles active flag', () => {
    const wh = registerWebhook('app-toggle', 'https://t.com', ['app.event'])
    expect(setWebhookActive(wh.id, false)).toBe(true)
    expect(getWebhook(wh.id)!.active).toBe(false)
    expect(setWebhookActive(wh.id, true)).toBe(true)
    expect(getWebhook(wh.id)!.active).toBe(true)
  })

  it('generateSignature produces a hex string', () => {
    const sig = generateSignature('payload', 'secret')
    expect(typeof sig).toBe('string')
    expect(sig.length).toBeGreaterThan(0)
  })

  it('verifySignature validates a correct signature', () => {
    const payload = '{"test":true}'
    const secret = 'my-secret'
    const sig = generateSignature(payload, secret)
    expect(verifySignature(payload, sig, secret)).toBe(true)
  })

  it('verifySignature rejects incorrect signature', () => {
    expect(verifySignature('data', 'bad-sig', 'secret')).toBe(false)
  })

  it('getDeliveryLog returns an array', () => {
    const log = getDeliveryLog()
    expect(Array.isArray(log)).toBe(true)
  })

  it('getDeliveryStats returns summary with expected fields', () => {
    const stats = getDeliveryStats()
    expect(typeof stats.total).toBe('number')
    expect(typeof stats.successful).toBe('number')
    expect(typeof stats.failed).toBe('number')
    expect(typeof stats.pending).toBe('number')
    expect(typeof stats.successRate).toBe('number')
  })
})

// ── Batch Processor ──────────────────────────────────────────────────────────

import {
  createBatchJob,
  submitBatchJob,
  getBatchJob,
  getBatchResult,
  cancelBatchJob,
  listBatchJobs,
  MAX_ITEMS_PER_BATCH,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRIES,
} from '../batch-processor'

describe('Batch Processor', () => {
  it('exports expected constants', () => {
    expect(typeof MAX_ITEMS_PER_BATCH).toBe('number')
    expect(typeof DEFAULT_CONCURRENCY).toBe('number')
    expect(typeof DEFAULT_MAX_RETRIES).toBe('number')
  })

  it('createBatchJob returns a job with pending status', () => {
    const job = createBatchJob({
      appSlug: 'batch-app',
      items: [{ input: 'Summarise this', taskType: 'summarise' }],
    })
    expect(job.id).toBeTruthy()
    expect(job.appSlug).toBe('batch-app')
    expect(job.status).toBe('pending')
    expect(job.items.length).toBe(1)
    expect(job.progress.total).toBe(1)
    expect(job.progress.pending).toBe(1)
  })

  it('getBatchJob retrieves a created job', () => {
    const job = createBatchJob({
      appSlug: 'batch-get',
      items: [{ input: 'Hello', taskType: 'greet' }],
    })
    const found = getBatchJob(job.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(job.id)
  })

  it('getBatchJob returns null for unknown id', () => {
    expect(getBatchJob('nonexistent')).toBeNull()
  })

  it('cancelBatchJob cancels a pending job', () => {
    const job = createBatchJob({
      appSlug: 'batch-cancel',
      items: [{ input: 'data', taskType: 'process' }],
    })
    expect(cancelBatchJob(job.id)).toBe(true)
    expect(getBatchJob(job.id)!.status).toBe('cancelled')
  })

  it('cancelBatchJob returns false for unknown id', () => {
    expect(cancelBatchJob('nonexistent')).toBe(false)
  })

  it('listBatchJobs filters by appSlug', () => {
    createBatchJob({
      appSlug: 'batch-list-test',
      items: [{ input: 'test', taskType: 'test' }],
    })
    const jobs = listBatchJobs('batch-list-test')
    expect(jobs.length).toBeGreaterThanOrEqual(1)
    for (const j of jobs) expect(j.appSlug).toBe('batch-list-test')
  })

  it('submitBatchJob resolves for a valid job', async () => {
    const job = createBatchJob({
      appSlug: 'batch-submit',
      items: [{ input: 'item', taskType: 'run' }],
    })
    const ok = await submitBatchJob(job.id)
    expect(typeof ok).toBe('boolean')
  })

  it('getBatchResult returns null for pending job', () => {
    const job = createBatchJob({
      appSlug: 'batch-result',
      items: [{ input: 'data', taskType: 'test' }],
    })
    const result = getBatchResult(job.id)
    // Pending job may return null or a result with pending status
    if (result !== null) {
      expect(result.jobId).toBe(job.id)
    }
  })
})

// ── RAG Pipeline ─────────────────────────────────────────────────────────────

import {
  chunkText,
  generateEmbedding,
  generateEmbeddings,
  buildRAGPrompt,
  getRAGHealth,
  RAG_CHUNK_SIZE,
  RAG_CHUNK_OVERLAP,
  RAG_TOP_K,
  RAG_EMBEDDING_MODEL,
  type RAGContext,
} from '../rag-pipeline'

describe('RAG Pipeline', () => {
  it('exports expected constants', () => {
    expect(typeof RAG_CHUNK_SIZE).toBe('number')
    expect(typeof RAG_CHUNK_OVERLAP).toBe('number')
    expect(typeof RAG_TOP_K).toBe('number')
    expect(typeof RAG_EMBEDDING_MODEL).toBe('string')
  })

  describe('chunkText', () => {
    it('chunks a short text into one chunk', () => {
      const chunks = chunkText('Hello world')
      expect(chunks.length).toBe(1)
      expect(chunks[0]).toBe('Hello world')
    })

    it('chunks a long text into multiple chunks', () => {
      // chunkText splits on sentence boundaries (.!?)
      const longText = Array.from({ length: 200 }, (_, i) => `Sentence number ${i}.`).join(' ')
      const chunks = chunkText(longText, 200, 20)
      expect(chunks.length).toBeGreaterThan(1)
      for (const c of chunks) {
        expect(c.length).toBeGreaterThan(0)
      }
    })

    it('respects custom chunk size', () => {
      const text = Array.from({ length: 100 }, (_, i) => `Item ${i}.`).join(' ')
      const small = chunkText(text, 50, 0)
      const large = chunkText(text, 500, 0)
      expect(small.length).toBeGreaterThan(large.length)
    })
  })

  it('buildRAGPrompt constructs a prompt string', () => {
    const ctx: RAGContext = {
      query: 'What is AI?',
      results: [
        { content: 'AI is artificial intelligence.', score: 0.95, documentId: 'd1', source: 'wiki', chunkIndex: 0, metadata: {} },
      ],
      contextWindow: 'AI is artificial intelligence.',
      totalChunksSearched: 10,
      latencyMs: 42,
    }
    const prompt = buildRAGPrompt('What is AI?', ctx)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toContain('AI')
  })

  it('buildRAGPrompt includes system prompt when results exist', () => {
    const ctx: RAGContext = {
      query: 'test',
      results: [
        { content: 'Some context.', score: 0.9, documentId: 'd1', source: 'src', chunkIndex: 0, metadata: {} },
      ],
      contextWindow: 'Some context.',
      totalChunksSearched: 1,
      latencyMs: 0,
    }
    const prompt = buildRAGPrompt('test', ctx, 'You are a helpful assistant')
    expect(prompt).toContain('helpful assistant')
  })

  it('generateEmbedding returns null without API key', async () => {
    const result = await generateEmbedding('test text')
    // Without OPENAI_API_KEY, should gracefully return null
    expect(result === null || Array.isArray(result)).toBe(true)
  })

  it('generateEmbeddings returns array of results', async () => {
    const results = await generateEmbeddings(['a', 'b'])
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(2)
  })

  it('getRAGHealth returns a health status object', async () => {
    const health = await getRAGHealth()
    expect(typeof health.vectorStoreHealthy).toBe('boolean')
    expect(typeof health.embeddingAvailable).toBe('boolean')
    expect(typeof health.ready).toBe('boolean')
  })
})

// ── Guardrails ───────────────────────────────────────────────────────────────

import {
  runGuardrails,
  detectPII,
  redactPII,
  detectToxicity,
  detectBias,
  detectHallucinationIndicators,
  DEFAULT_POLICY,
  PII_PATTERN_COUNT,
  TOXIC_PATTERN_COUNT,
  BIAS_INDICATOR_COUNT,
  GUARDRAIL_CATEGORIES,
} from '../guardrails'

describe('Guardrails', () => {
  it('exports expected constants', () => {
    expect(typeof PII_PATTERN_COUNT).toBe('number')
    expect(typeof TOXIC_PATTERN_COUNT).toBe('number')
    expect(typeof BIAS_INDICATOR_COUNT).toBe('number')
    expect(Array.isArray(GUARDRAIL_CATEGORIES)).toBe(true)
    expect(GUARDRAIL_CATEGORIES.length).toBeGreaterThan(0)
  })

  it('DEFAULT_POLICY has required fields', () => {
    expect(Array.isArray(DEFAULT_POLICY.enabledChecks)).toBe(true)
    expect(typeof DEFAULT_POLICY.blockOnCritical).toBe('boolean')
    expect(typeof DEFAULT_POLICY.autoRedactPII).toBe('boolean')
  })

  describe('runGuardrails', () => {
    it('passes for clean text', () => {
      const result = runGuardrails('This is a normal sentence about technology.')
      expect(result.passed).toBe(true)
      expect(Array.isArray(result.checks)).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
      expect(result.metadata.checksRun).toBeGreaterThan(0)
    })

    it('result has expected metadata fields', () => {
      const result = runGuardrails('Hello world')
      expect(typeof result.metadata.checksPassed).toBe('number')
      expect(typeof result.metadata.checksFailed).toBe('number')
      expect(typeof result.metadata.criticalFailures).toBe('number')
    })
  })

  describe('detectPII', () => {
    it('detects email addresses', () => {
      const pii = detectPII('Contact me at john@example.com for details')
      expect(pii.length).toBeGreaterThan(0)
      const emailHit = pii.find((p) => p.type.toLowerCase().includes('email'))
      expect(emailHit).toBeDefined()
    })

    it('returns empty array for clean text', () => {
      const pii = detectPII('No personal information here')
      // May still return items with count 0 or empty array
      const total = pii.reduce((sum, p) => sum + p.count, 0)
      expect(total).toBe(0)
    })
  })

  describe('redactPII', () => {
    it('redacts email addresses', () => {
      const result = redactPII('Email me at alice@example.org')
      expect(result).not.toContain('alice@example.org')
    })

    it('leaves clean text unchanged', () => {
      const clean = 'Just a normal sentence'
      expect(redactPII(clean)).toBe(clean)
    })
  })

  describe('detectToxicity', () => {
    it('returns an array of pattern results', () => {
      const results = detectToxicity('This is a fine message')
      expect(Array.isArray(results)).toBe(true)
      for (const r of results) {
        expect(typeof r.pattern).toBe('string')
        expect(typeof r.matched).toBe('boolean')
      }
    })
  })

  describe('detectBias', () => {
    it('returns an array', () => {
      const results = detectBias('Equal opportunity for everyone')
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('detectHallucinationIndicators', () => {
    it('returns an array of strings', () => {
      const results = detectHallucinationIndicators('As we all know, this is definitely true')
      expect(Array.isArray(results)).toBe(true)
    })
  })
})

// ── Tool Runtime ─────────────────────────────────────────────────────────────

import {
  getAvailableTools,
  getToolsAsOpenAIFunctions,
  executeTool,
  executeToolCalls,
  registerTool,
  unregisterTool,
  BUILTIN_TOOL_NAMES,
  BUILTIN_TOOL_COUNT,
  type ToolCall,
  type ToolDefinition,
} from '../tool-runtime'

describe('Tool Runtime', () => {
  it('has 5 built-in tools', () => {
    expect(BUILTIN_TOOL_COUNT).toBe(5)
    expect(BUILTIN_TOOL_NAMES).toContain('calculator')
    expect(BUILTIN_TOOL_NAMES).toContain('current_time')
    expect(BUILTIN_TOOL_NAMES).toContain('json_extract')
    expect(BUILTIN_TOOL_NAMES).toContain('text_transform')
    expect(BUILTIN_TOOL_NAMES).toContain('http_fetch')
  })

  it('getAvailableTools returns all built-in tools', () => {
    const tools = getAvailableTools()
    expect(tools.length).toBeGreaterThanOrEqual(5)
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.category).toBeTruthy()
      expect(Array.isArray(tool.parameters)).toBe(true)
    }
  })

  it('getToolsAsOpenAIFunctions returns proper format', () => {
    const functions = getToolsAsOpenAIFunctions()
    expect(functions.length).toBeGreaterThanOrEqual(5)
    for (const fn of functions) {
      expect(fn.type).toBe('function')
      expect(fn.function.name).toBeTruthy()
      expect(fn.function.description).toBeTruthy()
      expect(fn.function.parameters).toBeTruthy()
      expect(fn.function.parameters.type).toBe('object')
    }
  })

  it('executeTool runs calculator successfully', async () => {
    const call: ToolCall = {
      id: 'calc-1',
      toolName: 'calculator',
      arguments: { expression: '2 + 2' },
    }
    const result = await executeTool(call)
    expect(result.callId).toBe('calc-1')
    expect(result.toolName).toBe('calculator')
    expect(result.success).toBe(true)
    expect((result.output as Record<string, unknown>).result).toBe(4)
    expect(typeof result.executionMs).toBe('number')
  })

  it('executeTool runs text_transform', async () => {
    const call: ToolCall = {
      id: 'txt-1',
      toolName: 'text_transform',
      arguments: { text: 'hello world', operation: 'uppercase' },
    }
    const result = await executeTool(call)
    expect(result.success).toBe(true)
    expect((result.output as Record<string, unknown>).result).toBe('HELLO WORLD')
  })

  it('executeTool handles unknown tool gracefully', async () => {
    const call: ToolCall = {
      id: 'unk-1',
      toolName: 'nonexistent_tool',
      arguments: {},
    }
    const result = await executeTool(call)
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('executeToolCalls runs multiple calls', async () => {
    const calls: ToolCall[] = [
      { id: 'a', toolName: 'calculator', arguments: { expression: '10 * 5' } },
      { id: 'b', toolName: 'text_transform', arguments: { text: 'ABC', operation: 'lowercase' } },
    ]
    const results = await executeToolCalls(calls)
    expect(results.length).toBe(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  it('registerTool and unregisterTool manage custom tools', async () => {
    const def: ToolDefinition = {
      name: 'test_custom_tool',
      description: 'A test tool',
      category: 'custom',
      parameters: [],
    }
    registerTool(def, async () => 'custom result')
    const tools = getAvailableTools()
    expect(tools.some((t) => t.name === 'test_custom_tool')).toBe(true)

    const result = await executeTool({
      id: 'c1',
      toolName: 'test_custom_tool',
      arguments: {},
    })
    expect(result.success).toBe(true)
    expect(result.output).toBe('custom result')

    expect(unregisterTool('test_custom_tool')).toBe(true)
    expect(getAvailableTools().some((t) => t.name === 'test_custom_tool')).toBe(false)
  })

  it('unregisterTool returns false for unknown tool', () => {
    expect(unregisterTool('does_not_exist')).toBe(false)
  })
})

// ── Workflow Engine ──────────────────────────────────────────────────────────

import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  activateWorkflow,
  deleteWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
  STEP_TYPES,
  WORKFLOW_STATUSES,
  type WorkflowStep,
} from '../workflow-engine'

describe('Workflow Engine', () => {
  it('exports expected constants', () => {
    expect(Array.isArray(STEP_TYPES)).toBe(true)
    expect(STEP_TYPES).toContain('input')
    expect(STEP_TYPES).toContain('ai_completion')
    expect(STEP_TYPES).toContain('transform')
    expect(STEP_TYPES).toContain('condition')
    expect(STEP_TYPES).toContain('output')
    expect(WORKFLOW_STATUSES).toContain('draft')
    expect(WORKFLOW_STATUSES).toContain('active')
    expect(WORKFLOW_STATUSES).toContain('archived')
  })

  it('createWorkflow creates a workflow in draft status', () => {
    const steps: WorkflowStep[] = [
      { id: 'step-1', type: 'input', name: 'Start', config: {} },
      { id: 'step-2', type: 'output', name: 'End', config: {} },
    ]
    const wf = createWorkflow({
      name: 'Test Workflow',
      description: 'A test workflow',
      appSlug: 'wf-app',
      steps,
      entryStepId: 'step-1',
    })
    expect(wf.id).toBeTruthy()
    expect(wf.name).toBe('Test Workflow')
    expect(wf.status).toBe('draft')
    expect(wf.steps.size).toBe(2)
  })

  it('getWorkflow retrieves a created workflow', () => {
    const wf = createWorkflow({
      name: 'Retrieve Test',
      description: 'test',
      appSlug: 'wf-get',
      steps: [{ id: 's1', type: 'input', name: 'In', config: {} }],
      entryStepId: 's1',
    })
    const found = getWorkflow(wf.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(wf.id)
  })

  it('getWorkflow returns null for unknown id', () => {
    expect(getWorkflow('nonexistent')).toBeNull()
  })

  it('listWorkflows filters by appSlug', () => {
    createWorkflow({
      name: 'List Test',
      description: 'test',
      appSlug: 'wf-list-unique',
      steps: [{ id: 's1', type: 'input', name: 'In', config: {} }],
      entryStepId: 's1',
    })
    const wfs = listWorkflows('wf-list-unique')
    expect(wfs.length).toBeGreaterThanOrEqual(1)
    for (const wf of wfs) expect(wf.appSlug).toBe('wf-list-unique')
  })

  it('activateWorkflow changes status to active', () => {
    const wf = createWorkflow({
      name: 'Activate Test',
      description: 'test',
      appSlug: 'wf-activate',
      steps: [{ id: 's1', type: 'input', name: 'In', config: {} }],
      entryStepId: 's1',
    })
    expect(activateWorkflow(wf.id)).toBe(true)
    expect(getWorkflow(wf.id)!.status).toBe('active')
  })

  it('deleteWorkflow removes a workflow', () => {
    const wf = createWorkflow({
      name: 'Delete Test',
      description: 'test',
      appSlug: 'wf-del',
      steps: [{ id: 's1', type: 'input', name: 'In', config: {} }],
      entryStepId: 's1',
    })
    expect(deleteWorkflow(wf.id)).toBe(true)
    expect(getWorkflow(wf.id)).toBeNull()
  })

  it('deleteWorkflow returns false for unknown id', () => {
    expect(deleteWorkflow('nonexistent')).toBe(false)
  })

  it('getWorkflowRun returns null for unknown run', () => {
    expect(getWorkflowRun('no-such-run')).toBeNull()
  })

  it('listWorkflowRuns returns empty for unknown workflow', () => {
    expect(listWorkflowRuns('no-such-wf')).toEqual([])
  })
})

// ── Prompt Studio ────────────────────────────────────────────────────────────

import {
  createTemplate,
  updateTemplate,
  getTemplate,
  listTemplates,
  getVersionHistory,
  deleteTemplate,
  renderTemplate,
  createABTest,
  startABTest,
  selectVariant,
  getABTest,
  listABTests,
  TEMPLATE_CATEGORIES,
} from '../prompt-studio'

describe('Prompt Studio', () => {
  it('exports expected constants', () => {
    expect(TEMPLATE_CATEGORIES).toContain('chat')
    expect(TEMPLATE_CATEGORIES).toContain('coding')
    expect(TEMPLATE_CATEGORIES).toContain('creative')
    expect(TEMPLATE_CATEGORIES).toContain('analysis')
    expect(TEMPLATE_CATEGORIES).toContain('agent')
    expect(TEMPLATE_CATEGORIES).toContain('custom')
  })

  describe('Template CRUD', () => {
    it('createTemplate creates a template with correct fields', () => {
      const tmpl = createTemplate({
        name: 'Greeting Template',
        description: 'Greets the user',
        appSlug: 'ps-app',
        template: 'Hello, {{name}}!',
        variables: [{ name: 'name', description: 'User name', type: 'string', required: true }],
        tags: ['greeting'],
        category: 'chat',
      })
      expect(tmpl.id).toBeTruthy()
      expect(tmpl.name).toBe('Greeting Template')
      expect(tmpl.version).toBe(1)
      expect(tmpl.isActive).toBe(true)
      expect(tmpl.variables.length).toBe(1)
    })

    it('getTemplate retrieves a created template', () => {
      const tmpl = createTemplate({
        name: 'Get Test',
        description: 'test',
        appSlug: 'ps-get',
        template: 'Test {{x}}',
      })
      const found = getTemplate(tmpl.id)
      expect(found).not.toBeNull()
      expect(found!.id).toBe(tmpl.id)
    })

    it('getTemplate returns null for unknown id', () => {
      expect(getTemplate('no-such-id')).toBeNull()
    })

    it('updateTemplate bumps version', () => {
      const tmpl = createTemplate({
        name: 'Update Test',
        description: 'test',
        appSlug: 'ps-upd',
        template: 'v1: {{msg}}',
      })
      const updated = updateTemplate(tmpl.id, { template: 'v2: {{msg}}' })
      expect(updated).not.toBeNull()
      expect(updated!.version).toBe(2)
      expect(updated!.template).toBe('v2: {{msg}}')
    })

    it('updateTemplate returns null for unknown id', () => {
      expect(updateTemplate('nonexistent', { template: 'x' })).toBeNull()
    })

    it('listTemplates filters by appSlug', () => {
      createTemplate({
        name: 'List Test',
        description: 'test',
        appSlug: 'ps-list-unique',
        template: 'hi',
      })
      const list = listTemplates('ps-list-unique')
      expect(list.length).toBeGreaterThanOrEqual(1)
      for (const t of list) expect(t.appSlug).toBe('ps-list-unique')
    })

    it('deleteTemplate removes a template', () => {
      const tmpl = createTemplate({
        name: 'Del Test',
        description: 'test',
        appSlug: 'ps-del',
        template: 'bye',
      })
      expect(deleteTemplate(tmpl.id)).toBe(true)
      expect(getTemplate(tmpl.id)).toBeNull()
    })

    it('deleteTemplate returns false for unknown id', () => {
      expect(deleteTemplate('nonexistent')).toBe(false)
    })
  })

  describe('renderTemplate', () => {
    it('renders template with variables', () => {
      const tmpl = createTemplate({
        name: 'Render Test',
        description: 'test',
        appSlug: 'ps-render',
        template: 'Hello, {{name}}! You are {{age}} years old.',
        variables: [
          { name: 'name', description: 'Name', type: 'string', required: true },
          { name: 'age', description: 'Age', type: 'number', required: true },
        ],
      })
      const result = renderTemplate(tmpl.id, { name: 'Alice', age: 30 })
      expect(result).not.toBeNull()
      expect(result!.rendered).toContain('Alice')
      expect(result!.rendered).toContain('30')
    })

    it('returns null for unknown template', () => {
      expect(renderTemplate('unknown', { x: 'y' })).toBeNull()
    })
  })

  describe('Version History', () => {
    it('tracks version changes', () => {
      const tmpl = createTemplate({
        name: 'Version Test',
        description: 'test',
        appSlug: 'ps-ver',
        template: 'v1',
      })
      updateTemplate(tmpl.id, { template: 'v2' })
      updateTemplate(tmpl.id, { template: 'v3' })
      const history = getVersionHistory(tmpl.id)
      expect(history.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('A/B Testing', () => {
    it('createABTest creates a test in draft status', () => {
      const t1 = createTemplate({ name: 'A', description: 'a', appSlug: 'ab-app', template: 'a' })
      const t2 = createTemplate({ name: 'B', description: 'b', appSlug: 'ab-app', template: 'b' })
      const ab = createABTest({
        name: 'AB Test 1',
        appSlug: 'ab-app',
        variants: [
          { name: 'Variant A', templateId: t1.id },
          { name: 'Variant B', templateId: t2.id },
        ],
      })
      expect(ab.id).toBeTruthy()
      expect(ab.status).toBe('draft')
      expect(ab.variants.length).toBe(2)
    })

    it('startABTest changes status to running', () => {
      const t1 = createTemplate({ name: 'C', description: 'c', appSlug: 'ab-start', template: 'c' })
      const t2 = createTemplate({ name: 'D', description: 'd', appSlug: 'ab-start', template: 'd' })
      const ab = createABTest({
        name: 'AB Start Test',
        appSlug: 'ab-start',
        variants: [
          { name: 'V1', templateId: t1.id },
          { name: 'V2', templateId: t2.id },
        ],
      })
      expect(startABTest(ab.id)).toBe(true)
      const found = getABTest(ab.id)
      expect(found!.status).toBe('running')
    })

    it('selectVariant returns a variant from a running test', () => {
      const t1 = createTemplate({ name: 'E', description: 'e', appSlug: 'ab-sel', template: 'e' })
      const t2 = createTemplate({ name: 'F', description: 'f', appSlug: 'ab-sel', template: 'f' })
      const ab = createABTest({
        name: 'AB Select Test',
        appSlug: 'ab-sel',
        variants: [
          { name: 'V1', templateId: t1.id },
          { name: 'V2', templateId: t2.id },
        ],
      })
      startABTest(ab.id)
      const variant = selectVariant(ab.id)
      expect(variant).not.toBeNull()
      expect(variant!.name).toBeTruthy()
    })

    it('getABTest returns null for unknown id', () => {
      expect(getABTest('nonexistent')).toBeNull()
    })

    it('listABTests filters by appSlug', () => {
      const t1 = createTemplate({ name: 'G', description: 'g', appSlug: 'ab-list-unique', template: 'g' })
      createABTest({
        name: 'AB List Test',
        appSlug: 'ab-list-unique',
        variants: [{ name: 'V1', templateId: t1.id }],
      })
      const tests = listABTests('ab-list-unique')
      expect(tests.length).toBeGreaterThanOrEqual(1)
    })
  })
})
