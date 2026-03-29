/**
 * @module multimodal-router
 * @description Multimodal Generation Router for the AmarktAI Network.
 *
 * Routes content-generation requests to the appropriate AI pipeline based
 * on content type. Supports text, image-prompt, ad-concept, campaign,
 * calendar, reel/video concept, and brand-voice generation.
 *
 * Features:
 *   - Text generation routing
 *   - Image prompt generation (via AI text models)
 *   - Ad concept generation (headline, body, CTA, visual direction)
 *   - Campaign package generation
 *   - Content calendar generation
 *   - Reel / video concept planning
 *   - Asset pipeline orchestration hooks
 *   - Creative memory integration (brand voice)
 *
 * Server-side only. Never import from client components.
 */

import { callProvider } from '@/lib/brain'
import { getAppProfile } from '@/lib/app-profiles'
import { getDefaultModelForProvider } from '@/lib/model-registry'
import { prisma } from '@/lib/prisma'

// ── Type definitions ────────────────────────────────────────────────────────

/** Supported content types for the multimodal router. */
export type ContentType =
  | 'text'
  | 'image_prompt'
  | 'ad_concept'
  | 'social_post'
  | 'caption'
  | 'campaign_plan'
  | 'content_calendar'
  | 'reel_concept'
  | 'video_concept'
  | 'brand_voice'
  | 'voice_script'
  | 'tts_brief'
  | 'speech_workflow'
  | 'voice_profile'

/** Quality mode for image/video generation. */
export type QualityMode = 'cheap' | 'balanced' | 'premium'

/** Input for a multimodal generation request. */
export interface MultimodalRequest {
  /** App slug for profile lookup and memory scoping. */
  appSlug: string
  /** The type of content to generate. */
  contentType: ContentType
  /** The user's creative prompt / brief. */
  prompt: string
  /** Optional structured context (campaign details, audience info, etc). */
  context?: Record<string, unknown>
  /** Brand voice description to inject into the system prompt. */
  brandVoice?: string
  /** Target distribution platform (instagram, tiktok, linkedin, etc). */
  targetPlatform?: string
  /** Desired output format. */
  outputFormat?: 'text' | 'json' | 'markdown'
  /** Quality mode for image/video generation (default: 'balanced'). */
  qualityMode?: QualityMode
}

/** Result from the multimodal generation router. */
export interface MultimodalResult {
  /** Whether the generation completed successfully. */
  success: boolean
  /** The content type that was generated. */
  contentType: ContentType
  /** The generated output (null on failure). */
  output: string | null
  /** Generation metadata. */
  metadata: {
    modelUsed: string | null
    providerUsed: string | null
    latencyMs: number
    usedBrandMemory: boolean
    usedCampaignMemory: boolean
  }
  /** Non-fatal warnings. */
  warnings: string[]
  /** Error messages (non-empty when success is false). */
  errors: string[]
}

/** Current operational status of the multimodal router. */
export interface MultimodalStatus {
  /** Whether the router is reachable and has at least one provider. */
  available: boolean
  /** Content types the router can handle. */
  supportedContentTypes: ContentType[]
  /** Text-based generation is available. */
  textGenerationReady: boolean
  /** Image prompt generation is available. */
  imagePromptReady: boolean
  /** Video concept generation is available. */
  videoConceptReady: boolean
  /** Campaign plan generation is available. */
  campaignPlanReady: boolean
  /** Voice script / TTS brief generation is available. */
  voiceReady: boolean
  /** Human-readable status label. */
  statusLabel: 'operational' | 'partial' | 'not_configured'
}

// ── Constants ───────────────────────────────────────────────────────────────

/** All content types the router can handle. */
const ALL_CONTENT_TYPES: ContentType[] = [
  'text',
  'image_prompt',
  'ad_concept',
  'social_post',
  'caption',
  'campaign_plan',
  'content_calendar',
  'reel_concept',
  'video_concept',
  'brand_voice',
  'voice_script',
  'tts_brief',
  'speech_workflow',
  'voice_profile',
]

