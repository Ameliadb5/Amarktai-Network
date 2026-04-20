/**
 * POST /api/admin/providers/health-check-all
 *
 * Runs a live health check against every configured AI provider in parallel
 * and persists the updated statuses to the database.
 *
 * Called by:
 *  - Admin dashboard "Refresh All" button
 *  - Automated cron job (set CRON_SECRET in env and call this endpoint with
 *    Authorization: Bearer <CRON_SECRET> from your scheduler / Vercel Cron)
 *
 * GET /api/admin/providers/health-check-all
 *   Returns last-checked timestamps and statuses for all providers.
 *   Cached for 60 s (next revalidate).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { mapHealthStatusToTruthState, runProviderHealthCheck } from '@/lib/providers'
import { syncProviderHealthFromDB } from '@/lib/sync-provider-health'

// Next.js route-segment cache — GET results are revalidated every 60 seconds.
export const revalidate = 60

/** Verify the caller is either an authenticated admin or a cron scheduler. */
async function isAuthorised(req: NextRequest): Promise<boolean> {
  // 1. Admin session
  const session = await getSession()
  if (session.isLoggedIn) return true

  // 2. Bearer token for cron jobs (CRON_SECRET env var must be set)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth === `Bearer ${cronSecret}`) return true
  }

  return false
}

/** GET — return current provider health statuses (cached 60 s). */
export async function GET(req: NextRequest) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providers = await prisma.aiProvider.findMany({
    select: {
      id: true,
      providerKey: true,
      displayName: true,
      healthStatus: true,
      healthMessage: true,
      lastCheckedAt: true,
      enabled: true,
    },
    orderBy: { providerKey: 'asc' },
  })

  return NextResponse.json({ providers, cachedAt: new Date().toISOString() })
}

/** POST — run a live health check against every provider in parallel. */
export async function POST(req: NextRequest) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providers = await prisma.aiProvider.findMany({
    select: { id: true, providerKey: true, apiKey: true, baseUrl: true, enabled: true },
  })

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      let status: string
      let message: string

      if (!provider.enabled) {
        status = 'disabled'; message = 'Provider is disabled'
      } else if (!provider.apiKey) {
        status = 'unconfigured'; message = 'No API key configured'
      } else {
        const check = await runProviderHealthCheck(
          provider.providerKey,
          provider.apiKey,
          provider.baseUrl,
        )
        const truthState = mapHealthStatusToTruthState(check.status)
        status = check.status
        message = `[${truthState}] ${check.message}`
      }

      return prisma.aiProvider.update({
        where: { id: provider.id },
        data: { healthStatus: status, healthMessage: message, lastCheckedAt: new Date() },
        select: { id: true, providerKey: true, healthStatus: true, healthMessage: true, lastCheckedAt: true },
      })
    }),
  )

  // Sync updated statuses into the in-memory health cache used by the router
  await syncProviderHealthFromDB()

  const updated = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof prisma.aiProvider.update>>> => r.status === 'fulfilled')
    .map((r) => r.value)

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String(r.reason))

  return NextResponse.json({
    checked: updated.length,
    failed: failed.length,
    providers: updated,
    errors: failed,
    checkedAt: new Date().toISOString(),
  })
}
