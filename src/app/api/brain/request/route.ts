import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  authenticateApp,
  resolveRoute,
  callProvider,
  logBrainEvent,
  type BrainResponse,
} from '@/lib/brain'

// ── Request schema ────────────────────────────────────────────────────────────

const requestSchema = z.object({
  appId: z.string().min(1).max(200),
  appSecret: z.string().min(1),
  externalUserId: z.string().optional(),
  taskType: z.string().min(1).max(100),
  message: z.string().min(1).max(32_000),
  metadata: z.record(z.unknown()).optional(),
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
      traceId, productId: null, appSlug: body.appId, taskType: body.taskType,
      routedProvider: null, routedModel: null, success: false,
      errorMessage: auth.error ?? 'Auth failed', latencyMs: Date.now() - start,
    })
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, error: auth.error ?? 'Unauthorized', statusCode: auth.statusCode, latencyMs: Date.now() - start }),
      { status: auth.statusCode },
    )
  }

  const { app } = auth

  // ── Resolve routing policy ────────────────────────────────────────────
  const route = await resolveRoute(app.category, body.taskType)
  if (!route) {
    await logBrainEvent({
      traceId, productId: app.id, appSlug: app.slug, taskType: body.taskType,
      routedProvider: null, routedModel: null, success: false,
      errorMessage: 'No provider available', latencyMs: Date.now() - start,
    })
    return NextResponse.json(
      errorResponse({ traceId, taskType: body.taskType, app, error: 'No AI provider is available — all providers are unconfigured or disabled', statusCode: 503, latencyMs: Date.now() - start }),
      { status: 503 },
    )
  }

  // ── Call provider ─────────────────────────────────────────────────────
  const providerResult = await callProvider(route.providerKey, route.model, body.message)
  const latencyMs = Date.now() - start

  // ── Log brain event ───────────────────────────────────────────────────
  await logBrainEvent({
    traceId, productId: app.id, appSlug: app.slug, taskType: body.taskType,
    routedProvider: route.providerKey, routedModel: providerResult.model,
    success: providerResult.ok,
    errorMessage: providerResult.error ?? null,
    latencyMs,
  })

  // ── Build normalised response ─────────────────────────────────────────
  const warnings: string[] = []
  if (route.fallbackUsed) warnings.push(`Routed via fallback provider (${route.reason})`)

  const response: BrainResponse = {
    success: providerResult.ok,
    traceId,
    app: { id: app.id, name: app.name, slug: app.slug },
    routedProvider: route.providerKey,
    routedModel: providerResult.model,
    taskType: body.taskType,
    output: providerResult.output,
    warnings,
    errors: providerResult.error ? [providerResult.error] : [],
    latencyMs,
    memoryUsed: false,
    fallbackUsed: route.fallbackUsed,
    timestamp: new Date().toISOString(),
  }

  const httpStatus = providerResult.ok ? 200 : 502
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
    output: null,
    warnings: [],
    errors: [opts.error],
    latencyMs: opts.latencyMs,
    memoryUsed: false,
    fallbackUsed: false,
    timestamp: new Date().toISOString(),
  }
}
