import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { callProvider, logBrainEvent } from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
} from '@/lib/capability-engine'
import { getAppSafetyConfig } from '@/lib/content-filter'

const testSchema = z.object({
  message: z.string().min(1).max(16_000),
  taskType: z.string().default('chat'),
  providerKey: z.string().optional(), // override routing if specified
  appSlug: z.string().optional(),     // app context for safety/adult mode
})

/**
 * POST /api/admin/brain/test
 *
 * Admin-session-authenticated test endpoint for the Brain Chat dashboard.
 * Bypasses app-level auth (admin session is auth).
 * Routes through capability engine: classify → resolve → execute.
 * Returns structured response with provider/model/capability/executed/fallback/error.
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

  // Step 1: Classify required capabilities
  const capabilities = classifyCapabilities(body.taskType, body.message)

  // Step 2: Resolve capability routes to check availability
  // Pass adult mode flag from app safety config if app context provided
  const safetyConfig = body.appSlug ? getAppSafetyConfig(body.appSlug) : undefined
  const capabilityRoutes = resolveCapabilityRoutes({
    capabilities,
    adultMode: safetyConfig?.adultMode,
    safeMode: safetyConfig?.safeMode,
  })
  const unavailable = capabilityRoutes.routes.filter(r => !r.available)

  // If required capabilities are unavailable and no direct provider override, return error
  if (unavailable.length > 0 && !body.providerKey) {
    const latencyMs = Date.now() - start
    const reasons = unavailable.map(r => r.missingMessage ?? 'Capability unavailable').filter(Boolean)
    return NextResponse.json(
      {
        success: false,
        executed: false,
        traceId,
        output: null,
        capability: capabilities,
        capabilityRoutes: capabilityRoutes.routes.map(r => ({
          capability: r.capability,
          available: r.available,
          reason: r.missingMessage,
        })),
        routedProvider: null,
        routedModel: null,
        executionMode: null,
        fallback_used: false,
        routingReason: reasons.join(' '),
        error: reasons[0] ?? 'Required capability is not available',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
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
      classificationJson: JSON.stringify({ capabilities }),
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
        executed: result.ok,
        traceId,
        output: result.output,
        capability: capabilities,
        routedProvider: body.providerKey,
        routedModel: result.model,
        executionMode: 'direct',
        confidenceScore: null,
        fallbackUsed: false,
        fallback_used: false,
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
        executed: false,
        traceId,
        output: null,
        capability: capabilities,
        routedProvider: null,
        routedModel: null,
        executionMode: orchResult.executionMode,
        fallback_used: false,
        routingReason: orchResult.routingReason ?? orchResult.errors[0] ?? 'No AI provider is configured and enabled',
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
    classificationJson: JSON.stringify({ capabilities, ...orchResult.classification }),
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
      executed: success,
      traceId,
      output: orchResult.output,
      capability: capabilities,
      routedProvider: orchResult.routedProvider,
      routedModel: orchResult.routedModel,
      executionMode: orchResult.executionMode,
      confidenceScore: orchResult.confidenceScore,
      validationUsed: orchResult.validationUsed,
      consensusUsed: orchResult.consensusUsed,
      fallbackUsed: orchResult.fallbackUsed,
      fallback_used: orchResult.fallbackUsed,
      warnings: orchResult.warnings,
      routingReason: orchResult.routingReason,
      error: orchResult.errors[0] ?? null,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: success ? 200 : 502 },
  )
}