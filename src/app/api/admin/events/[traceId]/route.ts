import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { safeParseJson } from '@/lib/utils'

/**
 * GET /api/admin/events/[traceId]
 *
 * Returns the full execution trace for a single brain request by traceId.
 * Requires active admin session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { traceId } = await params

  const event = await prisma.brainEvent.findFirst({
    where: { traceId },
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
  })

  if (!event) {
    return NextResponse.json({ error: 'Trace not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...event,
    classification: safeParseJson<Record<string, unknown>>(event.classificationJson, {}),
    warnings: safeParseJson<string[]>(event.warningsJson, []),
    classificationJson: undefined,
    warningsJson: undefined,
  })
}
