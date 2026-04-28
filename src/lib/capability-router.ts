/**
 * @module capability-router
 * @description Central capability router for the AmarktAI Network — PHASE 1.
 *
 * Routes AI capability requests to the best available provider, always trying
 * GenX first, then falling back to cheap alternatives (Gemini, Groq,
 * OpenRouter, Grok, Qwen).
 *
 * Capabilities supported:
 *   chat, code, file_analysis, image_generation, image_edit,
 *   video_generation, image_to_video, music_generation, lyrics_generation,
 *   tts, stt, voice_response, adult_image, adult_video,
 *   repo_edit, app_build, deploy_plan, research, scrape_website
 *
 * Server-side only. Never import from client components.
 */

import {
  callGenXChat,
  callGenXMedia,
  GENX_TEXT_MODELS,
  GENX_IMAGE_MODELS,
  GENX_VIDEO_MODELS,
  GENX_TTS_MODELS,
} from '@/lib/genx-client'
import { callProvider, getVaultApiKey } from '@/lib/brain'
import { crawlAppWebsite } from '@/lib/firecrawl'
import { createArtifact } from '@/lib/artifact-store'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapabilityRequest {
  /** The prompt / message / URL */
  input: string
  /** Explicit capability override (auto-detected from input when absent) */
  capability?: string
  /** File references (paths or URLs) */
  files?: string[]
  /** App slug for artifact ownership */
  appId?: string
  /** Workspace slug for artifact ownership */
  workspaceId?: string
  /** Force a specific provider (skips the automatic chain) */
  providerOverride?: string
  /** Force a specific model ID */
  modelOverride?: string
  /** Enable adult content routing (also requires safeMode=false) */
  adultMode?: boolean
  /** When true, blocks adult content even if adultMode=true */
  safeMode?: boolean
  /** Persist output as an Artifact DB record */
  saveArtifact?: boolean
  /** Caller-supplied trace ID */
  traceId?: string
  /** Arbitrary metadata forwarded to downstream providers */
  metadata?: Record<string, unknown>
}

export interface CapabilityResponse {
  success: boolean
  capability: string
  provider: string | null
  model: string | null
  /** 'text' | 'image' | 'video' | 'audio' | 'code' | 'video_plan' | 'music_blueprint' | 'markdown' */
  outputType: string
  /** Text, URL, or base64 data URI */
  output: string | null
  /** Artifact ID if saveArtifact=true and artifact was persisted */
  artifactId?: string
  fallbackUsed: boolean
  fallbackReason?: string
  /** Non-fatal degradation warning (e.g. blueprint returned instead of real audio) */
  warning?: string
  /** Error message when success=false */
  error?: string
  /** Structured error category for adult/specialist routes */
  error_category?: 'missing_key' | 'provider_policy_block' | 'model_not_supported' | 'endpoint_error' | 'guardrail_block' | 'unknown'
}

// ── Supported capability set ───────────────────────────────────────────────────

const ALL_CAPABILITIES = [
  'chat', 'code', 'file_analysis',
  'image_generation', 'image_edit',
  'video_generation', 'image_to_video',
  'music_generation', 'lyrics_generation',
  'tts', 'stt', 'voice_response',
  'adult_image', 'adult_video',
  'suggestive_image', 'suggestive_video',
  'repo_edit', 'app_build', 'deploy_plan',
  'research', 'scrape_website',
] as const

type Capability = (typeof ALL_CAPABILITIES)[number]

// ── Adult content guardrails ──────────────────────────────────────────────────

/**
 * Terms that are unconditionally blocked in adult mode.
 * Uses simple string inclusion — no RegEx to prevent ReDoS on user input.
 */
const ADULT_BLOCKED_TERMS: readonly string[] = [
  'minor', 'child', 'underage', 'teen', 'adolescent', 'juvenile',
  'young person', 'kid', 'school age', 'preteen', 'infant', 'baby',
  'girl under 18', 'boy under 18', 'girl under 16', 'boy under 16',
  'non-consensual', 'rape', 'forced sex', 'forced intercourse',
]

/** Style prefix injected into suggestive image prompts to enforce non-explicit output */
const SUGGESTIVE_STYLE_PREFIX = 'Tasteful professional photograph, artistic lighting, no explicit sexual content, no genitalia:'

/**
 * Check adult content guardrails.
 * Returns a human-readable block reason, or null if the request is allowed.
 */
function checkAdultGuardrails(
  input: string,
  adultMode: boolean,
  safeMode: boolean,
): string | null {
  if (!adultMode) return 'adultMode is not enabled'
  if (safeMode) return 'safeMode is active — adult content blocked'
  const lower = input.toLowerCase()
  for (const term of ADULT_BLOCKED_TERMS) {
    if (lower.includes(term)) {
      return `Blocked: content contains prohibited term "${term}"`
    }
  }
  // Real person + sexual content
  if (
    lower.includes('real person') &&
    (lower.includes('sex') || lower.includes('naked') || lower.includes('nude'))
  ) {
    return 'Blocked: real person + sexual content is not permitted'
  }
  // Violence + sexual content
  if (
    lower.includes('violen') &&
    (lower.includes('sex') || lower.includes('naked') || lower.includes('nude'))
  ) {
    return 'Blocked: violence + sexual content is not permitted'
  }
  return null
}

