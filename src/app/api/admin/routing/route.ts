import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { routeRequest, type RoutingContext } from '@/lib/routing-engine'

/**
 * POST /api/admin/routing — test the routing engine with a given context.
 *
 * Body:
 *   appSlug: string
 *   appCategory: string
 *   taskType: string
 *   taskComplexity: 'simple' | 'moderate' | 'complex'
 *   message: string
 *   requiresRetrieval?: boolean
 *   requiresMultimodal?: boolean
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as Partial<RoutingContext>

    if (!body.appSlug || !body.taskType || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: appSlug, taskType, message' },
        { status: 422 },
      )
    }

    const context: RoutingContext = {
      appSlug: body.appSlug,
      appCategory: body.appCategory ?? 'generic',
      taskType: body.taskType,
      taskComplexity: body.taskComplexity ?? 'moderate',
      message: body.message,
      requiresRetrieval: body.requiresRetrieval ?? false,
      requiresMultimodal: body.requiresMultimodal ?? false,
      preferredProvider: body.preferredProvider,
      maxCostTier: body.maxCostTier,
      maxLatencyTier: body.maxLatencyTier,
    }

    const decision = routeRequest(context)
    return NextResponse.json({ context, decision })
  } catch (err) {
    console.error('[routing] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to compute routing decision' },
      { status: 500 },
    )
  }
}
