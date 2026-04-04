/**
 * Vector Store — AmarktAI Network
 *
 * Qdrant-backed vector database for semantic search, RAG, and memory.
 *
 * When QDRANT_URL is not configured, operations degrade gracefully to
 * no-ops so the rest of the platform keeps working without Qdrant.
 *
 * Server-side only.
 */

import { QdrantClient } from '@qdrant/js-client-rest'

// ── Singleton ────────────────────────────────────────────────────────────────

let _client: QdrantClient | null = null

/**
 * Returns the shared Qdrant client, or `null` if QDRANT_URL is not set.
 */
export function getQdrantClient(): QdrantClient | null {
  if (_client) return _client
  const url = process.env.QDRANT_URL
  if (!url) return null
  _client = new QdrantClient({
    url,
    apiKey: process.env.QDRANT_API_KEY || undefined,
  })
  return _client
}

// ── Collection management ───────────────────────────────────────────────────

const DEFAULT_COLLECTION = 'amarktai_memory'
const VECTOR_SIZE = 1536 // OpenAI text-embedding-3-large default

/**
 * Ensure the default collection exists.
 */
export async function ensureCollection(
  name = DEFAULT_COLLECTION,
  vectorSize = VECTOR_SIZE,
): Promise<boolean> {
  const client = getQdrantClient()
  if (!client) return false
  try {
    const collections = await client.getCollections()
    const exists = collections.collections.some((c) => c.name === name)
    if (!exists) {
      await client.createCollection(name, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      })
    }
    return true
  } catch {
    return false
  }
}

// ── Upsert / Search ─────────────────────────────────────────────────────────

export interface VectorPoint {
  id: string
  vector: number[]
  payload: Record<string, unknown>
}

/**
 * Upsert vector points into the collection.
 */
export async function upsertVectors(
  points: VectorPoint[],
  collection = DEFAULT_COLLECTION,
): Promise<boolean> {
  const client = getQdrantClient()
  if (!client) return false
  try {
    await client.upsert(collection, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    })
    return true
  } catch {
    return false
  }
}

export interface SearchResult {
  id: string | number
  score: number
  payload: Record<string, unknown>
}

/**
 * Search for the nearest vectors.
 */
export async function searchVectors(
  vector: number[],
  limit = 10,
  collection = DEFAULT_COLLECTION,
  filter?: Record<string, unknown>,
): Promise<SearchResult[]> {
  const client = getQdrantClient()
  if (!client) return []
  try {
    const results = await client.search(collection, {
      vector,
      limit,
      filter: filter as never,
      with_payload: true,
    })
    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }))
  } catch {
    return []
  }
}

/**
 * Returns true when Qdrant is connected and responding.
 */
export async function isQdrantHealthy(): Promise<boolean> {
  const client = getQdrantClient()
  if (!client) return false
  try {
    await client.getCollections()
    return true
  } catch {
    return false
  }
}
