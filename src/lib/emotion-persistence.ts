/**
 * Emotion Persistence Layer — AmarktAI Network
 *
 * Bridges the in-memory emotion engine to Redis (short-term) and
 * Qdrant (long-term) storage.  Degrades gracefully when either
 * backend is unavailable — the emotion engine always works in-memory
 * and this layer adds durability on top.
 *
 * Redis keys:
 *   emotion:profile:{userId}       – EmotionalProfile JSON (TTL 7 days)
 *   emotion:drift:{userId}         – EmotionalDrift JSON   (TTL 7 days)
 *   emotion:memory:{userId}        – EmotionMemoryEntry[] JSON (TTL 7 days)
 *   emotion:personality:{userId}   – PersonalityState JSON (TTL 7 days)
 *   emotion:context:{userId}       – ConversationContext JSON (TTL 1 day)
 *   emotion:learning:{userId}      – LearningState JSON (TTL 30 days)
 *   emotion:transitions            – Transition matrix JSON (TTL 30 days)
 *   emotion:analyses_count         – Global counter (no TTL)
 *
 * Qdrant collection: amarktai_emotions
 *   Stores emotion vectors for long-term user emotional fingerprints.
 *   Each point = one emotion analysis snapshot, with user/emotion metadata.
 */

import { getRedisClient } from './redis'
import { getQdrantClient } from './vector-store'
import type {
  EmotionalProfile,
  EmotionalDrift,
  EmotionMemoryEntry,
  PersonalityState,
  ConversationContext,
  LearningState,
  EmotionAnalysis,
  EmotionType,
} from './emotion-engine'

// ─── Constants ──────────────────────────────────────────────────────────────

const PREFIX = 'emotion:'
const TTL_7D = 7 * 24 * 60 * 60   // 7 days
const TTL_1D = 24 * 60 * 60       // 1 day
const TTL_30D = 30 * 24 * 60 * 60 // 30 days

const EMOTION_COLLECTION = 'amarktai_emotions'
const EMOTION_VECTOR_SIZE = 14 // one dimension per emotion type

const EMOTION_DIMS: EmotionType[] = [
  'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust',
  'trust', 'anticipation', 'frustration', 'confusion', 'excitement', 'neutral',
  'longing', 'affection',
]

// ─── Redis Persistence ──────────────────────────────────────────────────────

async function redisSet(key: string, value: unknown, ttl: number): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.set(PREFIX + key, JSON.stringify(value), 'EX', ttl)
    return true
  } catch {
    return false
  }
}

async function redisGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    const raw = await client.get(PREFIX + key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

// ─── Profile Persistence ────────────────────────────────────────────────────

export async function persistProfile(profile: EmotionalProfile): Promise<boolean> {
  return redisSet(`profile:${profile.userId}`, profile, TTL_7D)
}

export async function loadProfile(userId: string): Promise<EmotionalProfile | null> {
  return redisGet<EmotionalProfile>(`profile:${userId}`)
}

// ─── Drift Persistence ──────────────────────────────────────────────────────

export async function persistDrift(drift: EmotionalDrift): Promise<boolean> {
  return redisSet(`drift:${drift.userId}`, drift, TTL_7D)
}

export async function loadDrift(userId: string): Promise<EmotionalDrift | null> {
  return redisGet<EmotionalDrift>(`drift:${userId}`)
}

// ─── Memory Persistence ─────────────────────────────────────────────────────

export async function persistMemory(userId: string, entries: EmotionMemoryEntry[]): Promise<boolean> {
  return redisSet(`memory:${userId}`, entries, TTL_7D)
}

export async function loadMemory(userId: string): Promise<EmotionMemoryEntry[] | null> {
  return redisGet<EmotionMemoryEntry[]>(`memory:${userId}`)
}

// ─── Personality Persistence ────────────────────────────────────────────────

export async function persistPersonality(userId: string, state: PersonalityState): Promise<boolean> {
  return redisSet(`personality:${userId}`, state, TTL_7D)
}

export async function loadPersonality(userId: string): Promise<PersonalityState | null> {
  return redisGet<PersonalityState>(`personality:${userId}`)
}

// ─── Conversation Context Persistence ───────────────────────────────────────

export async function persistContext(ctx: ConversationContext): Promise<boolean> {
  return redisSet(`context:${ctx.userId}`, ctx, TTL_1D)
}

export async function loadContext(userId: string): Promise<ConversationContext | null> {
  return redisGet<ConversationContext>(`context:${userId}`)
}

// ─── Learning State Persistence ─────────────────────────────────────────────

export async function persistLearning(state: LearningState): Promise<boolean> {
  return redisSet(`learning:${state.userId}`, state, TTL_30D)
}

export async function loadLearning(userId: string): Promise<LearningState | null> {
  return redisGet<LearningState>(`learning:${userId}`)
}

// ─── Transition Matrix Persistence ──────────────────────────────────────────

export async function persistTransitions(matrix: Map<string, number>): Promise<boolean> {
  const obj = Object.fromEntries(matrix)
  return redisSet('transitions', obj, TTL_30D)
}

export async function loadTransitions(): Promise<Map<string, number> | null> {
  const obj = await redisGet<Record<string, number>>('transitions')
  if (!obj) return null
  return new Map(Object.entries(obj))
}

// ─── Global Counter Persistence ─────────────────────────────────────────────

export async function persistAnalysesCount(count: number): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    await client.set(PREFIX + 'analyses_count', String(count))
    return true
  } catch {
    return false
  }
}

