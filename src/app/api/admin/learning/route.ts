import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  getLearningStatus,
  getProviderPerformance,
  generateInsights,
  getEcosystemLearningState,
} from '@/lib/learning-engine'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'

/**
 * GET /api/admin/learning
 *
 * Returns paginated memory entries + learning engine status.
 * Query params:
 *   page    (default 1)
 *   limit   (default 20, max 100)
 *   type    (optional — filter by memoryType)
 *   app     (optional — filter by appSlug)
 *   view    (optional — 'status' | 'insights' | 'performance' | 'ecosystem')
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = validateConfig()
  if (!cfg.valid) {
    return NextResponse.json({ ...configErrorResponse(cfg), entries: [], total: 0, page: 1, limit: 20, totalPages: 0 }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view')

  // Specialised views from the learning engine
  if (view === 'status') {
    const status = await getLearningStatus()
    return NextResponse.json(status)
  }
  if (view === 'insights') {
    const insights = await generateInsights()
    return NextResponse.json({ insights })
  }
  if (view === 'performance') {
    const provider = searchParams.get('provider') ?? undefined
    const performance = await getProviderPerformance(provider)
    return NextResponse.json({ performance })
  }
  if (view === 'ecosystem') {
    const ecosystem = await getEcosystemLearningState()
    return NextResponse.json(ecosystem)
  }

  // Default: paginated memory entries (backwards-compatible)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const type  = searchParams.get('type') ?? undefined
  const app   = searchParams.get('app')  ?? undefined

  try {
    const where = {
      ...(type ? { memoryType: type } : {}),
      ...(app  ? { appSlug: app } : {}),
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    }

    const [total, entries] = await Promise.all([
      prisma.memoryEntry.count({ where }),
      prisma.memoryEntry.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          appSlug: true,
          memoryType: true,
          key: true,
          content: true,
          importance: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ])

    return NextResponse.json({
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    const { category, message } = classifyDbError(err)
    console.error('[learning] GET error:', category, message)
    return NextResponse.json({
      entries: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      error: message,
      category,
    })
  }
}
