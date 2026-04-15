/**
 * App Success Engine — AmarktAI Network
 *
 * Tracks per-app engagement, success, failure, and inactivity.
 * Generates recommendations to boost struggling apps and
 * prioritize high-performing ones.
 *
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export type AppHealthState = 'thriving' | 'healthy' | 'struggling' | 'inactive' | 'unknown'

export interface AppSuccessMetrics {
  appSlug: string
  appName: string
  state: AppHealthState
  requestCount7d: number
  successRate7d: number
  avgLatency7d: number
  artifactCount: number
  lastActivityAt: Date | null
  daysSinceActivity: number
  trendDirection: 'up' | 'stable' | 'down' | 'none'
  recommendations: string[]
}

// ── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  inactivityDays: 7,
  thrivingSuccessRate: 0.95,
  thrivingMinRequests: 50,
  healthySuccessRate: 0.80,
  healthyMinRequests: 10,
  strugglingSuccessRate: 0.60,
}

// ── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Analyze success metrics for a single app.
 */
export async function getAppSuccessMetrics(appSlug: string): Promise<AppSuccessMetrics> {
  const app = await prisma.product.findUnique({
    where: { slug: appSlug },
    select: { slug: true, name: true },
  })

  if (!app) {
    return {
      appSlug,
      appName: appSlug,
      state: 'unknown',
      requestCount7d: 0,
      successRate7d: 0,
      avgLatency7d: 0,
      artifactCount: 0,
      lastActivityAt: null,
      daysSinceActivity: -1,
      trendDirection: 'none',
      recommendations: ['App not found in registry'],
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000)

  // Fetch 7d and 14d brain events for trend comparison
  const [events7d, events14to7d, artifactCount, lastEvent] = await Promise.all([
    prisma.brainEvent.findMany({
      where: { appSlug, timestamp: { gte: sevenDaysAgo } },
      select: { success: true, latencyMs: true },
    }),
    prisma.brainEvent.findMany({
      where: { appSlug, timestamp: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      select: { success: true },
    }),
    prisma.artifact.count({ where: { appSlug } }).catch(() => 0),
    prisma.brainEvent.findFirst({
      where: { appSlug },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
  ])

  const requestCount7d = events7d.length
  const successCount7d = events7d.filter(e => e.success).length
  const successRate7d = requestCount7d > 0 ? successCount7d / requestCount7d : 0
  const avgLatency7d = requestCount7d > 0
    ? events7d.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) / requestCount7d
    : 0

  const lastActivityAt = lastEvent?.timestamp ?? null
  const daysSinceActivity = lastActivityAt
    ? Math.floor((Date.now() - lastActivityAt.getTime()) / 86_400_000)
    : -1

  // Trend: compare 7d to previous 7d
  const prevCount = events14to7d.length
  let trendDirection: 'up' | 'stable' | 'down' | 'none' = 'none'
  if (prevCount > 0 || requestCount7d > 0) {
    if (requestCount7d > prevCount * 1.2) trendDirection = 'up'
    else if (requestCount7d < prevCount * 0.8) trendDirection = 'down'
    else trendDirection = 'stable'
  }

  // Determine state
  let state: AppHealthState = 'unknown'
  if (daysSinceActivity > THRESHOLDS.inactivityDays || daysSinceActivity === -1) {
    state = 'inactive'
  } else if (successRate7d >= THRESHOLDS.thrivingSuccessRate && requestCount7d >= THRESHOLDS.thrivingMinRequests) {
    state = 'thriving'
  } else if (successRate7d >= THRESHOLDS.healthySuccessRate && requestCount7d >= THRESHOLDS.healthyMinRequests) {
    state = 'healthy'
  } else if (requestCount7d >= THRESHOLDS.healthyMinRequests) {
    state = 'struggling'
  } else {
    state = requestCount7d > 0 ? 'healthy' : 'inactive'
  }

  // Generate recommendations
  const recommendations = generateRecommendations(state, {
    successRate7d,
    avgLatency7d,
    requestCount7d,
    daysSinceActivity,
    trendDirection,
  })

  return {
    appSlug,
    appName: app.name,
    state,
    requestCount7d,
    successRate7d,
    avgLatency7d,
    artifactCount,
    lastActivityAt,
    daysSinceActivity,
    trendDirection,
    recommendations,
  }
}

/**
 * Get success metrics for all AI-enabled apps.
 */
export async function getAllAppSuccessMetrics(): Promise<AppSuccessMetrics[]> {
  const apps = await prisma.product.findMany({
    where: { aiEnabled: true },
    select: { slug: true },
  })

  const results: AppSuccessMetrics[] = []
  for (const app of apps) {
    try {
      const metrics = await getAppSuccessMetrics(app.slug)
      results.push(metrics)
    } catch {
      results.push({
        appSlug: app.slug,
        appName: app.slug,
        state: 'unknown',
        requestCount7d: 0,
        successRate7d: 0,
        avgLatency7d: 0,
        artifactCount: 0,
        lastActivityAt: null,
        daysSinceActivity: -1,
        trendDirection: 'none',
        recommendations: ['Failed to analyze app metrics'],
      })
    }
  }

  return results.sort((a, b) => {
    const stateOrder: Record<AppHealthState, number> = {
      struggling: 0, inactive: 1, unknown: 2, healthy: 3, thriving: 4,
    }
    return stateOrder[a.state] - stateOrder[b.state]
  })
}

/**
 * Get summary counts by state.
 */
export async function getAppSuccessSummary(): Promise<Record<AppHealthState, number>> {
  const metrics = await getAllAppSuccessMetrics()
  const summary: Record<AppHealthState, number> = {
    thriving: 0, healthy: 0, struggling: 0, inactive: 0, unknown: 0,
  }
  for (const m of metrics) {
    summary[m.state]++
  }
  return summary
}

// ── Recommendations ──────────────────────────────────────────────────────────

function generateRecommendations(
  state: AppHealthState,
  data: {
    successRate7d: number
    avgLatency7d: number
    requestCount7d: number
    daysSinceActivity: number
    trendDirection: string
  },
): string[] {
  const recs: string[] = []

  if (state === 'inactive') {
    recs.push('App has been inactive. Consider sending a re-engagement notification.')
    if (data.daysSinceActivity > 14) {
      recs.push('No activity in over 2 weeks. Review if this app is still needed.')
    }
  }

  if (state === 'struggling') {
    if (data.successRate7d < 0.7) {
      recs.push('High failure rate detected. Check provider health and routing configuration.')
    }
    if (data.avgLatency7d > 5000) {
      recs.push('Average latency is high. Consider routing to faster models for this app.')
    }
    recs.push('Review the app\'s learning logs for improvement suggestions.')
  }

  if (state === 'thriving' && data.trendDirection === 'up') {
    recs.push('App is thriving with growing usage. Consider increasing its resource allocation.')
  }

  if (data.trendDirection === 'down' && data.requestCount7d > 0) {
    recs.push('Usage is trending down compared to previous week. Investigate cause.')
  }

  if (data.successRate7d > 0 && data.successRate7d < 0.80) {
    recs.push(`Success rate is ${(data.successRate7d * 100).toFixed(0)}%. Target is 80%+. Review error logs.`)
  }

  return recs
}
