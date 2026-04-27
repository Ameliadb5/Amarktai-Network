/**
 * GET /api/admin/monitor
 *
 * Aggregated monitoring endpoint — Phase 3F.
 *
 * Returns:
 *   - webdockServer: CPU/RAM/disk/network from Webdock metrics-now (if configured)
 *   - apps: per-app health, uptime, request count, error count, last heartbeat
 *   - artifacts: storage counts by type
 *   - db: basic DB health check (ping + row counts)
 *   - deployments: recent deploy log status
 *   - recommendation: OK | upgrade_vps | investigate_errors | storage_risk | move_app
 *
 * Query params:
 *   webdockSlug — optional server slug override (default: deploy_defaults.defaultWebdockSlug)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getWebdockMetricsNow, listWebdockServers } from '@/lib/webdock-client'

async function getWebdockToken(): Promise<string | null> {
  // The webdock-client resolves its own token from DB/env automatically.
  // This stub exists only for the server slug lookup flow below.
  return null
}

async function getDefaultWebdockSlug(): Promise<string> {
  const row = await prisma.integrationConfig.findUnique({ where: { key: 'deploy_defaults' } }).catch(() => null)
  if (!row?.notes) return ''
  try { return (JSON.parse(row.notes) as { defaultWebdockSlug?: string }).defaultWebdockSlug ?? '' } catch { return '' }
}

function buildRecommendation(data: {
  cpuPercent?: number
  ramPercent?: number
  diskPercent?: number
  errorApps: number
  totalApps: number
  artifactCount: number
}): string {
  if (data.diskPercent !== undefined && data.diskPercent > 85) return 'storage_risk'
  if (data.cpuPercent !== undefined && data.cpuPercent > 85) return 'upgrade_vps'
  if (data.ramPercent !== undefined && data.ramPercent > 85) return 'upgrade_vps'
  if (data.errorApps > 0 && data.totalApps > 0 && data.errorApps / data.totalApps > 0.5) return 'investigate_errors'
  if (data.artifactCount > 10000) return 'storage_risk'
  return 'ok'
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const slugOverride = searchParams.get('webdockSlug') ?? ''

  const [, defaultSlug] = await Promise.all([
    getWebdockToken(),
    getDefaultWebdockSlug(),
  ])

  const serverSlug = slugOverride || defaultSlug

  // Parallel data collection
  const [
    appsData,
    artifactCounts,
    recentDeploys,
    webdockMetricsResult,
    brainEvents7d,
  ] = await Promise.allSettled([

    // Apps health
    prisma.product.findMany({
      where: { monitoringEnabled: true },
      select: {
        id: true, name: true, slug: true, status: true,
        integration: {
          select: {
            healthStatus: true, lastHeartbeatAt: true, uptime: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    }),

    // Artifact counts by type
    prisma.artifact.groupBy({
      by: ['type'],
      _count: { id: true },
    }),

    // Recent deploy logs
    prisma.appDeployLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true, appSlug: true, status: true, deployMethod: true,
        branch: true, startedAt: true, completedAt: true, durationMs: true,
      },
    }),

    // Webdock metrics
    (async () => {
      if (!serverSlug) return null
      const result = await getWebdockMetricsNow(serverSlug)
      return result.success ? result.data : null
    })(),

    // Brain events (last 7d) for error rate
    prisma.brainEvent.groupBy({
      by: ['success'],
      where: { timestamp: { gte: new Date(Date.now() - 7 * 86400_000) } },
      _count: { id: true },
    }),
  ])

  const apps = appsData.status === 'fulfilled' ? appsData.value : []
  const artifacts = artifactCounts.status === 'fulfilled' ? artifactCounts.value : []
  const deploys = recentDeploys.status === 'fulfilled' ? recentDeploys.value : []
  const webdockMetrics = webdockMetricsResult.status === 'fulfilled' ? webdockMetricsResult.value : null
  const brainEvts = brainEvents7d.status === 'fulfilled' ? brainEvents7d.value : []

  // Process apps
  const processedApps = apps.map(app => {
    const health = app.integration?.healthStatus ?? 'unknown'
    const lastBeat = app.integration?.lastHeartbeatAt
    const stale = lastBeat ? Date.now() - new Date(lastBeat).getTime() > 5 * 60_000 : true
    return {
      slug: app.slug,
      name: app.name,
      status: app.status,
      health,
      uptime: app.integration?.uptime ?? null,
      lastHeartbeatAt: lastBeat?.toISOString() ?? null,
      stale,
    }
  })

  const errorApps = processedApps.filter(a => a.health === 'error' || a.health === 'degraded').length

  // Process artifact counts
  const artifactByType: Record<string, number> = {}
  let totalArtifacts = 0
  for (const row of artifacts) {
    artifactByType[row.type] = row._count.id
    totalArtifacts += row._count.id
  }

  // Brain event success/error counts
  let totalBrainSuccess = 0
  let totalBrainError = 0
  for (const row of brainEvts) {
    if (row.success) totalBrainSuccess += row._count.id
    else totalBrainError += row._count.id
  }
  const totalBrainRequests = totalBrainSuccess + totalBrainError
  const successRate7d = totalBrainRequests > 0
    ? Math.round((totalBrainSuccess / totalBrainRequests) * 1000) / 10
    : null

  // Webdock server metrics
  type MetricEntry = { values: Array<{ value: number }> }
  type MetricsData = { cpu?: MetricEntry; ram?: MetricEntry; disk?: MetricEntry }
  const metrics = webdockMetrics as MetricsData | null
  const cpuPercent = metrics?.cpu?.values?.[0]?.value ?? null
  const ramPercent = metrics?.ram?.values?.[0]?.value ?? null
  const diskPercent = metrics?.disk?.values?.[0]?.value ?? null

  const recommendation = buildRecommendation({
    cpuPercent: cpuPercent ?? undefined,
    ramPercent: ramPercent ?? undefined,
    diskPercent: diskPercent ?? undefined,
    errorApps,
    totalApps: processedApps.length,
    artifactCount: totalArtifacts,
  })

  // DB health ping
  let dbHealthy = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbHealthy = true
  } catch { /* ignore */ }

  // Check if Webdock is configured (has a token in DB)
  const webdockConfigured = await prisma.integrationConfig.findUnique({ where: { key: 'webdock' } })
    .then(r => !!(r?.apiKey))
    .catch(() => false)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    webdockServer: serverSlug
      ? {
          slug: serverSlug,
          configured: webdockConfigured,
          cpuPercent,
          ramPercent,
          diskPercent,
          metricsAvailable: !!webdockMetrics,
          error: webdockMetricsResult.status === 'rejected'
            ? (webdockMetricsResult.reason instanceof Error ? webdockMetricsResult.reason.message : 'Metrics unavailable')
            : null,
        }
      : { slug: null, configured: false, message: 'No Webdock server configured in Deploy Defaults' },
    apps: processedApps,
    brain: {
      requests7d: totalBrainRequests,
      successRate7d,
      errorCount7d: totalBrainError,
    },
    artifacts: {
      total: totalArtifacts,
      byType: artifactByType,
    },
    db: {
      healthy: dbHealthy,
    },
    recentDeploys: deploys,
    recommendation,
    recommendationText: {
      ok:                 'System health looks good.',
      upgrade_vps:        'Server resources are under heavy load. Consider upgrading your VPS.',
      investigate_errors: 'Multiple apps are reporting errors. Investigate affected apps.',
      storage_risk:       'Storage usage is high. Review and clean up artifacts.',
      move_app:           'Consider moving high-traffic apps to their own VPS.',
    }[recommendation] ?? 'Status unknown.',
  })
}
