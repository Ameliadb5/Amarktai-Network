import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAppSafetyConfig, setAppSafetyConfig } from '@/lib/content-filter'

/**
 * GET /api/admin/app-safety?appSlug=<slug> — returns safety config for an app.
 * POST /api/admin/app-safety — update safety config (adult mode toggle, safe mode, suggestive mode).
 *
 * Safety mode enforcement rules:
 *  1. Adult mode and suggestive mode can ONLY be enabled when safe mode is explicitly disabled.
 *  2. CSAM / violence / self-harm are ALWAYS blocked regardless of mode.
 *  3. Only lawful adult 18+ content is allowed. NEVER minors. NEVER illegal.
 *  4. Suggestive mode allows lingerie, swimwear, fashion poses, topless nudity — no explicit sex acts or genitalia.
 */
export async function GET(request: NextRequest) {
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

  const config = getAppSafetyConfig(appSlug)
  return NextResponse.json({
    appSlug,
    safeMode: config.safeMode,
    adultMode: config.adultMode,
    suggestiveMode: config.suggestiveMode,
    note: 'CSAM, violence, and self-harm content is ALWAYS blocked regardless of adult mode setting.',
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { appSlug?: string; safeMode?: boolean; adultMode?: boolean; suggestiveMode?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { appSlug, safeMode, adultMode, suggestiveMode } = body

  if (!appSlug || typeof appSlug !== 'string') {
    return NextResponse.json(
      { error: 'appSlug is required' },
      { status: 400 },
    )
  }

  // Enforce: adult mode requires safe mode OFF
  if (adultMode === true && safeMode !== false) {
    const currentConfig = getAppSafetyConfig(appSlug)
    if (currentConfig.safeMode) {
      return NextResponse.json(
        {
          error: 'Adult mode requires safe mode to be disabled first. Set safeMode=false before enabling adultMode.',
          currentConfig,
        },
        { status: 400 },
      )
    }
  }

  // Enforce: suggestive mode requires safe mode OFF
  if (suggestiveMode === true && safeMode !== false) {
    const currentConfig = getAppSafetyConfig(appSlug)
    if (currentConfig.safeMode) {
      return NextResponse.json(
        {
          error: 'Suggestive mode requires safe mode to be disabled first. Set safeMode=false before enabling suggestiveMode.',
          currentConfig,
        },
        { status: 400 },
      )
    }
  }

  const updated = setAppSafetyConfig(appSlug, {
    ...(typeof safeMode === 'boolean' ? { safeMode } : {}),
    ...(typeof adultMode === 'boolean' ? { adultMode } : {}),
    ...(typeof suggestiveMode === 'boolean' ? { suggestiveMode } : {}),
  })

  return NextResponse.json({
    appSlug,
    safeMode: updated.safeMode,
    adultMode: updated.adultMode,
    suggestiveMode: updated.suggestiveMode,
    note: 'CSAM, violence, and self-harm content is ALWAYS blocked regardless of adult mode setting.',
  })
}
