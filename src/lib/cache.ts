/**
 * Cache Layer — AmarktAI Network
 *
 * In-memory caching layer with TTL support for:
 *   - Embedding cache   — stores computed embeddings to avoid re-computation
 *   - Retrieval cache   — stores retrieval results for repeated queries
 *   - Response cache    — stores recent AI responses (short TTL)
 *
 * Uses a simple Map-based LRU-ish cache. In production, swap the backing
 * store to Redis by implementing the CacheBackend interface.
 *
 * Server-side only.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  value: T
  expiresAt: number // epoch ms
  createdAt: number
}

export interface CacheOptions {
  /** Time-to-live in seconds. */
  ttlSeconds: number
  /** Maximum number of entries before eviction. */
  maxEntries: number
}

export interface CacheStats {
  hits: number
  misses: number
  entries: number
  evictions: number
}

// ── In-Memory Cache Implementation ──────────────────────────────────

class InMemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private stats: CacheStats = { hits: 0, misses: 0, entries: 0, evictions: 0 }
  private readonly ttlMs: number
  private readonly maxEntries: number

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlSeconds * 1000
    this.maxEntries = options.maxEntries
  }

  /** Retrieve a cached value, or undefined if expired / missing. */
  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      this.stats.misses++
      return undefined
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.entries = this.store.size
      this.stats.misses++
      return undefined
    }
    this.stats.hits++
    return entry.value
  }

  /** Store a value in the cache. Evicts oldest entries when full. */
  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictOldest()
    }
    const now = Date.now()
    this.store.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      createdAt: now,
    })
    this.stats.entries = this.store.size
  }

  /** Check if a key exists and is not expired. */
  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.stats.entries = this.store.size
      return false
    }
    return true
  }

  /** Delete a single entry. */
  delete(key: string): boolean {
    const deleted = this.store.delete(key)
    this.stats.entries = this.store.size
    return deleted
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear()
    this.stats.entries = 0
  }

  /** Return cache statistics. */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /** Remove expired entries. */
  prune(): number {
    const now = Date.now()
    let pruned = 0
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        pruned++
      }
    }
    this.stats.entries = this.store.size
    return pruned
  }

  private evictOldest(): void {
    // Evict the entry with the earliest createdAt
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [key, entry] of this.store) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldestKey = key
      }
    }
    if (oldestKey) {
      this.store.delete(oldestKey)
      this.stats.evictions++
    }
  }
}

// ── Cache Instances ─────────────────────────────────────────────────

/** Embedding cache — long TTL (1 hour), stores vector embeddings. */
export const embeddingCache = new InMemoryCache<number[]>({
  ttlSeconds: 3600,
  maxEntries: 5000,
})

/** Retrieval cache — medium TTL (5 minutes), stores retrieval results. */
export const retrievalCache = new InMemoryCache<unknown>({
  ttlSeconds: 300,
  maxEntries: 2000,
})

/** Response cache — short TTL (60 seconds), stores AI response text. */
export const responseCache = new InMemoryCache<string>({
  ttlSeconds: 60,
  maxEntries: 1000,
})

// ── Utility: cache key builders ─────────────────────────────────────

/**
 * Build a deterministic cache key for retrieval queries.
 * Uses appSlug + query text + options hash.
 */
export function buildRetrievalCacheKey(
  appSlug: string,
  query: string,
  maxResults: number,
  includeGlobal: boolean,
): string {
  return `retrieval:${appSlug}:${includeGlobal ? 'g' : 'l'}:${maxResults}:${simpleHash(query)}`
}

/**
 * Build a cache key for response caching.
 * Uses appSlug + taskType + message hash.
 */
export function buildResponseCacheKey(
  appSlug: string,
  taskType: string,
  message: string,
): string {
  return `response:${appSlug}:${taskType}:${simpleHash(message)}`
}

/**
 * Build a cache key for embedding caching.
 */
export function buildEmbeddingCacheKey(text: string): string {
  return `emb:${simpleHash(text)}`
}

/** Simple string hash for cache keys. */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash.toString(36)
}

// ── Aggregate stats ─────────────────────────────────────────────────

/**
 * Returns combined statistics for all cache layers.
 */
export function getCacheStats(): {
  embedding: CacheStats
  retrieval: CacheStats
  response: CacheStats
} {
  return {
    embedding: embeddingCache.getStats(),
    retrieval: retrievalCache.getStats(),
    response: responseCache.getStats(),
  }
}

/**
 * Clear all caches. Useful for testing or manual reset.
 */
export function clearAllCaches(): void {
  embeddingCache.clear()
  retrievalCache.clear()
  responseCache.clear()
}

/**
 * Prune expired entries from all caches.
 * Returns total number of pruned entries.
 */
export function pruneAllCaches(): number {
  return embeddingCache.prune() + retrievalCache.prune() + responseCache.prune()
}
