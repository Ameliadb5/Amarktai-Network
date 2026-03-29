import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authenticateApp } from '@/lib/brain'
import { scanContent } from '@/lib/content-filter'

// ── Request schema ────────────────────────────────────────────────────────────

const streamRequestSchema = z.object({
  appId: z.string().min(1).max(200),
  appSecret: z.string().min(1),
  taskType: z.string().min(1).max(100),
  message: z.string().min(1).max(32_000),
  traceId: z.string().optional(),
})

/**
 * POST /api/brain/stream
 *
 * Server-Sent Events (SSE) streaming endpoint for real-time AI responses.
 * Returns a text/event-stream response that clients can consume with EventSource.
 *
 * Events emitted:
 *   - `data: {"type":"chunk","content":"..."}` — incremental response text
 *   - `data: {"type":"done","traceId":"..."}` — stream complete
 *   - `data: {"type":"error","message":"..."}` — error occurred
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof streamRequestSchema>
  try {
    const raw = await request.json()
    body = streamRequestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof z.ZodError
          ? `Invalid request: ${err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
          : 'Invalid JSON body',
      },
      { status: 422 },
    )
  }

  const traceId = body.traceId || randomUUID()

  // ── Content filter ────────────────────────────────────────────────────
  const inputFilter = scanContent(body.message)
  if (inputFilter.flagged) {
    return NextResponse.json(
      { error: 'Input blocked by safety filter', traceId, categories: inputFilter.categories },
      { status: 403 },
    )
  }

  // ── Auth ──────────────────────────────────────────────────────────────
  const auth = await authenticateApp(body.appId, body.appSecret)
  if (!auth.ok || !auth.app) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized', traceId },
      { status: auth.statusCode },
    )
  }

  // ── Stream response via SSE ──────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Check for OpenAI API key for real streaming
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
          // Stub mode: simulate streaming response
          send({ type: 'chunk', content: `[Stream stub] Processing: "${body.message.slice(0, 100)}"` })
          send({ type: 'chunk', content: ' — No API key configured for real streaming.' })
          send({ type: 'done', traceId, model: 'stub', provider: 'none' })
          controller.close()
          return
        }

        // Real OpenAI streaming
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: `You are a helpful assistant for ${auth.app.name}.` },
              { role: 'user', content: body.message },
            ],
            stream: true,
          }),
        })

        if (!response.ok || !response.body) {
          send({ type: 'error', message: 'Upstream provider error' })
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                send({ type: 'done', traceId, model: 'gpt-4o-mini', provider: 'openai' })
                controller.close()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  send({ type: 'chunk', content })
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }
        }

        send({ type: 'done', traceId, model: 'gpt-4o-mini', provider: 'openai' })
        controller.close()
      } catch (err) {
        send({ type: 'error', message: String(err) })
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Trace-Id': traceId,
    },
  })
}
