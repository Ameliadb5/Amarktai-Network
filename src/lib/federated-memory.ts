/**
 * Federated Memory — Per-User Persistent AI Memory
 *
 * Enables AI that remembers: conversation history, user preferences,
 * learned patterns, and contextual knowledge. Uses Qdrant for semantic
 * memory retrieval and Redis for session caching.
 *
 * Truthful: Only stores and retrieves actual user interactions.
 * No fabricated memories.
 */

import { searchVectors, upsertVectors, ensureCollection } from './vector-store'
import { cacheGet, cacheSet, cacheDel } from './redis'
import { generateEmbedding } from './rag-pipeline'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Memory {
  id: string
  userId: string
  appSlug: string
  type: MemoryType
  content: string
  importance: number // 0-1 (higher = more important to remember)
  metadata: Record<string, unknown>
  createdAt: string
  expiresAt?: string
  accessCount: number
  lastAccessedAt: string
}

export type MemoryType =
  | 'conversation'    // Chat history
  | 'preference'      // User preference (e.g., "prefers formal tone")
  | 'fact'            // Learned fact about user (e.g., "works in finance")
  | 'instruction'     // Standing instruction (e.g., "always use metric units")
  | 'feedback'        // User feedback on AI outputs
  | 'context'         // Session context
  | 'summary'         // Summarized conversation

export interface MemoryQuery {
  userId: string
  appSlug: string
  query: string
  types?: MemoryType[]
  limit?: number
  minImportance?: number
}

export interface MemorySearchResult {
  memory: Memory
  relevanceScore: number
}

export interface UserProfile {
  userId: string
  appSlug: string
  totalMemories: number
  memoryTypes: Record<MemoryType, number>
  oldestMemory?: string
  newestMemory?: string
  preferences: Memory[]
  instructions: Memory[]
}

// ── In-Memory Storage (production uses Qdrant + Redis) ───────────────────────

const memoryStore = new Map<string, Memory>()
const userMemoryIndex = new Map<string, Set<string>>() // userId:appSlug → Set<memoryId>

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_MEMORIES_PER_USER = 1000
const DEFAULT_IMPORTANCE = 0.5
const SESSION_CACHE_TTL = 3600 // 1 hour
const _MEMORY_COLLECTION = 'amarktai_federated_memory'

// ── Memory CRUD ──────────────────────────────────────────────────────────────

/** Store a new memory. */
export async function storeMemory(input: {
  userId: string
  appSlug: string
  type: MemoryType
  content: string
  importance?: number
  metadata?: Record<string, unknown>
  expiresAt?: string
}): Promise<Memory> {
  const id = randomUUID()
  const now = new Date().toISOString()

  const memory: Memory = {
    id,
    userId: input.userId,
    appSlug: input.appSlug,
    type: input.type,
    content: input.content,
    importance: input.importance ?? DEFAULT_IMPORTANCE,
    metadata: input.metadata ?? {},
    createdAt: now,
    expiresAt: input.expiresAt,
    accessCount: 0,
    lastAccessedAt: now,
  }

  // Store in memory map
  memoryStore.set(id, memory)

  // Update user index
  const indexKey = `${input.userId}:${input.appSlug}`
  if (!userMemoryIndex.has(indexKey)) {
    userMemoryIndex.set(indexKey, new Set())
  }
  const index = userMemoryIndex.get(indexKey)!
  index.add(id)

  // Evict old memories if over limit
  if (index.size > MAX_MEMORIES_PER_USER) {
    await evictOldMemories(input.userId, input.appSlug)
  }

  // Store in vector DB for semantic search
  const embedding = await generateEmbedding(input.content)
  if (embedding) {
    try {
      await ensureCollection()
      await upsertVectors([{
        id,
        vector: embedding,
        payload: {
          ...memory,
          _type: 'federated_memory',
        },
      }])
    } catch { /* Vector store unavailable — memory still in local store */ }
  }

  // Cache in Redis for fast session access
  await cacheSet(`mem:${id}`, JSON.stringify(memory), SESSION_CACHE_TTL)

  return memory
}

