/**
 * SSE Event Stream — AmarktAI Network
 *
 * Server-Sent Events endpoint for real-time dashboard updates.
 * Streams: job progress, artifact completion, alerts, agent activity.
 *
 * GET /api/system/events
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { emitSystemEvent as _emit, getEventListenerCount } from '@/lib/event-bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.isLoggedIn) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { subscribe } = await import('@/lib/event-bus')

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), listeners: getEventListenerCount() + 1 })}\n\n`
      controller.enqueue(encoder.encode(connectEvent))

      // Subscribe to system events
      unsubscribe = subscribe((event) => {
        try {
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(sseData))
        } catch {
          cleanup()
        }
      })

      // Heartbeat every 30 seconds
      heartbeatInterval = setInterval(() => {
        try {
          const hb = `event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), listeners: getEventListenerCount() })}\n\n`
          controller.enqueue(encoder.encode(hb))
        } catch {
          cleanup()
        }
      }, 30_000)

      function cleanup() {
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null }
      }

      request.signal.addEventListener('abort', () => {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() {
      if (unsubscribe) unsubscribe()
      if (heartbeatInterval) clearInterval(heartbeatInterval)
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
