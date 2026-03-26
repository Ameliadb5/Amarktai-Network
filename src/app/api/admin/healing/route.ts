import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { runHealingChecks } from '@/lib/self-healing'

/** GET /api/admin/healing — run self-healing checks and return status */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await runHealingChecks()
    return NextResponse.json(status)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Healing check failed' },
      { status: 500 },
    )
  }
}
