/**
 * Learning Engine — AmarktAI Network
 *
 * Real learning foundations built on actual route outcomes,
 * provider/model performance history, and app-level memory growth.
 *
 * Learning exists at two scopes:
 *   1. Per-app — individual app performance, preferences, and task patterns
 *   2. Shared ecosystem — cross-app provider scoring and optimization
 *
 * All data is sourced from BrainEvent + MemoryEntry tables.
 * Nothing is fabricated — every metric reflects real usage.
 *
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────

export interface RouteOutcome {
  appSlug: string
  taskType: string
  executionMode: string
  providerKey: string
  model: string
  success: boolean
  latencyMs: number
  confidenceScore: number | null
  fallbackUsed: boolean
  validationPassed: boolean | null
}

export interface ProviderPerformance {
  providerKey: string
  totalRequests: number
  successRate: number
  avgLatencyMs: number
  failureCount: number
  lastSuccess: Date | null
  lastFailure: Date | null
}

export interface AppLearningState {
  appSlug: string
  totalRequests: number
  successRate: number
  topTaskTypes: Array<{ taskType: string; count: number }>
  memoryEntries: number
  lastActivity: Date | null
}

export interface LearningInsight {
  type: 'performance' | 'optimization' | 'preference' | 'instruction_refinement'
  scope: 'app' | 'ecosystem'
  appSlug?: string
  title: string
  description: string
  confidence: number
  createdAt: Date
}

export interface LearningStatus {
  available: boolean
  totalOutcomesLogged: number
  totalInsights: number
  providerCount: number
  appCount: number
  lastLearningRun: Date | null
  statusLabel: 'active' | 'collecting' | 'empty' | 'not_configured'
}

// ── Route Outcome Logging ────────────────────────────────────────────

/**
 * Log a route outcome to the MemoryEntry table.
 *
 * Stores the full outcome as structured JSON under memoryType='learned'
 * and key='route_outcome'. This builds the foundation for preference
 * adaptation, provider scoring, and route optimization.
 *
 * Never throws — returns false on failure.
 */
export async function logRouteOutcome(outcome: RouteOutcome): Promise<boolean> {
  try {
    await prisma.memoryEntry.create({
      data: {
        appSlug: outcome.appSlug,
        memoryType: 'learned',
        key: 'route_outcome',
        content: JSON.stringify({
          taskType: outcome.taskType,
          executionMode: outcome.executionMode,
          providerKey: outcome.providerKey,
          model: outcome.model,
          success: outcome.success,
          latencyMs: outcome.latencyMs,
          confidenceScore: outcome.confidenceScore,
          fallbackUsed: outcome.fallbackUsed,
          validationPassed: outcome.validationPassed,
          recordedAt: new Date().toISOString(),
        }),
        importance: outcome.success ? 0.5 : 0.8,
      },
    })
    return true
  } catch (err) {
    console.warn('[learning-engine] logRouteOutcome failed:', err instanceof Error ? err.message : err)
    return false
  }
}

// ── Provider Performance ─────────────────────────────────────────────

/**
 * Compute real provider performance metrics from BrainEvent history.
 *
 * Groups events by routed_provider, calculating success rate, average
 * latency, failure count, and last success/failure timestamps.
 *
 * When providerKey is supplied, returns a single-element array (or empty
 * if the provider has no recorded events).
 */
