/**
 * GET /api/admin/app-health?slug=<appSlug>
 *
 * Returns real health + usage stats for a connected app:
 *   - last request timestamp
 *   - 7-day request count and per-day trend
 *   - success rate
 *   - estimated monthly cost (current month)
 *   - connection health (active / stale / no data)
 *
 * Data comes from UsageMeter and AppIntegration tables.
 * Server-side only. Requires admin session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export interface AppHealthStats {
  appSlug: string
  lastRequestAt: string | null
  requests7d: number
  successRate7d: number | null   // 0–100, null if no data
  estimatedMonthlyCostCents: number
  connectionStatus: 'active' | 'stale' | 'no_data'
  trend7d: Array<{ date: string; requests: number; successRate: number | null }>
  topCapability: string | null
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug query param required' }, { status: 400 })
  }

  try {
    // 7-day window
    const since7d = new Date()
    since7d.setDate(since7d.getDate() - 7)
    since7d.setHours(0, 0, 0, 0)

    // Current month window
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [rows7d, rowsMonth] = await Promise.all([
      prisma.usageMeter.findMany({
        where: { appSlug: slug, date: { gte: since7d } },
        orderBy: { date: 'asc' },
      }),
      prisma.usageMeter.findMany({
        where: { appSlug: slug, date: { gte: monthStart } },
        select: { costUsdCents: true },
      }),
    ])

    // Aggregate 7-day stats
    let requests7d = 0
    let success7d = 0
    const byDay: Record<string, { requests: number; success: number }> = {}
    const byCap: Record<string, number> = {}

    for (const r of rows7d) {
      requests7d += r.requestCount
      success7d += r.successCount

      const day = r.date.toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = { requests: 0, success: 0 }
      byDay[day].requests += r.requestCount
      byDay[day].success += r.successCount

      byCap[r.capability] = (byCap[r.capability] ?? 0) + r.requestCount
    }

    const estimatedMonthlyCostCents = rowsMonth.reduce((acc: number, r: { costUsdCents: number }) => acc + r.costUsdCents, 0)

    const successRate7d = requests7d > 0
      ? Math.round((success7d / requests7d) * 100)
      : null

    const trend7d = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        requests: d.requests,
        successRate: d.requests > 0 ? Math.round((d.success / d.requests) * 100) : null,
      }))

    // Last request: find the most recent date in usage data
    const latestRow = rows7d.length > 0 ? rows7d[rows7d.length - 1] : null
    let lastRequestAt: string | null = null
    if (latestRow) {
      lastRequestAt = latestRow.date.toISOString()
    } else {
      // Check older data outside the 7d window
      try {
        const older = await prisma.usageMeter.findFirst({
          where: { appSlug: slug },
          orderBy: { date: 'desc' },
          select: { date: true },
        })
        if (older) lastRequestAt = older.date.toISOString()
      } catch {
        // ignore
      }
    }

    // Connection status
    const now = Date.now()
    const lastMs = lastRequestAt ? new Date(lastRequestAt).getTime() : null
    let connectionStatus: 'active' | 'stale' | 'no_data' = 'no_data'
    if (lastMs) {
      const daysSinceLast = (now - lastMs) / 86_400_000
      connectionStatus = daysSinceLast <= 2 ? 'active' : 'stale'
    }

    // Top capability
    const topCapability = Object.entries(byCap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const stats: AppHealthStats = {
      appSlug: slug,
      lastRequestAt,
      requests7d,
      successRate7d,
      estimatedMonthlyCostCents,
      connectionStatus,
      trend7d,
      topCapability,
    }

    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load app health' },
      { status: 500 },
    )
  }
}
