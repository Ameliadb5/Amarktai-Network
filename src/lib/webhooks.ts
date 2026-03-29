/**
 * Webhook System — AmarktAI Network
 *
 * Outbound webhook event system for notifying connected apps
 * when important events occur in the brain.
 *
 * Event types:
 *   - task_completed  — AI task finished successfully
 *   - alert_triggered — safety or health alert fired
 *   - budget_warning  — provider budget threshold crossed
 *   - app_heartbeat   — periodic health status
 *
 * Server-side only.
 */

// ── Types ────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'task_completed'
  | 'alert_triggered'
  | 'budget_warning'
  | 'app_heartbeat'

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  appSlug: string
  timestamp: string
  payload: Record<string, unknown>
}

export interface WebhookSubscription {
  id: string
  appSlug: string
  url: string
  events: WebhookEventType[]
  secret?: string
  active: boolean
  createdAt: string
}

export interface WebhookDelivery {
  eventId: string
  subscriptionId: string
  status: 'pending' | 'delivered' | 'failed'
  statusCode?: number
  attempts: number
  lastAttemptAt?: string
  error?: string
}

// ── In-memory storage (future: move to DB) ──────────────────────────

const subscriptions = new Map<string, WebhookSubscription>()
const deliveryLog: WebhookDelivery[] = []
let eventCounter = 0

// ── Subscription management ─────────────────────────────────────────

/**
 * Register a webhook subscription for an app.
 */
export function registerWebhook(
  appSlug: string,
  url: string,
  events: WebhookEventType[],
  secret?: string,
): WebhookSubscription {
  const id = `wh_${++eventCounter}_${Date.now()}`
  const sub: WebhookSubscription = {
    id,
    appSlug,
    url,
    events,
    secret,
    active: true,
    createdAt: new Date().toISOString(),
  }
  subscriptions.set(id, sub)
  return sub
}

/**
 * Unregister a webhook subscription.
 */
export function unregisterWebhook(subscriptionId: string): boolean {
  return subscriptions.delete(subscriptionId)
}

/**
 * List all subscriptions for an app.
 */
export function listWebhooks(appSlug?: string): WebhookSubscription[] {
  const all = Array.from(subscriptions.values())
  if (appSlug) return all.filter(s => s.appSlug === appSlug)
  return all
}

// ── Event dispatch ──────────────────────────────────────────────────

/**
 * Emit a webhook event to all subscribed endpoints.
 * Delivery is best-effort with retry on failure.
 */
export async function emitWebhookEvent(
  type: WebhookEventType,
  appSlug: string,
  payload: Record<string, unknown>,
): Promise<WebhookEvent> {
  const event: WebhookEvent = {
    id: `evt_${++eventCounter}_${Date.now()}`,
    type,
    appSlug,
    timestamp: new Date().toISOString(),
    payload,
  }

  // Find matching subscriptions
  const matchingSubs = Array.from(subscriptions.values()).filter(
    s => s.active && (s.appSlug === appSlug || s.appSlug === '*') && s.events.includes(type),
  )

  // Deliver to each subscriber (fire-and-forget, no await blocking)
  for (const sub of matchingSubs) {
    deliverToSubscriber(event, sub).catch(() => {
      // Delivery failures are logged but don't throw
    })
  }

  return event
}

/**
 * Deliver an event to a single subscriber with retry.
 */
async function deliverToSubscriber(
  event: WebhookEvent,
  sub: WebhookSubscription,
  maxRetries = 3,
): Promise<void> {
  const delivery: WebhookDelivery = {
    eventId: event.id,
    subscriptionId: sub.id,
    status: 'pending',
    attempts: 0,
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    delivery.attempts = attempt
    delivery.lastAttemptAt = new Date().toISOString()

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event.type,
        'X-Webhook-Id': event.id,
      }
      if (sub.secret) {
        headers['X-Webhook-Secret'] = sub.secret
      }

      const response = await fetch(sub.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10_000), // 10s timeout
      })

      delivery.statusCode = response.status
      if (response.ok) {
        delivery.status = 'delivered'
        deliveryLog.push(delivery)
        return
      }
    } catch (err) {
      delivery.error = err instanceof Error ? err.message : String(err)
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }

  delivery.status = 'failed'
  deliveryLog.push(delivery)
}

// ── Delivery log ────────────────────────────────────────────────────

/**
 * Get recent delivery log entries.
 */
export function getDeliveryLog(limit = 50): WebhookDelivery[] {
  return deliveryLog.slice(-limit)
}

/**
 * Get delivery stats summary.
 */
export function getWebhookStats(): {
  totalSubscriptions: number
  activeSubscriptions: number
  totalDeliveries: number
  successfulDeliveries: number
  failedDeliveries: number
} {
  const active = Array.from(subscriptions.values()).filter(s => s.active)
  const successful = deliveryLog.filter(d => d.status === 'delivered')
  const failed = deliveryLog.filter(d => d.status === 'failed')

  return {
    totalSubscriptions: subscriptions.size,
    activeSubscriptions: active.length,
    totalDeliveries: deliveryLog.length,
    successfulDeliveries: successful.length,
    failedDeliveries: failed.length,
  }
}
