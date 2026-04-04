/**
 * Redis Client — AmarktAI Network
 *
 * Provides a singleton Redis connection for caching, rate limiting,
 * and pub/sub messaging.
 *
 * When REDIS_URL is not configured, operations degrade gracefully to
 * no-ops so the rest of the platform keeps working without Redis.
 *
 * Server-side only.
 */

import Redis from 'ioredis'

// ── Singleton ────────────────────────────────────────────────────────────────

let _client: Redis | null = null

/**
 * Returns the shared Redis client, or `null` if REDIS_URL is not set.
 */
export function getRedisClient(): Redis | null {
  if (_client) return _client
  const url = process.env.REDIS_URL
  if (!url) return null
  _client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null          // give up after 5 retries
      return Math.min(times * 200, 2000)  // exponential backoff
    },
  })
  _client.on('error', (err) => {
    console.error('[Redis] connection error:', err.message)
  })
  return _client
}

// ── Cache helpers ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 300 // 5 minutes

/**
 * Get a cached value. Returns `null` if Redis is unavailable or key doesn't exist.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedisClient()
  if (!client) return null
  try {
    return await client.get(key)
  } catch {
    return null
  }
}

/**
 * Set a cached value with optional TTL (seconds). Defaults to 5 minutes.
 */
export async function cacheSet(key: string, value: string, ttlSeconds = DEFAULT_TTL): Promise<void> {
  const client = getRedisClient()
  if (!client) return
  try {
    await client.set(key, value, 'EX', ttlSeconds)
  } catch {
    // degrade silently
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client) return
  try {
    await client.del(key)
  } catch {
    // degrade silently
  }
}

/**
 * Returns true when Redis is connected and responding.
 */
export async function isRedisHealthy(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    const pong = await client.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}
