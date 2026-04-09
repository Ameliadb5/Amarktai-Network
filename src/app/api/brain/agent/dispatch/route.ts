/**
 * POST /api/brain/agent/dispatch
 *
 * Dispatch an agent task from a connected app. Authenticated via appId + appSecret.
 *
 * Request body:
 *   - appId      (string)  — app slug
 *   - appSecret  (string)  — app secret
 *   - agentType  (string)  — one of the 18 built-in agent types
 *   - message    (string)  — task input
 *   - context    (object?, optional) — extra context for the agent
 *   - async      (boolean?, optional) — if true and Redis available, queue and return taskId
 *
 * Response (sync):  { taskId, status, output, agentType, latencyMs }
 * Response (async): { taskId, status: 'queued', agentType, pollUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateApp } from '@/lib/brain'
import {
  createAgentTask,
  executeAgent,
  getAgentDefinition,
  type AgentType,
} from '@/lib/agent-runtime'
import { getAgentReadiness } from '@/lib/agent-audit'
import { enqueueJob } from '@/lib/job-queue'

const AGENT_TYPES: AgentType[] = [
  'planner', 'router', 'validator', 'memory', 'retrieval',
  'creative', 'campaign', 'trading_analyst', 'app_ops', 'learning',
  'security', 'voice', 'travel_planner', 'developer', 'support_community',
  'healing', 'chatbot', 'marketing_agent',
]

const RequestSchema = z.object({
  appId: z.string().min(1).max(200),
  appSecret: z.string().min(1),
  agentType: z.string().refine((v): v is AgentType => AGENT_TYPES.includes(v as AgentType), {
    message: `agentType must be one of: ${AGENT_TYPES.join(', ')}`,
  }),
  message: z.string().min(1).max(16_000),
  context: z.record(z.unknown()).optional(),
  async: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { appId, appSecret, agentType, message, context, async: runAsync } = parsed.data

  // Authenticate app
  const auth = await authenticateApp(appId, appSecret)
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error ?? 'Authentication failed', executed: false },
      { status: auth.statusCode },
    )
  }

  // Check agent readiness
  const audit = getAgentReadiness(agentType as AgentType)
  if (audit?.readiness === 'NOT_CONNECTED') {
    return NextResponse.json(
      {
        executed: false,
        agentType,
        readiness: audit.readiness,
        error: audit.reasons[0] ?? `Agent ${agentType} requires a provider that is not configured`,
        requiredProvider: audit.provider,
      },
      { status: 503 },
    )
  }

  const definition = getAgentDefinition(agentType as AgentType)

  // Create agent task
  let task
  try {
    task = createAgentTask(agentType as AgentType, appId, { message, context })
  } catch (err: unknown) {
    return NextResponse.json(
      { executed: false, error: err instanceof Error ? err.message : 'Failed to create agent task' },
      { status: 403 },
    )
  }

  // Async path — queue and return immediately
  if (runAsync) {
    const queueId = await enqueueJob({
      type: 'agent_task',
      appSlug: appId,
      data: { taskId: task.id, agentType, message, context: context ?? {} },
    })

    if (queueId) {
      return NextResponse.json({
        executed: true,
        taskId: task.id,
        queueJobId: queueId,
        status: 'queued',
        agentType,
        agentName: definition.name,
      }, { status: 202 })
    }
    // Queue unavailable — fall through to synchronous
  }

  // Synchronous execution
  const completed = await executeAgent(task)
  const latencyMs = Date.now() - start

  if (completed.status === 'failed') {
    return NextResponse.json(
      {
        executed: false,
        taskId: completed.id,
        status: completed.status,
        agentType,
        agentName: definition.name,
        error: completed.error ?? 'Agent execution failed',
        latencyMs,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    executed: true,
    taskId: completed.id,
    status: completed.status,
    agentType,
    agentName: definition.name,
    output: completed.output,
    latencyMs: completed.latencyMs ?? latencyMs,
  })
}