/** Retrieve a specific memory. */
export async function getMemory(id: string): Promise<Memory | null> {
  // Try cache first
  const cached = await cacheGet(`mem:${id}`)
  if (cached) {
    try {
      const memory = JSON.parse(cached) as Memory
      memory.accessCount++
      memory.lastAccessedAt = new Date().toISOString()
      memoryStore.set(id, memory)
      return memory
    } catch { /* cache corruption */ }
  }

  const memory = memoryStore.get(id)
  if (!memory) return null

  // Check expiry
  if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) {
    memoryStore.delete(id)
    await cacheDel(`mem:${id}`)
    return null
  }

  memory.accessCount++
  memory.lastAccessedAt = new Date().toISOString()
  return memory
}

/** Delete a memory. */
export async function deleteMemory(id: string): Promise<boolean> {
  const memory = memoryStore.get(id)
  if (!memory) return false

  memoryStore.delete(id)
  await cacheDel(`mem:${id}`)

  const indexKey = `${memory.userId}:${memory.appSlug}`
  userMemoryIndex.get(indexKey)?.delete(id)

  return true
}

// ── Memory Search ────────────────────────────────────────────────────────────

/**
 * Search memories semantically — find memories relevant to a query.
 */
export async function searchMemories(query: MemoryQuery): Promise<MemorySearchResult[]> {
  const { userId, appSlug, query: queryText, types, limit = 10, minImportance = 0 } = query

  // First try semantic search via vector store
  const embedding = await generateEmbedding(queryText)
  if (embedding) {
    try {
      const results = await searchVectors(embedding, limit * 3)
      const filtered = results
        .filter((r) => {
          if (r.payload?._type !== 'federated_memory') return false
          if (r.payload?.userId !== userId) return false
          if (r.payload?.appSlug !== appSlug) return false
          if (types && !types.includes(r.payload?.type as MemoryType)) return false
          if ((r.payload?.importance as number ?? 0) < minImportance) return false
          return true
        })
        .slice(0, limit)

      return filtered.map((r) => ({
        memory: {
          id: String(r.id),
          userId: String(r.payload?.userId ?? ''),
          appSlug: String(r.payload?.appSlug ?? ''),
          type: (r.payload?.type ?? 'context') as MemoryType,
          content: String(r.payload?.content ?? ''),
          importance: Number(r.payload?.importance ?? 0.5),
          metadata: (r.payload?.metadata ?? {}) as Record<string, unknown>,
          createdAt: String(r.payload?.createdAt ?? ''),
          expiresAt: r.payload?.expiresAt as string | undefined,
          accessCount: Number(r.payload?.accessCount ?? 0),
          lastAccessedAt: String(r.payload?.lastAccessedAt ?? ''),
        },
        relevanceScore: r.score,
      }))
    } catch { /* Vector store unavailable — fall through to local search */ }
  }

  // Fallback: local keyword search
  const indexKey = `${userId}:${appSlug}`
  const memoryIds = userMemoryIndex.get(indexKey)
  if (!memoryIds) return []

  const queryLower = queryText.toLowerCase()
  const results: MemorySearchResult[] = []

  for (const memId of memoryIds) {
    const memory = memoryStore.get(memId)
    if (!memory) continue
    if (types && !types.includes(memory.type)) continue
    if (memory.importance < minImportance) continue
    if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) continue

    // Simple keyword relevance
    const contentLower = memory.content.toLowerCase()
    const words = queryLower.split(/\s+/)
    const matchCount = words.filter((w) => contentLower.includes(w)).length
    const score = matchCount / Math.max(1, words.length)

    if (score > 0.1) {
      results.push({ memory, relevanceScore: score })
    }
  }

  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

// ── User Profile ─────────────────────────────────────────────────────────────

