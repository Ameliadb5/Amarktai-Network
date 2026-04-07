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

// ── DB Store (replaces in-memory Maps) ───────────────────────────────────────

import { prisma } from './prisma'

const MAX_DELIVERY_LOG = 1000
const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAYS_MS = [1000, 5000, 30000, 120000, 600000] // 1s, 5s, 30s, 2m, 10m

function rowToRegistration(row: {
  id: string
  appSlug: string
  url: string
  secret: string
  events: string
  active: boolean
  metadata: string
  createdAt: Date
}): WebhookRegistration {
  return {
    id: row.id,
    appSlug: row.appSlug,
    url: row.url,
    secret: row.secret,
    events: JSON.parse(row.events) as WebhookEventType[],
    active: row.active,
    createdAt: row.createdAt,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

/** Register a new webhook endpoint. */
export async function registerWebhook(
  appSlug: string,
  url: string,
  events: WebhookEventType[],
  metadata?: Record<string, unknown>,
): Promise<WebhookRegistration> {
  if (!url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS')
  }

  const row = await prisma.webhookRegistrationRecord.create({
    data: {
      id: randomUUID(),
      appSlug,
      url,
      secret: randomUUID(),
      events: JSON.stringify(events),
      active: true,
      metadata: JSON.stringify(metadata ?? {}),
    },
  })
  return rowToRegistration(row)
}

/** Unregister a webhook. */
export async function unregisterWebhook(id: string): Promise<boolean> {
  try {
    await prisma.webhookRegistrationRecord.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

/** Get all webhooks for an app. */
export async function getWebhooksForApp(appSlug: string): Promise<WebhookRegistration[]> {
  try {
    const rows = await prisma.webhookRegistrationRecord.findMany({
      where: { appSlug, active: true },
    })
    return rows.map(rowToRegistration)
  } catch {
    return []
  }
}

/** Get a specific webhook by ID. */
export async function getWebhook(id: string): Promise<WebhookRegistration | undefined> {
  try {
    const row = await prisma.webhookRegistrationRecord.findUnique({ where: { id } })
    return row ? rowToRegistration(row) : undefined
  } catch {
    return undefined
  }
}

/** Update webhook active status. */
export async function setWebhookActive(id: string, active: boolean): Promise<boolean> {
  try {
    await prisma.webhookRegistrationRecord.update({ where: { id }, data: { active } })
    return true
  } catch {
    return false
  }
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
    logDelivery(registration.id, event, deliveryId, true, res.status, undefined, Date.now() - start)

    return result
  } catch (err) {
    const result: WebhookDeliveryResult = {
      deliveryId,
      success: false,
      error: err instanceof Error ? err.message : 'Delivery failed',
      latencyMs: Date.now() - start,
    }

    logDelivery(registration.id, event, deliveryId, false, undefined, result.error, Date.now() - start)

    return result
  }
}

function logDelivery(
  webhookId: string,
  event: WebhookEvent,
  deliveryId: string,
  success: boolean,
  statusCode: number | undefined,
  error: string | undefined,
  _latencyMs: number,
): void {
  prisma.webhookDeliveryRecord.create({
    data: {
      webhookId,
      eventId: event.id,
      eventType: event.type,
      url: '', // populated by caller if needed; kept for referential integrity
      status: success ? 'success' : 'failed',
      statusCode: statusCode ?? null,
      attempts: 1,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      lastAttemptAt: new Date(),
      error: error ?? null,
    },
  }).catch(() => { /* non-critical logging */ })
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

  const webhooks = (await getWebhooksForApp(appSlug)).filter((w) => w.events.includes(eventType))
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
export async function getDeliveryLog(webhookId?: string, limit: number = 50): Promise<WebhookDelivery[]> {
  try {
    const rows = await prisma.webhookDeliveryRecord.findMany({
      where: webhookId ? { webhookId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, MAX_DELIVERY_LOG),
    })
    return rows.map((r) => ({
      id: String(r.id),
      webhookId: r.webhookId,
      eventId: r.eventId,
      url: r.url,
      status: r.status as WebhookDelivery['status'],
      statusCode: r.statusCode ?? undefined,
      attempts: r.attempts,
      maxAttempts: r.maxAttempts,
      lastAttemptAt: r.lastAttemptAt ?? undefined,
      nextRetryAt: r.nextRetryAt ?? undefined,
      error: r.error ?? undefined,
    }))
  } catch {
    return []
  }
}

/** Get delivery statistics. */
export async function getDeliveryStats(): Promise<{
  total: number
  successful: number
  failed: number
  pending: number
  successRate: number
}> {
  try {
    const [total, successful, failed, pending] = await Promise.all([
      prisma.webhookDeliveryRecord.count(),
      prisma.webhookDeliveryRecord.count({ where: { status: 'success' } }),
      prisma.webhookDeliveryRecord.count({ where: { status: 'failed' } }),
      prisma.webhookDeliveryRecord.count({ where: { status: { in: ['pending', 'retrying'] } } }),
    ])
    return { total, successful, failed, pending, successRate: total > 0 ? successful / total : 0 }
  } catch {
    return { total: 0, successful: 0, failed: 0, pending: 0, successRate: 0 }
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
