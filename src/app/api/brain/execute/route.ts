/**
 * POST /api/brain/execute
 *
 * Canonical app-facing Brain Gateway — execute alias.
 *
 * Accepts three request shapes:
 *
 * 1. Standard (same as /api/brain/request):
 *    { appId, appSecret, taskType, message, externalUserId?, metadata? }
 *
 * 2. Canonical enriched shape:
 *    { app_id, app_secret, task, input, mode?, user_id?, session_id?,
 *      metadata?, requested_capability?, provider_override?, model_override?,
 *      user_context? }
 *    When `input` is present, `task` = task type and `input` = message.
 *
 * 3. Legacy executeTask() shape (backward compat):
 *    { app_id, app_secret, mode, task, user_context?, externalUserId? }
 *    When `input` is absent, `task` = message and `mode` = task type.
 *
 * Admin/internal test apps (app_id = "__admin_test__") bypass normal app-auth
 * and are forwarded to the admin brain-test handler, which requires an active
 * admin session.
 *
 * The full pipeline runs here:
 *   authenticate → emotion detection → memory retrieval → orchestrate
 *   → provider selection → model execution → content filter → respond
 */

import { NextRequest, NextResponse } from 'next/server'
import { POST as handleRequest } from '@/app/api/brain/request/route'
import { POST as handleAdminTest } from '@/app/api/admin/brain/test/route'
import { resolveCapability } from '@/lib/capability-engine'

/** Convert execute-route body to the admin/brain/test schema. */
function toAdminTestBody(raw: Record<string, unknown>): Record<string, unknown> {
  // When `input` is present it is the message; `task` is the task type.
  const hasInput = raw.input !== undefined && raw.input !== null
  return {
    message: hasInput
      ? String(raw.input ?? '')
      : String(raw.task ?? raw.message ?? ''),
    taskType: hasInput
      ? String(raw.task ?? raw.mode ?? 'chat')
      : String(raw.mode ?? raw.taskType ?? 'chat'),
    providerKey: raw.provider_override ?? raw.providerKey ?? undefined,
    modelId: raw.model_override ?? raw.modelId ?? undefined,
    appSlug: '__admin_test__',
  }
}

/**
 * Normalise the enriched / legacy wire formats into the standard brain/request
 * schema before forwarding to the shared handler.
 */
function normaliseToStandard(raw: Record<string, unknown>): Record<string, unknown> {
  // Detect canonical shape: `input` present means task=taskType, input=message.
  const hasInput = raw.input !== undefined && raw.input !== null

  return {
    appId: raw.app_id ?? raw.appId,
    appSecret: raw.app_secret ?? raw.appSecret,
    taskType: hasInput
      ? String(raw.task ?? raw.mode ?? raw.taskType ?? 'chat')
      : String(raw.mode ?? raw.taskType ?? 'chat'),
    message: hasInput
      ? String(raw.input ?? '')
      : String(raw.task ?? raw.message ?? ''),
    externalUserId: raw.user_id ?? raw.externalUserId,
    traceId: raw.traceId,
    requestMode: raw.requestMode,
    metadata: {
      ...(typeof raw.metadata === 'object' && raw.metadata !== null
        ? raw.metadata as Record<string, unknown>
        : {}),
      ...(typeof raw.user_context === 'object' && raw.user_context !== null
        ? { user_context: raw.user_context }
        : {}),
      ...(raw.requested_capability !== undefined
        ? { requested_capability: raw.requested_capability }
        : {}),
      ...(raw.provider_override !== undefined
        ? { provider_override: raw.provider_override }
        : {}),
      ...(raw.model_override !== undefined
        ? { model_override: raw.model_override }
        : {}),
      ...(raw.session_id !== undefined
        ? { session_id: raw.session_id }
        : {}),
    },
  }
}

function applyResolvedTaskType(body: Record<string, unknown>): Record<string, unknown> {
  const metadata = typeof body.metadata === 'object' && body.metadata !== null
    ? body.metadata as Record<string, unknown>
    : {}
  const requestedCapability =
    typeof metadata.requested_capability === 'string'
      ? metadata.requested_capability
      : undefined
  const taskType = String(requestedCapability ?? body.taskType ?? 'chat')
  const message = String(body.message ?? '')
  const resolved = resolveCapability(taskType, message)
  return { ...body, taskType: resolved.primaryCapability }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: Record<string, unknown>
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Admin / internal test bypass ────────────────────────────────────────────
  // When app_id (or appId) is "__admin_test__", skip normal app-auth and forward
  // to the admin brain-test handler. That handler enforces admin session auth.
  const appId = raw.app_id ?? raw.appId
  if (appId === '__admin_test__') {
    const adminBody = toAdminTestBody(raw)
    const adminReq = new NextRequest(
      request.url.replace('/api/brain/execute', '/api/admin/brain/test'),
      {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(adminBody),
      },
    )
    return handleAdminTest(adminReq) as Promise<NextResponse>
  }

  // ── Standard shape — pass through unchanged ──────────────────────────────
  if ('appId' in raw && 'taskType' in raw && 'message' in raw) {
    const resolvedRaw = applyResolvedTaskType(raw)
    const stdReq = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(resolvedRaw),
    })
    return handleRequest(stdReq) as Promise<NextResponse>
  }

  // ── Canonical / legacy shape — normalise and forward ────────────────────
  const normalised = applyResolvedTaskType(normaliseToStandard(raw))
  const normReq = new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalised),
  })
  return handleRequest(normReq) as Promise<NextResponse>
}
