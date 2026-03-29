/**
 * @module retrieval-engine
 * @description Retrieval + Rerank engine for the AmarktAI Network.
 *
 * Provides app-scoped and global ecosystem memory retrieval with scoring
 * based on importance, freshness (exponential decay), and keyword relevance.
 * Foundation-ready for embeddings and reranking when providers are configured.
 *
 * Features:
 *   - App-scoped memory retrieval
 *   - Global ecosystem memory retrieval (_global namespace)
 *   - Freshness scoring (exponential decay over 30 days)
 *   - Basic keyword relevance scoring
 *   - Source tagging and summarisation hooks
 *   - Archive / prune strategy for expired entries
 *
 * Server-side only. Never import from client components.
 */

import { prisma } from '@/lib/prisma'
import { retrievalCache, buildRetrievalCacheKey } from '@/lib/cache'

// ── Type definitions ────────────────────────────────────────────────────────

/** Query parameters for the retrieval engine. */
export interface RetrievalQuery {
  /** App slug to scope results to. */
  appSlug: string
  /** Natural-language or keyword query. */
  query: string
  /** Maximum number of results to return (default: 10). */
  maxResults?: number
  /** Filter by memory types (e.g. 'event', 'summary'). */
  memoryTypes?: string[]
  /** Also search global / shared memories (appSlug = '_global'). */
  includeGlobal?: boolean
  /** Minimum importance threshold (0–1). */
  minImportance?: number
  /** Weight for recency in final scoring (0–1, default: 0.3). */
  freshnessWeight?: number
}

/** Combined result returned by the retrieval engine. */
export interface RetrievalResult {
  /** Scored and sorted entries. */
  entries: RetrievedEntry[]
  /** Total entries found before limit. */
  totalFound: number
  /** Count of entries from the app namespace. */
  fromApp: number
  /** Count of entries from the global namespace. */
  fromGlobal: number
  /** Wall-clock latency of the retrieval call (ms). */
  retrievalLatencyMs: number
  /** Whether a rerank pass was applied. */
  rerankApplied: boolean
}

/** A single scored entry from the retrieval engine. */
export interface RetrievedEntry {
  id: number
  appSlug: string
  memoryType: string
  key: string
  content: string
  /** Original importance value (0–1). */
  importance: number
  /** Freshness score based on exponential decay (0–1). */
  freshnessScore: number
  /** Relevance score from keyword matching or embeddings (0–1). */
  relevanceScore: number
  /** Weighted combination of importance, freshness, and relevance. */
  finalScore: number
  createdAt: Date
  /** Whether this entry came from the app namespace or the global one. */
  source: 'app' | 'global'
}

/** Current operational status of the retrieval engine. */
export interface RetrievalStatus {
  /** Whether the engine is reachable and operational. */
  available: boolean
  /** True when an embedding provider is configured. */
  embeddingsEnabled: boolean
  /** True when a rerank model is available. */
  rerankEnabled: boolean
  /** Total entries indexed across all namespaces. */
  totalIndexedEntries: number
  /** Distinct app slugs with stored entries. */
  appNamespaces: string[]
  /** Human-readable status label. */
  statusLabel: 'active' | 'basic' | 'not_configured'
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Half-life for freshness decay (days). */
const FRESHNESS_HALF_LIFE_DAYS = 30

/** Default maximum results per query. */
const DEFAULT_MAX_RESULTS = 10

/** Global namespace slug for ecosystem-wide memories. */
const GLOBAL_SLUG = '_global'

// ── Scoring helpers ─────────────────────────────────────────────────────────

/**
 * Compute a freshness score using exponential decay.
 *
 * Returns 1.0 for entries created just now and decays towards 0 with a
 * half-life of 30 days.
 *
 * @param createdAt - Timestamp of the memory entry.
 * @returns A score between 0 and 1.
 */
export function computeFreshnessScore(createdAt: Date): number {
  const ageDays = (Date.now() - createdAt.getTime()) / 86_400_000
  if (ageDays <= 0) return 1.0
  return Math.pow(0.5, ageDays / FRESHNESS_HALF_LIFE_DAYS)
}

/**
 * Compute a basic keyword-overlap relevance score.
 *
 * Tokenises both the query and the content, then returns the ratio of
 * query tokens found in the content. Returns 0 when no tokens match,
 * 1.0 when every query token appears in the content.
 *
 * @param query   - The search query.
 * @param content - The memory entry content.
 * @returns A score between 0 and 1.
 */
export function computeKeywordRelevance(query: string, content: string): number {
  if (!query || !content) return 0

  const tokenise = (text: string): string[] =>
    text.toLowerCase().split(/\W+/).filter((t) => t.length > 1)

  const queryTokens = tokenise(query)
  if (queryTokens.length === 0) return 0

  const contentTokens = new Set(tokenise(content))
  const matches = queryTokens.filter((t) => contentTokens.has(t)).length
  return matches / queryTokens.length
}

// ── Core retrieval ──────────────────────────────────────────────────────────

/**
 * Retrieve and score memory entries for a given query.
 *
 * Queries the MemoryEntry table for app-scoped entries (and optionally
 * global entries), scores each by importance, freshness, and keyword
 * relevance, then returns them sorted by the weighted final score.
 *
 * Never throws — returns an empty result set on any error.
 *
 * @param query - Retrieval query parameters.
 * @returns Scored and sorted retrieval results.
 */
export async function retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
  const start = Date.now()
  const maxResults = query.maxResults ?? DEFAULT_MAX_RESULTS
  const freshnessWeight = Math.max(0, Math.min(1, query.freshnessWeight ?? 0.3))
  const importanceWeight = 0.4
  const relevanceWeight = 1 - freshnessWeight - importanceWeight > 0
    ? 1 - freshnessWeight - importanceWeight
    : 0.3

