import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  getAppProfile,
  DEFAULT_APP_PROFILES,
  runtimeProfileOverrides,
  type AppProfile,
} from '@/lib/app-profiles'

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
    // Return both in-memory routing profile AND DB-backed AI profile
    const profile = getAppProfile(appSlug)
    let dbProfile = null
    try {
      dbProfile = await prisma.appAiProfile.findUnique({ where: { appSlug } })
    } catch {
      // DB unavailable — return in-memory only
    }
    return NextResponse.json({ profile: dbProfile ?? profile })
  }

  // Merge defaults + runtime overrides
  const merged = new Map(DEFAULT_APP_PROFILES)
  for (const [k, v] of runtimeProfileOverrides) {
    merged.set(k, v)
  }
  const profiles = Object.fromEntries(merged)
  return NextResponse.json({ profiles, total: merged.size })
}

/**
 * POST /api/admin/app-profiles — create or update an app profile.
 *
 * Supports two modes:
 *   1. action='upsert' — simple DB upsert of AppAiProfile fields
 *   2. Full AppProfile JSON — legacy in-memory override
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // ── DB-backed upsert mode ────────────────────────────────────────
    if (body.action === 'upsert' && body.appSlug) {
      const data: Record<string, unknown> = {}
      const allowedFields = [
        'routingStrategy', 'basePersonality', 'emotionContextWindow',
        'allowedProviders', 'preferredModels', 'costMode',
        'budgetSensitivity', 'latencySensitivity', 'allowedModels',
        'fallbackChain', 'enabledCapabilities', 'enabledAgents',
        'safeMode', 'adultMode', 'suggestiveMode',
      ]
      for (const field of allowedFields) {
        if (body[field] !== undefined) data[field] = body[field]
      }

      const result = await prisma.appAiProfile.upsert({
        where: { appSlug: body.appSlug },
        update: data,
        create: {
          appSlug: body.appSlug,
          appName: body.appName ?? body.appSlug,
          ...data,
        },
      })
      return NextResponse.json({ success: true, profile: result })
    }

    // ── Legacy in-memory profile mode ────────────────────────────────
    const profile = body as AppProfile

    if (!profile.app_id || !profile.app_name) {
      return NextResponse.json(
        { error: 'app_id and app_name are required' },
        { status: 400 },
      )
    }

    // Validate required fields
    const requiredStrings: (keyof AppProfile)[] = [
      'app_id',
      'app_name',
      'app_type',
      'domain',
      'default_routing_mode',
      'memory_namespace',
      'retrieval_namespace',
    ]
    for (const field of requiredStrings) {
      if (typeof profile[field] !== 'string' || !(profile[field] as string).trim()) {
        return NextResponse.json(
          { error: `${field} is required and must be a non-empty string` },
          { status: 400 },
        )
      }
    }

    // Store in runtime overrides (these persist for the server process lifetime)
    runtimeProfileOverrides.set(profile.app_id, profile)

    return NextResponse.json({
      success: true,
      profile,
      message: `Profile "${profile.app_id}" saved successfully`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: String(err) },
      { status: 400 },
    )
  }
}

/**
 * DELETE /api/admin/app-profiles — remove a runtime app profile override.
 *
 * Query params:
 *   appSlug — the profile to delete
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const appSlug = searchParams.get('appSlug')

  if (!appSlug) {
    return NextResponse.json(
      { error: 'appSlug query parameter is required' },
      { status: 400 },
    )
  }

  const existed = runtimeProfileOverrides.delete(appSlug)

  return NextResponse.json({
    success: true,
    deleted: existed,
    message: existed
      ? `Profile "${appSlug}" removed`
      : `Profile "${appSlug}" was not in runtime overrides`,
  })
}
