/**
 * AmarktAI Network — TypeScript SDK Client
 *
 * Lightweight, zero-dependency client for connecting any JavaScript/TypeScript
 * application to the AmarktAI Network Brain API.
 *
 * Usage:
 *   import { AmarktAIClient } from '@/lib/sdk/amarktai-client'
 *
 *   const ai = new AmarktAIClient({
 *     baseUrl: 'https://your-amarktai-instance.com',
 *     appId: 'my-app-slug',
 *     appSecret: 'your-app-secret',
 *   })
 *
 *   // Text generation
 *   const res = await ai.execute({ taskType: 'chat', message: 'Hello!' })
 *
 *   // Image generation
 *   const img = await ai.execute({ taskType: 'image_generation', message: 'A sunset' })
 *
 *   // Streaming
 *   for await (const chunk of ai.stream({ message: 'Tell me a story' })) {
 *     process.stdout.write(chunk)
 *   }
 *
 *   // Agent dispatch
 *   const task = await ai.dispatchAgent({ agentType: 'creative', message: 'Write a tagline' })
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AmarktAIConfig {
  /** Base URL of the AmarktAI Network instance (no trailing slash). */
  baseUrl: string
  /** App slug (app_id) registered in the AmarktAI admin. */
  appId: string
  /** App secret for authentication. */
  appSecret: string
  /** Default timeout in ms (default: 30 000). */
  timeout?: number
  /** Max retries on 5xx / network errors (default: 2). */
  maxRetries?: number
}

export interface ExecuteRequest {
  taskType: string
  message: string
  provider?: string
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  traceId?: string
}

export interface ExecuteResponse {
  output: string | null
  model: string
  provider: string
  latencyMs: number
  cached: boolean
  costEstimate?: number
  traceId?: string
  error?: string
}

export interface StreamRequest {
  taskType?: string
  message: string
  provider?: string
  model?: string
  systemPrompt?: string
  traceId?: string
}

export interface AgentDispatchRequest {
  agentType: string
  message: string
  context?: Record<string, unknown>
  async?: boolean
}

export interface AgentDispatchResponse {
  executed: boolean
  taskId: string
  status: string
  agentType: string
  agentName: string
  output?: string | null
  latencyMs?: number
  error?: string
}

export interface ImageRequest {
  message: string
  provider?: string
  model?: string
  style?: string
  width?: number
  height?: number
}

export interface HeartbeatResponse {
  status: string
  appSlug: string
  connectedToBrain: boolean
  timestamp: string
}

// ── Client ───────────────────────────────────────────────────────────────────

export class AmarktAIClient {
  private readonly baseUrl: string
  private readonly appId: string
  private readonly appSecret: string
  private readonly timeout: number
  private readonly maxRetries: number

  constructor(config: AmarktAIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.appId = config.appId
    this.appSecret = config.appSecret
    this.timeout = config.timeout ?? 30_000
    this.maxRetries = config.maxRetries ?? 2
  }

  // ── Core execution ──────────────────────────────────────────────────────

  /** Execute a brain request (text, image, research, etc.). */
  async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/api/brain/execute', {
      appId: this.appId,
      appSecret: this.appSecret,
      ...req,
    })
  }

  /** Generate an image via the brain gateway. */
  async image(req: ImageRequest): Promise<ExecuteResponse> {
    return this.execute({
      taskType: 'image_generation',
      ...req,
    })
  }

  /** Dispatch an agent task. */
  async dispatchAgent(req: AgentDispatchRequest): Promise<AgentDispatchResponse> {
    return this.post<AgentDispatchResponse>('/api/brain/agent/dispatch', {
      appId: this.appId,
      appSecret: this.appSecret,
      ...req,
    })
  }

  // ── Streaming ───────────────────────────────────────────────────────────

  /** Stream a response as an async iterator of text chunks. */
  async *stream(req: StreamRequest): AsyncGenerator<string, void, undefined> {
    const url = `${this.baseUrl}/api/brain/stream`
    const body = JSON.stringify({
      appId: this.appId,
      appSecret: this.appSecret,
      taskType: req.taskType ?? 'chat',
      ...req,
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(this.timeout * 3), // streams get 3× timeout
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new AmarktAIError(`Stream request failed (${res.status}): ${errText}`, res.status)
    }

    if (!res.body) throw new AmarktAIError('No response body for stream', 500)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        // Parse SSE format
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            try {
              const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
              const content = parsed.choices?.[0]?.delta?.content
              if (content) yield content
            } catch {
              // Non-JSON SSE data — yield raw
              if (data.trim()) yield data
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ── Integration endpoints ───────────────────────────────────────────────

  /** Check app connection health. */
  async heartbeat(): Promise<HeartbeatResponse> {
    return this.post<HeartbeatResponse>('/api/integrations/heartbeat', {
      appId: this.appId,
      appSecret: this.appSecret,
    })
  }

  /** Send a custom event to the AmarktAI events pipeline. */
  async sendEvent(eventType: string, data: Record<string, unknown>): Promise<{ received: boolean }> {
    return this.post<{ received: boolean }>('/api/integrations/events', {
      appId: this.appId,
      appSecret: this.appSecret,
      eventType,
      data,
    })
  }

  /** Report metrics to the AmarktAI metrics pipeline. */
  async reportMetrics(metrics: Record<string, number>): Promise<{ received: boolean }> {
    return this.post<{ received: boolean }>('/api/integrations/metrics', {
      appId: this.appId,
      appSecret: this.appSecret,
      metrics,
    })
  }

  // ── TTS / STT ──────────────────────────────────────────────────────────

  /** Text-to-speech. Returns audio URL or base64 audio. */
  async tts(text: string, opts?: { voice?: string; provider?: string; emotionAware?: boolean }): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/api/brain/tts', {
      appId: this.appId,
      appSecret: this.appSecret,
      text,
      ...opts,
    })
  }

  /** Speech-to-text. Accepts base64 audio. */
  async stt(audioBase64: string, opts?: { provider?: string; language?: string }): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/api/brain/stt', {
      appId: this.appId,
      appSecret: this.appSecret,
      audio: audioBase64,
      ...opts,
    })
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeout),
        })

        if (res.status >= 500 && attempt < this.maxRetries) {
          // Exponential backoff for server errors
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
          continue
        }

        const data = await res.json() as T & { error?: string }

        if (!res.ok) {
          throw new AmarktAIError(
            data.error ?? `Request failed with status ${res.status}`,
            res.status,
          )
        }

        return data
      } catch (err: unknown) {
        if (err instanceof AmarktAIError) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
        }
      }
    }

    throw lastError ?? new AmarktAIError('Request failed after retries', 500)
  }
}

// ── Error class ──────────────────────────────────────────────────────────────

export class AmarktAIError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'AmarktAIError'
    this.statusCode = statusCode
  }
}
