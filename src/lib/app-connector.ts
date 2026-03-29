/**
 * App Connector — AmarktAI Network
 *
 * Universal app connector that monitors all connected apps.
 * Tracks heartbeats, metrics, and events from each app.
 * The brain uses this data to learn from all apps collectively.
 *
 * Features:
 *   - Heartbeat tracking (app liveness)
 *   - Metrics collection (request counts, latency, errors)
 *   - Event aggregation (cross-app intelligence)
 *   - Rate limiting per app
 *   - Request queue for heavy jobs
 *
 * Server-side only.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface AppHeartbeat {
  appSlug: string
  status: 'healthy' | 'degraded' | 'offline'
  version?: string
  uptime?: number
  timestamp: string
}

export interface AppMetrics {
  appSlug: string
  requestCount: number
  errorCount: number
  avgLatencyMs: number
  lastRequestAt: string | null
  activeUsers?: number
}

export interface AppEvent {
  appSlug: string
  eventType: string
  payload: Record<string, unknown>
  timestamp: string
}

export interface ConnectedApp {
  appSlug: string
  lastHeartbeat: AppHeartbeat | null
  metrics: AppMetrics
  recentEvents: AppEvent[]
  rateLimitState: RateLimitState
}

export interface RateLimitState {
  appSlug: string
  requestsThisMinute: number
  maxRequestsPerMinute: number
  blocked: boolean
  resetAt: string
}

// ── In-memory storage ───────────────────────────────────────────────

const connectedApps = new Map<string, ConnectedApp>()
const requestQueue: Array<{ appSlug: string; taskType: string; priority: number; queuedAt: string }> = []

// ── Default rate limits ─────────────────────────────────────────────

const DEFAULT_RATE_LIMIT = 60 // requests per minute
const rateLimitOverrides = new Map<string, number>()

// ── App Registration & Heartbeat ────────────────────────────────────

function getOrCreateApp(appSlug: string): ConnectedApp {
  let app = connectedApps.get(appSlug)
  if (!app) {
    app = {
      appSlug,
      lastHeartbeat: null,
      metrics: {
        appSlug,
        requestCount: 0,
        errorCount: 0,
        avgLatencyMs: 0,
        lastRequestAt: null,
      },
      recentEvents: [],
      rateLimitState: {
        appSlug,
        requestsThisMinute: 0,
        maxRequestsPerMinute: rateLimitOverrides.get(appSlug) ?? DEFAULT_RATE_LIMIT,
        blocked: false,
        resetAt: new Date(Date.now() + 60_000).toISOString(),
      },
    }
    connectedApps.set(appSlug, app)
  }
  return app
}

/**
 * Record a heartbeat from a connected app.
 */
export function recordHeartbeat(appSlug: string, status: AppHeartbeat['status'] = 'healthy', version?: string, uptime?: number): AppHeartbeat {
  const app = getOrCreateApp(appSlug)
  const heartbeat: AppHeartbeat = {
    appSlug,
    status,
    version,
    uptime,
    timestamp: new Date().toISOString(),
  }
  app.lastHeartbeat = heartbeat
  return heartbeat
}

/**
 * Record a request from an app (updates metrics).
 */
export function recordAppRequest(appSlug: string, latencyMs: number, success: boolean): void {
  const app = getOrCreateApp(appSlug)
  const m = app.metrics
  const totalLatency = m.avgLatencyMs * m.requestCount + latencyMs
  m.requestCount++
  m.avgLatencyMs = Math.round(totalLatency / m.requestCount)
  if (!success) m.errorCount++
  m.lastRequestAt = new Date().toISOString()

  // Update rate limit counter
  app.rateLimitState.requestsThisMinute++
}

/**
 * Record an event from an app.
 */
