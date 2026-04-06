import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAgentDefinitions, getAgentStatus } from '@/lib/agent-runtime'
import { auditAllAgents } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/** GET /api/admin/agents — returns agent runtime status, definitions, and audit data.
 *  Optional: ?appSlug=xxx to include per-app assignment status. */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const definitions = getAgentDefinitions()
  const status = getAgentStatus()
  const audit = auditAllAgents()

  // Build agent list with audit readiness
  const auditMap = new Map(audit.agents.map(a => [a.agentType, a]))

  // Optionally load per-app assignment data
  const appSlug = request.nextUrl.searchParams.get('appSlug')
  let enabledForApp: string[] = []
  if (appSlug) {
    const profile = await prisma.appAiProfile.findUnique({
      where: { appSlug },
      select: { enabledAgents: true },
    })
    if (profile?.enabledAgents) {
      try { enabledForApp = JSON.parse(profile.enabledAgents as string) } catch { /* ignore */ }
    }
  }

  const agents = Array.from(definitions.entries()).map(([type, def]) => {
    const entry = auditMap.get(type)
    return {
      id: type,
      name: def.name,
      type,
      description: def.description,
      capabilities: def.capabilities,
      canHandoff: def.canHandoff,
      memoryEnabled: def.memoryEnabled,
      defaultProvider: def.defaultProvider ?? 'openai',
      defaultModel: def.defaultModel ?? '',
      // Audit data
      readiness: entry?.readiness ?? 'NOT_CONNECTED',
      auditReasons: entry?.reasons ?? ['Audit not available'],
      providerHealth: entry?.providerHealth ?? 'unknown',
      providerCallable: entry?.providerCallable ?? false,
      providerRegistered: entry?.providerRegistered ?? false,
      modelExists: entry?.modelExists ?? false,
      // Per-app assignment (only populated when appSlug is provided)
      enabledForApp: appSlug ? enabledForApp.includes(type) : undefined,
    }
  })

  return NextResponse.json({ agents, status, audit: audit.summary, enabledForApp })
}

const assignSchema = z.object({
  appSlug: z.string().min(1),
  /** Agent types to enable for this app — replaces the full list. Pass [] to clear. */
  agentTypes: z.array(z.string()),
})

/** POST /api/admin/agents — assign agents to an app.
 *  Body: { appSlug, agentTypes: string[] } */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof assignSchema>
  try {
    body = assignSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request' }, { status: 422 })
  }

  // Upsert the AppAiProfile for this app — only update enabledAgents
  const updated = await prisma.appAiProfile.upsert({
    where: { appSlug: body.appSlug },
    create: {
      appSlug: body.appSlug,
      appName: body.appSlug,
      enabledAgents: JSON.stringify(body.agentTypes),
    },
    update: {
      enabledAgents: JSON.stringify(body.agentTypes),
    },
    select: { appSlug: true, enabledAgents: true },
  })

  return NextResponse.json({
    appSlug: updated.appSlug,
    enabledAgents: JSON.parse(updated.enabledAgents as string),
    updatedAt: new Date().toISOString(),
  })
}

