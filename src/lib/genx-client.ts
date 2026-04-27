/**
 * GenX Client — AmarktAI Network
 *
 * GenX is the primary AI execution layer for the AmarktAI Network.
 * All AI requests are routed through GenX by default. Direct provider
 * routing (openai/groq/gemini/etc.) is only used as a fallback when
 * GenX is unavailable or returns an error.
 *
 * Endpoints:
 *   chat:   POST /v1/chat/completions
 *   media:  POST /api/v1/generate
 *   jobs:   GET  /api/v1/jobs/:id
 *   models: GET  /api/v1/models
 *
 * Model selection is policy-driven:
 *   best      — highest-capability model in GenX catalog (workspace default)
 *   cheap     — lowest-cost model for the capability
 *   balanced  — cost/quality tradeoff model
 *   fixed     — explicit model ID provided by the caller
 *
 * Server-side only. Never import from client components.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type GenXModelPolicy = 'best' | 'cheap' | 'balanced' | 'fixed'

export type GenXCapability =
  | 'chat'
  | 'code'
  | 'reasoning'
  | 'image_generation'
  | 'image_editing'
  | 'video_generation'
  | 'tts'
  | 'stt'
  | 'embeddings'
  | 'multimodal'
  | 'research'
  | 'adult'

export type GenXOperationType =
  | 'chat'
  | 'generate'
  | 'edit'
  | 'plan'
  | 'code'
  | 'summarise'
  | 'classify'
  | 'embed'
  | 'tts'
  | 'stt'

export interface GenXModel {
  id: string
  name: string
  capabilities: GenXCapability[]
  costTier: 'free' | 'very_low' | 'low' | 'medium' | 'high' | 'premium'
  latencyTier: 'ultra_low' | 'low' | 'medium' | 'high'
  contextWindow: number
  supportsAdult?: boolean
}

export interface GenXChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenXChatRequest {
  model: string
  messages: GenXChatMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
  metadata?: Record<string, unknown>
}

export interface GenXChatResponse {
  id: string
  model: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface GenXMediaRequest {
  model: string
  prompt: string
  type: 'image' | 'video' | 'audio'
  width?: number
  height?: number
  duration?: number
  style?: string
  metadata?: Record<string, unknown>
}

export interface GenXMediaResponse {
  id: string
  model: string
  type: 'image' | 'video' | 'audio'
  url?: string
  base64?: string
  jobId?: string    // present when generation is async
  status: 'completed' | 'pending' | 'processing' | 'failed'
  error?: string
}

export interface GenXJobStatus {
  id: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  result?: GenXMediaResponse
  error?: string
  createdAt: string
  updatedAt: string
}

export interface GenXCallResult {
  success: boolean
  output: string | null
  model: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  latencyMs: number
  error: string | null
  genxUsed: boolean
}

export interface GenXMediaResult {
  success: boolean
  url: string | null
  jobId: string | null
  status: 'pending' | 'processing' | 'completed' | 'succeeded' | 'failed'
  model: string
  latencyMs: number
  error: string | null
}

export interface GenXStatus {
  available: boolean
  apiUrl: string | null
  error: string | null
}

// ── Configuration ─────────────────────────────────────────────────────────────

const GENX_TIMEOUT  = 60_000 // 60 s

/**
 * Whether adult content is supported by the connected GenX deployment.
 * Controlled by the GENX_ADULT_CONTENT_SUPPORTED env var.
 * Defaults to false to prevent unintentional adult routing.
 */
export const GENX_ADULT_CONTENT_SUPPORTED =
  process.env.GENX_ADULT_CONTENT_SUPPORTED === 'true'

/**
 * Resolve the active GenX API URL and key.
 * Priority: DB (IntegrationConfig key='genx') > environment variables.
 * This allows the admin to configure GenX via the Settings UI without
 * redeploying.
 */
async function resolveGenXConfig(): Promise<{ apiUrl: string; apiKey: string }> {
  let apiUrl = process.env.GENX_API_URL ?? ''
  let apiKey = process.env.GENX_API_KEY ?? ''

  try {
    // Lazy import to avoid circular dependency — prisma is safe to import here
    const { prisma } = await import('@/lib/prisma')
    const { decryptVaultKey } = await import('@/lib/crypto-vault')
    const row = await prisma.integrationConfig.findUnique({ where: { key: 'genx' } })
    if (row?.apiUrl) apiUrl = row.apiUrl
    if (row?.apiKey) {
      const decrypted = decryptVaultKey(row.apiKey)
      if (decrypted) apiKey = decrypted
    }
  } catch {
    // DB unavailable — fall through to env vars
  }

  return { apiUrl, apiKey }
}


