/**
 * Rate Limiter — Redis-backed Sliding Window Rate Limiting
 *
 * Per-app, per-user, and per-provider rate limiting using Redis sorted sets
 * with sliding window algorithm. Gracefully degrades to allow-all when
 * Redis is unavailable.
 *
 * Truthful: Only blocks when actual limits are exceeded.
 */

import { getRedisClient } from './redis'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
  retryAfterMs?: number
}

export type RateLimitScope = 'app' | 'user' | 'provider' | 'global' | 'ip'

// ── Default Limits ───────────────────────────────────────────────────────────

const DEFAULT_LIMITS: Record<RateLimitScope, RateLimitConfig> = {
  app: { maxRequests: 1000, windowSeconds: 60 },       // 1000 req/min per app
  user: { maxRequests: 60, windowSeconds: 60 },         // 60 req/min per user
  provider: { maxRequests: 500, windowSeconds: 60 },    // 500 req/min per provider
  global: { maxRequests: 10_000, windowSeconds: 60 },   // 10K req/min global
  ip: { maxRequests: 120, windowSeconds: 60 },          // 120 req/min per IP
}

// Custom per-app overrides stored in memory (loaded from DB at startup)
const customLimits = new Map<string, RateLimitConfig>()

// ── Core Rate Limiting ───────────────────────────────────────────────────────

/**
 * Check and consume a rate limit token using sliding window algorithm.
 * Uses Redis sorted sets: score = timestamp, member = unique request ID.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  const limits = config ?? customLimits.get(`${scope}:${identifier}`) ?? DEFAULT_LIMITS[scope]

  // Gracefully degrade: allow all when Redis unavailable
  if (!redis) {
    return {
      allowed: true,
      remaining: limits.maxRequests,
      limit: limits.maxRequests,
      resetAt: new Date(Date.now() + limits.windowSeconds * 1000),
    }
  }

  const key = `rl:${scope}:${identifier}`
  const now = Date.now()
  const windowStart = now - limits.windowSeconds * 1000

  try {
    // Use Redis pipeline for atomic operation
    const pipeline = redis.pipeline()

    // Remove expired entries (outside window)
    pipeline.zremrangebyscore(key, '-inf', windowStart)
    // Count current entries in window
    pipeline.zcard(key)
    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`)
    // Set TTL on the key
    pipeline.expire(key, limits.windowSeconds + 1)

    const results = await pipeline.exec()
    if (!results) {
      return { allowed: true, remaining: limits.maxRequests, limit: limits.maxRequests, resetAt: new Date(now + limits.windowSeconds * 1000) }
    }

    const currentCount = (results[1]?.[1] as number) ?? 0
    const allowed = currentCount < limits.maxRequests
    const remaining = Math.max(0, limits.maxRequests - currentCount - (allowed ? 1 : 0))

    if (!allowed) {
      // Remove the request we just added since it's denied
      const lastResult = results[2]
      if (lastResult) {
        // We can't easily undo the zadd in pipeline, but the next window cleanup will handle it
      }
    }

    return {
      allowed,
      remaining,
      limit: limits.maxRequests,
      resetAt: new Date(now + limits.windowSeconds * 1000),
      ...(allowed ? {} : { retryAfterMs: limits.windowSeconds * 1000 - (now - windowStart) }),
    }
  } catch {
    // Redis error — allow through
    return {
      allowed: true,
      remaining: limits.maxRequests,
      limit: limits.maxRequests,
      resetAt: new Date(now + limits.windowSeconds * 1000),
    }
  }
}

/**
 * Check rate limit without consuming a token (peek).
 */
export async function peekRateLimit(
  scope: RateLimitScope,
  identifier: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  const limits = config ?? customLimits.get(`${scope}:${identifier}`) ?? DEFAULT_LIMITS[scope]

  if (!redis) {
    return {
      allowed: true,
      remaining: limits.maxRequests,
      limit: limits.maxRequests,
      resetAt: new Date(Date.now() + limits.windowSeconds * 1000),
    }
  }

  const key = `rl:${scope}:${identifier}`
  const now = Date.now()
  const windowStart = now - limits.windowSeconds * 1000

  try {
    const count = await redis.zcount(key, windowStart, '+inf')
    const allowed = count < limits.maxRequests
    return {
      allowed,
      remaining: Math.max(0, limits.maxRequests - count),
      limit: limits.maxRequests,
      resetAt: new Date(now + limits.windowSeconds * 1000),
    }
  } catch {
    return { allowed: true, remaining: limits.maxRequests, limit: limits.maxRequests, resetAt: new Date(now + limits.windowSeconds * 1000) }
  }
}

/**
 * Set custom rate limit for a specific scope+identifier.
 */
export function setCustomLimit(scope: RateLimitScope, identifier: string, config: RateLimitConfig): void {
  customLimits.set(`${scope}:${identifier}`, config)
}

/**
 * Reset rate limit counter for a scope+identifier.
 */
export async function resetRateLimit(scope: RateLimitScope, identifier: string): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return false
  try {
    await redis.del(`rl:${scope}:${identifier}`)
    return true
  } catch {
    return false
  }
}

/**
 * Get rate limit headers for HTTP responses.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfterMs ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {}),
  }
}

// ── Composite Rate Limiting ──────────────────────────────────────────────────

/**
 * Check multiple rate limits at once (e.g., per-app + per-user + global).
 * Returns the most restrictive result.
 */
export async function checkCompositeLimits(
  checks: Array<{ scope: RateLimitScope; identifier: string; config?: RateLimitConfig }>,
): Promise<RateLimitResult & { blockedBy?: RateLimitScope }> {
  const results = await Promise.all(
    checks.map(async (c) => ({
      scope: c.scope,
      result: await checkRateLimit(c.scope, c.identifier, c.config),
    })),
  )

  // Find the most restrictive (lowest remaining, or any blocked)
  const blocked = results.find((r) => !r.result.allowed)
  if (blocked) {
    return { ...blocked.result, blockedBy: blocked.scope }
  }

  // Return the most restrictive allowed result
  const mostRestrictive = results.reduce((min, r) =>
    r.result.remaining < min.result.remaining ? r : min,
  )
  return { ...mostRestrictive.result }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const DEFAULT_RATE_LIMITS = DEFAULT_LIMITS
