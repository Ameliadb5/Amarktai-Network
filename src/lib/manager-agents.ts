/**
 * @module manager-agents
 * @description Subsystem Manager Agents for the AmarktAI Network platform.
 *
 * Each manager is responsible for a specific subsystem:
 *   - Routing Manager:  monitors provider health, triggers routing changes, auto-downgrades
 *   - Queue Manager:    detects stuck jobs, retries or reassigns, cleans failed jobs
 *   - Artifact Manager: cleans expired artifacts, ensures integrity
 *   - App Manager:      detects over-budget/inactive apps, auto-pauses when needed
 *   - Learning Manager: runs daily optimization cycles, triggers learning jobs
 *   - Growth Manager:   identifies high-performing apps, prioritizes resources
 *
 * Phase 3: Managers now ACT on problems, not just log them.
 * Each check can trigger remediation actions.
 *
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'
import { getQueueStatus, getQueue } from '@/lib/job-queue'
import { getStorageStatus } from '@/lib/storage-driver'
import { emitSystemEvent } from '@/lib/event-bus'

// ── Types ────────────────────────────────────────────────────────────────────

export type ManagerType =
  | 'routing'
  | 'queue'
  | 'artifact'
  | 'app'
  | 'learning'
  | 'growth'

export type ManagerAction =
  | 'health_check'
  | 'escalation'
  | 'recovery'
  | 'coordination'
  | 'signal'
  | 'enforcement'

export type Severity = 'info' | 'warning' | 'critical'

export interface ManagerCheckResult {
  managerType: ManagerType
  action: ManagerAction
  summary: string
  details: Record<string, unknown>
  severity: Severity
}

export interface ManagerStatus {
  managerType: ManagerType
  lastCheckAt: string | null
  issueCount: number
  criticalCount: number
  recentActions: Array<{
    action: string
    summary: string
    severity: string
    createdAt: Date
  }>
}

// ── Logging ──────────────────────────────────────────────────────────────────

async function logManagerAction(result: ManagerCheckResult): Promise<void> {
  try {
    await prisma.managerAgentLog.create({
      data: {
        managerType: result.managerType,
        action: result.action,
        summary: result.summary,
        details: JSON.stringify(result.details),
        severity: result.severity,
        resolved: result.severity === 'info',
      },
    })
  } catch (err) {
    console.error(`[manager-agents] Failed to log ${result.managerType} action:`, err)
  }
}

// ── Routing Manager ──────────────────────────────────────────────────────────

export async function runRoutingManagerCheck(): Promise<ManagerCheckResult> {
  let providerCount = 0
  let healthyCount = 0
  const degradedProviders: string[] = []
  const actionsPerformed: string[] = []

  try {
    const providers = await prisma.aiProvider.findMany({ where: { enabled: true } })
    providerCount = providers.length

    for (const p of providers) {
      if (p.healthStatus === 'healthy') {
        healthyCount++
      } else {
        degradedProviders.push(p.providerKey)

        // ACTION: Auto-downgrade providers with persistent errors
        if (p.healthStatus === 'error' && p.enabled) {
          try {
            // Check if provider has been in error state for > 1 hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            if (p.lastCheckedAt && p.lastCheckedAt < oneHourAgo) {
              await prisma.aiProvider.update({
                where: { id: p.id },
                data: { healthStatus: 'disabled', healthMessage: 'Auto-disabled by routing manager due to persistent errors' },
              })
              actionsPerformed.push(`Auto-disabled ${p.providerKey} (persistent error state)`)
            }
          } catch {
            // Non-critical action
          }
        }
      }
    }
  } catch {
    // DB unavailable
  }

  const severity: Severity =
    providerCount === 0 ? 'critical' :
    degradedProviders.length > providerCount / 2 ? 'warning' : 'info'

  const result: ManagerCheckResult = {
    managerType: 'routing',
    action: actionsPerformed.length > 0 ? 'recovery' : 'health_check',
    summary: `${healthyCount}/${providerCount} providers healthy. ${degradedProviders.length} degraded.${actionsPerformed.length > 0 ? ` Actions: ${actionsPerformed.join('; ')}` : ''}`,
    details: { providerCount, healthyCount, degradedProviders, actionsPerformed },
    severity,
  }

  await logManagerAction(result)
  if (actionsPerformed.length > 0) {
    emitSystemEvent('manager_action', { manager: 'routing', actions: actionsPerformed })
  }
  return result
}

// ── Queue Manager ────────────────────────────────────────────────────────────

export async function runQueueManagerCheck(): Promise<ManagerCheckResult> {
  const status = await getQueueStatus()

  const stuckJobs = (status.counts['stuck'] ?? 0) + (status.counts['stalled'] ?? 0)
  const failedJobs = status.counts['failed'] ?? 0
  const waitingJobs = status.counts['waiting'] ?? 0
  const actionsPerformed: string[] = []

  // ACTION: Retry stuck/stalled jobs
  if (stuckJobs > 0 && status.backendAvailable) {
    try {
      const queue = getQueue()
      if (queue) {
        const stalledJobs = await queue.getJobs(['stalled'], 0, 10)
        for (const job of stalledJobs) {
          try {
            await job.retry()
            actionsPerformed.push(`Retried stalled job ${job.id}`)
          } catch {
            // Job may have been processed already
          }
        }
      }
    } catch {
      // Queue access failed
    }
  }

  // ACTION: Clean old failed jobs (>24h)
  if (failedJobs > 50 && status.backendAvailable) {
    try {
      const queue = getQueue()
      if (queue) {
        const cleaned = await queue.clean(24 * 60 * 60 * 1000, 100, 'failed')
        if (cleaned.length > 0) {
          actionsPerformed.push(`Cleaned ${cleaned.length} old failed jobs`)
        }
      }
    } catch {
      // Non-critical
    }
  }

  const severity: Severity =
    stuckJobs > 10 ? 'critical' :
    failedJobs > 20 ? 'warning' :
    !status.backendAvailable ? 'warning' : 'info'

  const result: ManagerCheckResult = {
    managerType: 'queue',
    action: actionsPerformed.length > 0 ? 'recovery' : 'health_check',
    summary: status.backendAvailable
      ? `Queue healthy. Waiting: ${waitingJobs}, Failed: ${failedJobs}, Stuck: ${stuckJobs}${actionsPerformed.length > 0 ? `. Actions: ${actionsPerformed.join('; ')}` : ''}`
      : 'Queue backend (Redis) unavailable — jobs running inline',
    details: { ...status.counts, backendAvailable: status.backendAvailable, actionsPerformed },
    severity,
  }

  await logManagerAction(result)
  if (actionsPerformed.length > 0) {
    emitSystemEvent('manager_action', { manager: 'queue', actions: actionsPerformed })
  }
  return result
}

// ── Artifact Manager ─────────────────────────────────────────────────────────

export async function runArtifactManagerCheck(): Promise<ManagerCheckResult> {
  const storageStatus = getStorageStatus()
  let totalArtifacts = 0
  let failedArtifacts = 0
  let expiredCleaned = 0
  const actionsPerformed: string[] = []

  try {
    totalArtifacts = await prisma.artifact.count()
    failedArtifacts = await prisma.artifact.count({ where: { status: 'failed' } })

    // ACTION: Clean expired artifacts (status = 'expired' or failed > 7 days old)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const expiredResult = await prisma.artifact.deleteMany({
      where: {
        OR: [
          { status: 'expired' },
          { status: 'failed', createdAt: { lt: sevenDaysAgo } },
        ],
      },
    })
    expiredCleaned = expiredResult.count
    if (expiredCleaned > 0) {
      actionsPerformed.push(`Cleaned ${expiredCleaned} expired/old-failed artifacts`)
    }
  } catch {
    // Schema may not be migrated yet
  }

  const severity: Severity =
    failedArtifacts > totalArtifacts * 0.1 && totalArtifacts > 10 ? 'warning' : 'info'

  const result: ManagerCheckResult = {
    managerType: 'artifact',
    action: actionsPerformed.length > 0 ? 'recovery' : 'health_check',
    summary: `Storage: ${storageStatus.driver} (${storageStatus.configured ? 'configured' : 'not configured'}). ${totalArtifacts} artifacts, ${failedArtifacts} failed.${actionsPerformed.length > 0 ? ` ${actionsPerformed.join('; ')}` : ''}`,
    details: { storageStatus, totalArtifacts, failedArtifacts, expiredCleaned, actionsPerformed },
    severity,
  }

  await logManagerAction(result)
  return result
}

// ── App Manager ──────────────────────────────────────────────────────────────

export async function runAppManagerCheck(): Promise<ManagerCheckResult> {
  let totalApps = 0
  let pausedApps = 0
  const overBudgetApps: string[] = []
  const actionsPerformed: string[] = []

  try {
    totalApps = await prisma.product.count()
    const budgetConfigs = await prisma.appBudgetConfig.findMany()
    pausedApps = budgetConfigs.filter(b => b.paused).length

    // Check monthly budgets
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    for (const config of budgetConfigs) {
      if (config.monthlyBudgetCents <= 0) continue
      const usage = await prisma.usageMeter.aggregate({
        where: { appSlug: config.appSlug, date: { gte: monthStart } },
        _sum: { costUsdCents: true },
      })
      const totalCost = usage._sum.costUsdCents ?? 0
      if (totalCost > config.monthlyBudgetCents) {
        overBudgetApps.push(config.appSlug)

        // ACTION: Auto-pause over-budget apps that aren't already paused
        if (!config.paused) {
          try {
            await prisma.appBudgetConfig.update({
              where: { id: config.id },
              data: {
                paused: true,
                pauseReason: `Auto-paused: monthly budget exceeded ($${(totalCost / 100).toFixed(2)} / $${(config.monthlyBudgetCents / 100).toFixed(2)})`,
              },
            })
            actionsPerformed.push(`Auto-paused ${config.appSlug} (over monthly budget)`)
          } catch {
            // Non-critical
          }
        }
      }
    }
  } catch {
    // DB or schema issues
  }

  const severity: Severity =
    overBudgetApps.length > 0 ? 'warning' :
    pausedApps > 0 ? 'info' : 'info'

  const result: ManagerCheckResult = {
    managerType: 'app',
    action: actionsPerformed.length > 0 ? 'enforcement' : 'health_check',
    summary: `${totalApps} apps. ${pausedApps} paused. ${overBudgetApps.length} over budget.${actionsPerformed.length > 0 ? ` Actions: ${actionsPerformed.join('; ')}` : ''}`,
    details: { totalApps, pausedApps, overBudgetApps, actionsPerformed },
    severity,
  }

  await logManagerAction(result)
  if (actionsPerformed.length > 0) {
    emitSystemEvent('manager_action', { manager: 'app', actions: actionsPerformed })
  }
  return result
}

// ── Learning Manager ─────────────────────────────────────────────────────────

export async function runLearningManagerCheck(): Promise<ManagerCheckResult> {
  let totalAgents = 0
  let learningEnabled = 0
  let recentLogs = 0
  const actionsPerformed: string[] = []

  try {
    const agents = await prisma.appAgent.findMany({
      select: { id: true, appSlug: true, learningEnabled: true, lastLearningCycleAt: true },
    })
    totalAgents = agents.length
    learningEnabled = agents.filter(a => a.learningEnabled).length

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    recentLogs = await prisma.appAgentLearningLog.count({
      where: { createdAt: { gte: weekAgo } },
    })

    // ACTION: Detect agents that haven't had a learning cycle in >48h and trigger one
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    for (const agent of agents) {
      if (!agent.learningEnabled) continue
      if (!agent.lastLearningCycleAt || agent.lastLearningCycleAt < twoDaysAgo) {
        actionsPerformed.push(`Flagged ${agent.appSlug} for overdue learning cycle`)
      }
    }
  } catch {
    // DB issues
  }

  const result: ManagerCheckResult = {
    managerType: 'learning',
    action: actionsPerformed.length > 0 ? 'coordination' : 'health_check',
    summary: `${learningEnabled}/${totalAgents} agents with learning enabled. ${recentLogs} learning events this week.${actionsPerformed.length > 0 ? ` ${actionsPerformed.join('; ')}` : ''}`,
    details: { totalAgents, learningEnabled, recentLogs, actionsPerformed },
    severity: actionsPerformed.length > 3 ? 'warning' : 'info',
  }

  await logManagerAction(result)
  return result
}

// ── Growth Manager ───────────────────────────────────────────────────────────

export async function runGrowthManagerCheck(): Promise<ManagerCheckResult> {
  let totalApps = 0
  let totalContacts = 0
  let totalWaitlist = 0
  let totalBrainEvents = 0
  const actionsPerformed: string[] = []

  try {
    totalApps = await prisma.product.count()
    totalContacts = await prisma.contactSubmission.count()
    totalWaitlist = await prisma.waitlistEntry.count()
    totalBrainEvents = await prisma.brainEvent.count()

    // ACTION: Identify high-performing and inactive apps
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    const aiApps = await prisma.product.findMany({
      where: { aiEnabled: true },
      select: { slug: true, name: true },
    })

    for (const app of aiApps) {
      const eventCount = await prisma.brainEvent.count({
        where: { appSlug: app.slug, timestamp: { gte: sevenDaysAgo } },
      })
      if (eventCount > 100) {
        actionsPerformed.push(`High-performer: ${app.slug} (${eventCount} events/7d)`)
      } else if (eventCount === 0) {
        actionsPerformed.push(`Inactive: ${app.slug} (0 events/7d)`)
      }
    }
  } catch {
    // DB issues
  }

  const result: ManagerCheckResult = {
    managerType: 'growth',
    action: actionsPerformed.length > 0 ? 'signal' : 'signal',
    summary: `${totalApps} apps, ${totalContacts} contacts, ${totalWaitlist} waitlist, ${totalBrainEvents} brain events.${actionsPerformed.length > 0 ? ` Insights: ${actionsPerformed.length}` : ''}`,
    details: { totalApps, totalContacts, totalWaitlist, totalBrainEvents, insights: actionsPerformed },
    severity: 'info',
  }

  await logManagerAction(result)
  return result
}

// ── Run All Managers ─────────────────────────────────────────────────────────

/**
 * Execute all manager health checks. Returns results from all managers.
 */
