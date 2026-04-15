/**
 * GET /api/system/health-deep — Deep system health diagnostics
 *
 * Returns comprehensive health status for all subsystems.
 * Requires admin auth. Not cacheable.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getQueueStatus, isJobQueueHealthy } from '@/lib/job-queue'
import { getStorageStatus } from '@/lib/storage-driver'
import { getAllProviderReliability } from '@/lib/provider-reliability'
import { getAllCircuitStatuses, getDeadLetterQueueSize } from '@/lib/circuit-breaker'
import { getAllManagerStatuses } from '@/lib/manager-agents'
import { getAlertSummary } from '@/lib/alert-engine'
import { getRedisClient } from '@/lib/redis'

export async function GET() {
  const session = await getSession()
  if (!session?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  // 1. Database health
  let dbStatus: 'ok' | 'error' = 'ok'
  let dbLatencyMs = 0
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - dbStart
  } catch {
    dbStatus = 'error'
  }

  // 2. Redis health
  let redisStatus: 'ok' | 'unavailable' | 'error' = 'unavailable'
  let redisLatencyMs = 0
  const redis = getRedisClient()
  if (redis) {
    try {
      const redisStart = Date.now()
      await redis.ping()
      redisLatencyMs = Date.now() - redisStart
      redisStatus = 'ok'
    } catch {
      redisStatus = 'error'
    }
  }

  // 3. Queue health
  const queueStatus = await getQueueStatus()
  const queueHealthy = await isJobQueueHealthy()

  // 4. Storage health
  const storageStatus = getStorageStatus()

  // 5. Provider reliability matrix
  const providerReliability = getAllProviderReliability()

  // 6. Circuit breaker states
  const circuitBreakers = getAllCircuitStatuses()

  // 7. Dead letter queue
  const dlqSize = getDeadLetterQueueSize()

  // 8. Manager agent statuses
  let managerStatuses: Awaited<ReturnType<typeof getAllManagerStatuses>> = []
  try {
    managerStatuses = await getAllManagerStatuses()
  } catch {
    // Managers may not be initialized
  }

  // 9. Alert summary
  let alertSummary = { total: 0, unresolved: 0, critical: 0, warning: 0, info: 0 }
  try {
    alertSummary = await getAlertSummary()
  } catch {
    // DB may not have alerts table yet
  }

  // 10. Counts summary
  let counts = { providers: 0, apps: 0, artifacts: 0, brainEvents: 0, agents: 0 }
  try {
    const [providers, apps, artifacts, brainEvents, agents] = await Promise.all([
      prisma.aiProvider.count({ where: { enabled: true } }),
      prisma.product.count(),
      prisma.artifact.count().catch(() => 0),
      prisma.brainEvent.count().catch(() => 0),
      prisma.appAgent.count().catch(() => 0),
    ])
    counts = { providers, apps, artifacts, brainEvents, agents }
  } catch {
    // partial counts ok
  }

  // 11. Memory usage
  const memUsage = process.memoryUsage()

  // Calculate overall health score
  let healthScore = 100
  if (dbStatus === 'error') healthScore -= 40
  if (redisStatus === 'error') healthScore -= 15
  if (redisStatus === 'unavailable') healthScore -= 5
  if (!queueHealthy) healthScore -= 10
  if (alertSummary.critical > 0) healthScore -= alertSummary.critical * 5
  if (alertSummary.warning > 0) healthScore -= alertSummary.warning * 2
  if (dlqSize > 10) healthScore -= 5
  healthScore = Math.max(0, Math.min(100, healthScore))

  const overallStatus = healthScore >= 80 ? 'healthy' :
    healthScore >= 50 ? 'degraded' : 'critical'

  return NextResponse.json(
    {
      status: overallStatus,
      healthScore,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - start,
      subsystems: {
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
        queue: {
          healthy: queueHealthy,
          backendAvailable: queueStatus.backendAvailable,
          counts: queueStatus.counts,
          deadLetterQueueSize: dlqSize,
        },
        storage: storageStatus,
      },
      providers: {
        total: counts.providers,
        reliability: providerReliability,
        circuitBreakers,
      },
      managers: managerStatuses,
      alerts: alertSummary,
      counts,
      memory: {
        rssBytes: memUsage.rss,
        heapUsedBytes: memUsage.heapUsed,
        heapTotalBytes: memUsage.heapTotal,
        externalBytes: memUsage.external,
      },
    },
    {
      status: overallStatus === 'critical' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    },
  )
}
