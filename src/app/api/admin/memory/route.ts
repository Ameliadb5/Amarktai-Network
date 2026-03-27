import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getMemoryStatus } from '@/lib/memory'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'

/** GET /api/admin/memory — returns current memory layer status */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cfg = validateConfig()
  if (!cfg.valid) {
    return NextResponse.json({
      ...configErrorResponse(cfg),
      available: false,
      totalEntries: 0,
      appSlugs: [],
      statusLabel: 'not_configured',
    }, { status: 503 })
  }
  try {
    const status = await getMemoryStatus()
    return NextResponse.json(status)
  } catch (err) {
    const { category, message } = classifyDbError(err)
    return NextResponse.json(
      { error: message, category, available: false, totalEntries: 0, appSlugs: [], statusLabel: 'not_configured' },
      { status: category === 'config_invalid' ? 503 : 500 },
    )
  }
}
