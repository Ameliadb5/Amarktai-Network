/**
 * Amarktai Network — Webhook System (In-Memory)
 *
 * Lightweight synchronous webhook registry for tests and runtime use cases
 * that do not require DB persistence. Provides synchronous register/list/
 * unregister operations and an async emit helper.
 *
 * For DB-backed webhook management see webhook-manager.ts.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string
  appSlug: string
  url: string
  events: string[]
  active: boolean
  createdAt: Date
}

export interface WebhookEmitEvent {
  id: string
  type: string
  appSlug: string
  data: Record<string, unknown>
  timestamp: string
}

export interface WebhookDeliveryEntry {
  id: string
  webhookId: string
  eventType: string
  deliveredAt: Date
  statusCode: number
  success: boolean
}

export interface WebhookStats {
  totalSubscriptions: number
  activeSubscriptions: number
  totalDeliveries: number
}

// ── In-Memory State ──────────────────────────────────────────────────────────

const subscriptions = new Map<string, WebhookSubscription>()
const deliveryLog: WebhookDeliveryEntry[] = []

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Register a new webhook subscription.
 * Returns the created subscription synchronously.
 */
export function registerWebhook(
  appSlug: string,
  url: string,
  events: string[],
): WebhookSubscription {
  const sub: WebhookSubscription = {
    id: randomUUID(),
    appSlug,
    url,
    events,
    active: true,
    createdAt: new Date(),
  }
  subscriptions.set(sub.id, sub)
  return sub
}

/**
 * Unregister a webhook subscription by id.
 * Returns true if found and removed, false otherwise.
 */
export function unregisterWebhook(id: string): boolean {
  return subscriptions.delete(id)
}

/**
 * List all active webhook subscriptions for an app.
 */
export function listWebhooks(appSlug: string): WebhookSubscription[] {
  return Array.from(subscriptions.values()).filter(
    (s) => s.appSlug === appSlug && s.active,
  )
}

/**
 * Emit a webhook event and record it in the delivery log.
 * Delivery is fire-and-forget in this implementation (no actual HTTP call).
 */
export async function emitWebhookEvent(
  type: string,
  appSlug: string,
  data: Record<string, unknown> = {},
): Promise<WebhookEmitEvent> {
  const event: WebhookEmitEvent = {
    id: randomUUID(),
    type,
    appSlug,
    data,
    timestamp: new Date().toISOString(),
  }

  // Record a delivery entry for each matching subscription
  const matching = Array.from(subscriptions.values()).filter(
    (s) => s.active && s.appSlug === appSlug && s.events.includes(type),
  )

  for (const sub of matching) {
    deliveryLog.push({
      id: randomUUID(),
      webhookId: sub.id,
      eventType: type,
      deliveredAt: new Date(),
      statusCode: 200,
      success: true,
    })
  }

  return event
}

/**
 * Retrieve the delivery log (all entries or filtered by webhookId).
 */
export function getDeliveryLog(webhookId?: string): WebhookDeliveryEntry[] {
  if (webhookId) return deliveryLog.filter((e) => e.webhookId === webhookId)
  return [...deliveryLog]
}

/**
 * Return aggregate statistics about the webhook registry.
 */
export function getWebhookStats(): WebhookStats {
  const all = Array.from(subscriptions.values())
  return {
    totalSubscriptions: all.length,
    activeSubscriptions: all.filter((s) => s.active).length,
    totalDeliveries: deliveryLog.length,
  }
}
