import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { callProvider, logBrainEvent } from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'

const testSchema = z.object({
  message: z.string().min(1).max(16_000),
  taskType: z.string().default('chat'),
  providerKey: z.string().optional(), // override routing if specified
})

/**
 * POST /api/admin/brain/test
 *
 * Admin-session-authenticated test endpoint for the Brain Chat dashboard.
 * Bypasses app-level auth (admin session is auth).
 * Uses the orchestration layer for natural requests, or direct provider override.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start = Date.now()
  const traceId = randomUUID()

  let body: z.infer<typeof testSchema>
  try {
    body = testSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request' },
      { status: 422 },
    )
  }

  // Direct provider override (admin manual test)
  if (body.providerKey) {
    const result = await callProvider(body.providerKey, '', body.message)
    const latencyMs = Date.now() - start
    await logBrainEvent({
      traceId,
      productId: null,
      appSlug: '__admin_test__',
      taskType: body.taskType,
      executionMode: 'direct',
      classificationJson: '{}',
      routedProvider: body.providerKey,
      routedModel: result.model,
      validationUsed: false,
      consensusUsed: false,
      confidenceScore: null,
      success: result.ok,
      errorMessage: result.error ?? null,
      warningsJson: '[]',
      latencyMs,
    })
    return NextResponse.json(
      {
        success: result.ok,
        traceId,
        output: result.output,
        routedProvider: body.providerKey,
        routedModel: result.model,
        executionMode: 'direct',
        confidenceScore: null,
        fallbackUsed: false,
        error: result.error ?? null,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: result.ok ? 200 : 502 },
    )
  }

  // Use orchestrator for natural routing (admin category = 'generic')
  const orchResult = await orchestrate({
    appCategory: 'generic',
    taskType: body.taskType,
    message: body.message,
  })
  const latencyMs = Date.now() - start
  const success = orchResult.errors.length === 0 && orchResult.output !== null

  if (!success && orchResult.routedProvider === null) {
    return NextResponse.json(
      {
        success: false,
        traceId,
        output: null,
        routedProvider: null,
        routedModel: null,
        executionMode: orchResult.executionMode,
        error: orchResult.errors[0] ?? 'No AI provider is configured and enabled',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  await logBrainEvent({
    traceId,
    productId: null,
    appSlug: '__admin_test__',
    taskType: body.taskType,
    executionMode: orchResult.executionMode,
    classificationJson: JSON.stringify(orchResult.classification),
    routedProvider: orchResult.routedProvider,
    routedModel: orchResult.routedModel,
    validationUsed: orchResult.validationUsed,
    consensusUsed: orchResult.consensusUsed,
    confidenceScore: orchResult.confidenceScore,
    success,
    errorMessage: orchResult.errors.length > 0 ? orchResult.errors.join('; ') : null,
    warningsJson: JSON.stringify(orchResult.warnings),
    latencyMs,
  })

  return NextResponse.json(
    {
      success,
      traceId,
      output: orchResult.output,
      routedProvider: orchResult.routedProvider,
      routedModel: orchResult.routedModel,
      executionMode: orchResult.executionMode,
      confidenceScore: orchResult.confidenceScore,
      validationUsed: orchResult.validationUsed,
      consensusUsed: orchResult.consensusUsed,
      fallbackUsed: orchResult.fallbackUsed,
      warnings: orchResult.warnings,
      error: orchResult.errors[0] ?? null,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: success ? 200 : 502 },
  )
}