// ── Capability detection ──────────────────────────────────────────────────────

/**
 * Detect the most appropriate capability from the request.
 * Explicit capability strings take priority; otherwise keyword-based detection
 * is used.  Uses simple string.includes() — no RegEx — to prevent ReDoS.
 */
function detectCapability(input: string, explicit?: string): Capability {
  if (explicit && (ALL_CAPABILITIES as readonly string[]).includes(explicit)) {
    return explicit as Capability
  }
  const lower = input.toLowerCase()
  // Simple string inclusion — no RegEx to prevent ReDoS on user-controlled input.
  const includesTerm = (term: string) => lower.includes(term)

  // Image
  if (
    (includesTerm('generate') || includesTerm('create') || includesTerm('draw') || includesTerm('paint') || includesTerm('make')) &&
    (includesTerm('image') || includesTerm('picture') || includesTerm('photo') || includesTerm('artwork') || includesTerm('illustration'))
  ) return 'image_generation'

  // Video
  if (
    (includesTerm('generate') || includesTerm('create') || includesTerm('make') || includesTerm('produce')) &&
    includesTerm('video')
  ) return 'video_generation'

  // Image-to-video
  if (includesTerm('image') && includesTerm('video') && (includesTerm('i2v') || includesTerm(' to '))) return 'image_to_video'

  // Music — must be before lyrics so "generate music with lyrics" routes to music
  if (
    (includesTerm('generate') || includesTerm('create') || includesTerm('make') || includesTerm('compose') || includesTerm('produce')) &&
    (includesTerm('music') || includesTerm('song') || includesTerm('track') || includesTerm('beat'))
  ) return 'music_generation'

  // Lyrics
  if (
    (includesTerm('write') || includesTerm('generate')) && includesTerm('lyrics')
  ) return 'lyrics_generation'
  if ((includesTerm('song') && includesTerm('lyrics')) || includesTerm('songwriting')) return 'lyrics_generation'

  // Voice output (TTS)
  if (
    includesTerm('speak') || includesTerm('tts') ||
    (includesTerm('read') && includesTerm('aloud')) ||
    (includesTerm('text') && includesTerm('speech') && !includesTerm('speech to text'))
  ) return 'tts'

  // Voice input (STT)
  if (
    includesTerm('transcribe') || includesTerm('stt') ||
    (includesTerm('speech') && includesTerm('to') && includesTerm('text')) ||
    (includesTerm('audio') && includesTerm('to') && includesTerm('text'))
  ) return 'stt'

  // Website scraping
  if (
    (includesTerm('scrape') || includesTerm('crawl') || includesTerm('extract') || includesTerm('fetch')) &&
    includesTerm('website')
  ) return 'scrape_website'

  // Research
  if (includesTerm('research') || (includesTerm('search') && includesTerm('web')) || includesTerm('look up')) return 'research'

  // Code
  if (
    (includesTerm('write') || includesTerm('generate') || includesTerm('implement') || includesTerm('create')) &&
    (includesTerm('code') || includesTerm('function') || includesTerm('class') || includesTerm('typescript') || includesTerm('javascript') || includesTerm('python'))
  ) return 'code'

  // File analysis
  if (
    (includesTerm('analyze') || includesTerm('analyse') || includesTerm('read') || includesTerm('summarize')) &&
    includesTerm('file')
  ) return 'file_analysis'

  // Deploy plan
  if (includesTerm('deploy') || includesTerm('deployment') || includesTerm('infrastructure')) return 'deploy_plan'

  // App build
  if ((includesTerm('build') || includesTerm('create')) && includesTerm('app')) return 'app_build'

  // Repo edit
  if ((includesTerm('edit') || includesTerm('modify') || includesTerm('fix')) && (includesTerm('repo') || includesTerm('codebase'))) return 'repo_edit'

  return 'chat'
}

// ── Output type mapping ───────────────────────────────────────────────────────

function outputTypeForCapability(cap: string): string {
  switch (cap) {
    case 'image_generation':
    case 'image_edit':
    case 'adult_image':   return 'image'
    case 'suggestive_image': return 'image'
    case 'video_generation':
    case 'image_to_video':
    case 'adult_video':   return 'video'
    case 'suggestive_video': return 'video'
    case 'music_generation': return 'audio'
    case 'tts':
    case 'voice_response': return 'audio'
    case 'stt':           return 'text'
    case 'code':
    case 'repo_edit':     return 'code'
    case 'deploy_plan':   return 'markdown'
    case 'research':      return 'markdown'
    default:              return 'text'
  }
}

