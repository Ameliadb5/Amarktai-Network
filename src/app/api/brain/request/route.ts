import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  authenticateApp,
  logBrainEvent,
  type BrainResponse,
} from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'
import { saveMemory } from '@/lib/memory'
import { retrieve } from '@/lib/retrieval-engine'
import { logRouteOutcome } from '@/lib/learning-engine'
import { scanContent, blockedExplanation, loadAppSafetyConfigFromDB, getAppSafetyConfig } from '@/lib/content-filter'
import { estimateCostUsd, getBudgetSummary } from '@/lib/budget-tracker'
import { runEmotionPipeline, setAppContextWindow, type PersonalityType } from '@/lib/emotion-engine'
import { runModerationPipeline } from '@/lib/moderation-pipeline'
import { buildMemoryContext } from '@/lib/federated-memory'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limiter'
import { checkAppBudget } from '@/lib/app-budget-enforcement'
import { getMonthUsage, recordUsage } from '@/lib/usage-meter'
import { recordProviderMetric } from '@/lib/provider-reliability'
import { getAppAgent, buildAgentSystemPrompt } from '@/lib/app-agent'
import { dispatchEvent } from '@/lib/webhook-manager'
import { emitSystemEvent } from '@/lib/event-bus'
import { resolveCapability } from '@/lib/capability-engine'

const SETTINGS_BLOCKED_CAPABILITIES = new Set([
  'adult_18plus_image',
  'suggestive_image_generation',
  'suggestive_video_planning',
  'suggestive_video_generation',
])
const CHARS_PER_TOKEN_ESTIMATE = 4

// ── Request schema ────────────────────────────────────────────────────────────

