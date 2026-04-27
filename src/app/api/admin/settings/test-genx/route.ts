/**
 * POST /api/admin/settings/test-genx
 * Tests the GenX API connection and returns model count.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Resolve effective URL and key: DB row takes priority over env vars
    let apiUrl = process.env.GENX_API_URL ?? ''
    let apiKey = process.env.GENX_API_KEY ?? ''

    const row = await prisma.integrationConfig.findUnique({ where: { key: 'genx' } })
    if (row?.apiUrl) apiUrl = row.apiUrl
    if (row?.apiKey) {
      const decrypted = decryptVaultKey(row.apiKey)
      if (decrypted) apiKey = decrypted
    }

    if (!apiUrl) {
      return NextResponse.json({ success: false, modelCount: 0, error: 'GenX API URL not configured' })
    }

    const baseUrl = apiUrl.replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseUrl}/api/v1/models`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        modelCount: 0,
        error: `GenX returned HTTP ${res.status}`,
      })
    }

    const data = await res.json()
    const modelCount: number = Array.isArray(data?.data) ? data.data.length
      : Array.isArray(data?.models) ? data.models.length
      : Array.isArray(data) ? data.length
      : 0

    return NextResponse.json({ success: true, modelCount, error: null })
  } catch (e) {
    return NextResponse.json({
      success: false,
      modelCount: 0,
      error: e instanceof Error ? e.message : 'Connection failed',
    })
  }
}