async function buildHeaders(): Promise<Record<string, string>> {
  const { apiKey } = await resolveGenXConfig()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`
  return h
}

// ── Status ────────────────────────────────────────────────────────────────────

export function getGenXStatus(): GenXStatus {
  const envUrl = process.env.GENX_API_URL ?? ''
  if (!envUrl) {
    return {
      available: false,
      apiUrl: null,
      error: 'GENX_API_URL not configured',
    }
  }
  return { available: true, apiUrl: envUrl, error: null }
}

/**
 * Async version of getGenXStatus that also checks the DB-stored config.
 * Used by routes that need accurate status including DB-saved settings.
 */
export async function getGenXStatusAsync(): Promise<GenXStatus> {
  const { apiUrl } = await resolveGenXConfig()
  if (!apiUrl) {
    return { available: false, apiUrl: null, error: 'GenX not configured (GENX_API_URL not set and no DB config)' }
  }
  return { available: true, apiUrl, error: null }
}

// ── Model Catalog ─────────────────────────────────────────────────────────────

/** In-memory model catalog cache. Refreshed on first call and every 5 minutes. */
let _modelCache: GenXModel[] | null = null
let _modelCacheAge = 0
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000

/** Fetch the GenX model catalog. Returns empty array when GenX is unavailable. */
export async function listGenXModels(): Promise<GenXModel[]> {
  const { apiUrl } = await resolveGenXConfig()
  if (!apiUrl) return []

  const now = Date.now()
  if (_modelCache && now - _modelCacheAge < MODEL_CACHE_TTL_MS) return _modelCache

  try {
    const res = await fetch(`${apiUrl}/api/v1/models`, {
      headers: await buildHeaders(),
      signal: AbortSignal.timeout(GENX_TIMEOUT),
    })
    if (!res.ok) return _modelCache ?? []
    const data = await res.json() as { models?: GenXModel[] } | GenXModel[]
    const models = Array.isArray(data) ? data : (data.models ?? [])
    _modelCache = models
    _modelCacheAge = now
    return models
  } catch {
    return _modelCache ?? []
  }
}

// ── Policy-Driven Model Selection ─────────────────────────────────────────────

/**
 * Select the best GenX model for a request based on policy, capability, and operation type.
 *
 * Policy semantics:
 *   best      — highest-capability model for the requested capability (workspace default)
 *   cheap     — lowest cost tier that satisfies the capability
 *   balanced  — medium cost tier, first match
 *   fixed     — return the fixedModelId directly (no catalog lookup)
 */
export async function selectGenXModel(
  policy: GenXModelPolicy,
  capability: GenXCapability,
  operationType: GenXOperationType,
  fixedModelId?: string,
): Promise<string> {
  // For 'fixed' policy, return the specified model ID directly
  if (policy === 'fixed' && fixedModelId) return fixedModelId

  const models = await listGenXModels()

  // Filter models that support the requested capability
  const capable = models.filter((m) => m.capabilities.includes(capability))

  if (capable.length === 0) {
    // GenX catalog unavailable or no model matches — return a sensible default
    // that GenX itself will validate/route
    return resolveDefaultByOperation(operationType)
  }

  // Cost tier ordering (low to high)
  const COST_ORDER: GenXModel['costTier'][] = ['free', 'very_low', 'low', 'medium', 'high', 'premium']

  switch (policy) {
    case 'best': {
      // Sort by cost tier descending (premium first), then latency ascending
      const sorted = [...capable].sort((a, b) => {
        const costDiff = COST_ORDER.indexOf(b.costTier) - COST_ORDER.indexOf(a.costTier)
        if (costDiff !== 0) return costDiff
        const LATENCY_ORDER: GenXModel['latencyTier'][] = ['ultra_low', 'low', 'medium', 'high']
        return LATENCY_ORDER.indexOf(a.latencyTier) - LATENCY_ORDER.indexOf(b.latencyTier)
      })
      return sorted[0]?.id ?? resolveDefaultByOperation(operationType)
    }

    case 'cheap': {
      const sorted = [...capable].sort((a, b) =>
        COST_ORDER.indexOf(a.costTier) - COST_ORDER.indexOf(b.costTier),
      )
      return sorted[0]?.id ?? resolveDefaultByOperation(operationType)
    }

    case 'balanced': {
      // Prefer medium tier; fall back to low, then high
      const medium = capable.find((m) => m.costTier === 'medium')
      if (medium) return medium.id
      const low = capable.find((m) => m.costTier === 'low')
      if (low) return low.id
      return capable[0]?.id ?? resolveDefaultByOperation(operationType)
    }

    default:
      return capable[0]?.id ?? resolveDefaultByOperation(operationType)
  }
}

/**
 * Resolve a sensible GenX default model name for an operation type when the
 * catalog is unavailable. These are opaque identifiers that GenX itself resolves.
 */
function resolveDefaultByOperation(operationType: GenXOperationType): string {
  const defaults: Record<GenXOperationType, string> = {
    chat:      'genx/default-chat',
    generate:  'genx/default-generate',
    edit:      'genx/default-edit',
    plan:      'genx/default-plan',
    code:      'genx/default-code',
    summarise: 'genx/default-summarise',
    classify:  'genx/default-classify',
    embed:     'genx/default-embed',
    tts:       'genx/default-tts',
    stt:       'genx/default-stt',
  }
  return defaults[operationType]
}

// ── Chat Execution ────────────────────────────────────────────────────────────

/**
 * Call GenX /v1/chat/completions.
 * Returns a normalised result. Never throws.
 */
export async function callGenXChat(request: GenXChatRequest): Promise<GenXCallResult> {
  const start = Date.now()

  const { apiUrl } = await resolveGenXConfig()
  if (!apiUrl) {
    return {
      success: false, output: null, model: request.model,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latencyMs: 0, error: 'GenX not configured (GENX_API_URL not set)', genxUsed: false,
    }
  }

  try {
    const res = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(GENX_TIMEOUT),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } | string }
      const msg = typeof errBody.error === 'string' ? errBody.error : errBody.error?.message ?? `HTTP ${res.status}`
      return { success: false, output: null, model: request.model, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, latencyMs, error: `GenX error: ${msg}`, genxUsed: true }
    }

    const data = await res.json() as GenXChatResponse
    const output = data.choices?.[0]?.message?.content ?? null

    return {
      success: true,
      output,
      model: data.model ?? request.model,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
        total_tokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs,
      error: null,
      genxUsed: true,
    }
  } catch (err) {
    return {
      success: false, output: null, model: request.model,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latencyMs: Date.now() - start,
      error: `GenX request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      genxUsed: true,
    }
  }
}

