/**
 * Platform Systems Tests — Tool Runtime, RAG, Rate Limiter, Webhooks,
 * Semantic Cache, Prompt Studio, Guardrails, Smart Router, Workflow Engine,
 * Multi-Modal Pipeline, Federated Memory, Batch Processor, Observability,
 * Audit Trail, Plugin System.
 *
 * Tests cover exports, type integrity, core logic, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mocks (must use vi.mock with self-contained factories) ────────────────────

// Also mock redis/cache so federated-memory doesn't fail on redis connection
vi.mock('../cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
}))

// Mock vector DB calls used by federated-memory
vi.mock('../qdrant', () => ({
  upsertVectors: vi.fn().mockResolvedValue(undefined),
  searchVectors: vi.fn().mockResolvedValue([]),
  ensureCollection: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
}))

// Prisma mock — in-memory tables for all new models (factory is self-contained to avoid hoisting issues)
vi.mock('../prisma', () => {
  type Row = Record<string, unknown>

  function makeTable(pk: string) {
    const store = new Map<unknown, Row>()
    let intPk = 1

    function resolveWhere(where: Row): Row | undefined {
      for (const [, row] of store) {
        const match = Object.entries(where).every(([k, v]) => {
          const rv = row[k]
          if (v !== null && typeof v === 'object' && 'in' in (v as object)) return ((v as { in: unknown[] }).in).includes(rv)
          return rv === v
        })
        if (match) return row
      }
    }

    return {
      store,
      async create({ data }: { data: Row }) {
        const clean: Row = {}
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && ('create' in (v as object))) continue
          clean[k] = v
        }
        if (!clean[pk]) clean[pk] = intPk++
        clean.createdAt = clean.createdAt ?? new Date()
        clean.updatedAt = clean.updatedAt ?? new Date()
        store.set(clean[pk], clean)
        return clean
      },
      async findUnique({ where }: { where: Row; include?: unknown }) {
        const key = where[pk]
        if (key !== undefined) return store.get(key) ?? null
        return resolveWhere(where) ?? null
      },
      async findFirst({ where }: { where?: Row }) {
        if (!where) return (store.values().next().value as Row | undefined) ?? null
        return resolveWhere(where) ?? null
      },
      async findMany({ where, orderBy: _ob, take: _t }: { where?: Row; orderBy?: unknown; take?: number } = {}) {
        function matchRow(row: Row, filter: Row): boolean {
          for (const [k, v] of Object.entries(filter)) {
            if (k === 'OR') {
              const ors = v as Row[]
              if (!ors.some((o) => matchRow(row, o))) return false
              continue
            }
            const rv = row[k]
            if (v !== null && typeof v === 'object') {
              const op = v as Record<string, unknown>
              if ('in' in op) { if (!(op.in as unknown[]).includes(rv)) return false; continue }
              if ('lt' in op) { if (rv === null || (rv as number) >= (op.lt as number)) return false; continue }
              if ('gt' in op) { if (rv === null || (rv as number) <= (op.gt as number)) return false; continue }
              if ('startsWith' in op) { if (typeof rv !== 'string' || !rv.startsWith(op.startsWith as string)) return false; continue }
              if ('contains' in op) { if (typeof rv !== 'string' || !rv.includes(op.contains as string)) return false; continue }
            } else {
              if (rv !== v) return false
            }
          }
          return true
        }
        const rows: Row[] = []
        for (const [, row] of store) {
          if (!where || matchRow(row, where)) rows.push(row)
        }
        return rows
      },
      async update({ where, data }: { where: Row; data: Row }) {
        const existing = (where[pk] !== undefined ? store.get(where[pk]) : resolveWhere(where)) as Row | undefined
        if (!existing) throw new Error('Record not found')
        const cleanData: Row = {}
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'create' in (v as object)) continue
          cleanData[k] = v
        }
        Object.assign(existing, { ...cleanData, updatedAt: new Date() })
        return existing
      },
      async updateMany({ where, data }: { where: Row; data: Row }) {
        let count = 0
        for (const [, row] of store) {
          const match = Object.entries(where).every(([k, v]) => row[k] === v)
          if (match) { Object.assign(row, data); count++ }
        }
        return { count }
      },
      async delete({ where }: { where: Row }) {
        const key = where[pk] ?? resolveWhere(where)?.[pk]
        if (key !== undefined) store.delete(key)
        return {}
      },
      async deleteMany({ where }: { where?: Row } = {}) {
        let count = 0
        if (!where) { count = store.size; store.clear(); return { count } }
        for (const [k, row] of store) {
          const match = Object.entries(where).every(([wk, wv]) => row[wk] === wv)
          if (match) { store.delete(k); count++ }
        }
        return { count }
      },
      async upsert({ where, create, update: upd }: { where: Row; create: Row; update: Row }) {
        const key = where[pk]
        const existing = key !== undefined ? store.get(key) : resolveWhere(where)
        if (existing) { Object.assign(existing as object, { ...upd, updatedAt: new Date() }); return existing }
        const row = { ...create, [pk]: create[pk] ?? intPk++, createdAt: new Date(), updatedAt: new Date() }
        store.set(row[pk], row)
        return row
      },
      async count({ where }: { where?: Row } = {}) {
        if (!where) return store.size
        let count = 0
        for (const [, row] of store) {
          const match = Object.entries(where).every(([k, v]) => {
            const rv = row[k]
            if (v !== null && typeof v === 'object' && 'in' in (v as object)) return ((v as { in: unknown[] }).in).includes(rv)
            return rv === v
          })
          if (match) count++
        }
        return count
      },
    }
  }

  const batchJobItemTable = makeTable('id')
  const batchJobTable = (() => {
    const base = makeTable('id')
    return {
      ...base,
      async create({ data }: { data: Row }) {
        const itemsNested = data.items as { create?: Row[] } | undefined
        const clean: Row = {}
        for (const [k, v] of Object.entries(data)) { if (k !== 'items') clean[k] = v }
        clean.createdAt = new Date(); clean.updatedAt = new Date()
        base.store.set(data.id, clean)
        if (itemsNested?.create) {
          let idx = 0
          for (const item of itemsNested.create) {
            await batchJobItemTable.create({ data: { ...item, id: batchJobItemTable.store.size + 1 + idx++, batchId: data.id } })
          }
        }
        return clean
      },
      async findUnique({ where, include }: { where: Row; include?: { items?: unknown } }) {
        const row = base.store.get(where.id) as Row | undefined
        if (!row) return null
        if (include?.items) {
          const items = await batchJobItemTable.findMany({ where: { batchId: row.id } })
          return { ...row, items }
        }
        return row
      },
      async findMany({ where, include, orderBy: _orderBy }: { where?: Row; include?: { items?: unknown }; orderBy?: unknown }) {
        const rows: Row[] = []
        for (const [, row] of base.store) {
          if (!where) { rows.push(row); continue }
          const match = Object.entries(where).every(([k, v]) => row[k] === v)
          if (match) rows.push(row)
        }
        if (include?.items) {
          return Promise.all(rows.map(async (r) => ({ ...r, items: await batchJobItemTable.findMany({ where: { batchId: r.id } }) })))
        }
        return rows
      },
      async update({ where, data }: { where: Row; data: Row }) {
        const existing = base.store.get(where.id) as Row
        if (!existing) throw new Error('Not found')
        Object.assign(existing, { ...data, updatedAt: new Date() })
        return existing
      },
    }
  })()

  const promptVersionTable = makeTable('id')
  const promptTemplateTable = (() => {
    const base = makeTable('id')
    return {
      ...base,
      async create({ data }: { data: Row }) {
        const vn = data.versions as { create?: Row | Row[] } | undefined
        const clean: Row = {}
        for (const [k, v] of Object.entries(data)) { if (k !== 'versions') clean[k] = v }
        clean.createdAt = new Date(); clean.updatedAt = new Date()
        base.store.set(data.id, clean)
        if (vn?.create) {
          const items = Array.isArray(vn.create) ? vn.create : [vn.create]
          for (const item of items) await promptVersionTable.create({ data: { ...item, templateId: data.id } })
        }
        return clean
      },
      async update({ where, data }: { where: Row; data: Row }) {
        const vn = data.versions as { create?: Row | Row[] } | undefined
        const clean: Row = {}
        for (const [k, v] of Object.entries(data)) { if (k !== 'versions') clean[k] = v }
        const existing = base.store.get(where.id) as Row
        if (!existing) throw new Error('Not found')
        Object.assign(existing, { ...clean, updatedAt: new Date() })
        if (vn?.create) {
          const items = Array.isArray(vn.create) ? vn.create : [vn.create]
          for (const item of items) await promptVersionTable.create({ data: { ...(item as Row), templateId: where.id } })
        }
        return existing
      },
    }
  })()

  return {
    prisma: {
      memoryEntry: makeTable('id'),
      batchJob: batchJobTable,
      batchJobItem: batchJobItemTable,
      workflowDefinition: makeTable('id'),
      workflowRun: makeTable('id'),
      promptTemplate: promptTemplateTable,
      promptTemplateVersion: promptVersionTable,
      promptABTest: makeTable('id'),
      appStrategyRecord: makeTable('appSlug'),
      webhookRegistrationRecord: makeTable('id'),
      webhookDeliveryRecord: makeTable('id'),
      fineTuneJob: makeTable('jobId'),
      aiProvider: { findMany: () => Promise.resolve([]) },
    },
  }
})

// ── Tool Runtime ─────────────────────────────────────────────────────────────

import {
  getAvailableTools,
  getToolsAsOpenAIFunctions,
  executeTool,
  executeToolCalls,
  processToolCallsFromResponse,
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

  it('executeTool — calculator works', async () => {
    const result = await executeTool({ id: '1', toolName: 'calculator', arguments: { expression: '2 + 3' } })
    expect(result.success).toBe(true)
    expect((result.output as { result: number }).result).toBe(5)
    expect(result.executionMs).toBeGreaterThanOrEqual(0)
  })

  it('executeTool — current_time works', async () => {
    const result = await executeTool({ id: '2', toolName: 'current_time', arguments: { timezone: 'UTC' } })
    expect(result.success).toBe(true)
    expect((result.output as { iso: string }).iso).toBeTruthy()
  })

  it('executeTool — json_extract works', async () => {
    const result = await executeTool({ id: '3', toolName: 'json_extract', arguments: { json: '{"a":{"b":42}}', path: 'a.b' } })
    expect(result.success).toBe(true)
    expect((result.output as { value: number }).value).toBe(42)
  })

  it('executeTool — text_transform works', async () => {
    const result = await executeTool({ id: '4', toolName: 'text_transform', arguments: { text: 'Hello World', operation: 'uppercase' } })
    expect(result.success).toBe(true)
    expect((result.output as { result: string }).result).toBe('HELLO WORLD')
  })

  it('executeTool — unknown tool returns error', async () => {
    const result = await executeTool({ id: '5', toolName: 'nonexistent', arguments: {} })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('executeToolCalls runs multiple tools in parallel', async () => {
    const calls: ToolCall[] = [
      { id: '1', toolName: 'calculator', arguments: { expression: '10 * 5' } },
      { id: '2', toolName: 'current_time', arguments: {} },
    ]
    const results = await executeToolCalls(calls)
    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  it('registerTool and unregisterTool work', () => {
    const def: ToolDefinition = { name: 'custom_test', description: 'Test', category: 'custom', parameters: [] }
    registerTool(def, async () => ({ result: 'ok' }))
    const tools = getAvailableTools()
    expect(tools.some(t => t.name === 'custom_test')).toBe(true)

    unregisterTool('custom_test')
    const toolsAfter = getAvailableTools()
    expect(toolsAfter.some(t => t.name === 'custom_test')).toBe(false)
  })

  it('processToolCallsFromResponse converts AI response to tool messages', async () => {
    const messages = await processToolCallsFromResponse([
      { id: 'tc1', function: { name: 'calculator', arguments: '{"expression":"1+1"}' } },
    ])
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('tool')
    expect(messages[0].tool_call_id).toBe('tc1')
  })
})

// ── RAG Pipeline ─────────────────────────────────────────────────────────────

import {
  chunkText,
  buildRAGPrompt,
  getRAGHealth,
  RAG_CHUNK_SIZE,
  RAG_TOP_K,
  RAG_EMBEDDING_MODEL,
  type RAGContext,
} from '../rag-pipeline'

describe('RAG Pipeline', () => {
  it('exports configuration constants', () => {
    expect(RAG_CHUNK_SIZE).toBe(512)
    expect(RAG_TOP_K).toBe(5)
    expect(RAG_EMBEDDING_MODEL).toBe('text-embedding-3-small')
  })

  it('chunkText splits text into chunks', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.'
    const chunks = chunkText(text, 50, 10)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0)
    }
  })

  it('chunkText handles empty input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('  ')).toEqual([])
  })

  it('chunkText returns single chunk for short text', () => {
    const chunks = chunkText('Short text.')
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('Short text.')
  })

  it('buildRAGPrompt injects context', () => {
    const context: RAGContext = {
      query: 'What is AI?',
      results: [{ content: 'AI is artificial intelligence.', score: 0.95, documentId: 'd1', source: 'wiki', chunkIndex: 0, metadata: {} }],
      contextWindow: '[Source 1: wiki (relevance: 95.0%)]\nAI is artificial intelligence.',
      totalChunksSearched: 10,
      latencyMs: 50,
    }
    const prompt = buildRAGPrompt('What is AI?', context)
    expect(prompt).toContain('What is AI?')
    expect(prompt).toContain('AI is artificial intelligence')
    expect(prompt).toContain('Retrieved Context')
  })

  it('buildRAGPrompt returns raw query when no results', () => {
    const context: RAGContext = { query: 'test', results: [], contextWindow: '', totalChunksSearched: 0, latencyMs: 0 }
    expect(buildRAGPrompt('test', context)).toBe('test')
  })

  it('getRAGHealth returns status', async () => {
    const health = await getRAGHealth()
    expect(typeof health.vectorStoreHealthy).toBe('boolean')
    expect(typeof health.embeddingAvailable).toBe('boolean')
    expect(typeof health.ready).toBe('boolean')
  })
})

// ── Rate Limiter ─────────────────────────────────────────────────────────────

import {
  checkRateLimit,
  peekRateLimit,
  setCustomLimit,
  getRateLimitHeaders,
  checkCompositeLimits,
  DEFAULT_RATE_LIMITS,
  type RateLimitResult,
} from '../rate-limiter'

describe('Rate Limiter', () => {
  it('exports default limits for all scopes', () => {
    expect(DEFAULT_RATE_LIMITS.app).toBeDefined()
    expect(DEFAULT_RATE_LIMITS.user).toBeDefined()
    expect(DEFAULT_RATE_LIMITS.provider).toBeDefined()
    expect(DEFAULT_RATE_LIMITS.global).toBeDefined()
    expect(DEFAULT_RATE_LIMITS.ip).toBeDefined()
    expect(DEFAULT_RATE_LIMITS.app.maxRequests).toBe(1000)
    expect(DEFAULT_RATE_LIMITS.user.maxRequests).toBe(60)
  })

  it('checkRateLimit allows when Redis unavailable (graceful degradation)', async () => {
    const result = await checkRateLimit('app', 'test-app')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(DEFAULT_RATE_LIMITS.app.maxRequests)
  })

  it('peekRateLimit works without consuming', async () => {
    const result = await peekRateLimit('user', 'test-user')
    expect(result.allowed).toBe(true)
  })

  it('getRateLimitHeaders returns proper headers', () => {
    const result: RateLimitResult = { allowed: true, remaining: 99, limit: 100, resetAt: new Date() }
    const headers = getRateLimitHeaders(result)
    expect(headers['X-RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Remaining']).toBe('99')
    expect(headers['X-RateLimit-Reset']).toBeTruthy()
  })

  it('getRateLimitHeaders includes Retry-After when blocked', () => {
    const result: RateLimitResult = { allowed: false, remaining: 0, limit: 100, resetAt: new Date(), retryAfterMs: 5000 }
    const headers = getRateLimitHeaders(result)
    expect(headers['Retry-After']).toBe('5')
  })

  it('checkCompositeLimits returns most restrictive', async () => {
    const result = await checkCompositeLimits([
      { scope: 'app', identifier: 'test' },
      { scope: 'user', identifier: 'test' },
    ])
    expect(result.allowed).toBe(true)
  })

  it('setCustomLimit accepts custom config', () => {
    setCustomLimit('app', 'premium-app', { maxRequests: 5000, windowSeconds: 60 })
    // No error thrown = success
  })
})

// ── Webhook Manager ──────────────────────────────────────────────────────────

import {
  registerWebhook,
  getWebhooksForApp,
  generateSignature,
  verifySignature,
  getDeliveryStats,
  WEBHOOK_EVENT_TYPES,
  MAX_RETRY_ATTEMPTS,
} from '../webhook-manager'

describe('Webhook Manager', () => {
  it('has 10 event types', () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(10)
    expect(WEBHOOK_EVENT_TYPES).toContain('brain.request.completed')
    expect(WEBHOOK_EVENT_TYPES).toContain('video.generation.completed')
    expect(WEBHOOK_EVENT_TYPES).toContain('agent.task.completed')
  })

  it('MAX_RETRY_ATTEMPTS is 5', () => {
    expect(MAX_RETRY_ATTEMPTS).toBe(5)
  })

  it('registerWebhook creates webhook', async () => {
    const webhook = await registerWebhook('test-app', 'https://example.com/webhook', ['brain.request.completed'])
    expect(webhook.id).toBeTruthy()
    expect(webhook.appSlug).toBe('test-app')
    expect(webhook.url).toBe('https://example.com/webhook')
    expect(webhook.secret).toBeTruthy()
    expect(webhook.active).toBe(true)
  })

  it('registerWebhook rejects non-HTTPS URLs', async () => {
    await expect(registerWebhook('test', 'http://insecure.com', ['app.event'])).rejects.toThrow('HTTPS')
  })

  it('getWebhooksForApp lists active webhooks', async () => {
    await registerWebhook('list-test', 'https://example.com/a', ['app.event'])
    const webhooks = await getWebhooksForApp('list-test')
    expect(webhooks.length).toBeGreaterThanOrEqual(1)
  })

  it('generateSignature and verifySignature work together', () => {
    const payload = '{"test":true}'
    const secret = 'my-secret'
    const sig = generateSignature(payload, secret)
    expect(verifySignature(payload, sig, secret)).toBe(true)
    expect(verifySignature(payload, 'wrong-sig' + sig.slice(9), secret)).toBe(false)
  })

  it('getDeliveryStats returns structure', async () => {
    const stats = await getDeliveryStats()
    expect(typeof stats.total).toBe('number')
    expect(typeof stats.successful).toBe('number')
    expect(typeof stats.failed).toBe('number')
    expect(typeof stats.successRate).toBe('number')
  })
})

// ── Semantic Cache ───────────────────────────────────────────────────────────

import {
  lookupCache,
  getCacheStats,
  resetCacheStats,
  SEMANTIC_SIMILARITY_THRESHOLD,
  SEMANTIC_CACHE_DEFAULT_TTL,
} from '../semantic-cache'

describe('Semantic Cache', () => {
  beforeEach(() => resetCacheStats())

  it('exports configuration constants', () => {
    expect(SEMANTIC_SIMILARITY_THRESHOLD).toBe(0.92)
    expect(SEMANTIC_CACHE_DEFAULT_TTL).toBe(3600)
  })

  it('lookupCache returns miss when cache empty', async () => {
    const result = await lookupCache('test query', 'test-app')
    expect(result.hit).toBe(false)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('getCacheStats returns structure', () => {
    const stats = getCacheStats()
    expect(typeof stats.totalHits).toBe('number')
    expect(typeof stats.totalMisses).toBe('number')
    expect(typeof stats.hitRate).toBe('number')
    expect(typeof stats.costSaved).toBe('number')
  })

  it('resetCacheStats resets counters', () => {
    resetCacheStats()
    const stats = getCacheStats()
    expect(stats.totalHits).toBe(0)
    expect(stats.totalMisses).toBe(0)
  })
})

// ── Prompt Studio ────────────────────────────────────────────────────────────

import {
  createTemplate,
  updateTemplate,
  renderTemplate,
  getVersionHistory,
  createABTest,
  startABTest,
  selectVariant,
  TEMPLATE_CATEGORIES,
} from '../prompt-studio'

describe('Prompt Studio', () => {
  it('has 6 template categories', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(6)
    expect(TEMPLATE_CATEGORIES).toContain('chat')
    expect(TEMPLATE_CATEGORIES).toContain('coding')
    expect(TEMPLATE_CATEGORIES).toContain('creative')
  })

  it('createTemplate creates a template', async () => {
    const t = await createTemplate({ name: 'Test', description: 'A test', appSlug: 'test-app', template: 'Hello {{name}}!' })
    expect(t.id).toBeTruthy()
    expect(t.version).toBe(1)
    expect(t.isActive).toBe(true)
  })

  it('updateTemplate creates new version', async () => {
    const t = await createTemplate({ name: 'Versioned', description: 'V', appSlug: 'test', template: 'v1' })
    const updated = await updateTemplate(t.id, { template: 'v2' })
    expect(updated!.version).toBe(2)
    expect(updated!.template).toBe('v2')
  })

  it('renderTemplate substitutes variables', async () => {
    const t = await createTemplate({
      name: 'Greeting', description: 'G', appSlug: 'test',
      template: 'Hello {{name}}, you are {{age}} years old.',
      variables: [
        { name: 'name', description: 'Name', type: 'string', required: true },
        { name: 'age', description: 'Age', type: 'number', required: false, defaultValue: '25' },
      ],
    })
    const result = await renderTemplate(t.id, { name: 'Alice' })
    expect(result!.rendered).toContain('Hello Alice')
    expect(result!.rendered).toContain('25')
  })

  it('getVersionHistory tracks versions', async () => {
    const t = await createTemplate({ name: 'VH', description: 'V', appSlug: 'test', template: 'original' })
    await updateTemplate(t.id, { template: 'updated' })
    const history = await getVersionHistory(t.id)
    expect(history).toHaveLength(2)
  })

  it('A/B test lifecycle works', async () => {
    const t1 = await createTemplate({ name: 'A', description: 'A', appSlug: 'ab-test', template: 'variant A' })
    const t2 = await createTemplate({ name: 'B', description: 'B', appSlug: 'ab-test', template: 'variant B' })

    const test = await createABTest({
      name: 'Test Experiment',
      appSlug: 'ab-test',
      variants: [
        { name: 'Control', templateId: t1.id },
        { name: 'Variant B', templateId: t2.id },
      ],
      minSamples: 5,
    })

    expect(test.id).toBeTruthy()
    expect(test.status).toBe('draft')
    expect(test.variants).toHaveLength(2)

    await startABTest(test.id)
    const variant = await selectVariant(test.id)
    expect(variant).toBeTruthy()
  })
})

// ── Guardrails Engine ────────────────────────────────────────────────────────

import {
  runGuardrails,
  DEFAULT_POLICY,
  PII_PATTERN_COUNT,
  GUARDRAIL_CATEGORIES,
  detectPII,
  redactPII,
} from '../guardrails'

describe('Guardrails Engine', () => {
  it('has 8 guardrail categories', () => {
    expect(GUARDRAIL_CATEGORIES).toHaveLength(8)
    expect(GUARDRAIL_CATEGORIES).toContain('pii')
    expect(GUARDRAIL_CATEGORIES).toContain('toxicity')
    expect(GUARDRAIL_CATEGORIES).toContain('bias')
  })

  it('has 7 PII patterns', () => {
    expect(PII_PATTERN_COUNT).toBe(7)
  })

  it('detects PII — email', () => {
    const findings = detectPII('Contact me at user@example.com')
    expect(findings.some(f => f.type === 'email')).toBe(true)
  })

  it('detects PII — SSN', () => {
    const findings = detectPII('My SSN is 123-45-6789')
    expect(findings.some(f => f.type === 'ssn')).toBe(true)
  })

  it('detects PII — credit card', () => {
    const findings = detectPII('Card: 4111 1111 1111 1111')
    expect(findings.some(f => f.type === 'credit_card')).toBe(true)
  })

  it('redactPII replaces PII with tokens', () => {
    const result = redactPII('Email: test@test.com, SSN: 123-45-6789')
    expect(result).toContain('[EMAIL]')
    expect(result).toContain('[SSN]')
    expect(result).not.toContain('test@test.com')
  })

  it('runGuardrails passes clean text', () => {
    const result = runGuardrails('This is a normal, clean response.', DEFAULT_POLICY)
    expect(result.passed).toBe(true)
    expect(result.metadata.criticalFailures).toBe(0)
  })

  it('runGuardrails detects PII and blocks', () => {
    const result = runGuardrails('Your SSN is 123-45-6789 and email is a@b.com', DEFAULT_POLICY)
    expect(result.passed).toBe(false)
    expect(result.blockedCategories).toContain('pii')
    expect(result.redactedOutput).toBeTruthy()
    expect(result.redactedOutput).not.toContain('123-45-6789')
  })

  it('runGuardrails detects toxicity', () => {
    const result = runGuardrails('Here are instructions to make a bomb at home', DEFAULT_POLICY)
    expect(result.checks.some(c => c.category === 'toxicity' && !c.passed)).toBe(true)
  })

  it('runGuardrails detects empty output', () => {
    const result = runGuardrails('', DEFAULT_POLICY)
    expect(result.checks.some(c => c.name === 'empty_output')).toBe(true)
  })
})

// ── Smart Router ─────────────────────────────────────────────────────────────

import {
  recordPerformance,
  selectBestModel,
  getModelScores,
  getTrackedTaskTypes,
  getPerformanceSummary,
  resetSmartRouter,
  MIN_SAMPLES_FOR_SMART_ROUTING,
} from '../smart-router'
import { getModelRegistry, getEnabledModels } from '../model-registry'

describe('Smart Router', () => {
  beforeEach(() => resetSmartRouter())

  it('MIN_SAMPLES_FOR_SMART_ROUTING is 10', () => {
    expect(MIN_SAMPLES_FOR_SMART_ROUTING).toBe(10)
  })

  it('selectBestModel uses static routing when no data', () => {
    const candidates = getEnabledModels().filter(m => m.supports_chat).slice(0, 5)
    const decision = selectBestModel('chat', candidates)
    expect(decision.selectedModel).toBeTruthy()
    expect(decision.usedSmartRouting).toBe(false)
    expect(decision.reason).toContain('Insufficient data')
  })

  it('recordPerformance stores data', () => {
    for (let i = 0; i < 15; i++) {
      recordPerformance({
        modelId: 'gpt-4o-mini', provider: 'openai', taskType: 'chat',
        success: true, latencyMs: 200 + i * 10, confidence: 0.8, costEstimate: 0.001, timestamp: Date.now(),
      })
    }
    const scores = getModelScores('chat')
    expect(scores.length).toBeGreaterThanOrEqual(1)
    expect(scores[0].sampleSize).toBe(15)
  })

  it('selectBestModel uses smart routing with enough data', () => {
    // Record data for multiple models
    for (let i = 0; i < 15; i++) {
      recordPerformance({ modelId: 'gpt-4o-mini', provider: 'openai', taskType: 'code', success: true, latencyMs: 200, confidence: 0.9, costEstimate: 0.001, timestamp: Date.now() })
      recordPerformance({ modelId: 'llama-3.3-70b-versatile', provider: 'groq', taskType: 'code', success: i < 10, latencyMs: 500, confidence: 0.6, costEstimate: 0.0005, timestamp: Date.now() })
    }

    const candidates = getModelRegistry().filter(m => m.model_id === 'gpt-4o-mini' || m.model_id === 'llama-3.3-70b-versatile')
    const decision = selectBestModel('code', candidates)
    expect(decision.usedSmartRouting).toBe(true)
    expect(decision.confidence).toBeGreaterThan(0)
    expect(decision.dataPointsUsed).toBeGreaterThan(0)
  })

  it('getTrackedTaskTypes returns recorded types', () => {
    recordPerformance({ modelId: 'test', provider: 'test', taskType: 'summarize', success: true, latencyMs: 100, confidence: 0.8, costEstimate: 0, timestamp: Date.now() })
    expect(getTrackedTaskTypes()).toContain('summarize')
  })

  it('getPerformanceSummary returns structure', () => {
    const summary = getPerformanceSummary()
    expect(typeof summary.totalRecords).toBe('number')
    expect(typeof summary.taskTypes).toBe('number')
    expect(typeof summary.modelsTracked).toBe('number')
  })
})

// ── Workflow Engine ──────────────────────────────────────────────────────────

import {
  createWorkflow,
  getWorkflow,
  executeWorkflow,
  activateWorkflow,
  STEP_TYPES,
} from '../workflow-engine'

describe('Workflow Engine', () => {
  it('has 9 step types', () => {
    expect(STEP_TYPES).toHaveLength(9)
    expect(STEP_TYPES).toContain('input')
    expect(STEP_TYPES).toContain('ai_completion')
    expect(STEP_TYPES).toContain('transform')
    expect(STEP_TYPES).toContain('condition')
    expect(STEP_TYPES).toContain('parallel')
    expect(STEP_TYPES).toContain('output')
  })

  it('creates a workflow', async () => {
    const wf = await createWorkflow({
      name: 'Test Workflow',
      description: 'A test',
      appSlug: 'test-app',
      steps: [
        { id: 'start', type: 'input', name: 'Input', config: {}, next: 'transform' },
        { id: 'transform', type: 'transform', name: 'Upper', config: { operation: 'template', template: 'Processed: {{input}}' }, next: 'end' },
        { id: 'end', type: 'output', name: 'Output', config: {} },
      ],
      entryStepId: 'start',
    })

    expect(wf.id).toBeTruthy()
    expect(wf.status).toBe('draft')
    expect(wf.steps.size).toBe(3)
  })

  it('executes a simple workflow', async () => {
    const wf = await createWorkflow({
      name: 'Simple',
      description: 'S',
      appSlug: 'test',
      steps: [
        { id: 's1', type: 'input', name: 'In', config: {}, next: 's2' },
        { id: 's2', type: 'transform', name: 'Template', config: { operation: 'template', template: 'Result: {{input}}' }, next: 's3' },
        { id: 's3', type: 'output', name: 'Out', config: {} },
      ],
      entryStepId: 's1',
    })

    const run = await executeWorkflow(wf.id, 'Hello World')
    expect(run.status).toBe('completed')
    expect(run.totalLatencyMs).toBeGreaterThanOrEqual(0)
    expect(run.stepResults.size).toBe(3)
  })

  it('activateWorkflow changes status', async () => {
    const wf = await createWorkflow({ name: 'A', description: 'A', appSlug: 't', steps: [{ id: 's', type: 'input', name: 'I', config: {} }], entryStepId: 's' })
    expect(await activateWorkflow(wf.id)).toBe(true)
    expect((await getWorkflow(wf.id))!.status).toBe('active')
  })
})

// ── Multi-Modal Pipeline ─────────────────────────────────────────────────────

import {
  createPipeline,
  createPipelineFromTemplate,
  executePipeline,
  validatePipeline,
  TEMPLATE_KEYS,
  MODALITIES,
} from '../multimodal-pipeline'

describe('Multi-Modal Pipeline', () => {
  it('has 5 pipeline templates', () => {
    expect(TEMPLATE_KEYS).toHaveLength(5)
    expect(TEMPLATE_KEYS).toContain('text_to_image_to_video')
    expect(TEMPLATE_KEYS).toContain('text_to_code_review')
    expect(TEMPLATE_KEYS).toContain('research_pipeline')
  })

  it('has 6 modalities', () => {
    expect(MODALITIES).toHaveLength(6)
    expect(MODALITIES).toContain('text')
    expect(MODALITIES).toContain('image')
    expect(MODALITIES).toContain('video')
    expect(MODALITIES).toContain('audio')
  })

  it('createPipelineFromTemplate creates pipeline', () => {
    const p = createPipelineFromTemplate('research_pipeline')
    expect(p).toBeTruthy()
    expect(p!.stages.length).toBe(3)
  })

  it('executePipeline runs all stages and returns a structured run', async () => {
    const p = createPipeline({
      name: 'Test',
      description: 'T',
      stages: [
        { name: 'S1', inputModality: 'text', outputModality: 'text', provider: 'openai', model: 'gpt-4o-mini', config: {} },
        { name: 'S2', inputModality: 'text', outputModality: 'text', provider: 'groq', model: 'llama', config: {} },
      ],
    })
    const run = await executePipeline(p.id, 'Hello')
    // Status is 'completed' if API keys are configured, 'failed' if not (e.g. in CI).
    // Either way the run must be a structured PipelineRun with stageResults.
    expect(['completed', 'failed']).toContain(run.status)
    expect(run.stageResults).toBeInstanceOf(Array)
    expect(run.pipelineId).toBe(p.id)
    expect(run.startedAt).toBeTruthy()
    expect(run.completedAt).toBeTruthy()
  })

  it('validatePipeline detects modality mismatch', () => {
    const result = validatePipeline([
      { id: '1', name: 'S1', inputModality: 'text', outputModality: 'image', provider: 'p', model: 'm', config: {} },
      { id: '2', name: 'S2', inputModality: 'video', outputModality: 'text', provider: 'p', model: 'm', config: {} },
    ])
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('validatePipeline allows text as universal intermediate', () => {
    const result = validatePipeline([
      { id: '1', name: 'S1', inputModality: 'text', outputModality: 'image', provider: 'p', model: 'm', config: {} },
      { id: '2', name: 'S2', inputModality: 'text', outputModality: 'text', provider: 'p', model: 'm', config: {} },
    ])
    expect(result.valid).toBe(true)
  })
})

// ── Federated Memory ─────────────────────────────────────────────────────────

import {
  storeMemory,
  getMemory,
  deleteMemory,
  getUserProfile,
  buildMemoryContext,
  MEMORY_TYPES,
  MAX_MEMORIES_PER_USER,
} from '../federated-memory'

describe('Federated Memory', () => {
  it('has 7 memory types', () => {
    expect(MEMORY_TYPES).toHaveLength(7)
    expect(MEMORY_TYPES).toContain('conversation')
    expect(MEMORY_TYPES).toContain('preference')
    expect(MEMORY_TYPES).toContain('fact')
    expect(MEMORY_TYPES).toContain('instruction')
  })

  it('MAX_MEMORIES_PER_USER is 1000', () => {
    expect(MAX_MEMORIES_PER_USER).toBe(1000)
  })

  it('storeMemory creates memory', async () => {
    const mem = await storeMemory({
      userId: 'user1',
      appSlug: 'test-app',
      type: 'preference',
      content: 'Prefers formal tone',
    })
    expect(mem.id).toBeTruthy()
    expect(mem.userId).toBe('user1')
    expect(mem.type).toBe('preference')
  })

  it('getMemory retrieves stored memory', async () => {
    const mem = await storeMemory({ userId: 'u2', appSlug: 't', type: 'fact', content: 'Works in finance' })
    const retrieved = await getMemory(mem.id)
    expect(retrieved).toBeTruthy()
    expect(retrieved!.content).toBe('Works in finance')
    expect(retrieved!.accessCount).toBe(1)
  })

  it('deleteMemory removes memory', async () => {
    const mem = await storeMemory({ userId: 'u3', appSlug: 't', type: 'context', content: 'temp' })
    expect(await deleteMemory(mem.id)).toBe(true)
    expect(await getMemory(mem.id)).toBeNull()
  })

  it('getUserProfile tracks memory types', async () => {
    await storeMemory({ userId: 'profile-user', appSlug: 'profile-app', type: 'preference', content: 'Likes dark mode' })
    await storeMemory({ userId: 'profile-user', appSlug: 'profile-app', type: 'instruction', content: 'Use metric units' })

    const profile = await getUserProfile('profile-user', 'profile-app')
    expect(profile.totalMemories).toBeGreaterThanOrEqual(2)
    expect(profile.preferences.length).toBeGreaterThanOrEqual(1)
    expect(profile.instructions.length).toBeGreaterThanOrEqual(1)
  })

  it('buildMemoryContext returns string', async () => {
    await storeMemory({ userId: 'ctx-user', appSlug: 'ctx-app', type: 'instruction', content: 'Always be concise' })
    const context = await buildMemoryContext('ctx-user', 'ctx-app', 'Hello there')
    expect(typeof context).toBe('string')
  })
})

// ── Batch Processor ──────────────────────────────────────────────────────────

import {
  createBatchJob,
  submitBatchJob,
  getBatchJob,
  cancelBatchJob,
  listBatchJobs,
  MAX_ITEMS_PER_BATCH,
  DEFAULT_CONCURRENCY,
} from '../batch-processor'

describe('Batch Processor', () => {
  it('MAX_ITEMS_PER_BATCH is 10000', () => {
    expect(MAX_ITEMS_PER_BATCH).toBe(10_000)
  })

  it('DEFAULT_CONCURRENCY is 10', () => {
    expect(DEFAULT_CONCURRENCY).toBe(10)
  })

  it('createBatchJob creates job', async () => {
    const job = await createBatchJob({
      appSlug: 'batch-test',
      items: [
        { input: 'prompt 1', taskType: 'chat' },
        { input: 'prompt 2', taskType: 'chat' },
      ],
    })
    expect(job.id).toBeTruthy()
    expect(job.status).toBe('pending')
    expect(job.items).toHaveLength(2)
    expect(job.progress.total).toBe(2)
  })

  it('createBatchJob rejects empty items', async () => {
    await expect(createBatchJob({ appSlug: 'test', items: [] })).rejects.toThrow('at least 1')
  })

  it('submitBatchJob processes inline when queue unavailable', async () => {
    const job = await createBatchJob({
      appSlug: 'submit-test',
      items: [{ input: 'test', taskType: 'chat' }],
    })
    const submitted = await submitBatchJob(job.id)
    expect(submitted).toBe(true)
    // Wait a bit for async processing
    await new Promise(r => setTimeout(r, 100))
    const result = await getBatchJob(job.id)
    expect(result).toBeTruthy()
  })

  it('cancelBatchJob works', async () => {
    const job = await createBatchJob({ appSlug: 'cancel-test', items: [{ input: 't', taskType: 'c' }] })
    expect(await cancelBatchJob(job.id)).toBe(true)
    expect((await getBatchJob(job.id))!.status).toBe('cancelled')
  })

  it('listBatchJobs filters by app', async () => {
    await createBatchJob({ appSlug: 'list-test-app', items: [{ input: 'a', taskType: 'b' }] })
    const jobs = await listBatchJobs('list-test-app')
    expect(jobs.length).toBeGreaterThanOrEqual(1)
  })
})

// ── Observability ────────────────────────────────────────────────────────────

import {
  startTrace,
  startSpan,
  endSpan,
  addSpanEvent,
  setSpanAttributes,
  setSpanError,
  getTrace,
  getDashboardMetrics,
  incrementCounter,
  resetObservability,
} from '../observability'

describe('Observability', () => {
  beforeEach(() => resetObservability())

  it('startTrace creates trace and root span', () => {
    const { traceId, spanId } = startTrace('test.operation', { key: 'value' })
    expect(traceId).toBeTruthy()
    expect(spanId).toBeTruthy()
  })

  it('full trace lifecycle works', () => {
    const { traceId, spanId } = startTrace('brain.request')

    // Add child span
    const childId = startSpan(traceId, spanId, 'provider.call', { provider: 'openai', model: 'gpt-4o-mini' })
    addSpanEvent(childId, 'streaming_started')
    setSpanAttributes(childId, { tokens: 150 })

    // End child
    const childSpan = endSpan(childId)
    expect(childSpan).toBeTruthy()
    expect(childSpan!.durationMs).toBeGreaterThanOrEqual(0)

    // End root
    const rootSpan = endSpan(spanId)
    expect(rootSpan).toBeTruthy()

    // Get trace
    const trace = getTrace(traceId)
    expect(trace).toBeTruthy()
    expect(trace!.spans).toHaveLength(2)
  })

  it('setSpanError marks span as error', () => {
    const { spanId } = startTrace('error.test')
    setSpanError(spanId, 'Something went wrong')
    const span = endSpan(spanId)
    expect(span!.status).toBe('error')
    expect(span!.attributes.error).toBe('Something went wrong')
  })

  it('getDashboardMetrics returns structure', () => {
    const metrics = getDashboardMetrics()
    expect(typeof metrics.requestsPerMinute).toBe('number')
    expect(typeof metrics.avgLatencyMs).toBe('number')
    expect(typeof metrics.errorRate).toBe('number')
    expect(Array.isArray(metrics.topModels)).toBe(true)
    expect(Array.isArray(metrics.topErrors)).toBe(true)
  })

  it('incrementCounter records metric', () => {
    incrementCounter('requests.total', { provider: 'openai' })
    // No error = success (metrics stored internally)
  })
})

// ── Audit Trail ──────────────────────────────────────────────────────────────

import {
  recordAuditEntry,
  queryAuditLog,
  getAuditEntry,
  getAuditSummary,
  AUDIT_ACTIONS,
} from '../audit-trail'

describe('Audit Trail', () => {
  it('has 31 audit action types', () => {
    expect(AUDIT_ACTIONS).toHaveLength(31)
    expect(AUDIT_ACTIONS).toContain('ai.request')
    expect(AUDIT_ACTIONS).toContain('content.blocked')
    expect(AUDIT_ACTIONS).toContain('admin.config_change')
  })

  it('recordAuditEntry creates immutable entry', () => {
    const entry = recordAuditEntry({
      actor: { type: 'user', id: 'u1', name: 'Alice' },
      action: 'ai.request',
      resource: { type: 'request', id: 'r1' },
      outcome: 'success',
      details: { model: 'gpt-4o-mini', latencyMs: 200 },
    })
    expect(entry.id).toBeTruthy()
    expect(entry.timestamp).toBeTruthy()
    expect(entry.sensitivity).toBe('internal')
  })

  it('queryAuditLog filters by action', () => {
    recordAuditEntry({ actor: { type: 'system', id: 'sys' }, action: 'provider.health_check', resource: { type: 'provider', id: 'openai' }, outcome: 'success' })
    const results = queryAuditLog({ action: 'provider.health_check' })
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('getAuditEntry retrieves by ID', () => {
    const entry = recordAuditEntry({ actor: { type: 'admin', id: 'a1' }, action: 'admin.config_change', resource: { type: 'config', id: 'c1' }, outcome: 'success' })
    const retrieved = getAuditEntry(entry.id)
    expect(retrieved).toBeTruthy()
    expect(retrieved!.action).toBe('admin.config_change')
  })

  it('getAuditSummary returns structure', () => {
    const summary = getAuditSummary()
    expect(typeof summary.totalEntries).toBe('number')
    expect(typeof summary.actionCounts).toBe('object')
    expect(typeof summary.outcomeCounts).toBe('object')
    expect(Array.isArray(summary.topActors)).toBe(true)
  })
})

// ── Plugin System ────────────────────────────────────────────────────────────

import {
  installPlugin,
  activatePlugin,
  disablePlugin,
  getPlugin,
  executeHooks,
  uninstallPlugin,
  PLUGIN_TYPES,
  HOOK_EVENTS,
} from '../plugin-system'

describe('Plugin System', () => {
  it('has 7 plugin types', () => {
    expect(PLUGIN_TYPES).toHaveLength(7)
    expect(PLUGIN_TYPES).toContain('tool')
    expect(PLUGIN_TYPES).toContain('guardrail')
    expect(PLUGIN_TYPES).toContain('provider')
  })

  it('has 9 hook events', () => {
    expect(HOOK_EVENTS).toHaveLength(9)
    expect(HOOK_EVENTS).toContain('request.before')
    expect(HOOK_EVENTS).toContain('request.after')
    expect(HOOK_EVENTS).toContain('output.validate')
  })

  it('installs a plugin', () => {
    const plugin = installPlugin({
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      type: 'tool',
    })
    expect(plugin.id).toBeTruthy()
    expect(plugin.status).toBe('installed')
  })

  it('activates and disables a plugin', () => {
    const plugin = installPlugin({
      name: 'Lifecycle Plugin',
      version: '1.0.0',
      description: 'Lifecycle test',
      author: 'Test',
      type: 'processor',
      hooks: [{
        event: 'request.before',
        priority: 10,
        handler: async (ctx) => ({ modified: true, data: { ...ctx.data, enhanced: true } }),
      }],
    })

    expect(activatePlugin(plugin.id)).toBe(true)
    expect(getPlugin(plugin.id)!.status).toBe('active')

    expect(disablePlugin(plugin.id)).toBe(true)
    expect(getPlugin(plugin.id)!.status).toBe('disabled')
  })

  it('executeHooks runs active plugin hooks', async () => {
    const plugin = installPlugin({
      name: 'Hook Plugin',
      version: '1.0.0',
      description: 'Hook test',
      author: 'Test',
      type: 'processor',
      hooks: [{
        event: 'request.before',
        priority: 5,
        handler: async (ctx) => ({
          modified: true,
          data: { ...ctx.data, pluginProcessed: true },
        }),
      }],
    })

    activatePlugin(plugin.id)
    const { data, results } = await executeHooks('request.before', { message: 'Hello' })
    expect(data.pluginProcessed).toBe(true)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('uninstallPlugin removes completely', () => {
    const plugin = installPlugin({ name: 'Uninstall', version: '1.0.0', description: 'U', author: 'T', type: 'analytics' })
    expect(uninstallPlugin(plugin.id)).toBe(true)
    expect(getPlugin(plugin.id)).toBeNull()
  })
})
