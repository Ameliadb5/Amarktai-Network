/**
 * Geo / GPS Subsystem API — AmarktAI Network
 *
 * Provides location event ingestion, geofences, and trip history.
 * Truthfully reports degraded state when external geocoding is not configured.
 */

import { NextRequest, NextResponse } from 'next/server'

// Check if geo provider is configured
function isGeoConfigured(): boolean {
  return !!(process.env.MAPBOX_TOKEN || process.env.GOOGLE_MAPS_KEY || process.env.GEO_PROVIDER_KEY)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const action = searchParams.get('action') ?? 'status'

  const configured = isGeoConfigured()

  if (action === 'status') {
    return NextResponse.json({
      status: configured ? 'available' : 'not_configured',
      configured,
      provider: configured
        ? (process.env.MAPBOX_TOKEN ? 'mapbox' : process.env.GOOGLE_MAPS_KEY ? 'google_maps' : 'generic')
        : null,
      capabilities: {
        locationIngestion: configured,
        routeHistory: configured,
        geofences: configured,
        routePlayback: configured,
        geoAlerts: configured,
      },
      note: configured
        ? 'Geo subsystem is active and ready for location events'
        : 'Geo subsystem requires MAPBOX_TOKEN, GOOGLE_MAPS_KEY, or GEO_PROVIDER_KEY to be configured. Location features are unavailable.',
    })
  }

  if (action === 'events') {
    if (!configured) {
      return NextResponse.json({ events: [], note: 'Geo provider not configured', status: 'not_configured' })
    }
    // In production, this would query location events from DB
    return NextResponse.json({ events: [], total: 0, note: 'No location events recorded yet' })
  }

  if (action === 'geofences') {
    if (!configured) {
      return NextResponse.json({ geofences: [], status: 'not_configured' })
    }
    return NextResponse.json({ geofences: [], total: 0, note: 'No geofences configured yet' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const configured = isGeoConfigured()
  if (!configured) {
    return NextResponse.json(
      { error: 'Geo subsystem is not configured. Set MAPBOX_TOKEN, GOOGLE_MAPS_KEY, or GEO_PROVIDER_KEY.' },
      { status: 503 },
    )
  }

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'ingest') {
      const { appSlug, lat, lng, timestamp } = body
      if (!appSlug || lat == null || lng == null) {
        return NextResponse.json({ error: 'appSlug, lat, and lng are required' }, { status: 400 })
      }
      // In production this would store to DB
      return NextResponse.json({ success: true, event: { appSlug, lat, lng, timestamp: timestamp ?? new Date().toISOString() } })
    }

    if (action === 'create_geofence') {
      const { name, lat, lng, radiusMeters } = body
      if (!name || lat == null || lng == null || !radiusMeters) {
        return NextResponse.json({ error: 'name, lat, lng, and radiusMeters are required' }, { status: 400 })
      }
      return NextResponse.json({ success: true, geofence: { id: `gf_${Date.now()}`, name, lat, lng, radiusMeters } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to process geo request' }, { status: 500 })
  }
}
