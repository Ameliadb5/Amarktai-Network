/**
 * @module agent-audit
 * @description Agent audit system for the AmarktAI Network.
 *
 * For each registered agent, determines real operational status by checking:
 *  1. Agent definition exists
 *  2. Default provider is registered in the model registry
 *  3. Default provider has a call implementation in brain.ts
 *  4. Default model exists in registry
 *  5. Provider health is usable
 *
 * Classification:
 *  - READY          — all deps met, execution route exists, can run tasks
 *  - PARTIAL        — definition exists but some deps degraded (e.g. provider unconfigured)
 *  - NOT_CONNECTED  — critical deps missing or provider not callable
 *
 * Server-side only.
 */

import {
  getAgentDefinitions,
  type AgentType,
  type AgentDefinition,
} from './agent-runtime';

import {
  getModelsByProvider,
  getModelById,
  isProviderUsable,
  getProviderHealth,
  type ProviderHealthStatus,
} from './model-registry';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentReadiness = 'READY' | 'PARTIAL' | 'NOT_CONNECTED'

export interface AgentAuditEntry {
  /** Agent type identifier. */
  agentType: AgentType
  /** Human-readable agent name. */
  name: string
  /** Overall readiness classification. */
  readiness: AgentReadiness
  /** Diagnostic reasons (empty if READY). */
  reasons: string[]
  /** Whether the agent definition exists in the runtime. */
  definitionExists: boolean
  /** Whether the default provider is registered in the model registry. */
  providerRegistered: boolean
  /** Default provider key. */
  defaultProvider: string
  /** Default model ID. */
  defaultModel: string
  /** Provider health status from cache. */
  providerHealth: ProviderHealthStatus | 'unknown'
  /** Whether the provider is callable via brain.ts. */
  providerCallable: boolean
  /** Whether the default model is found in the registry. */
  modelExists: boolean
  /** Number of capabilities this agent claims. */
  capabilityCount: number
  /** Agent types this agent can hand off to. */
  canHandoff: AgentType[]
  /** Whether memory is enabled for this agent. */
  memoryEnabled: boolean
}

export interface AgentAuditSummary {
  /** Total agents audited. */
  total: number
  /** Agents classified READY. */
  ready: number
  /** Agents classified PARTIAL. */
  partial: number
  /** Agents classified NOT_CONNECTED. */
  notConnected: number
  /** Timestamp of this audit. */
  auditedAt: string
}

export interface AgentAuditResult {
  agents: AgentAuditEntry[]
  summary: AgentAuditSummary
}

// ─── Known callable providers ──────────────────────────────────────────────
// These are providers with actual call implementations in brain.ts.
// Keep in sync with the `case` statements in callProvider().

const CALLABLE_PROVIDERS = new Set([
  'openai',
  'groq',
  'deepseek',
  'openrouter',
  'together',
  'grok',
  'gemini',
  'huggingface',
  'nvidia',
])

// ─── Audit logic ────────────────────────────────────────────────────────────

/**
 * Audit a single agent definition and determine its operational readiness.
 */
function auditAgent(def: AgentDefinition): AgentAuditEntry {
  const reasons: string[] = []
  const provider = def.defaultProvider ?? 'openai'
  const model = def.defaultModel ?? ''

  // Check 1: Provider is callable
  const providerCallable = CALLABLE_PROVIDERS.has(provider)
  if (!providerCallable) {
    reasons.push(`Provider "${provider}" has no call implementation in brain.ts`)
  }

  // Check 2: Provider has models in registry
  const providerModels = getModelsByProvider(provider)
  const providerRegistered = providerModels.length > 0
  if (!providerRegistered) {
    reasons.push(`Provider "${provider}" has no models registered in model-registry`)
  }

  // Check 3: Default model exists in registry
  const modelEntry = model ? getModelById(provider, model) : undefined
  const modelExists = !!modelEntry
  if (model && !modelExists && providerRegistered) {
    reasons.push(`Model "${model}" not found in registry for provider "${provider}"`)
  }

  // Check 4: Provider health
  let providerHealth: ProviderHealthStatus | 'unknown' = 'unknown'
  try {
    providerHealth = getProviderHealth(provider)
  } catch {
    providerHealth = 'unknown'
  }
  const providerUsable = isProviderUsable(provider)
  if (providerRegistered && providerCallable && !providerUsable) {
    reasons.push(`Provider "${provider}" health: ${providerHealth} (not usable — requires API key configuration)`)
  }

  // Check 5: Handoff targets exist
  for (const target of def.canHandoff) {
    const targetDefs = getAgentDefinitions()
    if (!targetDefs.has(target)) {
      reasons.push(`Handoff target "${target}" agent not registered`)
    }
  }

  // Classify readiness
  let readiness: AgentReadiness
  if (!providerCallable || !providerRegistered) {
    readiness = 'NOT_CONNECTED'
  } else if (reasons.length > 0) {
    readiness = 'PARTIAL'
  } else {
    readiness = 'READY'
  }

  return {
    agentType: def.type,
    name: def.name,
    readiness,
    reasons,
    definitionExists: true,
    providerRegistered,
    defaultProvider: provider,
    defaultModel: model,
    providerHealth,
    providerCallable,
    modelExists,
    capabilityCount: def.capabilities.length,
    canHandoff: def.canHandoff,
    memoryEnabled: def.memoryEnabled,
  }
}

/**
 * Audit all registered agents and return a full audit report.
 *
 * This is the primary entry point for the agent audit system.
 */
export function auditAllAgents(): AgentAuditResult {
  const definitions = getAgentDefinitions()
  const agents: AgentAuditEntry[] = []

  for (const [, def] of Array.from(definitions.entries())) {
    agents.push(auditAgent(def))
  }

  const ready = agents.filter(a => a.readiness === 'READY').length
  const partial = agents.filter(a => a.readiness === 'PARTIAL').length
  const notConnected = agents.filter(a => a.readiness === 'NOT_CONNECTED').length

  return {
    agents,
    summary: {
      total: agents.length,
      ready,
      partial,
      notConnected,
      auditedAt: new Date().toISOString(),
    },
  }
}

/**
 * Get the readiness classification for a single agent type.
 */
export function getAgentReadiness(agentType: AgentType): AgentAuditEntry | null {
  const definitions = getAgentDefinitions()
  const def = definitions.get(agentType)
  if (!def) return null
  return auditAgent(def)
}