export async function getProviderPerformance(providerKey?: string): Promise<ProviderPerformance[]> {
  try {
    const where = providerKey
      ? { routedProvider: providerKey }
      : { routedProvider: { not: null } }

    const events = await prisma.brainEvent.findMany({
      where,
      select: {
        routedProvider: true,
        success: true,
        latencyMs: true,
        timestamp: true,
      },
    })

    // Group by provider
    const grouped = new Map<string, typeof events>()
    for (const ev of events) {
      const key = ev.routedProvider ?? 'unknown'
      const list = grouped.get(key) ?? []
      list.push(ev)
      grouped.set(key, list)
    }

    const results: ProviderPerformance[] = []

    for (const [key, providerEvents] of grouped) {
      const total = providerEvents.length
      const successes = providerEvents.filter((e) => e.success).length
      const failures = total - successes

      const latencies = providerEvents
        .map((e) => e.latencyMs)
        .filter((ms): ms is number => ms !== null)
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length)
        : 0

      const successEvents = providerEvents.filter((e) => e.success)
      const failureEvents = providerEvents.filter((e) => !e.success)

      const lastSuccess = successEvents.length > 0
        ? successEvents.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest)).timestamp
        : null
      const lastFailure = failureEvents.length > 0
        ? failureEvents.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest)).timestamp
        : null

      results.push({
        providerKey: key,
        totalRequests: total,
        successRate: total > 0 ? successes / total : 0,
        avgLatencyMs: avgLatency,
        failureCount: failures,
        lastSuccess,
        lastFailure,
      })
    }

    // Sort by total requests descending
    results.sort((a, b) => b.totalRequests - a.totalRequests)
    return results
  } catch (err) {
    console.warn('[learning-engine] getProviderPerformance failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ── App Learning State ───────────────────────────────────────────────

/**
 * Retrieve the learning state for a specific app.
 *
 * Combines BrainEvent performance data with MemoryEntry counts
 * to give a complete picture of what the engine has learned
 * about this app's usage patterns.
 */
export async function getAppLearningState(appSlug: string): Promise<AppLearningState> {
  const empty: AppLearningState = {
    appSlug,
    totalRequests: 0,
    successRate: 0,
    topTaskTypes: [],
    memoryEntries: 0,
    lastActivity: null,
  }

  try {
    const [events, memoryCount] = await Promise.all([
      prisma.brainEvent.findMany({
        where: { appSlug },
        select: {
          success: true,
          taskType: true,
          timestamp: true,
        },
      }),
      prisma.memoryEntry.count({ where: { appSlug } }),
    ])

    if (events.length === 0) {
      return { ...empty, memoryEntries: memoryCount }
    }

    const total = events.length
    const successes = events.filter((e) => e.success).length

    // Count task types
    const taskCounts = new Map<string, number>()
    for (const ev of events) {
      if (ev.taskType) {
        taskCounts.set(ev.taskType, (taskCounts.get(ev.taskType) ?? 0) + 1)
      }
    }
    const topTaskTypes = Array.from(taskCounts.entries())
      .map(([taskType, count]) => ({ taskType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const lastActivity = events.reduce(
      (latest, e) => (e.timestamp > latest ? e.timestamp : latest),
      events[0].timestamp,
    )

    return {
      appSlug,
      totalRequests: total,
      successRate: total > 0 ? successes / total : 0,
      topTaskTypes,
      memoryEntries: memoryCount,
      lastActivity,
    }
  } catch (err) {
    console.warn('[learning-engine] getAppLearningState failed:', err instanceof Error ? err.message : err)
    return empty
  }
}

// ── Insight Generation ───────────────────────────────────────────────

/**
 * Analyze BrainEvent data to generate truthful learning insights.
 *
 * Produces insights across four categories:
 *   - performance: provider success rates and latency trends
 *   - optimization: route optimization suggestions
 *   - preference: app-level task-type preferences
 *   - instruction_refinement: suggestions for improving app instructions
 *
 * All insights are derived from real data — nothing is fabricated.
 */
export async function generateInsights(): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = []
  const now = new Date()

  try {
    const events = await prisma.brainEvent.findMany({
      select: {
        appSlug: true,
        taskType: true,
        executionMode: true,
        routedProvider: true,
        routedModel: true,
        success: true,
        latencyMs: true,
        confidenceScore: true,
        timestamp: true,
      },
    })

    if (events.length === 0) return insights

    // ── Provider performance insights ──

    const byProvider = new Map<string, typeof events>()
    for (const ev of events) {
      if (!ev.routedProvider) continue
      const list = byProvider.get(ev.routedProvider) ?? []
      list.push(ev)
      byProvider.set(ev.routedProvider, list)
    }

    for (const [provider, providerEvents] of byProvider) {
      const total = providerEvents.length
      if (total < 5) continue // need minimum sample size

      const successes = providerEvents.filter((e) => e.success).length
      const rate = successes / total

      // High-performing provider
      if (rate >= 0.95) {
        // Find the most common task type for this provider
        const taskCounts = new Map<string, number>()
        for (const ev of providerEvents) {
          if (ev.taskType) {
            taskCounts.set(ev.taskType, (taskCounts.get(ev.taskType) ?? 0) + 1)
          }
        }
        const topTask = Array.from(taskCounts.entries())
          .sort((a, b) => b[1] - a[1])[0]

        const domain = topTask ? topTask[0] : 'general'
        insights.push({
          type: 'performance',
          scope: 'ecosystem',
          title: `${provider} has ${Math.round(rate * 100)}% success rate`,
          description: `Provider ${provider} has achieved a ${Math.round(rate * 100)}% success rate across ${total} requests. Consider making it primary for ${domain} tasks.`,
          confidence: Math.min(total / 50, 1),
          createdAt: now,
        })
      }

      // Low-performing provider
      if (rate < 0.7 && total >= 10) {
        insights.push({
          type: 'performance',
          scope: 'ecosystem',
          title: `${provider} success rate is low (${Math.round(rate * 100)}%)`,
          description: `Provider ${provider} has only a ${Math.round(rate * 100)}% success rate across ${total} requests. Consider deprioritizing or investigating failures.`,
          confidence: Math.min(total / 30, 1),
          createdAt: now,
        })
      }

      // Latency trend — compare last 24h to overall
      const oneDayAgo = new Date(now.getTime() - 86_400_000)
      const recentEvents = providerEvents.filter((e) => e.timestamp > oneDayAgo)
      const recentLatencies = recentEvents
        .map((e) => e.latencyMs)
        .filter((ms): ms is number => ms !== null)
      const allLatencies = providerEvents
        .map((e) => e.latencyMs)
        .filter((ms): ms is number => ms !== null)

      if (recentLatencies.length >= 3 && allLatencies.length >= 10) {
        const recentAvg = recentLatencies.reduce((s, v) => s + v, 0) / recentLatencies.length
        const overallAvg = allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length

        if (overallAvg > 0 && recentAvg > overallAvg * 1.2) {
          const increase = Math.round(((recentAvg - overallAvg) / overallAvg) * 100)
          insights.push({
            type: 'performance',
            scope: 'ecosystem',
            title: `${provider} latency increased ${increase}% in last 24h`,
            description: `Provider ${provider} average latency rose from ${Math.round(overallAvg)}ms to ${Math.round(recentAvg)}ms in the last 24 hours (${increase}% increase).`,
            confidence: Math.min(recentLatencies.length / 10, 1),
            createdAt: now,
          })
        }
      }
    }

    // ── App-level preference and optimization insights ──

    const byApp = new Map<string, typeof events>()
    for (const ev of events) {
      if (!ev.appSlug) continue
      const list = byApp.get(ev.appSlug) ?? []
      list.push(ev)
      byApp.set(ev.appSlug, list)
    }

    for (const [app, appEvents] of byApp) {
      if (appEvents.length < 5) continue

      // Task type concentration — suggest specialist routing
      const taskCounts = new Map<string, number>()
      for (const ev of appEvents) {
        if (ev.taskType) {
          taskCounts.set(ev.taskType, (taskCounts.get(ev.taskType) ?? 0) + 1)
        }
      }
      const sorted = Array.from(taskCounts.entries()).sort((a, b) => b[1] - a[1])

      if (sorted.length > 0) {
        const [topTask, topCount] = sorted[0]
        const concentration = topCount / appEvents.length

        if (concentration >= 0.6 && topCount >= 5) {
          insights.push({
            type: 'optimization',
            scope: 'app',
            appSlug: app,
            title: `App "${app}" primarily uses "${topTask}" tasks`,
            description: `${Math.round(concentration * 100)}% of ${app}'s ${appEvents.length} requests are "${topTask}" tasks. Suggest specialist routing for this task type to improve performance.`,
            confidence: Math.min(appEvents.length / 20, 1),
            createdAt: now,
          })
        }
      }

      // Execution mode preference
      const modeCounts = new Map<string, number>()
      for (const ev of appEvents) {
        modeCounts.set(ev.executionMode, (modeCounts.get(ev.executionMode) ?? 0) + 1)
      }
      const topMode = Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1])[0]

      if (topMode && topMode[0] !== 'direct' && topMode[1] / appEvents.length >= 0.5) {
        insights.push({
          type: 'preference',
          scope: 'app',
          appSlug: app,
          title: `App "${app}" prefers "${topMode[0]}" execution mode`,
          description: `${Math.round((topMode[1] / appEvents.length) * 100)}% of requests use "${topMode[0]}" mode. Consider setting this as the default for improved routing.`,
          confidence: Math.min(appEvents.length / 20, 1),
          createdAt: now,
        })
      }

      // Low success rate — suggest instruction refinement
      const appSuccesses = appEvents.filter((e) => e.success).length
      const appRate = appSuccesses / appEvents.length

      if (appRate < 0.8 && appEvents.length >= 10) {
        // Find which task types fail most
        const taskFailures = new Map<string, { total: number; failures: number }>()
        for (const ev of appEvents) {
          if (!ev.taskType) continue
          const entry = taskFailures.get(ev.taskType) ?? { total: 0, failures: 0 }
          entry.total++
          if (!ev.success) entry.failures++
          taskFailures.set(ev.taskType, entry)
        }
        const worstTask = Array.from(taskFailures.entries())
          .filter(([, v]) => v.total >= 3)
          .sort((a, b) => (b[1].failures / b[1].total) - (a[1].failures / a[1].total))[0]

        const detail = worstTask
          ? ` The "${worstTask[0]}" task type has the highest failure rate (${Math.round((worstTask[1].failures / worstTask[1].total) * 100)}%).`
          : ''

        insights.push({
          type: 'instruction_refinement',
          scope: 'app',
          appSlug: app,
          title: `App "${app}" has ${Math.round(appRate * 100)}% success rate`,
          description: `App "${app}" succeeds on only ${Math.round(appRate * 100)}% of ${appEvents.length} requests.${detail} Review app instructions and prompt templates for clarity.`,
          confidence: Math.min(appEvents.length / 20, 1),
          createdAt: now,
        })
      }
    }

    return insights
  } catch (err) {
    console.warn('[learning-engine] generateInsights failed:', err instanceof Error ? err.message : err)
    return insights
  }
}

// ── Learning Status ──────────────────────────────────────────────────

/**
 * Return the overall status of the learning engine.
 *
 * Counts are sourced directly from the database — nothing is estimated.
 * The statusLabel reflects the current data richness:
 *   - 'active'         — insights available, data flowing
 *   - 'collecting'     — data exists but not enough for insights
 *   - 'empty'          — no data recorded yet
 *   - 'not_configured' — database unreachable
 */
export async function getLearningStatus(): Promise<LearningStatus> {
  try {
    const [totalOutcomes, totalEvents, distinctProviders, distinctApps, latestEvent] = await Promise.all([
      prisma.memoryEntry.count({
        where: { memoryType: 'learned', key: 'route_outcome' },
      }),
      prisma.brainEvent.count(),
      prisma.brainEvent.findMany({
        where: { routedProvider: { not: null } },
        distinct: ['routedProvider'],
        select: { routedProvider: true },
      }),
      prisma.brainEvent.findMany({
        where: { appSlug: { not: '' } },
        distinct: ['appSlug'],
        select: { appSlug: true },
      }),
      prisma.brainEvent.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ])

    const providerCount = distinctProviders.length
    const appCount = distinctApps.length
    const totalData = totalOutcomes + totalEvents

    let statusLabel: LearningStatus['statusLabel']
    if (totalData === 0) {
      statusLabel = 'empty'
    } else if (totalEvents >= 10) {
      statusLabel = 'active'
    } else {
      statusLabel = 'collecting'
    }

    // Insights are generated on-the-fly, so count reflects current state
    const insights = totalEvents >= 5 ? await generateInsights() : []

    return {
      available: totalData > 0,
      totalOutcomesLogged: totalOutcomes,
      totalInsights: insights.length,
      providerCount,
      appCount,
      lastLearningRun: latestEvent?.timestamp ?? null,
      statusLabel,
    }
  } catch (err) {
    console.warn('[learning-engine] getLearningStatus failed:', err instanceof Error ? err.message : err)
    return {
      available: false,
      totalOutcomesLogged: 0,
      totalInsights: 0,
      providerCount: 0,
      appCount: 0,
      lastLearningRun: null,
      statusLabel: 'not_configured',
    }
  }
}

// ── Ecosystem Learning State ─────────────────────────────────────────

/**
 * Compute ecosystem-wide learning metrics.
 *
 * Aggregates across all apps and providers to give a bird's-eye view
 * of the network's learning progress. Used for the admin dashboard
 * and cross-app optimization decisions.
 */
export async function getEcosystemLearningState(): Promise<{
  totalApps: number
  totalOutcomes: number
  avgSuccessRate: number
  topProviders: ProviderPerformance[]
}> {
  try {
    const [distinctApps, totalOutcomes, events] = await Promise.all([
      prisma.brainEvent.findMany({
        where: { appSlug: { not: '' } },
        distinct: ['appSlug'],
        select: { appSlug: true },
      }),
      prisma.memoryEntry.count({
        where: { memoryType: 'learned', key: 'route_outcome' },
      }),
      prisma.brainEvent.findMany({
        select: { success: true },
      }),
    ])

    const totalApps = distinctApps.length
    const total = events.length
    const successes = events.filter((e) => e.success).length
    const avgSuccessRate = total > 0 ? successes / total : 0

    const topProviders = await getProviderPerformance()

    return {
      totalApps,
      totalOutcomes,
      avgSuccessRate,
      topProviders: topProviders.slice(0, 10),
    }
  } catch (err) {
    console.warn('[learning-engine] getEcosystemLearningState failed:', err instanceof Error ? err.message : err)
    return {
      totalApps: 0,
      totalOutcomes: 0,
      avgSuccessRate: 0,
      topProviders: [],
    }
  }
}
