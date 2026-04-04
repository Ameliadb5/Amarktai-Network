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
import { scanContent, blockedExplanation } from '@/lib/content-filter'
import { getBudgetSummary } from '@/lib/budget-tracker'

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

  // ── Content filter — scan input for policy violations ───────────────
  const inputFilter = scanContent(body.message)
  if (inputFilter.flagged) {
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
        categories: inputFilter.categories,
        message: blockedExplanation(inputFilter.categories),
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
  const result = await orchestrate({
    appSlug: app.slug,
    appCategory: app.category,
    taskType: body.taskType,
    message: memoryContext + body.message,
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

  // ── Content filter — scan output for policy violations ──────────────
  if (success && result.output) {
    const filterResult = scanContent(result.output)
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

  const response: BrainResponse = {
    success,
    traceId,
    app: { id: app.id, name: app.name, slug: app.slug },
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    taskType: body.taskType,
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
    timestamp: new Date().toISOString(),
  }

  const httpStatus = success ? 200 : 502
  return NextResponse.json(response, { status: httpStatus })
}

// ── Helper ────────────────────────────────────────────────────────────────────

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

