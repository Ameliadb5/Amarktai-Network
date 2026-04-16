import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { safeParseJson } from '@/lib/utils'

/**
 * GET /api/admin/brain/events
 *
 * Returns the 50 most recent brain events with full trace data for the admin dashboard.
 * Requires active admin session.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [events, totalRequests, successCount, errorCount] = await Promise.all([
      prisma.brainEvent.findMany({
        orderBy: { timestamp: 'desc' },
        take: 50,
        select: {
          id: true,
          traceId: true,
          appSlug: true,
          taskType: true,
          executionMode: true,
          classificationJson: true,
          routedProvider: true,
          routedModel: true,
          validationUsed: true,
          consensusUsed: true,
          confidenceScore: true,
          success: true,
          errorMessage: true,
          warningsJson: true,
          latencyMs: true,
          timestamp: true,
        },
      }),
      prisma.brainEvent.count(),
      prisma.brainEvent.count({ where: { success: true } }),
      prisma.brainEvent.count({ where: { success: false } }),
    ])

    const avgLatencyResult = await prisma.brainEvent.aggregate({
      _avg: { latencyMs: true, confidenceScore: true },
      where: { latencyMs: { not: null } },
    })

    const enrichedEvents = events.map(e => ({
      ...e,
      classification: safeParseJson<Record<string, unknown>>(e.classificationJson, {}),
      warnings: safeParseJson<string[]>(e.warningsJson, []),
      classificationJson: undefined,
      warningsJson: undefined,
    }))

    return NextResponse.json({
      events: enrichedEvents,
      stats: {
        totalRequests,
        successCount,
        errorCount,
        avgLatencyMs: avgLatencyResult._avg.latencyMs
          ? Math.round(avgLatencyResult._avg.latencyMs)
          : null,
        avgConfidenceScore: avgLatencyResult._avg.confidenceScore
          ? Math.round(avgLatencyResult._avg.confidenceScore * 100) / 100
          : null,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load brain events', code: 'EVENTS_LOAD_ERROR' },
      { status: 500 },
    )
  }
}

