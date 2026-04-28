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
import { getDefaultModelForProvider, MODEL_REGISTRY } from '@/lib/model-registry'
import { decryptVaultKey } from '@/lib/crypto-vault'

// ── Request / Response Contracts ─────────────────────────────────────────────

export interface BrainRequestInput {
  appId: string              // product slug (e.g. "amarktai-crypto")
  appSecret: string          // product.appSecret
  externalUserId?: string    // caller-supplied user ID (for future memory/personalisation)
  taskType: string           // e.g. 'chat' | 'analysis' | 'content' | 'support'
  message: string            // the prompt / payload
  metadata?: Record<string, unknown>
  requestMode?: 'sync' | 'async'  // 'async' queues via batch-processor; 'sync' (default) returns immediately
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
  estimatedCostUsd?: number
  cumulativeCostUsd?: number | null
  resolvedCapability?: string
  resolvedCapabilities?: string[]
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

  if (!product.connectedToBrain) {
    return { ok: false, statusCode: 409, error: 'App is not connected to the Brain — enable Brain connection in app settings' }
  }

  // Return app without exposing the secret
  const { appSecret: _omit, ...safeApp } = product
  return { ok: true, statusCode: 200, app: safeApp }
}

// ── Provider Abstraction ──────────────────────────────────────────────────────

/**
 * Resolve the default model for a provider.
 *
 * Delegates to the canonical model registry to avoid duplicate
 * switch-statements scattered across the codebase.
 */
function defaultModelFor(providerKey: string): string {
  return getDefaultModelForProvider(providerKey)
}

const BEARER_PREFIX = 'bearer '

function normalizeProviderApiKey(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith(BEARER_PREFIX)) {
    const token = trimmed.slice(BEARER_PREFIX.length).trim()
    return token || null
  }
  return trimmed
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
 * Look up an API key for a provider from the database vault first,
 * then fall back to the corresponding environment variable.
 *
 * This is the single source of truth for API key resolution across ALL
 * brain/* routes — stream, tts, stt, research, suggestive-image etc.
 * must use this helper instead of reading process.env directly.
 *
 * @param providerKey - Provider key, e.g. 'openai', 'mistral'
 * @returns The API key string, or null if not configured anywhere
 */
export async function getVaultApiKey(providerKey: string): Promise<string | null> {
  // DB vault is the authoritative source (set via the Admin → AI Providers UI)
  try {
    const row = await prisma.aiProvider.findUnique({
      where: { providerKey },
      select: { apiKey: true },
    })
    if (row?.apiKey) {
      const decrypted = decryptVaultKey(row.apiKey)
      return normalizeProviderApiKey(decrypted)
    }
  } catch {
    // DB unavailable — fall through to env
  }

  // Env-var fallback for local dev / CI where the DB may not be provisioned
  const envMap: Record<string, string> = {
    openai:      'OPENAI_API_KEY',
    anthropic:   'ANTHROPIC_API_KEY',
    gemini:      'GEMINI_API_KEY',
    groq:        'GROQ_API_KEY',
    deepseek:    'DEEPSEEK_API_KEY',
    openrouter:  'OPENROUTER_API_KEY',
    together:    'TOGETHER_API_KEY',
    grok:        'GROK_API_KEY',
    qwen:        'QWEN_API_KEY',
    nvidia:      'NVIDIA_API_KEY',
    huggingface: 'HUGGINGFACE_API_KEY',
    replicate:   'REPLICATE_API_KEY',
    cohere:      'COHERE_API_KEY',
    mistral:     'MISTRAL_API_KEY',
    genx:        'GENX_API_KEY',
    firecrawl:   'FIRECRAWL_API_KEY',
  }
  const envVar = envMap[providerKey]
  if (envVar && process.env[envVar]) return normalizeProviderApiKey(process.env[envVar]!) ?? null

  return null
}

/**
 * OpenAI image generation models that require /v1/images/generations instead of /v1/chat/completions.
 * These models MUST NEVER be routed to the chat/completions endpoint.
 * Only real, currently-valid OpenAI model IDs are included here.
 */
export const OPENAI_IMAGE_MODELS = new Set([
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
])

/**
 * Together AI image generation model prefixes.
 * Models matching these prefixes require /v1/images/generations, not /v1/chat/completions.
 */
