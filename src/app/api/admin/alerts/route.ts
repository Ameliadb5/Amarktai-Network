/**
 * Admin API — System Alerts
 *
 * GET  /api/admin/alerts → List alerts (with filters)
 * POST /api/admin/alerts → Resolve an alert
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { listAlerts, resolveAlert, getAlertSummary, type AlertSeverity, type AlertType } from '@/lib/alert-engine'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const severity = searchParams.get('severity') as AlertSeverity | null
    const alertType = searchParams.get('type') as AlertType | null
    const resolved = searchParams.get('resolved')

    const [alerts, summary] = await Promise.all([
      listAlerts({
        severity: severity ?? undefined,
        alertType: alertType ?? undefined,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        limit: 200,
      }),
      getAlertSummary(),
    ])

    return NextResponse.json({ alerts, summary, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get alerts' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as { action: string; alertId?: number }

    if (body.action === 'resolve' && body.alertId) {
      const ok = await resolveAlert(body.alertId)
      return NextResponse.json({ resolved: ok })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process alert action' },
      { status: 500 },
    )
  }
}
