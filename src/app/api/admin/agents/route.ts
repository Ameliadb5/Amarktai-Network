import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAgentDefinitions, getAgentStatus } from '@/lib/agent-runtime'
import { auditAllAgents } from '@/lib/agent-audit'

/** GET /api/admin/agents — returns agent runtime status, definitions, and audit data */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const definitions = getAgentDefinitions()
  const status = getAgentStatus()
  const audit = auditAllAgents()

  // Build agent list with audit readiness
  const auditMap = new Map(audit.agents.map(a => [a.agentType, a]))

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
    }
  })

  return NextResponse.json({ agents, status, audit: audit.summary })
}