const TOGETHER_IMAGE_MODEL_PREFIXES = [
  'black-forest-labs/',
  'stabilityai/stable-diffusion',
  'stability-ai/',
]

function isTogetherImageModel(modelId: string): boolean {
  return TOGETHER_IMAGE_MODEL_PREFIXES.some(prefix => modelId.startsWith(prefix))
}

/**
 * Qwen Wanx model ID prefixes.
 * Wanx models require the DashScope AIGC endpoint (/v1/services/aigc/) —
 * NOT the compatible-mode /v1/chat/completions path.
 * They must not be routed through callProvider's standard chat branch.
 */
const QWEN_WANX_MODEL_PREFIXES = [
  'wanx',
]

function isQwenWanxModel(modelId: string): boolean {
  return QWEN_WANX_MODEL_PREFIXES.some(prefix => modelId.startsWith(prefix))
}

/**
 * Call an AI provider via the single provider vault.
 * Reads API key + base URL from the vault — never from the request.
 * Returns a normalised result. Never throws.
 *
 * @param systemPrompt - Optional system-level instructions injected via the
 *   provider's native system role (OpenAI/Groq/etc. system message, Anthropic
 *   `system` field, Gemini `systemInstruction`). Providers that lack a system
 *   role receive it prepended to the user message.
 */