  // ── Check retrieval cache ────────────────────────────────────────────
  const cacheKey = buildRetrievalCacheKey(
    query.appSlug,
    query.query,
    maxResults,
    query.includeGlobal ?? false,
  )
  const cached = retrievalCache.get(cacheKey) as RetrievalResult | undefined
  if (cached) {
    return { ...cached, retrievalLatencyMs: Date.now() - start }
  }

  try {
    // ── Build the Prisma where clause ──────────────────────────────────
    const slugs: string[] = [query.appSlug]
    if (query.includeGlobal) slugs.push(GLOBAL_SLUG)

    const where: Record<string, unknown> = {
      appSlug: { in: slugs },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    }

    if (query.memoryTypes && query.memoryTypes.length > 0) {
      where.memoryType = { in: query.memoryTypes }
    }

    if (query.minImportance !== undefined && query.minImportance > 0) {
      where.importance = { gte: query.minImportance }
    }

    // ── Fetch candidates ──────────────────────────────────────────────
    const candidates = await prisma.memoryEntry.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        appSlug: true,
        memoryType: true,
        key: true,
        content: true,
        importance: true,
        createdAt: true,
      },
    })

    // ── Score each candidate ──────────────────────────────────────────
    const scored: RetrievedEntry[] = candidates.map((entry) => {
      const freshness = computeFreshnessScore(entry.createdAt)
      const relevance = computeKeywordRelevance(query.query, entry.content)
      const finalScore =
        entry.importance * importanceWeight +
        freshness * freshnessWeight +
        relevance * relevanceWeight

      return {
        id: entry.id,
        appSlug: entry.appSlug,
        memoryType: entry.memoryType,
        key: entry.key,
        content: entry.content,
        importance: entry.importance,
        freshnessScore: Math.round(freshness * 1000) / 1000,
        relevanceScore: Math.round(relevance * 1000) / 1000,
        finalScore: Math.round(finalScore * 1000) / 1000,
        createdAt: entry.createdAt,
        source: entry.appSlug === GLOBAL_SLUG ? 'global' as const : 'app' as const,
      }
    })

    // ── Sort by final score and limit ─────────────────────────────────
    scored.sort((a, b) => b.finalScore - a.finalScore)
    const limited = scored.slice(0, maxResults)

    const fromApp = limited.filter((e) => e.source === 'app').length
    const fromGlobal = limited.filter((e) => e.source === 'global').length

    const result: RetrievalResult = {
      entries: limited,
      totalFound: scored.length,
      fromApp,
      fromGlobal,
      retrievalLatencyMs: Date.now() - start,
      rerankApplied: false,
    }

    // ── Store in retrieval cache ────────────────────────────────────────
    retrievalCache.set(cacheKey, result)

    return result
  } catch (err) {
    console.warn('[retrieval-engine] retrieve failed:', err instanceof Error ? err.message : err)
    return {
      entries: [],
      totalFound: 0,
      fromApp: 0,
      fromGlobal: 0,
      retrievalLatencyMs: Date.now() - start,
      rerankApplied: false,
    }
  }
}

// ── Engine status ───────────────────────────────────────────────────────────

/**
 * Returns the current operational status of the retrieval engine.
 * Never throws.
 */
export async function getRetrievalStatus(): Promise<RetrievalStatus> {
  try {
    const totalIndexedEntries = await prisma.memoryEntry.count()
    const apps = await prisma.memoryEntry.findMany({
      select: { appSlug: true },
      distinct: ['appSlug'],
    })

    const appNamespaces = apps.map((a) => a.appSlug)

    return {
      available: true,
      embeddingsEnabled: false,
      rerankEnabled: false,
      totalIndexedEntries,
      appNamespaces,
      statusLabel: totalIndexedEntries > 0 ? 'active' : 'basic',
    }
  } catch (err) {
    console.warn('[retrieval-engine] getRetrievalStatus failed:', err instanceof Error ? err.message : err)
    return {
      available: false,
      embeddingsEnabled: false,
      rerankEnabled: false,
      totalIndexedEntries: 0,
      appNamespaces: [],
      statusLabel: 'not_configured',
    }
  }
}

// ── Pruning / archiving ─────────────────────────────────────────────────────

/**
 * Remove all memory entries whose `expiresAt` is in the past.
 *
 * Returns the number of entries deleted, or 0 on error.
 * Never throws.
 */
export async function pruneExpiredEntries(): Promise<number> {
  try {
    const result = await prisma.memoryEntry.deleteMany({
      where: {
        expiresAt: { not: null, lt: new Date() },
      },
    })
    return result.count
  } catch (err) {
    console.warn('[retrieval-engine] pruneExpiredEntries failed:', err instanceof Error ? err.message : err)
    return 0
  }
}
