import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getStorageStatus } from '@/lib/storage-driver'

/**
 * GET /api/admin/monitor/stats
 * Returns platform-wide stats for the Monitor page.
 * Includes: artifacts, brain events, workspace sessions, alerts,
 *           AI usage summary, storage info, and provider failures.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      artifactCount,
      brainEventCount,
      workspaceSessionCount,
      alertCount,
      recentBrainEvents,
      aiProviders,
      recentWorkspaceSessions,
      artifactStorageStats,
    ] = await Promise.all([
      prisma.artifact.count(),
      prisma.brainEvent.count(),
      prisma.workspaceSession.count(),
      prisma.systemAlert.count({ where: { resolved: false } }),
      // AI usage in last 30 days grouped by routed provider
      prisma.brainEvent.groupBy({
        by: ['routedProvider'],
        where: { timestamp: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }).catch(() => []),
      // Provider health snapshot
      prisma.aiProvider.findMany({
        select: { providerKey: true, displayName: true, healthStatus: true },
      }).catch(() => []),
      prisma.workspaceSession.count({ where: { createdAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
      prisma.artifact.aggregate({ _sum: { fileSizeBytes: true }, _count: { id: true } }).catch(() => null),
    ])

    // Summarise provider health
    type AiProviderRow = { providerKey: string; displayName: string; healthStatus: string }
    const providerFailures = (aiProviders as AiProviderRow[])
      .filter((p) => p.healthStatus === 'error' || p.healthStatus === 'degraded')
      .map((p) => ({ key: p.providerKey, name: p.displayName, status: p.healthStatus }))

    // Summarise AI usage by provider
    type BrainEventGroup = { routedProvider: string | null; _count: { id: number } }
    const aiUsageByProvider: Record<string, number> = {}
    for (const r of recentBrainEvents as BrainEventGroup[]) {
      const key = r.routedProvider ?? 'unknown'
      aiUsageByProvider[key] = (aiUsageByProvider[key] ?? 0) + r._count.id
    }
    const totalAiRequestsThisMonth = Object.values(aiUsageByProvider).reduce(
      (sum, n) => sum + n, 0
    )

    // Storage summary
    const storageStatus = getStorageStatus()
    type ArtifactAgg = { _sum: { fileSizeBytes: number | null }; _count: { id: number } } | null
    const storageTotalBytes = (artifactStorageStats as ArtifactAgg)?._sum?.fileSizeBytes ?? 0

    return NextResponse.json({
      artifactCount,
      brainEventCount,
      workspaceSessionCount,
      alertCount,
      aiUsage: {
        totalRequestsThisMonth: totalAiRequestsThisMonth,
        recentWorkspaceSessions,
        byProvider: aiUsageByProvider,
      },
      storage: {
        driver:             storageStatus.driver,
        configured:         storageStatus.configured,
        basePath:           storageStatus.basePath,
        totalArtifacts:     (artifactStorageStats as ArtifactAgg)?._count?.id ?? 0,
        totalStorageBytes:  storageTotalBytes,
        totalStorageMb:     Math.round(storageTotalBytes / (1024 * 1024) * 10) / 10,
      },
      providers: {
        failures:     providerFailures,
        failureCount: providerFailures.length,
        allProviders: (aiProviders as AiProviderRow[]).map((p) => ({
          key:    p.providerKey,
          name:   p.displayName,
          status: p.healthStatus,
        })),
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load stats' },
      { status: 500 },
    )
  }
}
