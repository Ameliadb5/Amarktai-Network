import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAgentDefinitions, getAgentStatus } from '@/lib/agent-runtime'

/** GET /api/admin/agents — returns agent runtime status and definitions */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const definitions = getAgentDefinitions()
  const status = getAgentStatus()

  // Convert Map to serializable array
  const agents = Array.from(definitions.entries()).map(([type, def]) => ({
    id: type,
    name: def.name,
    type,
    description: def.description,
    capabilities: def.capabilities,
    status: 'idle',
  }))

  return NextResponse.json({ agents, status })
}
