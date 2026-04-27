/**
 * Webdock Client — AmarktAI Network
 *
 * Webdock is the VPS hosting provider for the AmarktAI Network.
 * This client wraps the Webdock API for server management, metrics,
 * script execution, and event hooks.
 *
 * Webdock API base: https://app.webdock.io/api/v1
 * Docs: https://app.webdock.io/api-docs
 *
 * Server-side only. Never import from client components.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebdockServer {
  slug: string
  name: string
  status: string
  ipv4: string | null
  ipv6: string | null
  location: string
  profile: string
  image: string
  webServer: string | null
  aliases: string[]
  snapshotRunTime: number | null
  createdAt: string
  virtualization: string
}

export interface WebdockMetrics {
  cpu: number        // 0-100 %
  memory: number     // 0-100 %
  disk: number       // 0-100 %
  networkIn: number  // kbps
  networkOut: number // kbps
  timestamp: string
}

export interface WebdockScript {
  id: number
  name: string
  filename: string
  content: string
  type: string
}

export interface WebdockScriptExecution {
  callbackId: string
  status: string
}

export interface WebdockEvent {
  id: string
  type: string
  status: string
  description: string
  createdAt: string
  completedAt: string | null
}

export interface WebdockShellUser {
  username: string
  sudo: boolean
  publicKeys: string[]
}

export interface WebdockPublicKey {
  id: number
  name: string
  publicKey: string
  createdAt: string
}

export interface WebdockCallResult<T> {
  success: boolean
  data: T | null
  error: string | null
  latencyMs: number
  statusCode: number | null
}

// ── Configuration ─────────────────────────────────────────────────────────────

const WEBDOCK_BASE_URL = 'https://app.webdock.io/api/v1'
const WEBDOCK_TIMEOUT = 20_000

// ── Slug validation ───────────────────────────────────────────────────────────

const VALID_SLUG_RE = /^[a-zA-Z0-9_-]{1,128}$/

function isValidSlug(slug: string): boolean {
  return VALID_SLUG_RE.test(slug)
}

function invalidSlugResult<T>(): WebdockCallResult<T> {
  return { success: false, data: null, error: 'Invalid server slug', latencyMs: 0, statusCode: null }
}

/**
 * Resolve the Webdock API token from DB config or environment variable.
 * Priority: DB (IntegrationConfig key='webdock') > WEBDOCK_API_TOKEN env var
 */
async function resolveWebdockToken(): Promise<string> {
  // Try DB first
  try {
    const { prisma } = await import('@/lib/prisma')
    const { decryptVaultKey } = await import('@/lib/crypto-vault')
    const row = await prisma.integrationConfig.findUnique({ where: { key: 'webdock' } })
    if (row?.apiKey) {
      const decrypted = decryptVaultKey(row.apiKey)
      if (decrypted) return decrypted
    }
  } catch {
    // DB unavailable — fall through
  }

  return process.env.WEBDOCK_API_TOKEN ?? ''
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function webdockFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<WebdockCallResult<T>> {
  const start = Date.now()

  const token = await resolveWebdockToken()
  if (!token) {
    return {
      success: false,
      data: null,
      error: 'Webdock API token not configured',
      latencyMs: 0,
      statusCode: null,
    }
  }

  try {
    const res = await fetch(`${WEBDOCK_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(WEBDOCK_TIMEOUT),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      let errMsg = `Webdock API returned HTTP ${res.status}`
      try {
        const errBody = await res.json() as { message?: string; error?: string }
        errMsg = errBody.message ?? errBody.error ?? errMsg
      } catch { /* ignore */ }
      return { success: false, data: null, error: errMsg, latencyMs, statusCode: res.status }
    }

    // 204 No Content — success with no body
    if (res.status === 204) {
      return { success: true, data: null, error: null, latencyMs, statusCode: 204 }
    }

    const data = await res.json() as T
    return { success: true, data, error: null, latencyMs, statusCode: res.status }
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Request failed',
      latencyMs: Date.now() - start,
      statusCode: null,
    }
  }
}

// ── Server operations ─────────────────────────────────────────────────────────

/** List all servers on the Webdock account. */
export async function listWebdockServers(): Promise<WebdockCallResult<WebdockServer[]>> {
  return webdockFetch<WebdockServer[]>('/servers')
}

/** Get a single server by slug. */
export async function getWebdockServer(slug: string): Promise<WebdockCallResult<WebdockServer>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockServer>()
  return webdockFetch<WebdockServer>(`/servers/${encodeURIComponent(slug)}`)
}

/** Get live server metrics (now). */
export async function getWebdockMetricsNow(slug: string): Promise<WebdockCallResult<WebdockMetrics>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockMetrics>()
  return webdockFetch<WebdockMetrics>(`/servers/${encodeURIComponent(slug)}/metrics/now`)
}

/** List scripts for a server. */
export async function listWebdockScripts(slug: string): Promise<WebdockCallResult<WebdockScript[]>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockScript[]>()
  return webdockFetch<WebdockScript[]>(`/servers/${encodeURIComponent(slug)}/scripts`)
}

/** Execute a script on a server. Requires explicit confirmation on the calling side. */
export async function executeWebdockScript(
  slug: string,
  scriptId: number,
): Promise<WebdockCallResult<WebdockScriptExecution>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockScriptExecution>()
  if (!Number.isInteger(scriptId) || scriptId <= 0) {
    return { success: false, data: null, error: 'Invalid script ID', latencyMs: 0, statusCode: null }
  }
  return webdockFetch<WebdockScriptExecution>(
    `/servers/${encodeURIComponent(slug)}/scripts/${scriptId}/execute`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

/** List server events. */
export async function listWebdockEvents(slug: string): Promise<WebdockCallResult<WebdockEvent[]>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockEvent[]>()
  return webdockFetch<WebdockEvent[]>(`/servers/${encodeURIComponent(slug)}/events`)
}

/** List public keys on the Webdock account. */
export async function listWebdockPublicKeys(): Promise<WebdockCallResult<WebdockPublicKey[]>> {
  return webdockFetch<WebdockPublicKey[]>('/publickeys')
}

/** List shell users for a server. */
export async function listWebdockShellUsers(slug: string): Promise<WebdockCallResult<WebdockShellUser[]>> {
  if (!isValidSlug(slug)) return invalidSlugResult<WebdockShellUser[]>()
  return webdockFetch<WebdockShellUser[]>(`/servers/${encodeURIComponent(slug)}/shellUsers`)
}

/**
 * Check if the stored/provided token is valid by attempting to list servers.
 * Returns a lightweight status object.
 */
export async function testWebdockConnection(inlineToken?: string): Promise<{
  success: boolean
  serverCount: number
  latencyMs: number
  error: string | null
}> {
  const token = inlineToken?.trim() || (await resolveWebdockToken())

  if (!token) {
    return { success: false, serverCount: 0, latencyMs: 0, error: 'No Webdock API token configured' }
  }

  const start = Date.now()
  try {
    const res = await fetch(`${WEBDOCK_BASE_URL}/servers`, {
      headers: buildHeaders(token),
      signal: AbortSignal.timeout(WEBDOCK_TIMEOUT),
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      return {
        success: false,
        serverCount: 0,
        latencyMs,
        error: res.status === 401
          ? 'Invalid token — Webdock returned 401 Unauthorized'
          : `Webdock API returned HTTP ${res.status}`,
      }
    }

    const data = await res.json() as WebdockServer[]
    return { success: true, serverCount: Array.isArray(data) ? data.length : 0, latencyMs, error: null }
  } catch (err) {
    return {
      success: false,
      serverCount: 0,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}
