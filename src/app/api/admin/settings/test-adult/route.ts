/**
 * POST /api/admin/settings/test-adult
 *
 * Test the adult content specialist provider connection.
 * The AI Engine (GenX) is NEVER used for adult content generation.
 * Only specialist providers are supported: Together AI, HuggingFace, xAI/Grok, Custom.
 *
 * Returns truthful status — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

type ProviderType = 'together' | 'huggingface' | 'xai' | 'custom'

/** Translate an HTTP status to a user-facing error string */
function httpErr(status: number): string {
  if (status === 404) return 'endpoint not found'
  if (status === 401 || status === 403) return 'authentication failed — check API key'
  if (status === 422) return 'provider rejected request (422) — model may not support this operation or safety checker triggered'
  if (status === 429) return 'rate limited'
  if (status >= 500) return `server error (HTTP ${status})`
  return `HTTP ${status}`
}

/** Block SSRF: only allow http/https and block private/loopback in production */
function validateUrl(raw: string): { url: URL; error: string | null } {
  let url: URL
  try { url = new URL(raw) } catch { return { url: new URL('about:blank'), error: 'Invalid URL' } }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { url, error: 'URL must use http or https' }
  }
  const h = url.hostname.toLowerCase()
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(h) && process.env.NODE_ENV === 'production') {
    return { url, error: 'Private or loopback URLs are not allowed' }
  }
  return { url, error: null }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse request body ──
  let inlineMode         = ''
  let inlineProviderType = ''
  let inlineEndpoint     = ''
  let inlineKey          = ''
  let inlineModel        = ''

  try {
    const body = await req.json()
    inlineMode         = typeof body.mode         === 'string' ? body.mode.trim()         : ''
    inlineProviderType = typeof body.providerType === 'string' ? body.providerType.trim() : ''
    inlineEndpoint     = typeof body.endpoint     === 'string' ? body.endpoint.trim()     : ''
    inlineKey          = typeof body.apiKey       === 'string' ? body.apiKey.trim()       : ''
    inlineModel        = typeof body.model        === 'string' ? body.model.trim()        : ''
  } catch { /* ignore */ }

  // ── Resolve from DB if not provided inline ──
  let mode         = inlineMode
  let providerType = inlineProviderType as ProviderType
  let endpoint     = inlineEndpoint
  let apiKey       = inlineKey
  let providerModel = inlineModel

  if (!mode) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'adult_mode' } })
      if (row) {
        let notes: Record<string, string> = {}
        try { notes = JSON.parse(row.notes) } catch { /* ignore */ }
        if (!mode)         mode         = notes.mode             || ''
        if (!providerType) providerType = (notes.providerType || 'together') as ProviderType
        if (!endpoint)     endpoint     = notes.specialistEndpoint || ''
        if (!providerModel) providerModel = notes.providerModel   || ''
        if (!apiKey && row.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
      }
    } catch { /* ignore */ }
  }

  if (!mode) mode = 'disabled'

  // ── Disabled ──
  if (mode === 'disabled') {
    return NextResponse.json({
      mode: 'disabled',
      supported: false,
      status: 'disabled',
      message: 'Adult Creative Mode is disabled. Enable a specialist provider in Settings to use adult content generation.',
    })
  }

  if (mode !== 'specialist') {
    return NextResponse.json({
      mode,
      supported: false,
      status: 'unknown_mode',
      message: `Unknown mode "${mode}". Only "specialist" is supported. The AI Engine is never used for adult content.`,
    })
  }

  // ── Specialist provider ──
  if (!providerType) providerType = 'together'

  // ── Together AI ──
  if (providerType === 'together') {
    if (!apiKey) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'together',
        supported: false, status: 'not_configured',
        message: 'Together AI API key is required.',
      })
    }

    const togetherEndpoint = 'https://api.together.xyz/v1/images/generations'
    const model = providerModel || 'black-forest-labs/FLUX.1-schnell-Free'
    const start = Date.now()
    try {
      // lgtm[js/request-forgery] — hardcoded Together AI URL; admin-only endpoint
      const res = await fetch(togetherEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          prompt: 'probe',
          n: 1,
          width: 64,
          height: 64,
          disable_safety_checker: true,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const latencyMs = Date.now() - start

      // 200 = success; 400/422 = endpoint exists but prompt/model rejected
      const reachable = res.ok || res.status === 400 || res.status === 422 || res.status === 401 || res.status === 403
      const authOk = res.status !== 401 && res.status !== 403

      let extraNote = ''
      if (res.status === 422) extraNote = ' — provider returned 422 (disable_safety_checker was sent; model may not support this operation)'
      if (res.status === 401 || res.status === 403) extraNote = ' — authentication failed'

      return NextResponse.json({
        mode: 'specialist', providerType: 'together',
        supported: authOk && reachable,
        status: authOk && reachable ? 'available' : 'auth_failed',
        httpStatus: res.status,
        model,
        message: `Together AI endpoint reachable (HTTP ${res.status})${extraNote}`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'together',
        supported: false, status: 'unreachable',
        message: `Cannot reach Together AI: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── HuggingFace private endpoint ──
  if (providerType === 'huggingface') {
    if (!endpoint) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'huggingface',
        supported: false, status: 'not_configured',
        message: 'HuggingFace private endpoint URL is required.',
      })
    }

    const { url: hfUrl, error: hfErr } = validateUrl(endpoint)
    if (hfErr) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'huggingface',
        supported: false, status: 'invalid', message: hfErr,
      })
    }

    const start = Date.now()
    try {
      const hHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) hHeaders['Authorization'] = `Bearer ${apiKey}`
      // lgtm[js/request-forgery] — URL validated above; admin-only endpoint
      const res = await fetch(hfUrl.href, {
        method: 'POST',
        headers: hHeaders,
        body: JSON.stringify({ inputs: 'probe', parameters: {} }),
        signal: AbortSignal.timeout(20_000),
      })
      const latencyMs = Date.now() - start
      const reachable = res.status < 500

      return NextResponse.json({
        mode: 'specialist', providerType: 'huggingface',
        supported: reachable,
        status: reachable ? 'available' : 'server_error',
        httpStatus: res.status,
        message: reachable
          ? `HuggingFace endpoint reachable (HTTP ${res.status})`
          : `HuggingFace endpoint returned HTTP ${res.status}`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'huggingface',
        supported: false, status: 'unreachable',
        message: `Cannot reach HuggingFace endpoint: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── xAI / Grok Imagine ──
  if (providerType === 'xai') {
    if (!apiKey) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'xai',
        supported: false, status: 'not_configured',
        message: 'xAI API key is required.',
      })
    }

    const xaiImageEndpoint = 'https://api.x.ai/v1/images/generations'
    const model = providerModel || 'grok-2-image'
    const start = Date.now()
    try {
      // lgtm[js/request-forgery] — hardcoded xAI URL; admin-only endpoint
      const res = await fetch(xaiImageEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt: 'probe test', n: 1 }),
        signal: AbortSignal.timeout(20_000),
      })
      const latencyMs = Date.now() - start

      const reachable = res.ok || res.status === 400 || res.status === 422 || res.status === 401 || res.status === 403
      const authOk = res.status !== 401 && res.status !== 403

      let note = ''
      if (res.status === 401 || res.status === 403) note = ' — xAI adult content access not confirmed for this key'
      if (res.ok) note = ' — xAI image endpoint accessible'

      return NextResponse.json({
        mode: 'specialist', providerType: 'xai',
        supported: authOk && reachable,
        status: authOk && reachable ? 'available' : 'auth_failed',
        httpStatus: res.status,
        model,
        message: `xAI/Grok endpoint responded (HTTP ${res.status})${note}`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'xai',
        supported: false, status: 'unreachable',
        message: `Cannot reach xAI API: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── Custom (OpenAI-compatible) ──
  if (providerType === 'custom') {
    if (!endpoint) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'custom',
        supported: false, status: 'not_configured',
        message: 'Custom provider endpoint URL is required.',
      })
    }

    const { url: customUrl, error: customErr } = validateUrl(endpoint)
    if (customErr) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'custom',
        supported: false, status: 'invalid', message: customErr,
      })
    }

    const start = Date.now()
    try {
      const cHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) cHeaders['Authorization'] = `Bearer ${apiKey}`
      // lgtm[js/request-forgery] — URL validated above; admin-only endpoint
      const res = await fetch(customUrl.href, {
        method: 'POST',
        headers: cHeaders,
        body: JSON.stringify({ prompt: 'probe', model: providerModel || 'default', n: 1 }),
        signal: AbortSignal.timeout(20_000),
      })
      const latencyMs = Date.now() - start
      const reachable = res.status < 500

      return NextResponse.json({
        mode: 'specialist', providerType: 'custom',
        supported: reachable,
        status: reachable ? 'available' : 'server_error',
        httpStatus: res.status,
        message: reachable
          ? `Custom endpoint reachable (HTTP ${res.status}${res.status === 422 ? ' — safety checker or bad request' : ''})`
          : `Custom endpoint returned ${httpErr(res.status)}`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        mode: 'specialist', providerType: 'custom',
        supported: false, status: 'unreachable',
        message: `Cannot reach custom endpoint: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  return NextResponse.json({
    mode: 'specialist',
    supported: false,
    status: 'unknown_provider',
    message: `Unknown provider type: ${providerType}. Supported: together, huggingface, xai, custom`,
  })
}
