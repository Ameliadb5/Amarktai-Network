/**
 * POST /api/admin/settings/test-genx
 *
 * Test the GenX connection using the provided (or stored) API key and URL.
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

  // Accept inline credentials from the form (not-yet-saved values)
  let inlineKey = ''
  let inlineUrl = ''
  try {
    const body = await req.json()
    inlineKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    inlineUrl = typeof body.apiUrl === 'string' ? body.apiUrl.trim() : ''
  } catch { /* ignore — use stored config */ }

  // Resolve credentials: inline > DB > env var
  let apiKey = inlineKey
  let apiUrl = inlineUrl

  if (!apiKey || !apiUrl) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'genx' } })
      if (!apiKey && row?.apiKey) {
        apiKey = decryptVaultKey(row.apiKey) ?? ''
      }
      if (!apiUrl && row?.apiUrl) {
        apiUrl = row.apiUrl
      }
    } catch { /* ignore */ }
  }

  if (!apiKey) apiKey = process.env.GENX_API_KEY ?? ''
  if (!apiUrl) apiUrl = process.env.GENX_API_URL ?? ''

  if (!apiUrl) {
    return NextResponse.json({
      success: false,
      error: 'No GenX API URL configured',
      modelCount: 0,
    })
  }

  // Mask URL to origin for response
  let maskedUrl = apiUrl
  try {
    maskedUrl = new URL(apiUrl).origin
  } catch { /* keep original if parsing fails */ }

  const start = Date.now()
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${apiUrl}/api/v1/models`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `GenX responded with HTTP ${res.status}`,
        latencyMs,
        apiUrl: maskedUrl,
        modelCount: 0,
      })
    }

    const data = await res.json() as { models?: unknown[] } | unknown[]
    const models = Array.isArray(data) ? data : ((data as { models?: unknown[] }).models ?? [])

    return NextResponse.json({
      success: true,
      modelCount: models.length,
      latencyMs,
      apiUrl: maskedUrl,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      latencyMs: Date.now() - start,
      apiUrl: maskedUrl,
      modelCount: 0,
    })
  }
}