export async function loadAnalysesCount(): Promise<number> {
  const client = getRedisClient()
  if (!client) return 0
  try {
    const raw = await client.get(PREFIX + 'analyses_count')
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

// ─── Qdrant Long-Term Emotion Vectors ───────────────────────────────────────

/**
 * Convert an EmotionAnalysis into a fixed-size vector (12 dimensions).
 * Each dimension corresponds to one emotion type's score.
 */
export function analysisToVector(analysis: EmotionAnalysis): number[] {
  const scoreMap = new Map(analysis.emotions.map(e => [e.type, e.score]))
  return EMOTION_DIMS.map(dim => scoreMap.get(dim) ?? 0)
}

/**
 * Ensure the emotion collection exists in Qdrant.
 */
export async function ensureEmotionCollection(): Promise<boolean> {
  const client = getQdrantClient()
  if (!client) return false
  try {
    const collections = await client.getCollections()
    const exists = collections.collections.some(c => c.name === EMOTION_COLLECTION)
    if (!exists) {
      await client.createCollection(EMOTION_COLLECTION, {
        vectors: { size: EMOTION_VECTOR_SIZE, distance: 'Cosine' },
      })
    }
    return true
  } catch {
    return false
  }
}

/**
 * Store an emotion analysis as a vector point in Qdrant for long-term retrieval.
 */
export async function storeEmotionVector(
  userId: string,
  analysis: EmotionAnalysis,
  context?: string,
): Promise<boolean> {
  const client = getQdrantClient()
  if (!client) return false
  try {
    await ensureEmotionCollection()
    const vector = analysisToVector(analysis)
    const id = `${userId}-${Date.now()}`
    await client.upsert(EMOTION_COLLECTION, {
      wait: false, // async write for performance
      points: [{
        id,
        vector,
        payload: {
          userId,
          dominant: analysis.dominant,
          confidence: analysis.confidence,
          timestamp: new Date().toISOString(),
          context: context?.slice(0, 200) ?? '',
        },
      }],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Retrieve similar emotional moments for a user from long-term storage.
 */
export async function searchEmotionalHistory(
  analysis: EmotionAnalysis,
  userId: string,
  limit = 5,
): Promise<Array<{ dominant: string; confidence: number; timestamp: string; score: number }>> {
  const client = getQdrantClient()
  if (!client) return []
  try {
    const vector = analysisToVector(analysis)
    const results = await client.search(EMOTION_COLLECTION, {
      vector,
      limit,
      filter: {
        must: [{ key: 'userId', match: { value: userId } }],
      },
      with_payload: true,
    })
    return results.map(r => ({
      dominant: (r.payload as Record<string, unknown>)?.dominant as string ?? 'neutral',
      confidence: (r.payload as Record<string, unknown>)?.confidence as number ?? 0,
      timestamp: (r.payload as Record<string, unknown>)?.timestamp as string ?? '',
      score: r.score,
    }))
  } catch {
    return []
  }
}

// ─── Batch Persist (called after pipeline runs) ─────────────────────────────

export interface EmotionPersistenceResult {
  redis: boolean
  qdrant: boolean
}

/**
 * Persist all emotion state for a user after a pipeline run.
 * Non-blocking — errors are swallowed; the in-memory engine remains authoritative.
 */
export async function persistEmotionState(
  userId: string,
  state: {
    profile?: EmotionalProfile
    drift?: EmotionalDrift
    memory?: EmotionMemoryEntry[]
    personality?: PersonalityState
    context?: ConversationContext
    learning?: LearningState
    analysis?: EmotionAnalysis
    analysesCount?: number
    transitions?: Map<string, number>
    analysisContext?: string
  },
): Promise<EmotionPersistenceResult> {
  const results = { redis: false, qdrant: false }

  // Redis persistence (all fire-and-forget style)
  const redisOps: Promise<boolean>[] = []
  if (state.profile) redisOps.push(persistProfile(state.profile))
  if (state.drift) redisOps.push(persistDrift(state.drift))
  if (state.memory) redisOps.push(persistMemory(userId, state.memory))
  if (state.personality) redisOps.push(persistPersonality(userId, state.personality))
  if (state.context) redisOps.push(persistContext(state.context))
  if (state.learning) redisOps.push(persistLearning(state.learning))
  if (state.transitions) redisOps.push(persistTransitions(state.transitions))
  if (state.analysesCount !== undefined) redisOps.push(persistAnalysesCount(state.analysesCount))

  if (redisOps.length > 0) {
    const redisResults = await Promise.allSettled(redisOps)
    results.redis = redisResults.some(r => r.status === 'fulfilled' && r.value)
  }

  // Qdrant persistence (long-term emotion vector)
  if (state.analysis) {
    results.qdrant = await storeEmotionVector(userId, state.analysis, state.analysisContext)
  }

  return results
}

// ─── Exports for testing ────────────────────────────────────────────────────

export { EMOTION_COLLECTION, EMOTION_VECTOR_SIZE, EMOTION_DIMS, PREFIX }
