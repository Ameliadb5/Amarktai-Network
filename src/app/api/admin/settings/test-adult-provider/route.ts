/**
 * POST /api/admin/settings/test-adult-provider
 * Tests adult provider configuration based on the configured mode.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const row = await prisma.integrationConfig.findUnique({ where: { key: 'adult_provider' } })

    let mode: 'genx' | 'specialist' | 'disabled' = 'genx'
    let endpoint = ''
    let apiKey = ''

    if (row) {
      try {
        const notes = JSON.parse(row.notes || '{}')
        mode = notes.mode ?? 'genx'
        endpoint = notes.endpoint ?? row.apiUrl ?? ''
      } catch {
        endpoint = row.apiUrl ?? ''
      }
      if (row.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
    }

    if (mode === 'disabled') {
      return NextResponse.json({
        success: false,
        mode: 'disabled',
        error: 'Adult provider is disabled',
      })
    }

    if (mode === 'genx') {
      // Test via GenX status
      let genxUrl = process.env.GENX_API_URL ?? ''
      let genxKey = process.env.GENX_API_KEY ?? ''
      const genxRow = await prisma.integrationConfig.findUnique({ where: { key: 'genx' } })
      if (genxRow?.apiUrl) genxUrl = genxRow.apiUrl
      if (genxRow?.apiKey) {
        const dec = decryptVaultKey(genxRow.apiKey)
        if (dec) genxKey = dec
      }

      if (!genxUrl) {
        return NextResponse.json({
          success: false,
          mode: 'genx',
          error: 'GenX not configured — adult capability unavailable',
        })
      }

      try {
        const baseUrl = genxUrl.replace(/\/$/, '')
        const headers: Record<string, string> = {}
        if (genxKey) headers['Authorization'] = `Bearer ${genxKey}`

        const res = await fetch(`${baseUrl}/api/v1/models`, {
          headers,
          signal: AbortSignal.timeout(8000),
        })

        if (!res.ok) {
          return NextResponse.json({
            success: false,
            mode: 'genx',
            error: `GenX returned HTTP ${res.status}`,
          })
        }

        return NextResponse.json({ success: true, mode: 'genx', error: null })
      } catch (e) {
        return NextResponse.json({
          success: false,
          mode: 'genx',
          error: e instanceof Error ? e.message : 'GenX unreachable',
        })
      }
    }

    if (mode === 'specialist') {
      if (!endpoint) {
        return NextResponse.json({
          success: false,
          mode: 'specialist',
          error: 'Specialist endpoint not configured',
        })
      }

      try {
        const headers: Record<string, string> = {}
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

        const res = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(8000),
        })

        return NextResponse.json({
          success: res.ok || res.status < 500,
          mode: 'specialist',
          error: res.ok || res.status < 500 ? null : `Endpoint returned HTTP ${res.status}`,
        })
      } catch (e) {
        return NextResponse.json({
          success: false,
          mode: 'specialist',
          error: e instanceof Error ? e.message : 'Endpoint unreachable',
        })
      }
    }

    return NextResponse.json({ success: false, mode, error: 'Unknown mode' })
  } catch (e) {
    return NextResponse.json({
      success: false,
      mode: 'unknown',
      error: e instanceof Error ? e.message : 'Test failed',
    })
  }
}
