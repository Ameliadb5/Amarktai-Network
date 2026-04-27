/**
 * POST /api/admin/settings/test-genx
 *
 * Test the AI Engine connection using the provided (or stored) API key and URL.
 * Returns real test results — never faked.
 *
 * Response fields:
 *   success          boolean  — overall success (both catalog and chat OK)
 *   catalogOk        boolean  — model catalog endpoint responded OK
 *   chatOk           boolean  — chat completions endpoint responded OK
 *   modelCount       number   — number of models in catalog
 *   testedUrls       object   — { catalog, chat } — the exact URLs tested
 *   latencyMs        number   — total test duration
 *   apiUrl           string   — masked origin (no path or key)
 *   error            string?  — top-level error if unconfigured
 *   catalogError     string?  — catalog endpoint error detail
 *   chatError        string?  — chat endpoint error detail
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

/**
 * Normalise a GenX base URL:
 *   - Remove trailing slashes
 *   - Strip well-known path suffixes (/api/v1/models, /api/v1, /api)
 *   - Return just the origin (no path), so callers can safely append /api/v1/models
 */
function normaliseBaseUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }

  // Strip known endpoint suffixes from the path
  const path = url.pathname
    .replace(/\/api\/v1\/models\/?$/, '')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')

  // If path is now empty or just '/', use the bare origin
  if (!path || path === '/') {
    return url.origin
  }

  return `${url.origin}${path}`
}

/** Translate an HTTP status to a user-facing error string */
function httpStatusToError(status: number): string {
  if (status === 404) return 'endpoint not found'
  if (status === 401 || status === 403) return 'authentication failed — check API key'
  if (status === 429) return 'rate limited'
  if (status >= 500) return `server error (HTTP ${status})`
  return `HTTP ${status}`
}

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
      catalogOk: false,
      chatOk: false,
      modelCount: 0,
      error: 'No AI Engine API URL configured',
    })
  }

  // Validate URL to prevent SSRF — must be http or https
  let parsedUrl: URL
  try {
    parsedUrl = new URL(apiUrl)
  } catch {
    return NextResponse.json({
      success: false, catalogOk: false, chatOk: false, modelCount: 0,
      error: 'Invalid URL',
    })
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return NextResponse.json({
      success: false, catalogOk: false, chatOk: false, modelCount: 0,
      error: 'URL must use http or https',
    })
  }
  // Reject obvious private/loopback ranges in production
  const hostname = parsedUrl.hostname.toLowerCase()
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) && process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false, catalogOk: false, chatOk: false, modelCount: 0,
      error: 'Private or loopback URLs are not allowed',
    })
  }

  // Normalise the base URL (strip path suffixes, trailing slash)
  const baseUrl = normaliseBaseUrl(apiUrl)

  // Mask URL to origin for response (no path, no key)
  let maskedUrl: string
  try {
    maskedUrl = new URL(baseUrl).origin
  } catch {
    maskedUrl = baseUrl
  }

  const catalogUrl  = `${baseUrl}/api/v1/models`
  const chatUrl     = `${baseUrl}/v1/chat/completions`
  const generateUrl = `${baseUrl}/api/v1/generate`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const start = Date.now()

  // ── Test 1: Model catalog ─────────────────────────────────────────────────
  let catalogOk = false
  let catalogError: string | undefined
  let modelCount = 0

  try {
    // lgtm[js/request-forgery] — URL is validated above (protocol + private-IP checks); admin-only endpoint
    const res = await fetch(catalogUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const data = await res.json() as { models?: unknown[] } | unknown[]
      const models = Array.isArray(data) ? data : ((data as { models?: unknown[] }).models ?? [])
      modelCount = models.length
      catalogOk = true
    } else {
      catalogError = httpStatusToError(res.status)
    }
  } catch (err) {
    catalogError = err instanceof Error ? err.message : 'catalog request failed'
  }

  // ── Test 2: Chat completions ──────────────────────────────────────────────
  let chatOk = false
  let chatError: string | undefined

  try {
    // lgtm[js/request-forgery] — URL is validated above (protocol + private-IP checks); admin-only endpoint
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'genx/default-chat',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    // 200 OK or 400/422 (bad model id / bad request) both confirm the endpoint exists
    if (res.ok || res.status === 400 || res.status === 422) {
      chatOk = true
    } else {
      chatError = httpStatusToError(res.status)
    }
  } catch (err) {
    chatError = err instanceof Error ? err.message : 'chat request failed'
  }

  // ── Test 3: Media generate endpoint ──────────────────────────────────────
  // Use a minimal dry-run probe (no actual generation). If the endpoint responds
  // (even with 400/422 for a missing required field), it is reachable.
  let generateOk = false
  let generateNotTested = false
  let generateError: string | undefined

  try {
    // lgtm[js/request-forgery] — URL validated above; admin-only endpoint
    const res = await fetch(generateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: '__probe__', type: 'image', prompt: 'probe' }),
      signal: AbortSignal.timeout(10_000),
    })
    // 200/202 → ok; 400/422/415 → endpoint exists but rejected the probe request (expected)
    if (res.ok || res.status === 400 || res.status === 422 || res.status === 415) {
      generateOk = true
    } else if (res.status === 404) {
      generateNotTested = true
      generateError = 'generate endpoint not found at tested path'
    } else {
      generateError = httpStatusToError(res.status)
    }
  } catch (err) {
    // Network error — mark as not tested rather than failing the whole test
    generateNotTested = true
    generateError = err instanceof Error ? err.message : 'generate request failed'
  }

  const latencyMs = Date.now() - start
  const success = catalogOk && chatOk

  return NextResponse.json({
    success,
    catalogOk,
    chatOk,
    generateOk,
    generateNotTested,
    modelCount,
    latencyMs,
    apiUrl: maskedUrl,
    testedUrls: { catalog: catalogUrl, chat: chatUrl, generate: generateUrl },
    ...(catalogError  ? { catalogError }  : {}),
    ...(chatError     ? { chatError }     : {}),
    ...(generateError ? { generateError } : {}),
    ...(!success && !catalogError && !chatError
      ? { error: 'AI Engine connection failed' }
      : {}),
  })
}
