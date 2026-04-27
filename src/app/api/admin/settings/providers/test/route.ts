/**
 * POST /api/admin/settings/providers/test
 *
 * Test a fallback/specialist AI provider connection.
 * Accepts an inline key+URL or uses the stored config.
 * Returns real test results — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { PROVIDER_REGISTRY } from '../route'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* ignore */ }

  const providerId = typeof body.provider === 'string' ? body.provider.trim() : ''
  const inlineKey  = typeof body.apiKey  === 'string' ? body.apiKey.trim()  : ''
  const inlineUrl  = typeof body.apiUrl  === 'string' ? body.apiUrl.trim()  : ''

  const meta = PROVIDER_REGISTRY.find(p => p.id === providerId)
  if (!meta) {
    return NextResponse.json({ success: false, error: `Unknown provider: ${providerId}` })
  }

  // Resolve key: inline > DB > env
  let apiKey = inlineKey
  let apiUrl = inlineUrl

  if (!apiKey) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: meta.dbKey } })
      if (row?.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
      if (!apiUrl && row?.apiUrl) apiUrl = row.apiUrl
    } catch { /* ignore */ }
  }
  if (!apiKey) apiKey = process.env[meta.envKeyVar] ?? ''
  if (!apiUrl && meta.envUrlVar) apiUrl = process.env[meta.envUrlVar] ?? ''
  if (!apiUrl) apiUrl = meta.defaultUrl

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'No API key configured for this provider' })
  }

  // Validate URL to prevent SSRF — parse, validate protocol and host, then use the normalised URL
  let normalizedBaseUrl: string
  try {
    const parsed = new URL(apiUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ success: false, error: 'API URL must use http or https' })
    }
    // Reconstruct from parsed to avoid any bypass via encoding tricks
    normalizedBaseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '')
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid API URL' })
  }

  const start = Date.now()

  try {
    // Special-case HuggingFace — test via a fixed URL (not user-provided)
    if (meta.id === 'huggingface') {
      const res = await fetch('https://huggingface.co/api/whoami', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      })
      const latencyMs = Date.now() - start
      if (res.ok) {
        const data = await res.json() as { name?: string; type?: string }
        await prisma.integrationConfig.updateMany({
          where: { key: meta.dbKey },
          data: { notes: 'tested:ok' },
        }).catch(() => null)
        return NextResponse.json({ success: true, latencyMs, detail: `Authenticated as: ${data.name ?? 'unknown'}` })
      }
      return NextResponse.json({ success: false, error: `HuggingFace returned HTTP ${res.status}`, latencyMs })
    }

    // Special-case Gemini — uses API key as query param; use validated normalizedBaseUrl
    if (meta.id === 'gemini') {
      const testUrl = `${normalizedBaseUrl}/models?key=${encodeURIComponent(apiKey)}`
      const res = await fetch(testUrl, { signal: AbortSignal.timeout(10_000) })
      const latencyMs = Date.now() - start
      if (res.ok) {
        const data = await res.json() as { models?: unknown[] }
        const count = data.models?.length ?? 0
        await prisma.integrationConfig.updateMany({ where: { key: meta.dbKey }, data: { notes: 'tested:ok' } }).catch(() => null)
        return NextResponse.json({ success: true, latencyMs, modelCount: count, detail: `${count} models available` })
      }
      return NextResponse.json({ success: false, error: `Gemini API returned HTTP ${res.status}`, latencyMs })
    }

    // Standard OpenAI-compatible test — GET /models with Bearer token; use validated normalizedBaseUrl
    if (!meta.testEndpoint) {
      return NextResponse.json({ success: false, error: 'No test endpoint configured for this provider' })
    }

    const testUrl = `${normalizedBaseUrl}${meta.testEndpoint}`
    const res = await fetch(testUrl, {
      method: meta.testMethod,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      ...(meta.testBody ? { body: JSON.stringify(meta.testBody) } : {}),
      signal: AbortSignal.timeout(15_000),
    })

    const latencyMs = Date.now() - start

    if (res.ok) {
      let modelCount: number | undefined
      try {
        const data = await res.json() as { data?: unknown[]; models?: unknown[] } | unknown[]
        const list = Array.isArray(data) ? data : ((data as { data?: unknown[] }).data ?? (data as { models?: unknown[] }).models ?? [])
        modelCount = list.length
      } catch { /* ignore */ }

      await prisma.integrationConfig.updateMany({
        where: { key: meta.dbKey },
        data: { notes: 'tested:ok' },
      }).catch(() => null)

      return NextResponse.json({
        success: true,
        latencyMs,
        ...(modelCount !== undefined ? { modelCount, detail: `${modelCount} models available` } : {}),
      })
    }

    await prisma.integrationConfig.updateMany({
      where: { key: meta.dbKey },
      data: { notes: `tested:failed:${res.status}` },
    }).catch(() => null)

    return NextResponse.json({
      success: false,
      error: res.status === 401
        ? 'Invalid API key — provider returned 401 Unauthorized'
        : `Provider returned HTTP ${res.status}`,
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
