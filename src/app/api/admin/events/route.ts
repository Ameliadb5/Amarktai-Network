import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { safeParseJson } from '@/lib/utils'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'

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

  const cfg = validateConfig()
  if (!cfg.valid) return NextResponse.json({ ...configErrorResponse(cfg), events: [], total: 0 }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
  const appSlug = searchParams.get('appSlug') ?? undefined
  const executionMode = searchParams.get('executionMode') ?? undefined

  const where = {
    ...(appSlug ? { appSlug } : {}),
    ...(executionMode ? { executionMode } : {}),
  }

  try {
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
    eventSource: 'brain' as const,
    classification: safeParseJson<Record<string, unknown>>(e.classificationJson, {}),
    warnings: safeParseJson<string[]>(e.warningsJson, []),
    classificationJson: undefined,
    warningsJson: undefined,
  }))

  // Optionally include AppEvents for unified view
  const includeApp = searchParams.get('includeAppEvents') === 'true'
  let appEvents: Array<Record<string, unknown>> = []
  if (includeApp) {
    try {
      const rawAppEvents = await prisma.appEvent.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: { product: { select: { name: true, slug: true } } },
      })
      appEvents = rawAppEvents.map(e => ({
        id: e.id,
        eventSource: 'app' as const,
        appSlug: e.product?.slug ?? `product-${e.productId}`,
        appName: e.product?.name ?? '',
        eventType: e.eventType,
        severity: e.severity,
        title: e.title,
        message: e.message,
        timestamp: e.timestamp,
        success: e.severity !== 'error' && e.severity !== 'critical',
      }))
    } catch {
      // AppEvent table may not exist or be empty — no-op
    }
  }

  return NextResponse.json({
    events: enriched,
    appEvents: includeApp ? appEvents : undefined,
    total,
    limit,
  })
  } catch (error) {
    const { category, message } = classifyDbError(error)
    return NextResponse.json({ events: [], total: 0, limit, error: message, category }, { status: category === 'config_invalid' ? 503 : 500 })
  }
}