// ── Media Generation ──────────────────────────────────────────────────────────

/**
 * Call GenX /api/v1/generate for media (image / video / audio).
 * Returns a normalised result. Never throws.
 */
export async function callGenXMedia(request: GenXMediaRequest): Promise<GenXMediaResult> {
  const start = Date.now()

  const { apiUrl } = await resolveGenXConfig()
  if (!apiUrl) {
    return {
      success: false, url: null, jobId: null, status: 'failed',
      model: request.model, latencyMs: 0,
      error: 'GenX not configured (GENX_API_URL not set)',
    }
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/generate`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(GENX_TIMEOUT),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string }
      return { success: false, url: null, jobId: null, status: 'failed' as const, model: request.model, latencyMs, error: errBody.error ?? `GenX HTTP ${res.status}` }
    }

    const data = await res.json() as GenXMediaResponse

    if (data.jobId) {
      return { success: true, url: data.url ?? null, jobId: data.jobId, status: data.status, model: data.model ?? request.model, latencyMs, error: null }
    }

    return {
      success: data.status !== 'failed',
      url: data.url ?? null,
      jobId: null,
      status: data.status,
      model: data.model ?? request.model,
      latencyMs,
      error: data.error ?? null,
    }
  } catch (err) {
    return {
      success: false, url: null, jobId: null, status: 'failed',
      model: request.model, latencyMs: Date.now() - start,
      error: `GenX media request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    }
  }
}

// ── Job Polling ───────────────────────────────────────────────────────────────

/**
 * Poll GenX /api/v1/jobs/:id for async job status.
 */
export async function getGenXJobStatus(jobId: string): Promise<GenXJobStatus | null> {
  const { apiUrl } = await resolveGenXConfig()
  if (!apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: await buildHeaders(),
      signal: AbortSignal.timeout(GENX_TIMEOUT),
    })
    if (!res.ok) return null
    return await res.json() as GenXJobStatus
  } catch {
    return null
  }
}

// ── Adult Capability ──────────────────────────────────────────────────────────

/**
 * Audit note: Adult content routing via GenX.
 *
 * GenX adult content support is controlled by GENX_ADULT_CONTENT_SUPPORTED=true.
 * When false (default), adult requests are NOT routed through GenX — the caller
 * must implement a separate provider path. This file explicitly does not fake
 * adult availability. Any adult capability must be explicitly enabled by
 * setting GENX_ADULT_CONTENT_SUPPORTED=true in the deployment environment.
 */
export function getAdultCapabilityStatus(): {
  supported: boolean
  route: 'genx' | 'separate_provider' | 'unavailable'
  note: string
} {
  if (GENX_ADULT_CONTENT_SUPPORTED) {
    return {
      supported: true,
      route: 'genx',
      note: 'Adult content is enabled and routed through GenX. Ensure your GenX deployment complies with applicable content policy.',
    }
  }
  return {
    supported: false,
    route: 'separate_provider',
    note: 'GenX adult content support is not enabled. Set GENX_ADULT_CONTENT_SUPPORTED=true to enable after verifying your GenX deployment supports adult content.',
  }
}
