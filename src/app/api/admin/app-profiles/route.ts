import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAppProfile, DEFAULT_APP_PROFILES } from '@/lib/app-profiles'

/**
 * GET /api/admin/app-profiles — returns all app profiles or a specific one.
 *
 * Query params:
 *   appSlug (optional — get profile for a specific app)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const appSlug = searchParams.get('appSlug')

  if (appSlug) {
    const profile = getAppProfile(appSlug)
    return NextResponse.json({ profile })
  }

  // Return all profiles
  const profiles = Object.fromEntries(DEFAULT_APP_PROFILES)
  return NextResponse.json({ profiles, total: DEFAULT_APP_PROFILES.size })
}
