import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getGenXStatusAsync,
  listGenXModels,
  getAdultCapabilityStatus,
  getCachedEndpointProfile,
} from '@/lib/genx-client'

/**
 * GET /api/admin/genx/status
 *
 * Returns the live GenX execution layer status:
 *   - configured: whether the AI Engine URL is set (env or DB)
 *   - available:  whether GenX responded to the last request
 *   - modelCount: number of models returned by the catalog endpoint
 *   - adultCapability: truthful adult content routing status
 *   - apiUrl:     masked origin (host only, no path or key)
 *   - discoveredEndpoints: which endpoint paths were found on the server
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = await getGenXStatusAsync()
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

  // Expose the discovered endpoint profile so the UI can show which paths
  // the system is using — helps diagnose 404/405 issues.
  const profile = getCachedEndpointProfile()

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
    discoveredEndpoints: profile ? {
      catalogPath:  profile.catalogPath,
      chatPath:     profile.chatPath,
      generatePath: profile.generatePath,
      probeAge:     Math.round((Date.now() - profile.probeTime) / 1000) + 's ago',
    } : null,
  })
}
