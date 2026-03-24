/**
 * Amarktai Brain Gateway — Core Library
 *
 * Single source of truth for:
 *   - Brain request / response type contracts
 *   - App authentication against the app registry
 *   - Routing policy skeleton (extensible)
 *   - Provider abstraction layer (pluggable adapters)
 *   - Brain event logging
 *
 * Server-side only. Never import from client components.
 */

import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'crypto'

// ── Request / Response Contracts ─────────────────────────────────────────────

export interface BrainRequestInput {
  appId: string              // product slug (e.g. "amarktai-crypto")
  appSecret: string          // product.appSecret
  externalUserId?: string    // caller-supplied user ID (for future memory/personalisation)
  taskType: string           // e.g. 'chat' | 'analysis' | 'content' | 'support'
  message: string            // the prompt / payload
  metadata?: Record<string, unknown>
  requestMode?: 'sync' | 'async'  // 'async' is a future placeholder
  traceId?: string           // caller-supplied trace ID; generated if omitted
}

export interface BrainResponse {
  success: boolean
  traceId: string
  app: { id: number; name: string; slug: string } | null
  routedProvider: string | null
  routedModel: string | null
  taskType: string
  executionMode: string       // direct | specialist | review | consensus
  confidenceScore: number | null
  validationUsed: boolean
  consensusUsed: boolean
  output: string | null
  warnings: string[]
  errors: string[]
  latencyMs: number | null
  memoryUsed: boolean         // false until memory layer is built
  fallbackUsed: boolean
  timestamp: string
}

// ── App Authentication ────────────────────────────────────────────────────────

export interface AuthResult {
  ok: boolean
  statusCode: number
  error?: string
  app?: {
    id: number
    name: string
    slug: string
    category: string
    appType: string
    aiEnabled: boolean
    connectedToBrain: boolean
    status: string
  }
}

/**
 * Authenticate a calling app against the single app registry (Product table).
 * Uses timing-safe comparison to prevent secret enumeration attacks.
 */
export async function authenticateApp(appId: string, appSecret: string): Promise<AuthResult> {
  if (!appId || !appSecret) {
    return { ok: false, statusCode: 422, error: 'Missing appId or appSecret' }
  }

  const product = await prisma.product.findUnique({
    where: { slug: appId },
    select: {
      id: true, name: true, slug: true, category: true, appType: true,
      aiEnabled: true, connectedToBrain: true, status: true, appSecret: true,
    },
  })

  if (!product) return { ok: false, statusCode: 404, error: 'App not found in registry' }

  if (!product.appSecret) {
    return { ok: false, statusCode: 409, error: 'App not configured — no app secret set' }
  }

  // Timing-safe string comparison
  let secretMatch = false
  try {
    const a = Buffer.from(product.appSecret)
    const b = Buffer.from(appSecret)
    secretMatch = a.length === b.length && timingSafeEqual(a, b)
  } catch {
    secretMatch = false
  }

  if (!secretMatch) return { ok: false, statusCode: 401, error: 'Invalid app secret' }

  if (product.status === 'offline') {
    return { ok: false, statusCode: 409, error: 'App is currently offline' }
  }

  if (!product.aiEnabled) {
    return { ok: false, statusCode: 409, error: 'AI is not enabled for this app' }
  }

  // Return app without exposing the secret
  const { appSecret: _omit, ...safeApp } = product
  return { ok: true, statusCode: 200, app: safeApp }
}

// ── Provider Abstraction ──────────────────────────────────────────────────────

function defaultModelFor(providerKey: string): string {
  switch (providerKey) {
    case 'openai':      return 'gpt-4o-mini'
    case 'gemini':      return 'gemini-1.5-flash'
    case 'grok':        return 'grok-2-latest'
    case 'qwen':        return 'qwen-max'
    case 'huggingface': return 'meta-llama/Llama-3-8b-chat-hf'
    case 'nvidia':      return 'nvidia/llama-3.1-nemotron-70b-instruct'
    default:            return 'unknown'
  }
}

export interface ProviderCallResult {
  ok: boolean
  output: string | null
  error: string | null
  latencyMs: number
  model: string
  providerKey: string
}

/**
 * Call an AI provider via the single provider vault.
 * Reads API key + base URL from the vault — never from the request.
 * Returns a normalised result. Never throws.
 */
