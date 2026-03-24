import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

/**
 * GET /api/admin/brain/events
 *
 * Returns the 50 most recent brain events for the admin dashboard.
 * Requires active admin session.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [events, totalRequests, successCount, errorCount] = await Promise.all([
    prisma.brainEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        traceId: true,
        appSlug: true,
        taskType: true,
        routedProvider: true,
        routedModel: true,
        success: true,
        errorMessage: true,
        latencyMs: true,
        timestamp: true,
      },
    }),
    prisma.brainEvent.count(),
    prisma.brainEvent.count({ where: { success: true } }),
    prisma.brainEvent.count({ where: { success: false } }),
  ])

  const avgLatencyResult = await prisma.brainEvent.aggregate({
    _avg: { latencyMs: true },
    where: { latencyMs: { not: null } },
  })

  return NextResponse.json({
    events,
    stats: {
      totalRequests,
      successCount,
      errorCount,
      avgLatencyMs: avgLatencyResult._avg.latencyMs
        ? Math.round(avgLatencyResult._avg.latencyMs)
        : null,
    },
  })
}
