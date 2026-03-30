import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getAppStrategy,
  initializeStrategy,
  updateKpis,
  generateRecommendations,
  addGoal,
  removeGoal,
  setStrategyState,
  getStrategySummary,
  getAllStrategies,
} from '@/lib/strategy-engine'

/**
 * GET /api/admin/strategy?app=slug
 *
 * Returns strategy for a specific app (if ?app=slug provided)
 * or a summary of all strategies.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const appSlug = searchParams.get('app')

  if (appSlug) {
    const strategy = getAppStrategy(appSlug)
    if (!strategy) {
      return NextResponse.json({ error: 'No strategy configured for this app', appSlug }, { status: 404 })
    }
    return NextResponse.json(strategy)
  }

  return NextResponse.json({
    summary: getStrategySummary(),
    strategies: getAllStrategies(),
  })
}

/**
 * POST /api/admin/strategy
 *
 * Actions: initialize, updateKpis, addGoal, removeGoal, generateRecommendations, setState
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'initialize': {
        const { appSlug, appName, appType } = body
        if (!appSlug || !appName) {
          return NextResponse.json({ error: 'appSlug and appName are required' }, { status: 400 })
        }
        const strategy = initializeStrategy(appSlug, appName, appType ?? 'general')
        return NextResponse.json(strategy, { status: 201 })
      }

      case 'updateKpis': {
        const { appSlug, kpis } = body
        if (!appSlug || !kpis) {
          return NextResponse.json({ error: 'appSlug and kpis are required' }, { status: 400 })
        }
        const strategy = updateKpis(appSlug, kpis)
        if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
        return NextResponse.json(strategy)
      }

      case 'addGoal': {
        const { appSlug, goal } = body
        if (!appSlug || !goal) {
          return NextResponse.json({ error: 'appSlug and goal are required' }, { status: 400 })
        }
        const strategy = addGoal(appSlug, goal)
        if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
        return NextResponse.json(strategy)
      }

      case 'removeGoal': {
        const { appSlug, goalId } = body
        if (!appSlug || !goalId) {
          return NextResponse.json({ error: 'appSlug and goalId are required' }, { status: 400 })
        }
        const removed = removeGoal(appSlug, goalId)
        if (!removed) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
        return NextResponse.json({ success: true })
      }

      case 'generateRecommendations': {
        const { appSlug, outcomeData } = body
        if (!appSlug) {
          return NextResponse.json({ error: 'appSlug is required' }, { status: 400 })
        }
        const recs = generateRecommendations(appSlug, outcomeData)
        return NextResponse.json({ recommendations: recs })
      }

      case 'setState': {
        const { appSlug, state } = body
        if (!appSlug || !state) {
          return NextResponse.json({ error: 'appSlug and state are required' }, { status: 400 })
        }
        const ok = setStrategyState(appSlug, state)
        if (!ok) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[strategy] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
