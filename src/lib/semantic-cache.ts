/**
 * Semantic Cache — Embedding-Similarity Response Caching
 *
 * Caches AI responses by embedding similarity. If a semantically similar
 * question was asked before, returns the cached answer instead of making
 * a new API call. Can reduce costs by 80%+ on repeated queries.
 *
 * Uses Qdrant for similarity search and Redis for metadata caching.
 * Gracefully degrades when infrastructure is unavailable.
 */

import { searchVectors, upsertVectors, ensureCollection } from './vector-store'
import { cacheGet, cacheSet } from './redis'
import { generateEmbedding } from './rag-pipeline'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  id: string
  query: string
  response: string
  provider: string
  model: string
  taskType: string
  appSlug: string
  createdAt: string
  hitCount: number
  ttlSeconds: number
}

export interface CacheLookupResult {
  hit: boolean
  entry?: CacheEntry
  similarity?: number
  latencyMs: number
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  avgSimilarity: number
  costSaved: number // Estimated USD saved
}

// ── Configuration ────────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.92 // Must be >= 92% similar to return cached
const DEFAULT_TTL = 3600 // 1 hour
const _MAX_CACHE_SIZE = 10_000
const CACHE_COLLECTION = 'amarktai_semantic_cache'

// In-memory stats (production would use Redis/DB)
let stats = { hits: 0, misses: 0, totalSimilarity: 0 }

// ── Cache Operations ─────────────────────────────────────────────────────────

/**
 * Look up a semantically similar cached response.
 */
export async function lookupCache(
  query: string,
  appSlug: string,
  taskType?: string,
): Promise<CacheLookupResult> {
  const start = Date.now()

  // Try exact match in Redis first (fastest path)
  const exactKey = `sc:${appSlug}:${Buffer.from(query.toLowerCase().trim()).toString('base64').slice(0, 60)}`
  const exactHit = await cacheGet(exactKey)
  if (exactHit) {
    try {
      const entry = JSON.parse(exactHit) as CacheEntry
      stats.hits++
      stats.totalSimilarity += 1.0
      return { hit: true, entry, similarity: 1.0, latencyMs: Date.now() - start }
    } catch { /* cache corruption — fall through */ }
  }

  // Semantic similarity search via embeddings
  const embedding = await generateEmbedding(query)
  if (!embedding) {
    stats.misses++
    return { hit: false, latencyMs: Date.now() - start }
  }

  try {
    const results = await searchVectors(embedding, 3)
    const filtered = results.filter((r) => {
      if (r.score < SIMILARITY_THRESHOLD) return false
      if (r.payload?.appSlug !== appSlug) return false
      if (taskType && r.payload?.taskType !== taskType) return false
      // Check TTL
      const createdAt = r.payload?.createdAt as string
      const ttl = (r.payload?.ttlSeconds as number) ?? DEFAULT_TTL
      if (createdAt) {
        const age = (Date.now() - new Date(createdAt).getTime()) / 1000
        if (age > ttl) return false
      }
      return true
    })

    if (filtered.length > 0) {
      const best = filtered[0]
      const entry: CacheEntry = {
        id: String(best.id),
        query: String(best.payload?.query ?? ''),
        response: String(best.payload?.response ?? ''),
        provider: String(best.payload?.provider ?? ''),
        model: String(best.payload?.model ?? ''),
        taskType: String(best.payload?.taskType ?? ''),
        appSlug: String(best.payload?.appSlug ?? ''),
        createdAt: String(best.payload?.createdAt ?? ''),
        hitCount: Number(best.payload?.hitCount ?? 0) + 1,
        ttlSeconds: Number(best.payload?.ttlSeconds ?? DEFAULT_TTL),
      }
      stats.hits++
      stats.totalSimilarity += best.score
      return { hit: true, entry, similarity: best.score, latencyMs: Date.now() - start }
    }
  } catch { /* Vector store unavailable — miss */ }

  stats.misses++
  return { hit: false, latencyMs: Date.now() - start }
}

/**
 * Store a response in the semantic cache.
 */
export async function storeInCache(
  query: string,
  response: string,
  metadata: {
    provider: string
    model: string
    taskType: string
    appSlug: string
    ttlSeconds?: number
  },
): Promise<boolean> {
  const id = randomUUID()
  const ttl = metadata.ttlSeconds ?? DEFAULT_TTL

  // Store exact match in Redis
  const exactKey = `sc:${metadata.appSlug}:${Buffer.from(query.toLowerCase().trim()).toString('base64').slice(0, 60)}`
  const entry: CacheEntry = {
    id,
    query,
    response,
    provider: metadata.provider,
    model: metadata.model,
    taskType: metadata.taskType,
    appSlug: metadata.appSlug,
    createdAt: new Date().toISOString(),
    hitCount: 0,
    ttlSeconds: ttl,
  }
  await cacheSet(exactKey, JSON.stringify(entry), ttl)

  // Store in vector DB for semantic matching
  const embedding = await generateEmbedding(query)
  if (!embedding) return false

  try {
    await ensureCollection()
    await upsertVectors([
      {
        id,
        vector: embedding,
        payload: {
          ...entry,
          _type: 'semantic_cache',
        },
      },
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Invalidate cache entries for an app.
 */
export async function invalidateCache(_appSlug: string): Promise<number> {
  // For now, we can only clear Redis exact matches
  // Vector store cleanup would require a filtered delete
  // This is a best-effort invalidation
  return 0 // Entries will expire via TTL
}

// ── Stats ────────────────────────────────────────────────────────────────────

export function getCacheStats(): CacheStats {
  const total = stats.hits + stats.misses
  return {
    totalEntries: 0, // Would query vector store count
    totalHits: stats.hits,
    totalMisses: stats.misses,
    hitRate: total > 0 ? stats.hits / total : 0,
    avgSimilarity: stats.hits > 0 ? stats.totalSimilarity / stats.hits : 0,
    costSaved: stats.hits * 0.002, // Rough estimate: $0.002 saved per cache hit
  }
}

export function resetCacheStats(): void {
  stats = { hits: 0, misses: 0, totalSimilarity: 0 }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const SEMANTIC_SIMILARITY_THRESHOLD = SIMILARITY_THRESHOLD
export const SEMANTIC_CACHE_DEFAULT_TTL = DEFAULT_TTL
export const SEMANTIC_CACHE_COLLECTION = CACHE_COLLECTION
