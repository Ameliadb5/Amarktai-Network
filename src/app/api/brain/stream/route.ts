import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authenticateApp, getVaultApiKey, callProvider } from '@/lib/brain'
import { scanContent } from '@/lib/content-filter'

// ── Provider streaming configuration ──────────────────────────────────────────

/** Base URLs for OpenAI-compatible streaming providers */
const STREAMING_PROVIDERS: Record<string, { baseUrl: string }> = {
  openai:     { baseUrl: 'https://api.openai.com' },
  groq:       { baseUrl: 'https://api.groq.com/openai' },
  deepseek:   { baseUrl: 'https://api.deepseek.com' },
  openrouter: { baseUrl: 'https://openrouter.ai/api' },
  together:   { baseUrl: 'https://api.together.xyz' },
  grok:       { baseUrl: 'https://api.x.ai' },
  qwen:       { baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode' },
  nvidia:     { baseUrl: 'https://integrate.api.nvidia.com' },
  mistral:    { baseUrl: 'https://api.mistral.ai' },
}

/** Default models per provider for streaming */
const DEFAULT_STREAM_MODELS: Record<string, string> = {
  openai:     'gpt-4o-mini',
  groq:       'llama-3.3-70b-versatile',
  deepseek:   'deepseek-chat',
  openrouter: 'openai/gpt-4o-mini',
  together:   'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  grok:       'grok-2-latest',
  qwen:       'qwen-turbo',
  nvidia:     'nvidia/llama-3.1-nemotron-70b-instruct',
  gemini:     'gemini-2.0-flash',
  anthropic:  'claude-sonnet-4-20250514',
  cohere:     'command-r-plus',
  mistral:    'mistral-small-latest',
}

// ── Request schema ────────────────────────────────────────────────────────────

const streamRequestSchema = z.object({
  appId: z.string().min(1).max(200),
  appSecret: z.string().min(1),
  taskType: z.string().min(1).max(100),
  message: z.string().min(1).max(32_000),
  traceId: z.string().optional(),
  /** Preferred provider for streaming (default: auto-select first available) */
  provider: z.string().optional(),
  /** Preferred model (default: provider default) */
  model: z.string().optional(),
  /** System prompt override */
  systemPrompt: z.string().max(4000).optional(),
})

/**
 * POST /api/brain/stream
 *
 * Server-Sent Events (SSE) streaming endpoint for real-time AI responses.
 * Supports ALL 14 providers: OpenAI, Groq, DeepSeek, OpenRouter, Together,
 * Grok, Qwen, NVIDIA, Mistral (OpenAI-compatible streaming), Gemini,
 * Anthropic, Cohere (provider-specific streaming), plus HuggingFace and
 * Replicate (non-streaming fallback via callProvider).
 *
 * Events emitted:
 *   - `data: {"type":"chunk","content":"..."}` — incremental response text
 *   - `data: {"type":"done","traceId":"...","model":"...","provider":"..."}` — stream complete
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

  // ── Resolve provider and model ────────────────────────────────────────
  const resolvedProvider = await resolveProvider(body.provider)
  if (!resolvedProvider) {
    return NextResponse.json(
      { error: 'No streaming provider is configured — add at least one API key.', traceId },
      { status: 503 },
    )
  }
  const resolvedModel = body.model || DEFAULT_STREAM_MODELS[resolvedProvider] || 'gpt-4o-mini'

  // ── Stream response via SSE ──────────────────────────────────────────
  const encoder = new TextEncoder()
  const appName = auth.app.name
  const systemPrompt = body.systemPrompt || `You are a helpful assistant for ${appName}.`

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // ── Anthropic streaming (Messages API with SSE) ──────────────
        if (resolvedProvider === 'anthropic') {
          const apiKey = await getVaultApiKey('anthropic')
          if (!apiKey) {
            send({ type: 'error', message: 'Provider anthropic is not configured — add an API key via Admin → AI Providers.' })
            controller.close()
            return
          }

          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: resolvedModel,
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: 'user', content: body.message }],
              stream: true,
            }),
          })

          if (!response.ok || !response.body) {
            send({ type: 'error', message: `Anthropic HTTP ${response.status}` })
            controller.close()
            return
          }

          await processSSEStream(response.body, (data) => {
            // Anthropic SSE format: content_block_delta events
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                send({ type: 'chunk', content: parsed.delta.text })
              } else if (parsed.type === 'message_stop') {
                send({ type: 'done', traceId, model: resolvedModel, provider: 'anthropic' })
              }
            } catch { /* skip */ }
          })

          send({ type: 'done', traceId, model: resolvedModel, provider: 'anthropic' })
          controller.close()
          return
        }

        // ── Gemini streaming (generateContent with stream) ───────────
        if (resolvedProvider === 'gemini') {
          const apiKey = await getVaultApiKey('gemini')
          if (!apiKey) {
            send({ type: 'error', message: 'Provider gemini is not configured — add an API key via Admin → AI Providers.' })
            controller.close()
            return
          }

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:streamGenerateContent?key=${apiKey}&alt=sse`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: body.message }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
              }),
            },
          )

          if (!response.ok || !response.body) {
            send({ type: 'error', message: `Gemini HTTP ${response.status}` })
            controller.close()
            return
          }

          await processSSEStream(response.body, (data) => {
            try {
              const parsed = JSON.parse(data)
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) send({ type: 'chunk', content: text })
            } catch { /* skip */ }
          })

          send({ type: 'done', traceId, model: resolvedModel, provider: 'gemini' })
          controller.close()
          return
        }

        // ── Cohere streaming (chat endpoint with stream) ─────────────
        if (resolvedProvider === 'cohere') {
          const apiKey = await getVaultApiKey('cohere')
          if (!apiKey) {
            send({ type: 'error', message: 'Provider cohere is not configured — add an API key via Admin → AI Providers.' })
            controller.close()
            return
          }

          const response = await fetch('https://api.cohere.com/v2/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: resolvedModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: body.message },
              ],
              stream: true,
            }),
          })

          if (!response.ok || !response.body) {
            send({ type: 'error', message: `Cohere HTTP ${response.status}` })
            controller.close()
            return
          }

          await processSSEStream(response.body, (data) => {
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content-delta' && parsed.delta?.message?.content?.text) {
                send({ type: 'chunk', content: parsed.delta.message.content.text })
              }
            } catch { /* skip */ }
          })

          send({ type: 'done', traceId, model: resolvedModel, provider: 'cohere' })
          controller.close()
          return
        }

        // ── HuggingFace / Replicate non-streaming fallback ─────────────
        // These providers don't support SSE — call via callProvider and
        // emit the full response as a single chunk + done event.
        if (resolvedProvider === 'huggingface' || resolvedProvider === 'replicate') {
          const result = await callProvider(
            resolvedProvider,
            resolvedModel,
            body.message,
          )
          if (!result.ok) {
            send({ type: 'error', message: result.error ?? `${resolvedProvider} call failed` })
          } else {
            const text = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
            send({ type: 'chunk', content: text })
            send({ type: 'done', traceId, model: resolvedModel, provider: resolvedProvider })
          }
          controller.close()
          return
        }

        // ── OpenAI-compatible streaming (9 providers incl. Mistral) ──
        const providerConfig = STREAMING_PROVIDERS[resolvedProvider]
        if (!providerConfig) {
          send({ type: 'error', message: `Provider "${resolvedProvider}" does not support streaming.` })
          controller.close()
          return
        }

        const apiKey = await getVaultApiKey(resolvedProvider)
        if (!apiKey) {
          send({ type: 'error', message: `Provider ${resolvedProvider} is not configured — add an API key via Admin → AI Providers.` })
          controller.close()
          return
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        }
        if (resolvedProvider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://amarktai.network'
          headers['X-Title'] = 'AmarktAI Network'
        }

        const response = await fetch(`${providerConfig.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: body.message },
            ],
            stream: true,
          }),
        })

        if (!response.ok || !response.body) {
          send({ type: 'error', message: `${resolvedProvider} HTTP ${response.status}` })
          controller.close()
          return
        }

        await processSSEStream(response.body, (data) => {
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) send({ type: 'chunk', content })
          } catch { /* skip malformed */ }
        })

        send({ type: 'done', traceId, model: resolvedModel, provider: resolvedProvider })
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
      'X-Stream-Provider': resolvedProvider,
      'X-Stream-Model': resolvedModel,
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve which provider to use (auto-select first available or explicit).
 * Checks DB vault first via getVaultApiKey(), falls back to env vars.
 */
async function resolveProvider(requested?: string): Promise<string | null> {
  const allSupported = [...Object.keys(STREAMING_PROVIDERS), 'anthropic', 'gemini', 'cohere', 'huggingface', 'replicate']

  if (requested && allSupported.includes(requested)) {
    return requested
  }

  // Auto-select: check DB vault + env for first available provider
  const priority = [
    'openai', 'groq', 'anthropic', 'gemini', 'mistral',
    'deepseek', 'together', 'qwen', 'grok', 'openrouter', 'nvidia', 'cohere',
    'huggingface', 'replicate',
  ]

  for (const provider of priority) {
    const key = await getVaultApiKey(provider)
    if (key) return provider
  }

  return null
}

/** Process an SSE stream, calling handler for each data line. */
async function processSSEStream(
  body: ReadableStream<Uint8Array>,
  handler: (data: string) => void,
): Promise<void> {
  const reader = body.getReader()
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
        if (data && data !== '[DONE]') {
          handler(data)
        }
      }
    }
  }

  // Process remaining buffer
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6).trim()
    if (data && data !== '[DONE]') {
      handler(data)
    }
  }
}