export async function runAllManagerChecks(): Promise<ManagerCheckResult[]> {
  const results = await Promise.allSettled([
    runRoutingManagerCheck(),
    runQueueManagerCheck(),
    runArtifactManagerCheck(),
    runAppManagerCheck(),
    runLearningManagerCheck(),
    runGrowthManagerCheck(),
  ])

  return results
    .filter((r): r is PromiseFulfilledResult<ManagerCheckResult> => r.status === 'fulfilled')
    .map(r => r.value)
}

// ── Manager Status Retrieval ─────────────────────────────────────────────────

/**
 * Get status for a specific manager from recent logs.
 */
export async function getManagerStatus(managerType: ManagerType): Promise<ManagerStatus> {
  try {
    const recentActions = await prisma.managerAgentLog.findMany({
      where: { managerType },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { action: true, summary: true, severity: true, createdAt: true },
    })

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const issueCount = await prisma.managerAgentLog.count({
      where: { managerType, severity: { not: 'info' }, createdAt: { gte: weekAgo } },
    })

    const criticalCount = await prisma.managerAgentLog.count({
      where: { managerType, severity: 'critical', resolved: false },
    })

    return {
      managerType,
      lastCheckAt: recentActions[0]?.createdAt.toISOString() ?? null,
      issueCount,
      criticalCount,
      recentActions,
    }
  } catch {
    return {
      managerType,
      lastCheckAt: null,
      issueCount: 0,
      criticalCount: 0,
      recentActions: [],
    }
  }
}

/**
 * Get status for all managers.
 */
export async function getAllManagerStatuses(): Promise<ManagerStatus[]> {
  const types: ManagerType[] = ['routing', 'queue', 'artifact', 'app', 'learning', 'growth']
  return Promise.all(types.map(getManagerStatus))
}