export async function callProvider(
  providerKey: string,
  model: string,
  message: string,
): Promise<ProviderCallResult> {
  const start = Date.now()

  const vault = await prisma.aiProvider.findUnique({
    where: { providerKey },
    select: { apiKey: true, baseUrl: true, defaultModel: true },
  })

  if (!vault?.apiKey) {
    return {
      ok: false, output: null,
      error: `Provider "${providerKey}" is not configured (no API key)`,
      latencyMs: Date.now() - start, model, providerKey,
    }
  }

  const resolvedModel = model || vault.defaultModel || defaultModelFor(providerKey)
  const timeout = 30_000

  try {
    switch (providerKey) {
      // ── OpenAI & Grok share the OpenAI-compatible chat completions API ─────
      case 'openai':
      case 'grok': {
        const base = vault.baseUrl || (providerKey === 'grok' ? 'https://api.x.ai' : 'https://api.openai.com')
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.apiKey}` },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: 'user', content: message }],
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, output: null, error: `${providerKey} HTTP ${res.status}: ${body?.error?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return { ok: true, output: data?.choices?.[0]?.message?.content ?? null, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Gemini ──────────────────────────────────────────────────────────────
      case 'gemini': {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${encodeURIComponent(vault.apiKey)}`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, output: null, error: `Gemini HTTP ${res.status}: ${body?.error?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Qwen (DashScope) ────────────────────────────────────────────────────
      case 'qwen': {
        const base = vault.baseUrl || 'https://dashscope.aliyuncs.com/api/v1'
        const res = await fetch(`${base}/services/aigc/text-generation/generation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.apiKey}` },
          body: JSON.stringify({
            model: resolvedModel,
            input: { messages: [{ role: 'user', content: message }] },
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          return { ok: false, output: null, error: `Qwen HTTP ${res.status}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { output?: { text?: string; choices?: Array<{ message?: { content?: string } }> } }
        const text = data?.output?.text ?? data?.output?.choices?.[0]?.message?.content ?? null
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Hugging Face Inference ──────────────────────────────────────────────
      case 'huggingface': {
        const base = vault.baseUrl || 'https://api-inference.huggingface.co'
        const res = await fetch(`${base}/models/${resolvedModel}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.apiKey}` },
          body: JSON.stringify({ inputs: message }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          return { ok: false, output: null, error: `Hugging Face HTTP ${res.status}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as Array<{ generated_text?: string }> | { generated_text?: string }
        const text = Array.isArray(data) ? (data[0]?.generated_text ?? null) : (data?.generated_text ?? null)
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── NVIDIA NIM (OpenAI-compatible) ──────────────────────────────────────
      case 'nvidia': {
        const base = vault.baseUrl || 'https://integrate.api.nvidia.com/v1'
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.apiKey}` },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: 'user', content: message }],
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          return { ok: false, output: null, error: `NVIDIA HTTP ${res.status}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return { ok: true, output: data?.choices?.[0]?.message?.content ?? null, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      default:
        return { ok: false, output: null, error: `Unknown provider: "${providerKey}"`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
    }
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    const msg = isTimeout
      ? `Provider "${providerKey}" timed out after 30 s`
      : `Provider "${providerKey}" error: ${err instanceof Error ? err.message : 'unknown'}`
    return { ok: false, output: null, error: msg, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
  }
}

// ── Brain Event Logging ───────────────────────────────────────────────────────

export interface BrainEventPayload {
  traceId: string
  productId: number | null
  appSlug: string
  taskType: string
  executionMode: string
  classificationJson: string    // JSON string of ClassificationResult
  routedProvider: string | null
  routedModel: string | null
  validationUsed: boolean
  consensusUsed: boolean
  confidenceScore: number | null
  success: boolean
  errorMessage: string | null
  warningsJson: string          // JSON string of string[]
  latencyMs: number | null
}

/**
 * Persist a brain event. Never throws — logging failures must not crash the gateway.
 */
export async function logBrainEvent(event: BrainEventPayload): Promise<void> {
  try {
    await prisma.brainEvent.create({ data: event })
  } catch (err) {
    console.error('[brain] Failed to persist brain event:', err)
  }
}