export async function callProvider(
  providerKey: string,
  model: string,
  message: string,
  systemPrompt?: string,
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

  const resolvedApiKey = normalizeProviderApiKey(decryptVaultKey(vault.apiKey)) ?? ''
  if (!resolvedApiKey) {
    return {
      ok: false, output: null,
      error: `Provider "${providerKey}" API key could not be decrypted`,
      latencyMs: Date.now() - start, model, providerKey,
    }
  }

  let resolvedModel: string
  try {
    resolvedModel = model || vault.defaultModel || defaultModelFor(providerKey)
  } catch (err) {
    return {
      ok: false,
      output: null,
      error: err instanceof Error ? err.message : `No default model for provider "${providerKey}"`,
      latencyMs: Date.now() - start,
      model: model || 'unknown',
      providerKey,
    }
  }
  const timeout = 30_000

  // ── Phase 7: Strict execution guard ──────────────────────────────────────
  // Reject calls to models that are explicitly disabled in the registry.
  // A model being absent from the registry is allowed (e.g. vault-only custom
  // models) — only explicitly disabled registry entries are blocked.
  const registryEntry = MODEL_REGISTRY.find(
    (m) => m.model_id === resolvedModel && m.provider === providerKey
  )
  if (registryEntry && !registryEntry.enabled) {
    return {
      ok: false,
      output: null,
      error: `Model "${resolvedModel}" is disabled and cannot be executed. Check the model registry.`,
      latencyMs: Date.now() - start,
      model: resolvedModel,
      providerKey,
    }
  }

  try {
    switch (providerKey) {
      // ── OpenAI-compatible: OpenAI, Groq, DeepSeek, OpenRouter, Together AI, xAI/Grok, Qwen ──
      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'openrouter':
      case 'together':
      case 'grok':
      case 'qwen': {
        const baseMap: Record<string, string> = {
          openai:     'https://api.openai.com',
          groq:       'https://api.groq.com/openai',
          deepseek:   'https://api.deepseek.com',
          openrouter: 'https://openrouter.ai/api',
          together:   'https://api.together.xyz',
          grok:       'https://api.x.ai',
          qwen:       'https://dashscope-intl.aliyuncs.com/compatible-mode',
        }
        const base = vault.baseUrl || baseMap[providerKey] || 'https://api.openai.com'
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolvedApiKey}`,
        }
        // OpenRouter requires a site URL header
        if (providerKey === 'openrouter') {
          headers['HTTP-Referer'] = 'https://amarktai.network'
          headers['X-Title'] = 'AmarktAI Network'
        }
        // ── Phase 5: Wanx guard ──────────────────────────────────────────
        // Wanx image/video models require DashScope AIGC endpoint, NOT the
        // compatible-mode chat/completions path. Return a clear error rather
        // than silently routing to the wrong endpoint.
        if (providerKey === 'qwen' && isQwenWanxModel(resolvedModel)) {
          return {
            ok: false,
            output: null,
            error: `Qwen Wanx model "${resolvedModel}" requires the DashScope AIGC endpoint which is not yet wired in callProvider. Use the specialist /api/brain/image or /api/brain/video-generate routes instead.`,
            latencyMs: Date.now() - start,
            model: resolvedModel,
            providerKey,
          }
        }
        // ── Phase 6: Together image routing ──────────────────────────────
        // Together AI image-generation models (FLUX, Stable Diffusion) use
        // /v1/images/generations, not /v1/chat/completions.
        if (providerKey === 'together' && isTogetherImageModel(resolvedModel)) {
          const imgRes = await fetch(`${base}/v1/images/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: resolvedModel,
              prompt: message,
              n: 1,
            }),
            signal: AbortSignal.timeout(timeout),
          })
          if (!imgRes.ok) {
            const errBody = await imgRes.json().catch(() => ({})) as { error?: { message?: string } }
            return { ok: false, output: null, error: `Together Images API HTTP ${imgRes.status}: ${errBody?.error?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
          }
          const imgData = await imgRes.json() as { data?: Array<{ url?: string; b64_json?: string }> }
          const imageUrl = imgData?.data?.[0]?.url ?? imgData?.data?.[0]?.b64_json ?? null
          return { ok: true, output: imageUrl, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        // Image models require the images/generations endpoint, not chat/completions
        if (providerKey === 'openai' && OPENAI_IMAGE_MODELS.has(resolvedModel)) {
          const imgRes = await fetch(`${base}/v1/images/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: resolvedModel,
              prompt: message,
              n: 1,
              size: '1024x1024',
            }),
            signal: AbortSignal.timeout(timeout),
          })
          if (!imgRes.ok) {
            const errBody = await imgRes.json().catch(() => ({})) as { error?: { message?: string } }
            return { ok: false, output: null, error: `OpenAI Images API HTTP ${imgRes.status}: ${errBody?.error?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
          }
          const imgData = await imgRes.json() as { data?: Array<{ url?: string; b64_json?: string }> }
          const imageUrl = imgData?.data?.[0]?.url ?? imgData?.data?.[0]?.b64_json ?? null
          return { ok: true, output: imageUrl, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: message },
            ],
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
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${encodeURIComponent(resolvedApiKey)}`
        const geminiBody: Record<string, unknown> = {
          contents: [{ parts: [{ text: message }] }],
        }
        if (systemPrompt) {
          geminiBody.systemInstruction = { parts: [{ text: systemPrompt }] }
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
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

      // ── Hugging Face Inference ──────────────────────────────────────────────
      case 'huggingface': {
        const base = vault.baseUrl || 'https://api-inference.huggingface.co'
        const headers: Record<string, string> = {
          Authorization: `Bearer ${resolvedApiKey}`,
        }

        // Detect task type from model name patterns to send correct payload
        const modelLower = resolvedModel.toLowerCase()
        const isEmbedding = modelLower.includes('embed') || modelLower.includes('sentence-transformer') || modelLower.includes('bge-') || modelLower.includes('e5-')
        const isTTS = modelLower.includes('tts') || modelLower.includes('bark') || modelLower.includes('speecht5') || modelLower.includes('speech-t5')
        const isSTT = modelLower.includes('whisper') || modelLower.includes('wav2vec') || modelLower.includes('stt')

        let body: string
        const contentType = 'application/json'

        if (isEmbedding) {
          // Embedding models: { inputs: string | string[] } → returns float[][]
          body = JSON.stringify({ inputs: message })
        } else if (isTTS) {
          // TTS models: { inputs: string } → returns audio bytes
          body = JSON.stringify({ inputs: message })
        } else if (isSTT) {
          // STT models: raw audio bytes (message is expected to be a base64-encoded audio)
          // For text-based calls, wrap in the standard format
          body = JSON.stringify({ inputs: message })
        } else {
          // Default: text generation with parameters for better results
          body = JSON.stringify({
            inputs: message,
            parameters: { max_new_tokens: 1024, return_full_text: false },
          })
        }
        headers['Content-Type'] = contentType

        const res = await fetch(`${base}/models/${resolvedModel}`, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          return { ok: false, output: null, error: `Hugging Face HTTP ${res.status}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }

        if (isTTS) {
          // TTS returns audio buffer — convert to base64 data URL
          const audioBuffer = await res.arrayBuffer()
          const base64 = Buffer.from(audioBuffer).toString('base64')
          return { ok: true, output: `data:audio/wav;base64,${base64}`, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }

        if (isEmbedding) {
          // Embedding returns float[][] — return as JSON string
          const embeddings = await res.json()
          return { ok: true, output: JSON.stringify(embeddings), error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedApiKey}` },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: message },
            ],
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

      // ── Anthropic (Claude) ────────────────────────────────────────────────
      case 'anthropic': {
        const base = vault.baseUrl || 'https://api.anthropic.com'
        const anthropicBody: Record<string, unknown> = {
          model: resolvedModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: message }],
        }
        if (systemPrompt) {
          anthropicBody.system = systemPrompt
        }
        const res = await fetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': resolvedApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(anthropicBody),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, output: null, error: `Anthropic HTTP ${res.status}: ${body?.error?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { content?: Array<{ text?: string }> }
        const text = data?.content?.[0]?.text ?? null
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Cohere ────────────────────────────────────────────────────────────
      case 'cohere': {
        const base = vault.baseUrl || 'https://api.cohere.com'
        const res = await fetch(`${base}/v2/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedApiKey}`,
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: message },
            ],
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string }
          return { ok: false, output: null, error: `Cohere HTTP ${res.status}: ${body?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { message?: { content?: Array<{ text?: string }> } }
        const text = data?.message?.content?.[0]?.text ?? null
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Mistral AI (OpenAI-compatible) ─────────────────────────────────────
      case 'mistral': {
        const base = vault.baseUrl || 'https://api.mistral.ai'
        const res = await fetch(`${base}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedApiKey}`,
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: message },
            ],
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string }
          return { ok: false, output: null, error: `Mistral HTTP ${res.status}: ${body?.message ?? 'request failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        return { ok: true, output: data?.choices?.[0]?.message?.content ?? null, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
      }

      // ── Replicate ──────────────────────────────────────────────────────────
      // Replicate uses an async prediction API. We create a prediction and poll
      // until it resolves (up to the global timeout). The model is specified as
      // an owner/name[:version] string, e.g. "meta/llama-2-70b-chat".
      case 'replicate': {
        const base = vault.baseUrl || 'https://api.replicate.com'
        // Step 1: create prediction
        const createRes = await fetch(`${base}/v1/models/${resolvedModel}/predictions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${resolvedApiKey}`,
          },
          body: JSON.stringify({ input: { prompt: message } }),
          signal: AbortSignal.timeout(timeout),
        })
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({})) as { detail?: string }
          return { ok: false, output: null, error: `Replicate HTTP ${createRes.status}: ${errBody?.detail ?? 'prediction create failed'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }
        const prediction = await createRes.json() as { id?: string; urls?: { get?: string }; status?: string; error?: string; output?: unknown }

        if (!prediction.id) {
          return { ok: false, output: null, error: 'Replicate: prediction ID missing', latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }

        // Step 2: poll until succeeded / failed (max 28 s to stay within timeout)
        const pollUrl = prediction.urls?.get ?? `${base}/v1/predictions/${prediction.id}`
        // 800 ms gives ~35 polls within the 30 s window without overwhelming the API rate limits
        const POLL_INTERVAL_MS = 800
        // 2 s buffer ensures the final response can still be read before AbortSignal fires
        const POLL_DEADLINE = start + timeout - 2_000

        let pollResult = prediction
        while (pollResult.status !== 'succeeded' && pollResult.status !== 'failed') {
          if (Date.now() >= POLL_DEADLINE) {
            return { ok: false, output: null, error: `Replicate: prediction timed out (id=${prediction.id})`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
          const pollRes = await fetch(pollUrl, {
            headers: { Authorization: `Token ${resolvedApiKey}` },
          })
          if (!pollRes.ok) break
          pollResult = await pollRes.json() as typeof prediction
        }

        if (pollResult.status === 'failed' || pollResult.error) {
          return { ok: false, output: null, error: `Replicate prediction failed: ${pollResult.error ?? 'unknown'}`, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
        }

        // Output can be a string, an array of strings, or structured data
        const raw = pollResult.output
        let text: string | null = null
        if (typeof raw === 'string') {
          text = raw
        } else if (Array.isArray(raw)) {
          text = (raw as string[]).join('')
        } else if (raw != null) {
          text = JSON.stringify(raw)
        }
        return { ok: true, output: text, error: null, latencyMs: Date.now() - start, model: resolvedModel, providerKey }
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
