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
}

// ── Supported capability set ───────────────────────────────────────────────────

const ALL_CAPABILITIES = [
  'chat', 'code', 'file_analysis',
  'image_generation', 'image_edit',
  'video_generation', 'image_to_video',
  'music_generation', 'lyrics_generation',
  'tts', 'stt', 'voice_response',
  'adult_image', 'adult_video',
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
  const has = (term: string) => lower.includes(term)

  // Image
  if (
    (has('generate') || has('create') || has('draw') || has('paint') || has('make')) &&
    (has('image') || has('picture') || has('photo') || has('artwork') || has('illustration'))
  ) return 'image_generation'

  // Video
  if (
    (has('generate') || has('create') || has('make') || has('produce')) &&
    has('video')
  ) return 'video_generation'

  // Image-to-video
  if (has('image') && has('video') && (has('i2v') || has(' to '))) return 'image_to_video'

  // Music — must be before lyrics so "generate music with lyrics" routes to music
  if (
    (has('generate') || has('create') || has('make') || has('compose') || has('produce')) &&
    (has('music') || has('song') || has('track') || has('beat'))
  ) return 'music_generation'

  // Lyrics
  if (
    (has('write') || has('generate')) && has('lyrics')
  ) return 'lyrics_generation'
  if ((has('song') && has('lyrics')) || has('songwriting')) return 'lyrics_generation'

  // Voice output (TTS)
  if (
    has('speak') || has('tts') ||
    (has('read') && has('aloud')) ||
    (has('text') && has('speech') && !has('speech to text'))
  ) return 'tts'

  // Voice input (STT)
  if (
    has('transcribe') || has('stt') ||
    (has('speech') && has('to') && has('text')) ||
    (has('audio') && has('to') && has('text'))
  ) return 'stt'

  // Website scraping
  if (
    (has('scrape') || has('crawl') || has('extract') || has('fetch')) &&
    has('website')
  ) return 'scrape_website'

  // Research
  if (has('research') || (has('search') && has('web')) || has('look up')) return 'research'

  // Code
  if (
    (has('write') || has('generate') || has('implement') || has('create')) &&
    (has('code') || has('function') || has('class') || has('typescript') || has('javascript') || has('python'))
  ) return 'code'

  // File analysis
  if (
    (has('analyze') || has('analyse') || has('read') || has('summarize')) &&
    has('file')
  ) return 'file_analysis'

  // Deploy plan
  if (has('deploy') || has('deployment') || has('infrastructure')) return 'deploy_plan'

  // App build
  if ((has('build') || has('create')) && has('app')) return 'app_build'

  // Repo edit
  if ((has('edit') || has('modify') || has('fix')) && (has('repo') || has('codebase'))) return 'repo_edit'

  return 'chat'
}

// ── Output type mapping ───────────────────────────────────────────────────────

function outputTypeForCapability(cap: string): string {
  switch (cap) {
    case 'image_generation':
    case 'image_edit':
    case 'adult_image':   return 'image'
    case 'video_generation':
    case 'image_to_video':
    case 'adult_video':   return 'video'
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
    } catch { /* try next */ }
  }
  return { success: false, output: null, provider: null, model: null, error: 'All fallback text providers failed' }
}

// ── Artifact saving ───────────────────────────────────────────────────────────

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
    const typeMap: Record<string, 'image' | 'audio' | 'video' | 'code' | 'document'> = {
      image_generation: 'image', image_edit: 'image', adult_image: 'image',
      video_generation: 'video', image_to_video: 'video', adult_video: 'video',
      video_plan: 'document',
      music_generation: 'audio', tts: 'audio', voice_response: 'audio',
      code: 'code', repo_edit: 'code',
    }
    const artifactType = typeMap[cap] ?? 'document'
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
  } catch {
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
      const urlMatch = request.input.match(/https?:\/\/[^\s]+/)
      const url = urlMatch ? urlMatch[0] : request.input
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

  // ── Image generation ──────────────────────────────────────────────────────
  if (cap === 'image_generation' || cap === 'image_edit' || cap === 'adult_image') {
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
      } catch { /* try next */ }
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
      } catch { /* try next */ }
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

  // ── Video generation ──────────────────────────────────────────────────────
  if (cap === 'video_generation' || cap === 'image_to_video' || cap === 'adult_video') {
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
