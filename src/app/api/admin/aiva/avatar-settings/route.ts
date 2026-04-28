import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const SETTING_KEY = 'aiva_avatar_config'

/**
 * GET /api/admin/aiva/avatar-settings
 *
 * Returns the saved Aiva avatar artifact URLs per state.
 * Shape: { idle, listening, thinking, speaking, error } — each a URL string or null.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } })
    if (!row) {
      return NextResponse.json({ avatarUrls: null })
    }
    const avatarUrls = JSON.parse(row.value) as Record<string, string | null>
    return NextResponse.json({ avatarUrls })
  } catch {
    return NextResponse.json({ avatarUrls: null })
  }
}

/**
 * POST /api/admin/aiva/avatar-settings
 *
 * Saves Aiva avatar URLs.  Accepts partial updates — only provided keys are merged.
 *
 * Body: { state: string, url: string } for a single state
 *       OR { avatarUrls: Record<string, string> } for bulk update
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    // Load existing config
    let existing: Record<string, string | null> = {
      idle: null, listening: null, thinking: null, speaking: null, error: null,
    }
    const row = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null)
    if (row) {
      try { existing = JSON.parse(row.value) } catch { /* keep defaults */ }
    }

    // Merge in new values
    if (typeof body.state === 'string' && typeof body.url === 'string') {
      existing[body.state] = body.url
    } else if (typeof body.avatarUrls === 'object' && body.avatarUrls !== null) {
      const urls = body.avatarUrls as Record<string, string | null>
      for (const [state, url] of Object.entries(urls)) {
        existing[state] = url
      }
    } else {
      return NextResponse.json({ error: 'Provide { state, url } or { avatarUrls }' }, { status: 400 })
    }

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(existing) },
      create: { key: SETTING_KEY, value: JSON.stringify(existing) },
    })

    return NextResponse.json({ success: true, avatarUrls: existing })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}