/** Preferred provider order for creative generation. */
const CREATIVE_PROVIDER_PREFERENCE = ['openai', 'groq', 'deepseek', 'openrouter', 'together']

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the static list of content types the router supports.
 */
export function getSupportedContentTypes(): ContentType[] {
  return [...ALL_CONTENT_TYPES]
}

/**
 * Attempt to load a brand-voice memory entry for the given app.
 * Returns null if none exists or on any error.
 */
async function loadBrandVoiceMemory(appSlug: string): Promise<string | null> {
  try {
    const entry = await prisma.memoryEntry.findFirst({
      where: {
        appSlug,
        memoryType: 'context',
        key: 'brand_voice',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    })
    return entry?.content ?? null
  } catch {
    return null
  }
}

/**
 * Attempt to load recent campaign memory for the given app.
 * Returns null if none exists or on any error.
 */
async function loadCampaignMemory(appSlug: string): Promise<string | null> {
  try {
    const entry = await prisma.memoryEntry.findFirst({
      where: {
        appSlug,
        memoryType: 'context',
        key: 'campaign',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    })
    return entry?.content ?? null
  } catch {
    return null
  }
}

/**
 * Resolve the provider and model for creative generation.
 *
 * Reads the app profile's preferred models and allowed providers, then
 * picks the first available creative provider in priority order.
 */
function resolveCreativeProvider(appSlug: string): { providerKey: string; model: string } {
  const profile = getAppProfile(appSlug)

  for (const provider of CREATIVE_PROVIDER_PREFERENCE) {
    if (profile.allowed_providers.includes(provider)) {
      const model = getDefaultModelForProvider(provider)
      if (model !== 'unknown') {
        return { providerKey: provider, model }
      }
    }
  }

  // Fallback to first allowed provider
  const fallbackProvider = profile.allowed_providers[0] ?? 'groq'
  return {
    providerKey: fallbackProvider,
    model: getDefaultModelForProvider(fallbackProvider),
  }
}

// ── Prompt builder ──────────────────────────────────────────────────────────

/**
 * Build a specialised prompt for the given content type and request.
 *
 * Injects brand voice, platform targeting, and content-type-specific
 * instructions so the model produces structured, actionable output.
 *
 * @param request - The multimodal generation request.
 * @returns A fully constructed prompt string.
 */
export function buildCreativePrompt(request: MultimodalRequest): string {
  const { contentType, prompt, brandVoice, targetPlatform, outputFormat, context } = request

  const parts: string[] = []

  // Brand voice preamble
  if (brandVoice) {
    parts.push(`[Brand Voice]: ${brandVoice}`)
  }

  // Platform targeting
  if (targetPlatform) {
    parts.push(`[Target Platform]: ${targetPlatform}`)
  }

  // Extra context
  if (context && Object.keys(context).length > 0) {
    parts.push(`[Context]: ${JSON.stringify(context)}`)
  }

  // Content-type-specific instructions
  switch (contentType) {
    case 'text':
      parts.push(
        'You are a professional copywriter. Generate clear, engaging text based on the following brief.',
        `Brief: ${prompt}`,
      )
      break

    case 'social_post':
      parts.push(
        `You are a social media specialist${targetPlatform ? ` for ${targetPlatform}` : ''}. Write an engaging social media post.`,
        'Include relevant hashtags and a clear call to action where appropriate.',
        `Brief: ${prompt}`,
      )
      break

    case 'caption':
      parts.push(
        `You are a caption writer${targetPlatform ? ` for ${targetPlatform}` : ''}. Write a compelling caption.`,
        'Keep it concise but impactful. Include relevant hashtags.',
        `Brief: ${prompt}`,
      )
      break

    case 'image_prompt':
      parts.push(
        'You are an expert at writing detailed image-generation prompts for AI tools like DALL-E, Midjourney, and Stable Diffusion.',
        'Generate a highly detailed, descriptive image prompt that would produce a professional, visually striking result.',
        'Include: subject, style, lighting, colour palette, composition, mood, and technical parameters.',
        `Concept: ${prompt}`,
      )
      break

    case 'ad_concept':
      parts.push(
        'You are a senior advertising creative director. Generate a complete ad concept with the following sections:',
        '1. **Headline** — attention-grabbing, concise',
        '2. **Body Copy** — persuasive, benefit-focused',
        '3. **Call to Action (CTA)** — clear and actionable',
        '4. **Visual Direction** — describe the ideal visual/image to accompany the ad',
        `${targetPlatform ? `5. **Platform Notes** — optimisation tips for ${targetPlatform}` : ''}`,
        `Brief: ${prompt}`,
      )
      break

    case 'campaign_plan':
      parts.push(
        'You are a marketing strategist. Generate a structured campaign plan with:',
        '1. **Campaign Objective** — what the campaign aims to achieve',
        '2. **Target Audience** — demographics, interests, pain points',
        '3. **Key Messages** — 3-5 core messages',
        '4. **Channel Strategy** — which platforms/channels and why',
        '5. **Content Pillars** — 3-5 thematic content pillars',
        '6. **Timeline** — phased rollout plan',
        '7. **KPIs** — measurable success metrics',
        `Brief: ${prompt}`,
      )
      break

    case 'content_calendar':
      parts.push(
        'You are a content strategist. Generate a content calendar/schedule including:',
        '- Post dates and times (suggest optimal posting windows)',
        '- Content type for each slot (image, video, carousel, text)',
        '- Topic/theme for each post',
        '- Platform-specific notes',
        '- Hashtag suggestions per post',
        `${targetPlatform ? `Optimise for ${targetPlatform}.` : 'Cover a mix of platforms.'}`,
        `Brief: ${prompt}`,
      )
      break

    case 'reel_concept':
      parts.push(
        'You are a short-form video creative director. Generate a reel/short video concept with:',
        '1. **Hook** (first 1-3 seconds) — what grabs attention',
        '2. **Script/Storyboard** — scene-by-scene breakdown',
        '3. **Visual Style** — aesthetic, transitions, effects',
        '4. **Audio/Music Direction** — suggested music genre, voiceover notes',
        '5. **Text Overlays** — key on-screen text',
        '6. **CTA** — end-card or final message',
        'Note: This is a concept brief — actual video generation is not yet supported.',
        `Brief: ${prompt}`,
      )
      break

    case 'video_concept':
      parts.push(
        'You are a video production strategist. Generate a video concept brief with:',
        '1. **Concept Title**',
        '2. **Format & Duration** — suggested format (interview, explainer, vlog, etc) and length',
        '3. **Script Outline** — key talking points or scene list',
        '4. **Visual Direction** — cinematography style, colour grading, graphics',
        '5. **Audio** — music, sound design, voiceover direction',
        '6. **Distribution Strategy** — where to publish and how to optimise',
        'Note: This is a concept brief — actual video generation is not yet supported.',
        `Brief: ${prompt}`,
      )
      break

    case 'brand_voice':
      parts.push(
        'You are a brand strategist. Analyse the following and define a brand voice guide including:',
        '1. **Voice Attributes** — 3-5 adjectives that define the tone',
        '2. **Personality** — describe the brand as if it were a person',
        '3. **Do / Don\'t** — specific language guidance',
        '4. **Example Phrases** — 5-10 on-brand example sentences',
        '5. **Adaptation Notes** — how the voice flexes across platforms',
        `Brief: ${prompt}`,
      )
      break

    case 'voice_script':
      parts.push(
        'You are a professional scriptwriter for voice and audio content. Write a clean, natural-sounding voice script with:',
        '1. **Speaker Notes** — character/voice description, tone, pacing',
        '2. **Script** — natural dialogue formatted for text-to-speech delivery',
        '3. **Pronunciation Guide** — flag any unusual words or acronyms',
        '4. **Emotional Direction** — cues for tone shifts (warm, urgent, calm, etc)',
        'Format the script for direct TTS input — avoid markdown symbols within the spoken text.',
        `Brief: ${prompt}`,
      )
      break

    case 'tts_brief':
      parts.push(
        'You are a voice production director. Generate a TTS production brief covering:',
        '1. **Voice Profile** — gender, age range, accent, personality',
        '2. **Tone & Pacing** — speaking rate, pauses, emphasis patterns',
        '3. **Emotion Profile** — primary emotion and shifts',
        '4. **Use Case** — where this voice will be used (app, ad, narrator, etc)',
        '5. **Sample Phrases** — 3-5 example lines to test the voice profile',
        '6. **Technical Notes** — output format preferences (mp3, wav), target duration',
        `Brief: ${prompt}`,
      )
      break

    case 'speech_workflow':
      parts.push(
        'You are a conversational AI architect. Design a speech interaction workflow with:',
        '1. **Workflow Name & Purpose**',
        '2. **Trigger** — how the speech interaction is initiated',
        '3. **Dialogue Flow** — key conversation stages and branching logic',
        '4. **Voice Persona** — the AI\'s speaking character for this workflow',
        '5. **Fallback Handling** — what happens if the user doesn\'t respond or misunderstands',
        '6. **Completion State** — how the interaction ends successfully',
        '7. **Integration Notes** — how this workflow connects to app features or data',
        `Brief: ${prompt}`,
      )
      break

    case 'voice_profile':
      parts.push(
        'You are a voice casting and characterisation specialist. Define a complete voice profile including:',
        '1. **Name & Identity** — character name and role',
        '2. **Voice Characteristics** — pitch, timbre, accent, speaking rhythm',
        '3. **Personality Traits** — how the voice reflects personality',
        '4. **Emotional Range** — what emotions this voice can express and how',
        '5. **Use Cases** — which app features or scenarios use this voice',
        '6. **Sample Lines** — 5 representative lines that showcase the voice',
        '7. **Voice Model Recommendation** — which TTS voice or model best matches this profile',
        `Brief: ${prompt}`,
      )
      break

    default:
      parts.push(`Generate content for: ${prompt}`)
  }

  // Output format instruction
  if (outputFormat === 'json') {
    parts.push('\nRespond in valid JSON format.')
  } else if (outputFormat === 'markdown') {
    parts.push('\nFormat your response in Markdown.')
  }

  return parts.join('\n\n')
}

// ── Core generation ─────────────────────────────────────────────────────────

/**
 * Generate content through the multimodal router.
 *
 * Builds a specialised prompt, resolves the best creative provider for
 * the app, integrates brand voice memory when available, and delegates
 * to the provider abstraction layer.
 *
 * Never throws — returns a result object with errors on failure.
 *
 * @param request - The multimodal generation request.
 * @returns Generation result with output and metadata.
 */
export async function generateContent(request: MultimodalRequest): Promise<MultimodalResult> {
  const start = Date.now()
  const warnings: string[] = []
  const errors: string[] = []

  let usedBrandMemory = false
  let usedCampaignMemory = false

  try {
    // ── Load creative memories ────────────────────────────────────────
    let effectiveBrandVoice = request.brandVoice ?? null

    if (!effectiveBrandVoice) {
      const stored = await loadBrandVoiceMemory(request.appSlug)
      if (stored) {
        effectiveBrandVoice = stored
        usedBrandMemory = true
      }
    } else {
      usedBrandMemory = true
    }

    const campaignMemory = await loadCampaignMemory(request.appSlug)
    if (campaignMemory) {
      usedCampaignMemory = true
    }

    // ── Build the enriched request ────────────────────────────────────
    const enrichedRequest: MultimodalRequest = {
      ...request,
      brandVoice: effectiveBrandVoice ?? undefined,
      context: {
        ...request.context,
        ...(campaignMemory ? { recentCampaign: campaignMemory } : {}),
      },
    }

    const fullPrompt = buildCreativePrompt(enrichedRequest)

    // ── Resolve provider ──────────────────────────────────────────────
    const { providerKey, model } = resolveCreativeProvider(request.appSlug)

    // ── Call provider ─────────────────────────────────────────────────
    const result = await callProvider(providerKey, model, fullPrompt)

    if (!result.ok) {
      errors.push(result.error ?? `Provider ${providerKey} returned an error`)
      return {
        success: false,
        contentType: request.contentType,
        output: null,
        metadata: {
          modelUsed: result.model,
          providerUsed: result.providerKey,
          latencyMs: Date.now() - start,
          usedBrandMemory,
          usedCampaignMemory,
        },
        warnings,
        errors,
      }
    }

    return {
      success: true,
      contentType: request.contentType,
      output: result.output,
      metadata: {
        modelUsed: result.model,
        providerUsed: result.providerKey,
        latencyMs: Date.now() - start,
        usedBrandMemory,
        usedCampaignMemory,
      },
      warnings,
      errors,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error in multimodal router'
    console.error('[multimodal-router] generateContent failed:', msg)
    errors.push(msg)

    return {
      success: false,
      contentType: request.contentType,
      output: null,
      metadata: {
        modelUsed: null,
        providerUsed: null,
        latencyMs: Date.now() - start,
        usedBrandMemory,
        usedCampaignMemory,
      },
      warnings,
      errors,
    }
  }
}

// ── Engine status ───────────────────────────────────────────────────────────

/**
 * Image generation quality mode to model mapping.
 * Maps quality modes to the appropriate provider/model combination.
 */
const IMAGE_QUALITY_MODELS: Record<QualityMode, { provider: string; model: string }> = {
  cheap: { provider: 'together', model: 'stabilityai/stable-diffusion-xl-base-1.0' },
  balanced: { provider: 'together', model: 'black-forest-labs/FLUX.1-schnell' },
  premium: { provider: 'openai', model: 'dall-e-3' },
}

/**
 * Resolve the image generation provider and model based on quality mode.
 */
export function resolveImageProvider(qualityMode: QualityMode = 'balanced'): {
  provider: string
  model: string
  qualityMode: QualityMode
} {
  const mapping = IMAGE_QUALITY_MODELS[qualityMode]
  return { ...mapping, qualityMode }
}

/**
 * Returns the current operational status of the multimodal router.
 *
 * Checks for at least one configured AI provider to determine readiness.
 * Never throws.
 */
export async function getMultimodalStatus(): Promise<MultimodalStatus> {
  try {
    const providers = await prisma.aiProvider.findMany({
      select: { providerKey: true, apiKey: true },
    })

    const configured = providers.filter((p) => !!p.apiKey).map((p) => p.providerKey)
    const hasAnyProvider = configured.length > 0

    // Text-based generation requires at least one configured provider
    const textReady = hasAnyProvider
    // Image prompt generation uses text models to write prompts
    const imagePromptReady = hasAnyProvider
    // Video concept uses text models to write briefs
    const videoConceptReady = hasAnyProvider
    // Campaign plan uses text models
    const campaignPlanReady = hasAnyProvider
    // Voice script / TTS brief generation uses text models; TTS audio needs OpenAI TTS
    const voiceReady = hasAnyProvider

    let statusLabel: 'operational' | 'partial' | 'not_configured' = 'not_configured'
    if (textReady && imagePromptReady) {
      statusLabel = 'operational'
    } else if (hasAnyProvider) {
      statusLabel = 'partial'
    }

    return {
      available: hasAnyProvider,
      supportedContentTypes: ALL_CONTENT_TYPES,
      textGenerationReady: textReady,
      imagePromptReady: imagePromptReady,
      videoConceptReady: videoConceptReady,
      campaignPlanReady: campaignPlanReady,
      voiceReady,
      statusLabel,
    }
  } catch (err) {
    console.warn('[multimodal-router] getMultimodalStatus failed:', err instanceof Error ? err.message : err)
    return {
      available: false,
      supportedContentTypes: ALL_CONTENT_TYPES,
      textGenerationReady: false,
      imagePromptReady: false,
      videoConceptReady: false,
      campaignPlanReady: false,
      voiceReady: false,
      statusLabel: 'not_configured',
    }
  }
}
