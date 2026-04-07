import { NextRequest, NextResponse } from 'next/server'
import {
  registerWebhook,
  unregisterWebhook,
  getWebhooksForApp,
  getDeliveryLog,
  getDeliveryStats,
  dispatchEvent,
  type WebhookEventType,
} from '@/lib/webhook-manager'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'register') {
      const { url, events, appSlug, metadata } = body
      if (!url || !events?.length) {
        return NextResponse.json({ error: 'url and events required' }, { status: 400 })
      }
      const webhook = await registerWebhook(
        appSlug || 'default',
        url,
        events as WebhookEventType[],
        metadata,
      )
      return NextResponse.json({ success: true, webhook })
    }

    if (action === 'dispatch') {
      const { appSlug, eventType, data } = body
      if (!appSlug || !eventType) {
        return NextResponse.json({ error: 'appSlug and eventType required' }, { status: 400 })
      }
      const result = await dispatchEvent(appSlug, eventType, data || {})
      return NextResponse.json({ success: true, result })
    }

    if (action === 'remove') {
      const { webhookId } = body
      if (!webhookId) {
        return NextResponse.json({ error: 'webhookId required' }, { status: 400 })
      }
      const removed = await unregisterWebhook(webhookId)
      return NextResponse.json({ success: removed })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: register, dispatch, remove' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const appSlug = searchParams.get('appSlug') || 'default'
    const webhookId = searchParams.get('webhookId')

    const webhooks = await getWebhooksForApp(appSlug)
    const stats = await getDeliveryStats()
    const deliveries = await getDeliveryLog(webhookId || undefined, 50)

    return NextResponse.json({ webhooks, stats, deliveries })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list webhooks'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