const requestSchema = z.object({
  appId: z.string().min(1).max(200),
  appSecret: z.string().min(1),
  externalUserId: z.string().optional(),
  taskType: z.string().min(1).max(100),
  message: z.string().min(1).max(32_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  requestMode: z.enum(['sync', 'async']).optional(),
  traceId: z.string().optional(),
})

/**
 * POST /api/brain/request
 *
 * Canonical app-facing Brain Gateway.
 * Single entry point for all connected apps to request AI via Amarktai Network.
 *
 * Auth:   appId (product slug) + appSecret
 * Output: normalised BrainResponse — consistent regardless of provider or failure mode
 *
 * The orchestration layer (src/lib/orchestrator.ts) handles:
 *   - task classification
 *   - execution mode selection (direct / specialist / review / consensus)
 *   - specialist profile injection
 *   - multi-provider coordination
 *   - confidence scoring
 *   - fallback handling
 */
export async function POST(request: NextRequest) {
  const start = Date.now()

  // ── Parse & validate request body ────────────────────────────────────
  let body: z.infer<typeof requestSchema>
  try {
    const raw = await request.json()
    body = requestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json(
      errorResponse({
        traceId: randomUUID(),
        taskType: 'unknown',
        error: err instanceof z.ZodError
          ? `Invalid request: ${err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
          : 'Invalid JSON body',
        statusCode: 422,
        latencyMs: Date.now() - start,
      }),
      { status: 422 },
    )
  }

  const traceId = body.traceId || randomUUID()

  // ── Fast pre-auth content scan (always-blocked categories only) ───────
  // This runs before auth for efficiency — catches CSAM/violence/terrorism fast.
  // A second app-slug-aware scan is performed after auth using the app's safety config.
  const preAuthFilter = scanContent(body.message)
  if (preAuthFilter.flagged) {
    return NextResponse.json(
      {
        success: false,
        traceId,
        app: null,
        routedProvider: null,
        routedModel: null,
        taskType: body.taskType,
        executionMode: 'direct',
        confidenceScore: null,
        validationUsed: false,
        consensusUsed: false,
        output: null,
        warnings: [],
        errors: ['Input blocked by safety filter'],
        categories: preAuthFilter.categories,
        message: blockedExplanation(preAuthFilter.categories),
        latencyMs: Date.now() - start,
        memoryUsed: false,
        fallbackUsed: false,
        timestamp: new Date().toISOString(),
      },
      { status: 403 },
    )
  }

  // ── Authenticate the calling app ──────────────────────────────────────
  const auth = await authenticateApp(body.appId, body.appSecret)
  if (!auth.ok || !auth.app) {
    await logBrainEvent({
      traceId,
      productId: null,
      appSlug: body.appId,
      taskType: body.taskType,
      executionMode: 'direct',
      classificationJson: '{}',
      routedProvider: null,
      routedModel: null,
      validationUsed: false,
      consensusUsed: false,
      confidenceScore: null,
      success: false,
      errorMessage: auth.error ?? 'Auth failed',
      warningsJson: '[]',
      latencyMs: Date.now() - start,
    })
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, error: auth.error ?? 'Unauthorized', statusCode: auth.statusCode, latencyMs: Date.now() - start }),
      { status: auth.statusCode },
    )
  }

  const { app } = auth

  // ── Rate limiting (hard enforcement) ──────────────────────────────────
  const rateLimitResult = await checkRateLimit('app', app.slug)
  if (!rateLimitResult.allowed) {
    const headers = getRateLimitHeaders(rateLimitResult)
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, error: 'Rate limit exceeded for this app. Please retry later.', statusCode: 429, latencyMs: Date.now() - start }),
      { status: 429, headers },
    )
  }

  // ── Budget enforcement ────────────────────────────────────────────────
  try {
    const budgetCheck = await checkAppBudget(app.slug, body.taskType)
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        errorResponse({ traceId, taskType: body.taskType, error: budgetCheck.reason ?? 'Budget limit reached for this app.', statusCode: 429, latencyMs: Date.now() - start }),
        { status: 429 },
      )
    }
  } catch {
    // Budget check failure should not block requests — degrade gracefully
  }

  // ── Load app safety config (DB-backed, warm cache) ────────────────────
  // This warms the in-memory cache so all subsequent scanContent(text, app.slug)
  // calls in this request reflect the persisted safety policy.
  await loadAppSafetyConfigFromDB(app.slug)

  // Build a safety-mode context note for the model when suggestive mode is active.
  // This informs the model it may generate suggestive (but never explicit/illegal) content.
  const safetyConfig = getAppSafetyConfig(app.slug)
  const suggestiveModeNote = (!safetyConfig.safeMode && safetyConfig.suggestiveMode)
    ? '[App safety mode: Suggestive language, flirting, swearing, and tasteful adult themes are permitted. Explicit sexual acts, genitalia, minors in any adult context, and illegal content are strictly prohibited.]\n\n'
    : ''

  const requestedCapability =
    typeof body.metadata?.requested_capability === 'string'
      ? String(body.metadata.requested_capability)
      : null
  const capabilityResolution = resolveCapability(
    requestedCapability ?? body.taskType,
    body.message,
    {
      safeMode: safetyConfig.safeMode,
      adultMode: safetyConfig.adultMode,
      suggestiveMode: safetyConfig.suggestiveMode,
    },
  )

  if (!capabilityResolution.routeResult.allSatisfied) {
    const missing = capabilityResolution.routeResult.missingCapabilities[0] ?? 'Capability is unavailable'
    const blockedByPolicy = capabilityResolution.routeResult.routes.some(
      (route) => !route.available && SETTINGS_BLOCKED_CAPABILITIES.has(route.capability),
    )
    return NextResponse.json(
      {
        ...errorResponse({
          traceId,
          taskType: body.taskType,
          app,
          error: missing,
          statusCode: blockedByPolicy ? 403 : 503,
          latencyMs: Date.now() - start,
        }),
        resolvedCapability: capabilityResolution.primaryCapability,
        resolvedCapabilities: capabilityResolution.capabilities,
      },
      { status: blockedByPolicy ? 403 : 503 },
    )
  }

  const effectiveTaskType = capabilityResolution.primaryCapability

  // ── Load App Agent system prompt (B1 fix) ─────────────────────────────
  // If the app has an active App Agent configured, inject its system prompt
  // into the orchestration call so the agent's tone, rules, and persona are
  // applied to every request through the standard /brain/request endpoint.
  let agentSystemPrompt: string | undefined
  try {
    const agent = await getAppAgent(app.slug)
    if (agent?.active) {
      agentSystemPrompt = buildAgentSystemPrompt(agent)
    }
  } catch {
    // Agent lookup failure must not block the request
  }

  // ── Emit SSE: request started ────────────────────────────────────────
  emitSystemEvent('job_progress', {
    traceId,
    appSlug: app.slug,
    appName: app.name,
    taskType: body.taskType,
    stage: 'started',
    timestamp: new Date().toISOString(),
  })

  // ── Emotion engine — detect user emotion and build personality context ─
  // Uses the synchronous pipeline to avoid adding streaming latency.
  // Emotion state is persisted to Redis/Qdrant in a fire-and-forget manner.
  const emotionUserId = body.externalUserId || app.slug
  let appPersonality = mapAppPersonality(app.category)

  // Override from DB-backed AppAiProfile if set
  try {
    const aiProfile = await prisma.appAiProfile.findUnique({ where: { appSlug: app.slug } })
    if (aiProfile?.basePersonality) {
      appPersonality = aiProfile.basePersonality as PersonalityType
    }
    if (aiProfile?.emotionContextWindow && aiProfile.emotionContextWindow > 0) {
      setAppContextWindow(app.slug, aiProfile.emotionContextWindow)
    }
  } catch {
    // DB lookup failure → fall through to category-based default
  }
  let emotionContext = ''
  try {
    const emotionResult = runEmotionPipeline(emotionUserId, body.message, appPersonality)
    const { modulation, analysis } = emotionResult
    if (modulation.tonePrefix) {
      const dominantEmotion = analysis.dominant
      emotionContext =
        `[Tone: ${modulation.tonePrefix} Dominant emotion detected: ${dominantEmotion}. ` +
        `Personality: ${modulation.personalityApplied}.]\n\n`
    }
  } catch {
    // Emotion engine error must never crash the request pipeline
  }

  // ── Retrieve relevant memory context via retrieval-engine ──────────
  let memoryUsed = false
  let memoryContext = ''
  try {
    const retrievalResult = await retrieve({
      appSlug: app.slug,
      query: body.message,
      maxResults: 5,
      includeGlobal: true,
    })
    memoryUsed = retrievalResult.entries.length > 0
    if (retrievalResult.entries.length > 0) {
      memoryContext = `[Context from previous interactions with ${app.name}]\n${retrievalResult.entries.map(m => `- ${m.content}`).join('\n')}\n\n`
    }
  } catch {
    // Retrieval engine unavailable — proceed without context
  }

  // ── Federated memory context (semantic + typed user memories) ─────
  // Enriches the base retrieval with richer per-user memory (preferences,
  // instructions, facts). Runs concurrently; failure is silent.
  let federatedMemoryContext = ''
  try {
    const fedCtx = await buildMemoryContext(
      body.externalUserId || app.slug,
      app.slug,
      body.message,
    )
    if (fedCtx) {
      federatedMemoryContext = fedCtx + '\n\n'
      memoryUsed = true
    }
  } catch {
    // Federated memory unavailable — proceed without it
  }

  // ── Budget enforcement — block if all providers are over critical ────
  try {
    const budgetSummary = await getBudgetSummary()
    const allCritical = budgetSummary.entries.length > 0 &&
      budgetSummary.entries.every(e => e.status === 'critical')
    if (allCritical) {
      return NextResponse.json(
        errorResponse({
          traceId, taskType: body.taskType, app,
          error: 'All providers have exceeded their budget critical thresholds. Please contact your administrator.',
          statusCode: 429, latencyMs: Date.now() - start,
        }),
        { status: 429 },
      )
    }
  } catch {
    // Budget check failed — proceed without enforcement
  }

  // ── Orchestrate ───────────────────────────────────────────────────────
  // The agent system prompt (if any) is passed as a dedicated parameter so
  // orchestrate() can inject it via the provider's native system role mechanism
  // (OpenAI system message, Anthropic `system` field, Gemini systemInstruction).
  // This keeps it out of the user message turn entirely.
  const result = await orchestrate({
    appSlug: app.slug,
    appCategory: app.category,
    taskType: effectiveTaskType,
    message: suggestiveModeNote + emotionContext + federatedMemoryContext + memoryContext + body.message,
    agentSystemPrompt,
    providerOverride: typeof body.metadata?.provider_override === 'string' ? body.metadata.provider_override : undefined,
    modelOverride: typeof body.metadata?.model_override === 'string' ? body.metadata.model_override : undefined,
    allowFallback: body.metadata?.allow_fallback === true,
  })

  const latencyMs = Date.now() - start
  const hasErrors = result.errors.length > 0
  const success = !hasErrors && result.output !== null

  // ── Log brain event ───────────────────────────────────────────────────
  await logBrainEvent({
    traceId,
    productId: app.id,
    appSlug: app.slug,
    taskType: body.taskType,
    executionMode: result.executionMode,
    classificationJson: JSON.stringify(result.classification),
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    validationUsed: result.validationUsed,
    consensusUsed: result.consensusUsed,
    confidenceScore: result.confidenceScore,
    success,
    errorMessage: hasErrors ? result.errors.join('; ') : null,
    warningsJson: JSON.stringify(result.warnings),
    latencyMs,
  })

  // ── Emit SSE: request completed (B5) ─────────────────────────────────
  emitSystemEvent(success ? 'job_completed' : 'job_failed', {
    traceId,
    appSlug: app.slug,
    appName: app.name,
    taskType: body.taskType,
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    latencyMs,
    success,
    timestamp: new Date().toISOString(),
  })

  // ── Dispatch webhooks (B4 — fire-and-forget) ──────────────────────────
  // Sends to any webhook endpoints registered for this app. Never blocks response.
  const webhookEventType = success ? 'brain.request.completed' : 'brain.request.failed'
  dispatchEvent(app.slug, webhookEventType, {
    traceId,
    taskType: body.taskType,
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    latencyMs,
    success,
    ...(result.output ? { outputPreview: result.output.slice(0, 200) } : {}),
    ...(hasErrors ? { errors: result.errors } : {}),
  }).catch(() => { /* webhook delivery errors must not affect the response */ })

  // ── Usage metering + provider reliability ─────────────────────────────
  const tokenEstimate = estimateTokenCounts(body.message, result.output ?? '')
  try {
    const estimatedCost = result.routedModel
      ? estimateCostUsd(result.routedModel, tokenEstimate.inputTokens + tokenEstimate.outputTokens)
      : 0
    await recordUsage({
      appSlug: app.slug,
      capability: effectiveTaskType,
      provider: result.routedProvider ?? 'unknown',
      model: result.routedModel ?? '',
      success,
      inputTokens: tokenEstimate.inputTokens,
      outputTokens: tokenEstimate.outputTokens,
      latencyMs,
      costUsdCents: Math.max(0, Math.round(estimatedCost * 100)),
    })
  } catch { /* metering is best-effort */ }

  if (result.routedProvider) {
    recordProviderMetric(result.routedProvider, latencyMs, success, hasErrors ? result.errors[0] : undefined)
  }

  // ── Build normalised response ─────────────────────────────────────────
  // Return 503 when orchestration produced no output AND no provider was routed.
  // This catches all "no provider available" scenarios regardless of error message format.
  if (!success && result.routedProvider === null && result.output === null) {
    const errorMsg = result.errors.length > 0
      ? result.errors[0]
      : 'No AI provider is available — all providers are unconfigured or disabled'
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, app, error: errorMsg, statusCode: 503, latencyMs }),
      { status: 503 },
    )
  }

  // ── Content filter — scan output with full moderation pipeline ────
  // Runs OpenAI Moderation (primary) → keyword fallback → guardrails,
  // and records audit trail entry for every scan.
  if (success && result.output) {
    try {
      const outputModeration = await runModerationPipeline(result.output, 'output', {
        traceId,
        appSlug: app.slug,
        actorId: app.slug,
        actorType: 'app',
      })
      if (outputModeration.blocked) {
        return NextResponse.json(
          {
            success: false,
            traceId,
            app: { id: app.id, name: app.name, slug: app.slug },
            routedProvider: result.routedProvider,
            routedModel: result.routedModel,
            taskType: body.taskType,
            executionMode: result.executionMode,
            confidenceScore: result.confidenceScore,
            validationUsed: result.validationUsed,
            consensusUsed: result.consensusUsed,
            output: null,
            warnings: [],
            errors: ['Content blocked by safety filter'],
            categories: outputModeration.contentFilter.categories,
            message: blockedExplanation(outputModeration.contentFilter.categories),
            latencyMs,
            memoryUsed,
            fallbackUsed: result.fallbackUsed,
            timestamp: new Date().toISOString(),
            auditEntryId: outputModeration.auditEntryId,
          },
          { status: 403 },
        )
      }
    } catch {
      // Moderation pipeline failed — fall back to synchronous keyword scan
      const filterResult = scanContent(result.output, app.slug)
      if (filterResult.flagged) {
        return NextResponse.json(
          {
            success: false,
            traceId,
            app: { id: app.id, name: app.name, slug: app.slug },
            routedProvider: result.routedProvider,
            routedModel: result.routedModel,
            taskType: body.taskType,
            executionMode: result.executionMode,
            confidenceScore: result.confidenceScore,
            validationUsed: result.validationUsed,
            consensusUsed: result.consensusUsed,
            output: null,
            warnings: [],
            errors: ['Content blocked by safety filter'],
            categories: filterResult.categories,
            message: blockedExplanation(filterResult.categories),
            latencyMs,
            memoryUsed,
            fallbackUsed: result.fallbackUsed,
            timestamp: new Date().toISOString(),
          },
          { status: 403 },
        )
      }
    }
  }

  // ── Save memory on success ────────────────────────────────────────────
  if (success && result.output) {
    await saveMemory({
      appSlug:    app.slug,
      memoryType: 'event',
      key:        body.taskType,
      content:    `Task: ${body.taskType} | Input: ${body.message.slice(0, 200)} | Output: ${result.output.slice(0, 300)}`,
      importance: result.confidenceScore ?? 0.5,
      ttlDays:    90,
    })
  }

  // ── Log route outcome for learning engine ─────────────────────────────
  await logRouteOutcome({
    appSlug: app.slug,
    taskType: body.taskType,
    executionMode: result.executionMode,
    providerKey: result.routedProvider ?? 'none',
    model: result.routedModel ?? 'none',
    success,
    latencyMs,
    confidenceScore: result.confidenceScore,
    fallbackUsed: result.fallbackUsed,
    validationPassed: result.validationUsed ? !result.warnings.some(w => w.includes('Validator flagged')) : null,
  })

  const estimatedCostUsd = result.routedModel
    ? estimateCostUsd(result.routedModel, tokenEstimate.inputTokens + tokenEstimate.outputTokens)
    : 0
  let cumulativeCostUsd: number | null = null
  try {
    const month = await getMonthUsage(app.slug)
    cumulativeCostUsd = month.costCents / 100
  } catch {
    cumulativeCostUsd = null
  }

  const response: BrainResponse = {
    success,
    traceId,
    app: { id: app.id, name: app.name, slug: app.slug },
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    taskType: effectiveTaskType,
    executionMode: result.executionMode,
    confidenceScore: result.confidenceScore,
    validationUsed: result.validationUsed,
    consensusUsed: result.consensusUsed,
    output: result.output,
    warnings: result.warnings,
    errors: result.errors,
    latencyMs,
    memoryUsed,
    fallbackUsed: result.fallbackUsed,
    estimatedCostUsd,
    cumulativeCostUsd,
    resolvedCapability: capabilityResolution.primaryCapability,
    resolvedCapabilities: capabilityResolution.capabilities,
    timestamp: new Date().toISOString(),
  }

  const httpStatus = success ? 200 : 502
  return NextResponse.json(response, { status: httpStatus })
}

// ── Helper ────────────────────────────────────────────────────────────────────

function estimateTokenCounts(input: string, output: string): { inputTokens: number; outputTokens: number } {
  // Heuristic estimate only: ~4 chars/token works as a coarse average for UI/runtime cost visibility.
  // Real provider tokenization varies by language/content and may differ from this approximation.
  return {
    inputTokens: Math.max(1, Math.ceil(input.length / CHARS_PER_TOKEN_ESTIMATE)),
    outputTokens: Math.max(0, Math.ceil(output.length / CHARS_PER_TOKEN_ESTIMATE)),
  }
}

function errorResponse(opts: {
  traceId: string
  taskType: string
  error: string
  statusCode: number
  latencyMs: number
  app?: { id: number; name: string; slug: string }
}): BrainResponse {
  return {
    success: false,
    traceId: opts.traceId,
    app: opts.app ?? null,
    routedProvider: null,
    routedModel: null,
    taskType: opts.taskType,
    executionMode: 'direct',
    confidenceScore: null,
    validationUsed: false,
    consensusUsed: false,
    output: null,
    warnings: [],
    errors: [opts.error],
    latencyMs: opts.latencyMs,
    memoryUsed: false,
    fallbackUsed: false,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Map an app category/type to a base personality for the emotion engine.
 * The emotion engine will further adapt this based on the user's emotional state.
 */
function mapAppPersonality(category: string): PersonalityType {
  const cat = (category ?? '').toLowerCase()
  if (cat.includes('crypto') || cat.includes('trading') || cat.includes('finance') || cat.includes('forex')) {
    return 'analytical'
  }
  if (cat.includes('dating') || cat.includes('social')) {
    return 'flirty'
  }
  if (cat.includes('market') || cat.includes('marketing') || cat.includes('sales')) {
    return 'assertive'
  }
  if (cat.includes('support') || cat.includes('help') || cat.includes('health')) {
    return 'empathetic'
  }
  if (cat.includes('travel') || cat.includes('lifestyle')) {
    return 'friendly'
  }
  return 'professional'
}
