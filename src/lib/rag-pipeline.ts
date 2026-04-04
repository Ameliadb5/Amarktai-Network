/**
 * RAG Pipeline — Retrieval-Augmented Generation
 *
 * Complete pipeline: Document chunking → Embedding → Storage → Retrieval → Context injection.
 * Uses Qdrant vector store for semantic search and OpenAI embeddings for vectorization.
 *
 * Truthful: Only returns results that actually exist in the vector store.
 * Gracefully degrades when infrastructure (Qdrant, embedding API) is unavailable.
 */

import { searchVectors, upsertVectors, ensureCollection, isQdrantHealthy } from './vector-store'
import { cacheGet, cacheSet } from './redis'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: string
  content: string
  metadata: Record<string, unknown>
  /** Source identifier (e.g., filename, URL, app slug) */
  source: string
  /** Namespace for isolation (e.g., per-app, per-tenant) */
  namespace: string
}

export interface Chunk {
  id: string
  documentId: string
  content: string
  index: number
  metadata: Record<string, unknown>
  namespace: string
}

export interface RetrievalResult {
  content: string
  score: number
  documentId: string
  source: string
  chunkIndex: number
  metadata: Record<string, unknown>
}

export interface RAGContext {
  query: string
  results: RetrievalResult[]
  contextWindow: string
  totalChunksSearched: number
  latencyMs: number
}

export interface IngestResult {
  documentId: string
  chunksCreated: number
  embeddingsGenerated: number
  success: boolean
  error?: string
}

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_CHUNK_SIZE = 512
const DEFAULT_CHUNK_OVERLAP = 64
const DEFAULT_TOP_K = 5
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const EMBEDDING_CACHE_TTL = 3600 // 1 hour

// ── Text Chunking ────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks for embedding.
 * Uses sentence-aware splitting to avoid breaking mid-sentence.
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP,
): string[] {
  if (!text || text.trim().length === 0) return []
  if (text.length <= chunkSize) return [text.trim()]

  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Keep overlap from end of previous chunk
      const words = currentChunk.split(/\s+/)
      const overlapWords = words.slice(-Math.ceil(overlap / 5))
      currentChunk = overlapWords.join(' ') + ' ' + sentence
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// ── Embedding ────────────────────────────────────────────────────────────────

/**
 * Generate embeddings for text using OpenAI API.
 * Caches results in Redis to avoid redundant API calls.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  // Check cache first
  const cacheKey = `emb:${Buffer.from(text.slice(0, 200)).toString('base64').slice(0, 40)}`
  const cached = await cacheGet(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as number[]
    } catch { /* cache miss */ }
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Limit input size
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return null

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    const embedding = data.data?.[0]?.embedding
    if (!embedding) return null

    // Cache the embedding
    await cacheSet(cacheKey, JSON.stringify(embedding), EMBEDDING_CACHE_TTL)
    return embedding
  } catch {
    return null
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return texts.map(() => null)

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map((t) => t.slice(0, 8000)),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return texts.map(() => null)

    const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> }
    const result: (number[] | null)[] = texts.map(() => null)
    for (const item of data.data) {
      result[item.index] = item.embedding
    }
    return result
  } catch {
    return texts.map(() => null)
  }
}

// ── Document Ingestion ───────────────────────────────────────────────────────

/**
 * Ingest a document: chunk → embed → store in vector DB.
 */