/** Get a user's memory profile. */
export function getUserProfile(userId: string, appSlug: string): UserProfile {
  const indexKey = `${userId}:${appSlug}`
  const memoryIds = userMemoryIndex.get(indexKey) ?? new Set()

  const typeCounts: Record<MemoryType, number> = {
    conversation: 0, preference: 0, fact: 0, instruction: 0,
    feedback: 0, context: 0, summary: 0,
  }
  const preferences: Memory[] = []
  const instructions: Memory[] = []
  let oldest: string | undefined
  let newest: string | undefined

  for (const memId of memoryIds) {
    const memory = memoryStore.get(memId)
    if (!memory) continue

    typeCounts[memory.type] = (typeCounts[memory.type] ?? 0) + 1

    if (memory.type === 'preference') preferences.push(memory)
    if (memory.type === 'instruction') instructions.push(memory)

    if (!oldest || memory.createdAt < oldest) oldest = memory.createdAt
    if (!newest || memory.createdAt > newest) newest = memory.createdAt
  }

  return {
    userId,
    appSlug,
    totalMemories: memoryIds.size,
    memoryTypes: typeCounts,
    oldestMemory: oldest,
    newestMemory: newest,
    preferences,
    instructions,
  }
}

// ── Context Building ─────────────────────────────────────────────────────────

/**
 * Build a memory-augmented system prompt for a user.
 * Retrieves relevant memories and formats them as context.
 */
export async function buildMemoryContext(
  userId: string,
  appSlug: string,
  currentMessage: string,
): Promise<string> {
  const memories = await searchMemories({
    userId,
    appSlug,
    query: currentMessage,
    limit: 5,
    minImportance: 0.3,
  })

  if (memories.length === 0) return ''

  const profile = getUserProfile(userId, appSlug)

  const parts: string[] = []
  parts.push('--- User Memory Context ---')

  // Add standing instructions first
  if (profile.instructions.length > 0) {
    parts.push('User Instructions:')
    for (const inst of profile.instructions.slice(0, 3)) {
      parts.push(`  - ${inst.content}`)
    }
  }

  // Add preferences
  if (profile.preferences.length > 0) {
    parts.push('User Preferences:')
    for (const pref of profile.preferences.slice(0, 3)) {
      parts.push(`  - ${pref.content}`)
    }
  }

  // Add relevant memories
  if (memories.length > 0) {
    parts.push('Relevant Context:')
    for (const m of memories) {
      parts.push(`  - [${m.memory.type}] ${m.memory.content.slice(0, 200)}`)
    }
  }

  parts.push('--- End Memory Context ---')
  return parts.join('\n')
}

// ── Eviction ─────────────────────────────────────────────────────────────────

async function evictOldMemories(userId: string, appSlug: string): Promise<number> {
  const indexKey = `${userId}:${appSlug}`
  const memoryIds = userMemoryIndex.get(indexKey)
  if (!memoryIds || memoryIds.size <= MAX_MEMORIES_PER_USER) return 0

  // Get all memories, sort by importance * recency
  const memories: Array<{ id: string; score: number }> = []
  for (const memId of memoryIds) {
    const memory = memoryStore.get(memId)
    if (!memory) continue
    const age = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24) // days
    const recencyScore = 1 / (1 + age)
    const score = memory.importance * 0.6 + recencyScore * 0.4
    memories.push({ id: memId, score })
  }

  // Sort ascending (lowest score first = evict first)
  memories.sort((a, b) => a.score - b.score)

  // Evict lowest scoring until under limit
  const toEvict = memories.slice(0, memories.length - MAX_MEMORIES_PER_USER)
  for (const { id } of toEvict) {
    memoryStore.delete(id)
    memoryIds.delete(id)
    await cacheDel(`mem:${id}`)
  }

  return toEvict.length
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const MEMORY_TYPES: MemoryType[] = ['conversation', 'preference', 'fact', 'instruction', 'feedback', 'context', 'summary']
export { MAX_MEMORIES_PER_USER, DEFAULT_IMPORTANCE, SESSION_CACHE_TTL }
