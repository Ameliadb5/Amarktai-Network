import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/health — public health check
 *
 * Returns a real JSON object with system status.
 * This route is intentionally public (no auth) so load balancers and
 * uptime monitors can use it without admin credentials.
 *
 * Response shape:
 *   { status, timestamp, version, db }
 */
export async function GET() {
  const start = Date.now()

  // Quick DB ping — SELECT 1 equivalent via Prisma
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbStatus = 'error'
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      db: dbStatus,
      latencyMs: Date.now() - start,
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    },
  )
}
