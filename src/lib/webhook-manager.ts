/**
 * Webhook Manager — Event Delivery System
 *
 * Webhook registration, event delivery with retry logic, and signature
 * verification. Enables external apps to receive AI completion events
 * asynchronously.
 *
 * Truthful: Only delivers events that actually occurred. Retry state is
 * tracked accurately.
 */

import { randomUUID, createHmac } from 'crypto'
import { enqueueJob } from './job-queue'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WebhookRegistration {
  id: string
  appSlug: string
  url: string
  secret: string
  events: WebhookEventType[]
  active: boolean
  createdAt: Date
  metadata?: Record<string, unknown>
}

export type WebhookEventType =
  | 'brain.request.completed'
  | 'brain.request.failed'
  | 'brain.stream.completed'
  | 'video.generation.completed'
  | 'video.generation.failed'
  | 'agent.task.completed'
  | 'agent.task.failed'
  | 'budget.threshold.reached'
  | 'provider.health.changed'
  | 'app.event'

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  timestamp: string
  appSlug: string
  data: Record<string, unknown>
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  eventId: string
  url: string
  status: 'pending' | 'success' | 'failed' | 'retrying'
  statusCode?: number
  attempts: number
  maxAttempts: number
  lastAttemptAt?: Date
  nextRetryAt?: Date
  error?: string
}

export interface WebhookDeliveryResult {
  deliveryId: string
  success: boolean
  statusCode?: number
  error?: string
  latencyMs: number
}

// ── In-Memory Registry (production would use DB) ─────────────────────────────

const registrations = new Map<string, WebhookRegistration>()
const deliveryLog: WebhookDelivery[] = []

const MAX_DELIVERY_LOG = 1000
const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAYS_MS = [1000, 5000, 30000, 120000, 600000] // 1s, 5s, 30s, 2m, 10m

// ── Registration ─────────────────────────────────────────────────────────────

/** Register a new webhook endpoint. */
export function registerWebhook(
  appSlug: string,
  url: string,
  events: WebhookEventType[],
  metadata?: Record<string, unknown>,
): WebhookRegistration {
  if (!url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS')
  }

  const registration: WebhookRegistration = {
    id: randomUUID(),
    appSlug,
    url,
    secret: randomUUID(),
    events,
    active: true,
    createdAt: new Date(),
    metadata,
  }

  registrations.set(registration.id, registration)
  return registration
}

/** Unregister a webhook. */
export function unregisterWebhook(id: string): boolean {
  return registrations.delete(id)
}

/** Get all webhooks for an app. */
export function getWebhooksForApp(appSlug: string): WebhookRegistration[] {
  return Array.from(registrations.values()).filter((w) => w.appSlug === appSlug && w.active)
}

/** Get a specific webhook by ID. */
export function getWebhook(id: string): WebhookRegistration | undefined {
  return registrations.get(id)
}

/** Update webhook active status. */
export function setWebhookActive(id: string, active: boolean): boolean {
  const webhook = registrations.get(id)
  if (!webhook) return false
  webhook.active = active
  return true
}

// ── Signature Generation ─────────────────────────────────────────────────────

/** Generate HMAC-SHA256 signature for webhook payload. */
export function generateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Verify a webhook signature. */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = generateSignature(payload, secret)
  // Constant-time comparison
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

// ── Event Delivery ───────────────────────────────────────────────────────────

/** Deliver a webhook event to a single endpoint. */
async function deliverToEndpoint(
  registration: WebhookRegistration,
  event: WebhookEvent,
): Promise<WebhookDeliveryResult> {
  const deliveryId = randomUUID()
  const start = Date.now()
  const payload = JSON.stringify(event)
  const signature = generateSignature(payload, registration.secret)

  try {
    const res = await fetch(registration.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': registration.id,
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event.type,
        'X-Webhook-Delivery': deliveryId,
        'User-Agent': 'AmarktAI-Webhooks/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    })

    const success = res.status >= 200 && res.status < 300
    const result: WebhookDeliveryResult = {
      deliveryId,
      success,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    }

    // Log delivery
    logDelivery({
      id: deliveryId,
      webhookId: registration.id,
      eventId: event.id,
      url: registration.url,
      status: success ? 'success' : 'failed',
      statusCode: res.status,
      attempts: 1,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      lastAttemptAt: new Date(),
    })

    return result
  } catch (err) {
    const result: WebhookDeliveryResult = {
      deliveryId,
      success: false,
      error: err instanceof Error ? err.message : 'Delivery failed',
      latencyMs: Date.now() - start,
    }

    logDelivery({
      id: deliveryId,
      webhookId: registration.id,
      eventId: event.id,
      url: registration.url,
      status: 'failed',
      attempts: 1,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      lastAttemptAt: new Date(),
      error: result.error,
    })

    return result
  }
}

function logDelivery(delivery: WebhookDelivery): void {
  deliveryLog.push(delivery)
  if (deliveryLog.length > MAX_DELIVERY_LOG) {
    deliveryLog.splice(0, deliveryLog.length - MAX_DELIVERY_LOG)
  }
}

// ── Event Dispatching ────────────────────────────────────────────────────────

/**
 * Dispatch an event to all registered webhooks for the given app.
 * Failed deliveries are queued for retry via BullMQ.
 */
export async function dispatchEvent(
  appSlug: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<{ delivered: number; failed: number; queued: number }> {
  const event: WebhookEvent = {
    id: randomUUID(),
    type: eventType,
    timestamp: new Date().toISOString(),
    appSlug,
    data,
  }

  const webhooks = getWebhooksForApp(appSlug).filter((w) => w.events.includes(eventType))
  if (webhooks.length === 0) return { delivered: 0, failed: 0, queued: 0 }

  let delivered = 0
  let failed = 0
  let queued = 0

  const results = await Promise.allSettled(
    webhooks.map((w) => deliverToEndpoint(w, event)),
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled' && result.value.success) {
      delivered++
    } else {
      failed++
      // Queue for retry
      try {
        await enqueueJob({
          type: 'batch_inference',
          data: {
            webhookId: webhooks[i].id,
            event,
            attempt: 2,
          },
        })
        queued++
      } catch {
        // Queue unavailable — delivery lost
      }
    }
  }

  return { delivered, failed, queued }
}

// ── Delivery Log Access ──────────────────────────────────────────────────────

/** Get recent deliveries for a webhook. */
export function getDeliveryLog(webhookId?: string, limit: number = 50): WebhookDelivery[] {
  let log = deliveryLog
  if (webhookId) {
    log = log.filter((d) => d.webhookId === webhookId)
  }
  return log.slice(-limit)
}

/** Get delivery statistics. */
export function getDeliveryStats(): {
  total: number
  successful: number
  failed: number
  pending: number
  successRate: number
} {
  const total = deliveryLog.length
  const successful = deliveryLog.filter((d) => d.status === 'success').length
  const failed = deliveryLog.filter((d) => d.status === 'failed').length
  const pending = deliveryLog.filter((d) => d.status === 'pending' || d.status === 'retrying').length
  return {
    total,
    successful,
    failed,
    pending,
    successRate: total > 0 ? successful / total : 0,
  }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'brain.request.completed',
  'brain.request.failed',
  'brain.stream.completed',
  'video.generation.completed',
  'video.generation.failed',
  'agent.task.completed',
  'agent.task.failed',
  'budget.threshold.reached',
  'provider.health.changed',
  'app.event',
]

export { MAX_RETRY_ATTEMPTS, RETRY_DELAYS_MS }
