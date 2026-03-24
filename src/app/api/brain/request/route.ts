import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  authenticateApp,
  logBrainEvent,
  type BrainResponse,
} from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'

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

  // ── Orchestrate ───────────────────────────────────────────────────────
  const result = await orchestrate({
    appCategory: app.category,
    taskType: body.taskType,
    message: body.message,
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
  if (!success && result.routedProvider === null && result.errors.some(e => e.includes('No AI provider'))) {
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, app, error: result.errors[0], statusCode: 503, latencyMs }),
      { status: 503 },
    )
  }

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
    memoryUsed: result.memoryUsed,
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

