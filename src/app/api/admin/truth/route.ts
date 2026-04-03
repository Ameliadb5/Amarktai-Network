import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getProviderTruth,
  getCapabilityTruth,
  getModelTruth,
  getDashboardSummary,
} from '@/lib/dashboard-truth'

/**
 * GET /api/admin/truth — returns unified dashboard truth state.
 *
 * This is the single source of truth for all dashboard pages.
 * Query params:
 *   section (optional): 'providers' | 'capabilities' | 'models' | 'summary' | 'all'
 *   appSlug (optional): scope capabilities to a specific app
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section') || 'all'
  const appSlug = searchParams.get('appSlug') || undefined

  try {
    const result: Record<string, unknown> = {}

    if (section === 'all' || section === 'summary') {
      result.summary = await getDashboardSummary()
    }
    if (section === 'all' || section === 'providers') {
      result.providers = await getProviderTruth()
    }
    if (section === 'all' || section === 'capabilities') {
      result.capabilities = await getCapabilityTruth(appSlug)
    }
    if (section === 'all' || section === 'models') {
      result.models = getModelTruth()
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[truth] Error computing dashboard truth:', error)
    return NextResponse.json(
      { error: 'Failed to compute dashboard truth' },
      { status: 500 },
    )
  }
}