// ── GenX helpers ──────────────────────────────────────────────────────────────

async function tryGenXChat(
  input: string,
  model: string,
  systemPrompt?: string,
): Promise<{ success: boolean; output: string | null; model: string; error: string | null }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: input })
  const result = await callGenXChat({ model, messages })
  return { success: result.success, output: result.output, model: result.model, error: result.error }
}

async function tryGenXMedia(
  prompt: string,
  type: 'image' | 'video' | 'audio',
  model: string,
): Promise<{ success: boolean; url: string | null; model: string; error: string | null }> {
  const result = await callGenXMedia({ model, prompt, type })
  return { success: result.success, url: result.url, model: result.model, error: result.error }
}

// ── Fallback text chain ───────────────────────────────────────────────────────

const TEXT_FALLBACK_CHAIN: Array<{ key: string; model: string }> = [
  { key: 'gemini',      model: 'gemini-2.0-flash' },
  { key: 'groq',       model: 'llama-3.3-70b-versatile' },
  { key: 'openrouter', model: 'openai/gpt-4o-mini' },
  { key: 'grok',       model: 'grok-2' },
  { key: 'qwen',       model: 'qwen-plus' },
]

async function tryFallbackText(
  input: string,
  chain = TEXT_FALLBACK_CHAIN,
): Promise<{ success: boolean; output: string | null; provider: string | null; model: string | null; error: string | null }> {
  for (const { key, model } of chain) {
    try {
      const result = await callProvider(key, model, input, undefined)
      if (result.output) {
        return { success: true, output: result.output, provider: key, model, error: null }
      }
    } catch (err) {
      console.warn(`[capability-router] Fallback provider ${key} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return { success: false, output: null, provider: null, model: null, error: 'All fallback text providers failed' }
}

// ── Artifact saving ───────────────────────────────────────────────────────────

// ── Artifact type mapping ─────────────────────────────────────────────────────

const ARTIFACT_TYPE_MAP: Record<string, 'image' | 'audio' | 'video' | 'code' | 'document'> = {
  image_generation: 'image', image_edit: 'image', adult_image: 'image', suggestive_image: 'image',
  video_generation: 'video', image_to_video: 'video', adult_video: 'video', suggestive_video: 'video',
  video_plan: 'document',
  music_generation: 'audio', tts: 'audio', voice_response: 'audio',
  code: 'code', repo_edit: 'code',
}

async function maybeSaveArtifact(
  cap: string,
  output: string | null,
  provider: string | null,
  model: string | null,
  appSlug: string,
  traceId?: string,
): Promise<string | undefined> {
  if (!output) return undefined
  try {
    const artifactType = ARTIFACT_TYPE_MAP[cap] ?? 'document'
    const isUrl = output.startsWith('http://') || output.startsWith('https://')
    const artifact = await createArtifact({
      appSlug,
      type: artifactType,
      subType: cap,
      provider: provider ?? undefined,
      model: model ?? undefined,
      traceId,
      ...(isUrl ? { contentUrl: output } : { content: output }),
    })
    return artifact.id
  } catch (err) {
    console.warn('[capability-router] Artifact save failed:', err instanceof Error ? err.message : err)
    return undefined
  }
}

// ── Execution logger ──────────────────────────────────────────────────────────

function logExecution(
  cap: string,
  provider: string | null,
  model: string | null,
  fallback: boolean,
  artifactSaved: boolean,
  error: string | null,
): void {
  console.log(
    `[capability-router] capability=${cap} provider=${provider ?? 'none'} ` +
    `model=${model ?? 'none'} fallback=${fallback} artifact=${artifactSaved} ` +
    `error=${error ?? 'null'}`,
  )
}

// ── Main router ───────────────────────────────────────────────────────────────

export async function executeCapability(
  request: CapabilityRequest,
): Promise<CapabilityResponse> {
  const cap = detectCapability(request.input, request.capability)
  const appSlug = request.appId ?? request.workspaceId ?? '__system__'
  const save = request.saveArtifact ?? false

  // ── Adult content gating ──────────────────────────────────────────────────
  if (cap === 'adult_image' || cap === 'adult_video') {
    const blockReason = checkAdultGuardrails(
      request.input,
      request.adultMode ?? false,
      request.safeMode ?? false,
    )
    if (blockReason) {
      logExecution(cap, null, null, false, false, blockReason)
      return {
        success: false,
        capability: cap,
        provider: null,
        model: null,
        outputType: outputTypeForCapability(cap),
        output: null,
        fallbackUsed: false,
        error: blockReason,
      }
    }
  }

  // ── Scrape website ────────────────────────────────────────────────────────
  if (cap === 'scrape_website') {
    try {
      // Prefer a valid URL extracted from input; fall back to the raw input as-is
      let url = request.input.trim()
      const urlMatch = request.input.match(/https?:\/\/\S+/)
      if (urlMatch) {
        try { new URL(urlMatch[0]); url = urlMatch[0] } catch { /* keep raw input */ }
      }
      const result = await crawlAppWebsite(url)
      const output = result.success
        ? JSON.stringify({
            summary: result.summary,
            pages: result.pages.length,
            niche: result.detectedNiche,
            features: result.detectedFeatures,
            capabilities: result.aiCapabilitiesNeeded,
          })
        : null
      let artifactId: string | undefined
      if (save && output) {
        artifactId = await maybeSaveArtifact(cap, output, 'firecrawl', null, appSlug, request.traceId)
      }
      logExecution(cap, 'firecrawl', null, false, !!artifactId, result.error)
      return {
        success: result.success,
        capability: cap,
        provider: 'firecrawl',
        model: null,
        outputType: 'text',
        output,
        artifactId,
        fallbackUsed: false,
        error: result.error ?? undefined,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Firecrawl failed'
      logExecution(cap, 'firecrawl', null, false, false, error)
      return { success: false, capability: cap, provider: 'firecrawl', model: null, outputType: 'text', output: null, fallbackUsed: false, error }
    }
  }

  // ── Image generation (normal — safe mode only) ────────────────────────────
  if (cap === 'image_generation' || cap === 'image_edit') {
    const preferredModel = request.modelOverride ?? GENX_IMAGE_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXMedia(request.input, 'image', preferredModel)
      if (res.success && res.url) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.url, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'image', output: res.url, artifactId, fallbackUsed: false }
      }
    }

    // Fallback: OpenAI
    const openaiKey = await getVaultApiKey('openai')
    if (openaiKey && (!request.providerOverride || request.providerOverride === 'openai')) {
      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: request.input, n: 1, size: '1024x1024' }),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }> }
          const url = data.data?.[0]?.url ?? null
          const b64 = data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null
          const output = url ?? b64
          if (output) {
            let artifactId: string | undefined
            if (save) artifactId = await maybeSaveArtifact(cap, output, 'openai', 'dall-e-3', appSlug, request.traceId)
            logExecution(cap, 'openai', 'dall-e-3', true, !!artifactId, null)
            return { success: true, capability: cap, provider: 'openai', model: 'dall-e-3', outputType: 'image', output, artifactId, fallbackUsed: true, fallbackReason: 'GenX image unavailable' }
          }
        }
      } catch (err) { console.warn('[capability-router] OpenAI image failed:', err instanceof Error ? err.message : err) }
    }

    // Fallback: Together AI FLUX
    const togetherKey = await getVaultApiKey('together')
    if (togetherKey && (!request.providerOverride || request.providerOverride === 'together')) {
      try {
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: request.input, n: 1, steps: 4, width: 1024, height: 1024 }),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ url?: string }> }
          const url = data.data?.[0]?.url ?? null
          if (url) {
            let artifactId: string | undefined
            if (save) artifactId = await maybeSaveArtifact(cap, url, 'together', 'FLUX.1-schnell-Free', appSlug, request.traceId)
            logExecution(cap, 'together', 'FLUX.1-schnell-Free', true, !!artifactId, null)
            return { success: true, capability: cap, provider: 'together', model: 'FLUX.1-schnell-Free', outputType: 'image', output: url, artifactId, fallbackUsed: true, fallbackReason: 'GenX image unavailable' }
          }
        }
      } catch (err) { console.warn('[capability-router] Together AI image failed:', err instanceof Error ? err.message : err) }
    }

    logExecution(cap, null, null, true, false, 'No image provider available')
    return {
      success: false,
      capability: cap,
      provider: null,
      model: null,
      outputType: 'image',
      output: null,
      fallbackUsed: true,
      error: 'No image generation provider is configured. Configure GenX, OpenAI, or Together AI.',
    }
  }

  // ── Adult image generation (adult-capable providers only — no safe fallback) ─
  // adult_image MUST NOT fall back to normal image providers (OpenAI DALL-E,
  // safe GenX image route). Only providers that explicitly support adult content.
  // Provider order: xAI/Grok → Together AI (disable_safety_checker) → HuggingFace
  if (cap === 'adult_image') {
    // Guardrails already checked above. Proceed to adult-capable providers only.

    // ── Provider 1: xAI / Grok image generation ─────────────────────────
    const grokKey = await getVaultApiKey('grok')
    if (grokKey && (!request.providerOverride || request.providerOverride === 'xai' || request.providerOverride === 'grok')) {
      try {
        const xaiModel = request.modelOverride ?? 'grok-2-image'
        const res = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${grokKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: xaiModel, prompt: request.input, n: 1 }),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }> }
          const url = data.data?.[0]?.url ?? null
          const b64 = data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null
          const output = url ?? b64
          if (output) {
            let artifactId: string | undefined
            if (save) artifactId = await maybeSaveArtifact(cap, output, 'xai', xaiModel, appSlug, request.traceId)
            logExecution(cap, 'xai', xaiModel, false, !!artifactId, null)
            return { success: true, capability: cap, provider: 'xai', model: xaiModel, outputType: 'image', output, artifactId, fallbackUsed: false }
          }
        }
      } catch (err) { console.warn('[capability-router] xAI adult image failed:', err instanceof Error ? err.message : err) }
    }

    // ── Provider 2: Together AI with disable_safety_checker ─────────────
    const togetherKeyAdult = await getVaultApiKey('together')
    if (togetherKeyAdult && (!request.providerOverride || request.providerOverride === 'together')) {
      const adultModels = [
        { model: 'black-forest-labs/FLUX.1-schnell-Free', steps: 4 },
        { model: 'black-forest-labs/FLUX.1-schnell', steps: 4 },
        { model: 'stabilityai/stable-diffusion-xl-base-1.0', steps: 30 },
      ]
      for (const { model: adultModel, steps } of adultModels) {
        try {
          const res = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: { Authorization: `Bearer ${togetherKeyAdult}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: adultModel, prompt: request.input, n: 1, steps, width: 768, height: 768, disable_safety_checker: true }),
            signal: AbortSignal.timeout(60_000),
          })
          if (res.ok) {
            const data = await res.json() as { data?: Array<{ url?: string }> }
            const url = data.data?.[0]?.url ?? null
            if (url) {
              let artifactId: string | undefined
              if (save) artifactId = await maybeSaveArtifact(cap, url, 'together', adultModel, appSlug, request.traceId)
              logExecution(cap, 'together', adultModel, true, !!artifactId, null)
              return { success: true, capability: cap, provider: 'together', model: adultModel, outputType: 'image', output: url, artifactId, fallbackUsed: true, fallbackReason: 'xAI unavailable' }
            }
          } else if (res.status === 422) {
            // Safety checker triggered or model not supported — try next model
            console.warn(`[capability-router] Together adult image model ${adultModel} blocked (422)`)
            continue
          }
        } catch (err) { console.warn(`[capability-router] Together adult image (${adultModel}) failed:`, err instanceof Error ? err.message : err) }
      }
    }

    // ── Provider 3: HuggingFace adult models ─────────────────────────────
    const hfKeyAdult = await getVaultApiKey('huggingface')
    if (hfKeyAdult && (!request.providerOverride || request.providerOverride === 'huggingface')) {
      const hfAdultModels = [
        'SG161222/RealVisXL_V4.0',
        'Lykon/dreamshaper-8',
        'stabilityai/stable-diffusion-xl-base-1.0',
      ]
      for (const hfAdultModel of hfAdultModels) {
        try {
          const res = await fetch(`https://api-inference.huggingface.co/models/${hfAdultModel}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${hfKeyAdult}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: request.input, parameters: { num_inference_steps: 28, guidance_scale: 7.0, width: 768, height: 768 } }),
            signal: AbortSignal.timeout(120_000),
          })
          if (res.ok) {
            const contentType = res.headers.get('content-type') ?? 'image/png'
            if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
              const buffer = await res.arrayBuffer()
              if (buffer.byteLength > 0) {
                const output = `data:${contentType.startsWith('image/') ? contentType : 'image/png'};base64,${Buffer.from(buffer).toString('base64')}`
                let artifactId: string | undefined
                if (save) artifactId = await maybeSaveArtifact(cap, output, 'huggingface', hfAdultModel, appSlug, request.traceId)
                logExecution(cap, 'huggingface', hfAdultModel, true, !!artifactId, null)
                return { success: true, capability: cap, provider: 'huggingface', model: hfAdultModel, outputType: 'image', output, artifactId, fallbackUsed: true, fallbackReason: 'xAI/Together unavailable' }
              }
            }
          } else if (res.status === 503) {
            continue // Model loading
          }
        } catch (err) { console.warn(`[capability-router] HuggingFace adult image (${hfAdultModel}) failed:`, err instanceof Error ? err.message : err) }
      }
    }

    const adultMissingKeys: string[] = []
    if (!grokKey) adultMissingKeys.push('xAI/Grok key missing (Admin → AI Providers → xAI / Grok)')
    if (!togetherKeyAdult) adultMissingKeys.push('Together AI key missing (Admin → AI Providers → Together AI)')
    if (!hfKeyAdult) adultMissingKeys.push('HuggingFace key missing (Admin → AI Providers → HuggingFace)')

    logExecution(cap, null, null, false, false, 'No adult image provider available')
    return {
      success: false,
      capability: cap,
      provider: null,
      model: null,
      outputType: 'image',
      output: null,
      fallbackUsed: false,
      error: adultMissingKeys.length === 3
        ? `Adult image generation requires at least one provider key. ${adultMissingKeys.join('; ')}`
        : 'All adult image providers failed. Configure xAI/Grok, Together AI, or HuggingFace with adult-capable models.',
      error_category: adultMissingKeys.length === 3 ? 'missing_key' : 'provider_policy_block',
    }
  }

  // ── Adult video generation ────────────────────────────────────────────────
  // adult_video MUST NOT fall back to normal video or storyboard providers.
  // No adult video provider is wired yet — return structured UNAVAILABLE error.
  if (cap === 'adult_video') {
    logExecution(cap, null, null, false, false, 'No adult video provider available')
    return {
      success: false,
      capability: cap,
      provider: null,
      model: null,
      outputType: 'video',
      output: null,
      fallbackUsed: false,
      error: 'Adult video generation is not yet available. No adult-capable video provider is configured. Do not fall back to normal video or storyboard routes.',
      error_category: 'model_not_supported',
    }
  }

  // ── Suggestive image generation (non-explicit, gated) ────────────────────
  // Requires safeMode=false (adultMode flag used as proxy in capability-router context).
  if (cap === 'suggestive_image') {
    if (request.safeMode) {
      return {
        success: false, capability: cap, provider: null, model: null,
        outputType: 'image', output: null, fallbackUsed: false,
        error: 'safeMode is active — suggestive image generation blocked',
      }
    }
    const finalPrompt = `${SUGGESTIVE_STYLE_PREFIX} ${request.input}`

    // Try OpenAI DALL-E 3 first (has built-in content policy for suggestive-but-not-explicit)
    const openaiKeySug = await getVaultApiKey('openai')
    if (openaiKeySug && (!request.providerOverride || request.providerOverride === 'openai')) {
      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKeySug}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: finalPrompt, n: 1, size: '1024x1024', style: 'natural' }),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ url?: string }> }
          const url = data.data?.[0]?.url ?? null
          if (url) {
            let artifactId: string | undefined
            if (save) artifactId = await maybeSaveArtifact(cap, url, 'openai', 'dall-e-3', appSlug, request.traceId)
            logExecution(cap, 'openai', 'dall-e-3', false, !!artifactId, null)
            return { success: true, capability: cap, provider: 'openai', model: 'dall-e-3', outputType: 'image', output: url, artifactId, fallbackUsed: false }
          }
        }
      } catch (err) { console.warn('[capability-router] OpenAI suggestive image failed:', err instanceof Error ? err.message : err) }
    }

    // Fallback: Together AI FLUX
    const togetherKeySug = await getVaultApiKey('together')
    if (togetherKeySug && (!request.providerOverride || request.providerOverride === 'together')) {
      try {
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${togetherKeySug}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: finalPrompt, n: 1, steps: 4, width: 1024, height: 1024 }),
          signal: AbortSignal.timeout(60_000),
        })
        if (res.ok) {
          const data = await res.json() as { data?: Array<{ url?: string }> }
          const url = data.data?.[0]?.url ?? null
          if (url) {
            let artifactId: string | undefined
            if (save) artifactId = await maybeSaveArtifact(cap, url, 'together', 'FLUX.1-schnell-Free', appSlug, request.traceId)
            logExecution(cap, 'together', 'FLUX.1-schnell-Free', true, !!artifactId, null)
            return { success: true, capability: cap, provider: 'together', model: 'FLUX.1-schnell-Free', outputType: 'image', output: url, artifactId, fallbackUsed: true, fallbackReason: 'OpenAI unavailable' }
          }
        }
      } catch (err) { console.warn('[capability-router] Together suggestive image failed:', err instanceof Error ? err.message : err) }
    }

    logExecution(cap, null, null, true, false, 'No suggestive image provider available')
    return {
      success: false, capability: cap, provider: null, model: null, outputType: 'image', output: null, fallbackUsed: true,
      error: 'No suggestive image provider is configured. Configure OpenAI or Together AI.',
    }
  }

  // ── Suggestive video planning (non-explicit, gated) ───────────────────────
  // Returns a structured scene plan — no actual video generation.
  if (cap === 'suggestive_video') {
    if (request.safeMode) {
      return {
        success: false, capability: cap, provider: null, model: null,
        outputType: 'video', output: null, fallbackUsed: false,
        error: 'safeMode is active — suggestive video planning blocked',
      }
    }
    // Produce a scene plan via text fallback
    const planResult = await tryFallbackText(
      `Create a tasteful suggestive video scene plan for: "${request.input}". ` +
      `No explicit sexual content, no genitalia, no minors. ` +
      `Include: style, scenes, camera angles, clothing notes, and audio direction.`,
    )
    if (planResult.success && planResult.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, planResult.output, planResult.provider, planResult.model, appSlug, request.traceId)
      logExecution(cap, planResult.provider, planResult.model, false, !!artifactId, null)
      return {
        success: true, capability: cap, provider: planResult.provider, model: planResult.model,
        outputType: 'video_plan', output: planResult.output, artifactId, fallbackUsed: false,
        warning: 'Suggestive video generation is not available — scene plan returned instead',
      }
    }
    logExecution(cap, null, null, false, false, 'Suggestive video planning failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'video', output: null, fallbackUsed: false, error: 'No text provider available for suggestive video planning.' }
  }

  // ── Video generation (normal — safe mode only) ────────────────────────────
  if (cap === 'video_generation' || cap === 'image_to_video') {
    const preferredModel = request.modelOverride ?? GENX_VIDEO_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXMedia(request.input, 'video', preferredModel)
      if (res.success && res.url) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.url, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'video', output: res.url, artifactId, fallbackUsed: false }
      }
    }

    // No real video provider — return an honest storyboard plan
    const planResult = await tryFallbackText(
      `Create a detailed video storyboard/script for: "${request.input}". ` +
      `Structure as: scene list, shot descriptions, narration/dialogue, and visual style notes.`,
    )
    if (planResult.success && planResult.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact('video_plan', planResult.output, planResult.provider, planResult.model, appSlug, request.traceId)
      logExecution('video_plan', planResult.provider, planResult.model, true, !!artifactId, null)
      return {
        success: true,
        capability: 'video_plan',
        provider: planResult.provider,
        model: planResult.model,
        outputType: 'video_plan',
        output: planResult.output,
        artifactId,
        fallbackUsed: true,
        fallbackReason: 'No real video provider configured',
        warning: 'No real video provider configured — storyboard returned instead of generated video',
      }
    }

    logExecution(cap, null, null, true, false, 'No video provider available')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'video', output: null, fallbackUsed: true, error: 'No video generation provider is configured.' }
  }

  // ── Music generation ──────────────────────────────────────────────────────
  // GenX has no known real music models yet — fall to blueprint.
  // This must NEVER route to image generation.
  if (cap === 'music_generation') {
    const blueprintResult = await tryFallbackText(
      `Generate a complete music blueprint for: "${request.input}". ` +
      `Include: song title, genre, BPM, key, full verse/chorus/bridge structure, ` +
      `full lyrics, and production notes.`,
    )
    if (blueprintResult.success && blueprintResult.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, blueprintResult.output, blueprintResult.provider, blueprintResult.model, appSlug, request.traceId)
      logExecution(cap, blueprintResult.provider, blueprintResult.model, true, !!artifactId, null)
      return {
        success: true,
        capability: cap,
        provider: blueprintResult.provider,
        model: blueprintResult.model,
        outputType: 'music_blueprint',
        output: blueprintResult.output,
        artifactId,
        fallbackUsed: true,
        fallbackReason: 'No real music provider configured',
        warning: 'No real music provider configured — creative blueprint returned instead of generated audio',
      }
    }
    logExecution(cap, null, null, true, false, 'Music generation failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'audio', output: null, fallbackUsed: true, error: 'No music generation provider is configured.' }
  }

  // ── Lyrics generation ─────────────────────────────────────────────────────
  if (cap === 'lyrics_generation') {
    const systemPrompt = 'You are a professional songwriter. Generate creative, original song lyrics with verse/chorus/bridge structure.'
    const model = request.modelOverride ?? GENX_TEXT_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXChat(request.input, model, systemPrompt)
      if (res.success && res.output) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'text', output: res.output, artifactId, fallbackUsed: false }
      }
    }

    const fallback = await tryFallbackText(`${systemPrompt}\n\n${request.input}`)
    if (fallback.success && fallback.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
      logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
      return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'text', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
    }
    logExecution(cap, null, null, true, false, 'Lyrics generation failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'text', output: null, fallbackUsed: true, error: 'All providers failed for lyrics generation.' }
  }

  // ── TTS / voice response ──────────────────────────────────────────────────
  if (cap === 'tts' || cap === 'voice_response') {
    const model = request.modelOverride ?? GENX_TTS_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXMedia(request.input, 'audio', model)
      if (res.success && res.url) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.url, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'audio', output: res.url, artifactId, fallbackUsed: false }
      }
    }

    logExecution(cap, null, null, false, false, 'No TTS provider via capability router')
    return {
      success: false,
      capability: cap,
      provider: null,
      model: null,
      outputType: 'audio',
      output: null,
      fallbackUsed: false,
      error: 'TTS via the capability router requires GenX. Use /api/brain/tts for the full provider chain (ElevenLabs, OpenAI, Gemini, Qwen).',
    }
  }

  // ── STT ───────────────────────────────────────────────────────────────────
  if (cap === 'stt') {
    logExecution(cap, null, null, false, false, 'STT requires audio file input')
    return {
      success: false,
      capability: cap,
      provider: null,
      model: null,
      outputType: 'text',
      output: null,
      fallbackUsed: false,
      error: 'STT requires a multipart audio file. Use /api/brain/stt directly.',
    }
  }

  // ── Research ──────────────────────────────────────────────────────────────
  if (cap === 'research') {
    const systemPrompt = 'You are a research assistant. Provide comprehensive, factual, well-structured research.'
    const model = request.modelOverride ?? GENX_TEXT_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXChat(request.input, model, systemPrompt)
      if (res.success && res.output) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'markdown', output: res.output, artifactId, fallbackUsed: false }
      }
    }

    const fallback = await tryFallbackText(`${systemPrompt}\n\n${request.input}`)
    if (fallback.success && fallback.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
      logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
      return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'markdown', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
    }
    logExecution(cap, null, null, true, false, 'Research failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'text', output: null, fallbackUsed: true, error: 'All providers failed for research.' }
  }

  // ── Code / repo_edit / app_build ──────────────────────────────────────────
  if (cap === 'code' || cap === 'repo_edit' || cap === 'app_build') {
    const model = request.modelOverride ?? 'gpt-5.3-codex'
    const systemPrompt =
      cap === 'repo_edit' ? 'You are an expert software engineer. Provide precise code edits and file diffs.'
      : cap === 'app_build' ? 'You are a full-stack app builder. Generate complete, production-ready application code.'
      : 'You are an expert software engineer. Write clean, well-documented code.'

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXChat(request.input, model, systemPrompt)
      if (res.success && res.output) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'code', output: res.output, artifactId, fallbackUsed: false }
      }
    }

    const fallback = await tryFallbackText(`${systemPrompt}\n\n${request.input}`)
    if (fallback.success && fallback.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
      logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
      return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'code', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
    }
    logExecution(cap, null, null, true, false, 'Code generation failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'code', output: null, fallbackUsed: true, error: 'All providers failed for code generation.' }
  }

  // ── Deploy plan ───────────────────────────────────────────────────────────
  if (cap === 'deploy_plan') {
    const systemPrompt = 'You are a DevOps architect. Generate a detailed deployment plan with infrastructure specs, environment setup, and rollout steps.'
    const model = request.modelOverride ?? GENX_TEXT_MODELS[0]

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXChat(request.input, model, systemPrompt)
      if (res.success && res.output) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'markdown', output: res.output, artifactId, fallbackUsed: false }
      }
    }

    const fallback = await tryFallbackText(`${systemPrompt}\n\n${request.input}`)
    if (fallback.success && fallback.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
      logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
      return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'markdown', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
    }
    logExecution(cap, null, null, true, false, 'Deploy plan failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'text', output: null, fallbackUsed: true, error: 'All providers failed for deploy plan generation.' }
  }

  // ── File analysis ─────────────────────────────────────────────────────────
  if (cap === 'file_analysis') {
    const systemPrompt = 'You are a document analyst. Analyze and summarize the provided content, extracting key insights.'
    const model = request.modelOverride ?? GENX_TEXT_MODELS[0]
    const inputWithFiles = request.files?.length
      ? `${request.input}\n\nFiles: ${request.files.join(', ')}`
      : request.input

    if (!request.providerOverride || request.providerOverride === 'genx') {
      const res = await tryGenXChat(inputWithFiles, model, systemPrompt)
      if (res.success && res.output) {
        let artifactId: string | undefined
        if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
        logExecution(cap, 'genx', res.model, false, !!artifactId, null)
        return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'text', output: res.output, artifactId, fallbackUsed: false }
      }
    }

    const fallback = await tryFallbackText(`${systemPrompt}\n\n${inputWithFiles}`)
    if (fallback.success && fallback.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
      logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
      return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'text', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
    }
    logExecution(cap, null, null, true, false, 'File analysis failed')
    return { success: false, capability: cap, provider: null, model: null, outputType: 'text', output: null, fallbackUsed: true, error: 'All providers failed for file analysis.' }
  }

  // ── Chat (default) ────────────────────────────────────────────────────────
  const model = request.modelOverride ?? GENX_TEXT_MODELS[0]

  if (!request.providerOverride || request.providerOverride === 'genx') {
    const res = await tryGenXChat(request.input, model)
    if (res.success && res.output) {
      let artifactId: string | undefined
      if (save) artifactId = await maybeSaveArtifact(cap, res.output, 'genx', res.model, appSlug, request.traceId)
      logExecution(cap, 'genx', res.model, false, !!artifactId, null)
      return { success: true, capability: cap, provider: 'genx', model: res.model, outputType: 'text', output: res.output, artifactId, fallbackUsed: false }
    }
  }

  const fallback = await tryFallbackText(request.input)
  if (fallback.success && fallback.output) {
    let artifactId: string | undefined
    if (save) artifactId = await maybeSaveArtifact(cap, fallback.output, fallback.provider, fallback.model, appSlug, request.traceId)
    logExecution(cap, fallback.provider, fallback.model, true, !!artifactId, null)
    return { success: true, capability: cap, provider: fallback.provider, model: fallback.model, outputType: 'text', output: fallback.output, artifactId, fallbackUsed: true, fallbackReason: 'GenX unavailable' }
  }

  logExecution(cap, null, null, true, false, 'All providers failed')
  return {
    success: false,
    capability: cap,
    provider: null,
    model: null,
    outputType: 'text',
    output: null,
    fallbackUsed: true,
    error: 'All providers failed. Please configure at least one AI provider (GenX, Gemini, Groq, or OpenRouter).',
  }
}
