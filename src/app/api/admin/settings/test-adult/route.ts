/**
 * POST /api/admin/settings/test-adult
 *
 * Check the adult content capability status.
 * - If mode=genx: tests whether GenX reports adult capability
 * - If mode=specialist: tests the specialist endpoint
 * - If mode=disabled: returns disabled status
 *
 * Returns truthful status — never faked.
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

  // Accept inline config from form (not-yet-saved values)
  let inlineMode = ''
  let inlineEndpoint = ''
  let inlineKey = ''

  try {
    const body = await req.json()
    inlineMode     = typeof body.mode     === 'string' ? body.mode.trim()     : ''
    inlineEndpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
    inlineKey      = typeof body.apiKey   === 'string' ? body.apiKey.trim()   : ''
  } catch { /* ignore */ }

  // Resolve config: inline > DB > env
  let mode     = inlineMode
  let endpoint = inlineEndpoint
  let apiKey   = inlineKey

  if (!mode) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'adult_mode' } })
      if (row) {
        let notes: Record<string, string> = {}
        try { notes = JSON.parse(row.notes) } catch { /* ignore */ }
        if (!mode)     mode     = notes.mode     || ''
        if (!endpoint) endpoint = notes.specialistEndpoint || ''
        if (!apiKey && row.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
      }
    } catch { /* ignore */ }
  }

  if (!mode) {
    mode = process.env.GENX_ADULT_CONTENT_SUPPORTED === 'true' ? 'genx' : 'disabled'
  }

  // ── Disabled ──
  if (mode === 'disabled') {
    return NextResponse.json({
      mode: 'disabled',
      supported: false,
      status: 'disabled',
      message: 'Adult content generation is disabled.',
    })
  }

  // ── GenX ──
  if (mode === 'genx') {
    // Check if GenX is configured and reports adult capability
    let genxUrl = process.env.GENX_API_URL ?? ''
    let genxKey = process.env.GENX_API_KEY ?? ''

    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'genx' } })
      if (row?.apiUrl) genxUrl = row.apiUrl
      if (row?.apiKey) genxKey = decryptVaultKey(row.apiKey) ?? genxKey
    } catch { /* ignore */ }

    if (!genxUrl) {
      return NextResponse.json({
        mode: 'genx',
        supported: false,
        status: 'not_configured',
        message: 'GenX is not configured. Set GENX_API_URL or save the GenX API URL in Settings.',
      })
    }

    const envEnabled = process.env.GENX_ADULT_CONTENT_SUPPORTED === 'true'

    if (!envEnabled) {
      return NextResponse.json({
        mode: 'genx',
        supported: false,
        status: 'not_enabled',
        message: 'GenX adult content is not enabled. Set GENX_ADULT_CONTENT_SUPPORTED=true in your environment after verifying your GenX deployment supports adult content.',
      })
    }

    // Verify GenX is reachable
    const start = Date.now()
    try {
      const headers: Record<string, string> = {}
      if (genxKey) headers['Authorization'] = `Bearer ${genxKey}`

      const res = await fetch(`${genxUrl}/api/v1/models`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })

      const latencyMs = Date.now() - start

      if (!res.ok) {
        return NextResponse.json({
          mode: 'genx',
          supported: false,
          status: 'unreachable',
          message: `GenX responded with HTTP ${res.status}. Cannot confirm adult capability.`,
          latencyMs,
        })
      }

      return NextResponse.json({
        mode: 'genx',
        supported: true,
        status: 'available',
        message: 'Adult content is enabled and routed through GenX.',
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'genx',
        supported: false,
        status: 'unreachable',
        message: `GenX unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── Specialist provider ──
  if (mode === 'specialist') {
    if (!endpoint) {
      return NextResponse.json({
        mode: 'specialist',
        supported: false,
        status: 'not_configured',
        message: 'No specialist endpoint configured.',
      })
    }

    const start = Date.now()
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

      const res = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })

      const latencyMs = Date.now() - start

      // Any response (including 401/403) means the endpoint is reachable
      const reachable = res.status < 500

      return NextResponse.json({
        mode: 'specialist',
        supported: reachable,
        status: reachable ? 'available' : 'unreachable',
        httpStatus: res.status,
        message: reachable
          ? `Specialist endpoint reachable (HTTP ${res.status})`
          : `Specialist endpoint returned HTTP ${res.status}`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'specialist',
        supported: false,
        status: 'unreachable',
        message: `Cannot reach specialist endpoint: ${err instanceof Error ? err.message : 'unknown error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  return NextResponse.json({
    mode,
    supported: false,
    status: 'unknown',
    message: `Unknown adult mode: ${mode}`,
  })
}