export function recordAppEvent(appSlug: string, eventType: string, payload: Record<string, unknown> = {}): AppEvent {
  const app = getOrCreateApp(appSlug)
  const event: AppEvent = {
    appSlug,
    eventType,
    payload,
    timestamp: new Date().toISOString(),
  }
  app.recentEvents.push(event)
  // Keep only last 100 events per app
  if (app.recentEvents.length > 100) {
    app.recentEvents = app.recentEvents.slice(-100)
  }
  return event
}

// ── Rate Limiting ───────────────────────────────────────────────────

/**
 * Set rate limit for a specific app.
 */
export function setAppRateLimit(appSlug: string, maxPerMinute: number): void {
  rateLimitOverrides.set(appSlug, maxPerMinute)
  const app = connectedApps.get(appSlug)
  if (app) {
    app.rateLimitState.maxRequestsPerMinute = maxPerMinute
  }
}

/**
 * Check if an app is rate-limited.
 * Resets the counter if the window has expired.
 */
export function checkRateLimit(appSlug: string): RateLimitState {
  const app = getOrCreateApp(appSlug)
  const now = new Date()
  const resetAt = new Date(app.rateLimitState.resetAt)

  // Reset window if expired
  if (now >= resetAt) {
    app.rateLimitState.requestsThisMinute = 0
    app.rateLimitState.resetAt = new Date(now.getTime() + 60_000).toISOString()
    app.rateLimitState.blocked = false
  }

  // Check if blocked
  app.rateLimitState.blocked = app.rateLimitState.requestsThisMinute >= app.rateLimitState.maxRequestsPerMinute

  return { ...app.rateLimitState }
}

// ── Request Queue (for heavy jobs like video) ───────────────────────

/**
 * Add a request to the queue.
 */
export function enqueueRequest(appSlug: string, taskType: string, priority = 5): number {
  requestQueue.push({
    appSlug,
    taskType,
    priority,
    queuedAt: new Date().toISOString(),
  })
  // Sort by priority (lower = higher priority)
  requestQueue.sort((a, b) => a.priority - b.priority)
  return requestQueue.length
}

/**
 * Dequeue the next request.
 */
export function dequeueRequest(): { appSlug: string; taskType: string; priority: number; queuedAt: string } | null {
  return requestQueue.shift() ?? null
}

/**
 * Get queue length.
 */
export function getQueueLength(): number {
  return requestQueue.length
}

// ── Monitoring / Status ─────────────────────────────────────────────

/**
 * Get all connected apps with their status.
 */
export function getAllConnectedApps(): ConnectedApp[] {
  return Array.from(connectedApps.values())
}

/**
 * Get a specific connected app.
 */
export function getConnectedApp(appSlug: string): ConnectedApp | null {
  return connectedApps.get(appSlug) ?? null
}

/**
 * Get aggregate metrics across all apps.
 */
export function getAggregateMetrics(): {
  totalApps: number
  healthyApps: number
  degradedApps: number
  offlineApps: number
  totalRequests: number
  totalErrors: number
  avgLatencyMs: number
  queueLength: number
} {
  const apps = Array.from(connectedApps.values())
  const healthy = apps.filter(a => a.lastHeartbeat?.status === 'healthy').length
  const degraded = apps.filter(a => a.lastHeartbeat?.status === 'degraded').length
  const offline = apps.filter(a => !a.lastHeartbeat || a.lastHeartbeat.status === 'offline').length

  const totalRequests = apps.reduce((sum, a) => sum + a.metrics.requestCount, 0)
  const totalErrors = apps.reduce((sum, a) => sum + a.metrics.errorCount, 0)
  const latencies = apps.filter(a => a.metrics.requestCount > 0).map(a => a.metrics.avgLatencyMs)
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
    : 0

  return {
    totalApps: apps.length,
    healthyApps: healthy,
    degradedApps: degraded,
    offlineApps: offline,
    totalRequests,
    totalErrors,
    avgLatencyMs: avgLatency,
    queueLength: requestQueue.length,
  }
}
