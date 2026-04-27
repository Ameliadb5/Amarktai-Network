import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/monitor/stats
 * Returns platform-wide stats for the Monitor page.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [artifactCount, brainEventCount, workspaceSessionCount, alertCount] = await Promise.all([
      prisma.artifact.count(),
      prisma.brainEvent.count(),
      prisma.workspaceSession.count(),
      prisma.systemAlert.count({ where: { resolved: false } }),
    ])

    return NextResponse.json({
      artifactCount,
      brainEventCount,
      workspaceSessionCount,
      alertCount,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load stats' },
      { status: 500 },
    )
  }
}
