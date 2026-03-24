import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { safeParseJson } from '@/lib/utils'

/**
 * GET /api/admin/events
 *
 * Returns paginated brain execution trace events for admin observability.
 * Supports query params: limit (default 50, max 200), appSlug, executionMode.
 * Requires active admin session.
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
  const appSlug = searchParams.get('appSlug') ?? undefined
  const executionMode = searchParams.get('executionMode') ?? undefined

  const where = {
    ...(appSlug ? { appSlug } : {}),
    ...(executionMode ? { executionMode } : {}),
  }

  const [events, total] = await Promise.all([
    prisma.brainEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
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
    prisma.brainEvent.count({ where }),
  ])

  const enriched = events.map(e => ({
    ...e,
    classification: safeParseJson<Record<string, unknown>>(e.classificationJson, {}),
    warnings: safeParseJson<string[]>(e.warningsJson, []),
    classificationJson: undefined,
    warningsJson: undefined,
  }))

  return NextResponse.json({ events: enriched, total, limit })
}
