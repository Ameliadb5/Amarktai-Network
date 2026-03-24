import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { resolveRoute, callProvider, logBrainEvent } from '@/lib/brain'

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
 * Uses the same routing policy + provider abstraction as /api/brain/request.
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

  // Resolve route — use 'default' as category since this is an admin test
  const route = body.providerKey
    ? { providerKey: body.providerKey, model: '', reason: 'Admin manual override', fallbackUsed: false }
    : await resolveRoute('default', body.taskType)

  if (!route) {
    return NextResponse.json(
      {
        success: false,
        traceId,
        output: null,
        routedProvider: null,
        routedModel: null,
        error: 'No AI provider is configured and enabled',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  const result = await callProvider(route.providerKey, route.model, body.message)
  const latencyMs = Date.now() - start

  // Log as admin test event
  await logBrainEvent({
    traceId,
    productId: null,
    appSlug: '__admin_test__',
    taskType: body.taskType,
    routedProvider: route.providerKey,
    routedModel: result.model,
    success: result.ok,
    errorMessage: result.error ?? null,
    latencyMs,
  })

  return NextResponse.json(
    {
      success: result.ok,
      traceId,
      output: result.output,
      routedProvider: route.providerKey,
      routedModel: result.model,
      routingReason: route.reason,
      fallbackUsed: route.fallbackUsed,
      error: result.error ?? null,
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: result.ok ? 200 : 502 },
  )
}
