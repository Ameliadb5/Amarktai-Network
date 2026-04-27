import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getGenXStatus,
  listGenXModels,
  getAdultCapabilityStatus,
} from '@/lib/genx-client'

/**
 * GET /api/admin/genx/status
 *
 * Returns the live GenX execution layer status:
 *   - configured: whether GENX_API_URL is set
 *   - available:  whether GenX responded to the last request
 *   - modelCount: number of models returned by /api/v1/models
 *   - adultCapability: truthful adult content routing status
 *   - apiUrl:     masked origin (host only, no path or key)
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = getGenXStatus()
  const adultStatus = getAdultCapabilityStatus()

  let modelCount = 0
  if (status.available) {
    try {
      const models = await listGenXModels()
      modelCount = models.length
    } catch {
      // best-effort
    }
  }

  // Mask the URL to just the origin (hide path and any token-in-URL patterns)
  let maskedUrl: string | null = null
  if (status.apiUrl) {
    try {
      const parsed = new URL(status.apiUrl)
      maskedUrl = parsed.origin
    } catch {
      maskedUrl = status.apiUrl.slice(0, 30) + (status.apiUrl.length > 30 ? '…' : '')
    }
  }

  return NextResponse.json({
    configured:     status.available,
    available:      status.available,
    error:          status.error,
    apiUrl:         maskedUrl,
    modelCount,
    adultCapability: {
      supported:   adultStatus.supported,
      route:       adultStatus.route,
      reason:      adultStatus.note,
    },
  })
}
