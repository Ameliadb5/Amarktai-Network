/**
 * POST /api/admin/settings/test-webdock
 *
 * Test the Webdock API connection using the provided (or stored) API key.
 * Returns real test results — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let inlineKey = ''
  try {
    const body = await req.json()
    inlineKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  } catch { /* ignore */ }

  // Resolve key: inline > DB > env var
  let apiKey = inlineKey
  if (!apiKey) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'webdock' } })
      if (row?.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
    } catch { /* ignore */ }
  }
  if (!apiKey) apiKey = process.env.WEBDOCK_API_KEY ?? ''

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'No Webdock API key configured' })
  }

  const start = Date.now()
  try {
    const res = await fetch('https://app.webdock.io/api/v1/servers', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Webdock API responded with HTTP ${res.status}`,
        latencyMs,
      })
    }

    const raw = await res.json()
    const data = Array.isArray(raw) ? raw : []
    const serverCount = data.length

    return NextResponse.json({
      success: true,
      serverCount,
      latencyMs,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      latencyMs: Date.now() - start,
    })
  }
}