export async function ingestDocument(doc: Document): Promise<IngestResult> {
  const _start = Date.now()

  try {
    // Ensure vector collection exists
    await ensureCollection()

    // Chunk the document
    const textChunks = chunkText(doc.content)
    if (textChunks.length === 0) {
      return { documentId: doc.id, chunksCreated: 0, embeddingsGenerated: 0, success: true }
    }

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(textChunks)
    const validPairs: Array<{ chunk: string; embedding: number[]; index: number }> = []
    for (let i = 0; i < textChunks.length; i++) {
      if (embeddings[i]) {
        validPairs.push({ chunk: textChunks[i], embedding: embeddings[i]!, index: i })
      }
    }

    if (validPairs.length === 0) {
      return {
        documentId: doc.id,
        chunksCreated: textChunks.length,
        embeddingsGenerated: 0,
        success: false,
        error: 'Failed to generate any embeddings',
      }
    }

    // Store in vector DB
    const points = validPairs.map((p) => ({
      id: randomUUID(),
      vector: p.embedding,
      payload: {
        documentId: doc.id,
        content: p.chunk,
        chunkIndex: p.index,
        source: doc.source,
        namespace: doc.namespace,
        ...doc.metadata,
        ingestedAt: new Date().toISOString(),
      },
    }))

    await upsertVectors(points)

    return {
      documentId: doc.id,
      chunksCreated: textChunks.length,
      embeddingsGenerated: validPairs.length,
      success: true,
    }
  } catch (err) {
    return {
      documentId: doc.id,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown ingestion error',
    }
  }
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve relevant context for a query from the vector store.
 */
export async function retrieve(
  query: string,
  namespace?: string,
  topK: number = DEFAULT_TOP_K,
): Promise<RAGContext> {
  const start = Date.now()

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) {
    return {
      query,
      results: [],
      contextWindow: '',
      totalChunksSearched: 0,
      latencyMs: Date.now() - start,
    }
  }

  // Search vector store
  const searchResults = await searchVectors(queryEmbedding, topK * 2) // Fetch more for namespace filtering

  // Filter by namespace if specified
  let filtered = searchResults
  if (namespace) {
    filtered = searchResults.filter((r) => r.payload?.namespace === namespace)
  }

  // Take top K
  const topResults = filtered.slice(0, topK)

  // Map to retrieval results
  const results: RetrievalResult[] = topResults.map((r) => ({
    content: String(r.payload?.content ?? ''),
    score: r.score,
    documentId: String(r.payload?.documentId ?? ''),
    source: String(r.payload?.source ?? ''),
    chunkIndex: Number(r.payload?.chunkIndex ?? 0),
    metadata: (r.payload ?? {}) as Record<string, unknown>,
  }))

  // Build context window
  const contextWindow = results
    .map((r, i) => `[Source ${i + 1}: ${r.source} (relevance: ${(r.score * 100).toFixed(1)}%)]\n${r.content}`)
    .join('\n\n---\n\n')

  return {
    query,
    results,
    contextWindow,
    totalChunksSearched: searchResults.length,
    latencyMs: Date.now() - start,
  }
}

/**
 * Build a RAG-augmented prompt by injecting retrieved context.
 */
export function buildRAGPrompt(
  userQuery: string,
  context: RAGContext,
  systemPrompt?: string,
): string {
  if (context.results.length === 0) {
    return userQuery
  }

  const ragPrefix = systemPrompt
    ? `${systemPrompt}\n\n`
    : ''

  return `${ragPrefix}Use the following context to answer the user's question. If the context doesn't contain relevant information, say so honestly.\n\n--- Retrieved Context ---\n${context.contextWindow}\n--- End Context ---\n\nUser Question: ${userQuery}`
}

// ── Health Check ─────────────────────────────────────────────────────────────

export interface RAGHealthStatus {
  vectorStoreHealthy: boolean
  embeddingAvailable: boolean
  ready: boolean
}

export async function getRAGHealth(): Promise<RAGHealthStatus> {
  const vectorStoreHealthy = await isQdrantHealthy()
  const embeddingAvailable = !!process.env.OPENAI_API_KEY
  return {
    vectorStoreHealthy,
    embeddingAvailable,
    ready: vectorStoreHealthy && embeddingAvailable,
  }
}

// ── Constants for testing ────────────────────────────────────────────────────
export const RAG_CHUNK_SIZE = DEFAULT_CHUNK_SIZE
export const RAG_CHUNK_OVERLAP = DEFAULT_CHUNK_OVERLAP
export const RAG_TOP_K = DEFAULT_TOP_K
export const RAG_EMBEDDING_MODEL = EMBEDDING_MODEL
