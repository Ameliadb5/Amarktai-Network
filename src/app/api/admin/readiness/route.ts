import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { runReadinessAudit } from '@/lib/readiness-audit'

/** GET /api/admin/readiness — returns go-live readiness audit report */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const report = await runReadinessAudit()
  return NextResponse.json(report)
}
