import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAgentDefinitions, getAgentStatus } from '@/lib/agent-runtime'
import { auditAllAgents } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'
import {
  setProviderHealth,
  getModelRegistry,
  type ProviderHealthStatus,
} from '@/lib/model-registry'

/**
 * Sync the model-registry health cache from DB provider state so that
 * agent readiness reflects actual runtime configuration, not a cold cache.
 */
async function syncHealthCacheFromDB(): Promise<void> {
  try {
    const dbProviders = await prisma.aiProvider.findMany({
      where: { enabled: true },
      select: { providerKey: true, healthStatus: true, apiKey: true },
    })
    const configuredKeys = new Set<string>()
    for (const p of dbProviders) {
      if (p.apiKey) {
        setProviderHealth(p.providerKey, p.healthStatus as ProviderHealthStatus)
        configuredKeys.add(p.providerKey)
      }
    }
    const allKeys = new Set(getModelRegistry().map(m => m.provider))
    for (const key of Array.from(allKeys)) {
      if (!configuredKeys.has(key)) {
        setProviderHealth(key, 'unconfigured')
      }
    }
  } catch (err) {
    // Best-effort — fall through with existing cache state.
    console.warn('[agents] syncHealthCacheFromDB failed; agent readiness may reflect stale provider health:', err instanceof Error ? err.message : err)
  }
}

/** GET /api/admin/agents — returns agent runtime status, definitions, and audit data */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sync health cache so agent readiness reflects current DB configuration.
  await syncHealthCacheFromDB()

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
