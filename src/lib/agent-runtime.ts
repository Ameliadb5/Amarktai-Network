/**
 * @module agent-runtime
 * @description Internal Agent Runtime for the AmarktAI Network.
 *
 * Implements AmarktAI's own internal agents — planner, router, validator,
 * memory, retrieval, creative, campaign, trading analyst, app ops, and
 * learning — that collectively power multi-step orchestration, handoff
 * chains, and quality validation across every app in the network.
 *
 * Server-side only.
 */

import { callProvider } from '@/lib/brain'
import type { ProviderCallResult } from '@/lib/brain'
import { getAppProfile } from '@/lib/app-profiles'
import { getDefaultModelForProvider } from '@/lib/model-registry'

// ─── Types ──────────────────────────────────────────────────────────────────

/** Every agent role the runtime can instantiate. */
export type AgentType =
  | 'planner'
  | 'router'
  | 'validator'
  | 'memory'
  | 'retrieval'
  | 'creative'
  | 'campaign'
  | 'trading_analyst'
  | 'app_ops'
  | 'learning'
  | 'security'
  | 'voice'
  | 'travel_planner'
  | 'developer'
  | 'support_community'
  | 'healing'

/** Lifecycle status of an individual agent task. */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting'

/** Static metadata that describes an agent's role, capabilities, and constraints. */
export interface AgentDefinition {
  type: AgentType
  /** Human-readable display name. */
  name: string
  description: string
  capabilities: string[]
  requiredPermissions: string[]
  /** Agent types this agent is allowed to hand off work to. */
  canHandoff: AgentType[]
  memoryEnabled: boolean
  /** Provider key used when no app-level override exists. */
  defaultProvider?: string
  /** Model id used when no app-level override exists. */
  defaultModel?: string
}

/** A single unit of work dispatched to an agent. */
export interface AgentTask {
  id: string
  agentType: AgentType
  appSlug: string
  input: {
    message: string
    context?: Record<string, unknown>
    parentTaskId?: string
  }
  status: AgentStatus
  output: string | null
  error: string | null
  startedAt: Date
  completedAt: Date | null
  latencyMs: number | null
  handoffFrom?: AgentType
  handoffTo?: AgentType
}

// ─── Agent Definitions ──────────────────────────────────────────────────────

const AGENT_DEFINITIONS: ReadonlyMap<AgentType, AgentDefinition> = new Map<AgentType, AgentDefinition>([
  [
    'planner',
    {
      type: 'planner',
      name: 'Planner',
      description:
        'Breaks complex tasks into ordered sub-steps and coordinates their execution across agents.',
      capabilities: ['task_decomposition', 'step_ordering', 'dependency_analysis', 'goal_tracking'],
      requiredPermissions: ['agent:planner'],
      canHandoff: ['router', 'creative', 'trading_analyst'],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'router',
    {
      type: 'router',
      name: 'Router',
      description:
        'Routes sub-tasks to appropriate models and providers based on task requirements and app constraints.',
      capabilities: ['task_routing', 'model_selection', 'provider_matching', 'load_balancing'],
      requiredPermissions: ['agent:router'],
      canHandoff: ['validator'],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
  [
    'validator',
    {
      type: 'validator',
      name: 'Validator',
      description:
        'Validates agent outputs for quality, accuracy, and adherence to constraints.',
      capabilities: ['output_validation', 'quality_scoring', 'accuracy_check', 'constraint_enforcement'],
      requiredPermissions: ['agent:validator'],
      canHandoff: [],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'memory',
    {
      type: 'memory',
      name: 'Memory',
      description:
        'Manages long-term memory operations including save, retrieve, prune, and namespace isolation.',
      capabilities: ['memory_save', 'memory_retrieve', 'memory_prune', 'namespace_management'],
      requiredPermissions: ['agent:memory'],
      canHandoff: [],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
  [
    'retrieval',
    {
      type: 'retrieval',
      name: 'Retrieval',
      description:
        'Handles retrieval-augmented generation including document search, embedding lookup, and reranking.',
      capabilities: ['document_retrieval', 'embedding_search', 'reranking', 'context_assembly'],
      requiredPermissions: ['agent:retrieval'],
      canHandoff: [],
      memoryEnabled: false,
      defaultProvider: 'cohere',
      defaultModel: 'command-r-plus',
    },
  ],
  [
    'creative',
    {
      type: 'creative',
      name: 'Creative',
      description:
        'Content generation, copywriting, campaign ideation, and multimodal creative planning.',
      capabilities: ['content_generation', 'copywriting', 'campaign_ideation', 'multimodal_planning'],
      requiredPermissions: ['agent:creative'],
      canHandoff: [],
      memoryEnabled: false,
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet-4-20250514',
    },
  ],
  [
    'campaign',
    {
      type: 'campaign',
      name: 'Campaign',
      description:
        'Marketing campaign orchestration — audience targeting, scheduling, and cross-channel coordination.',
      capabilities: ['campaign_orchestration', 'audience_targeting', 'scheduling', 'cross_channel'],
      requiredPermissions: ['agent:campaign'],
      canHandoff: ['creative'],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'trading_analyst',
    {
      type: 'trading_analyst',
      name: 'Trading Analyst',
      description:
        'Financial data analysis, market signals, risk assessment. Requires validation and strict audit logging.',
      capabilities: ['financial_analysis', 'market_signals', 'risk_assessment', 'audit_logging'],
      requiredPermissions: ['agent:trading_analyst'],
      canHandoff: [],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'app_ops',
    {
      type: 'app_ops',
      name: 'App Ops',
      description:
        'System operations including health checks, diagnostics, configuration management, and app lifecycle.',
      capabilities: ['health_check', 'diagnostics', 'config_management', 'app_lifecycle'],
      requiredPermissions: ['agent:app_ops'],
      canHandoff: [],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
  [
    'learning',
    {
      type: 'learning',
      name: 'Learning',
      description:
        'Analyzes execution patterns, detects performance regressions, and generates improvement suggestions.',
      capabilities: ['pattern_analysis', 'regression_detection', 'improvement_suggestions', 'metric_tracking'],
      requiredPermissions: ['agent:learning'],
      canHandoff: [],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
  [
    'security',
    {
      type: 'security',
      name: 'Security',
      description:
        'Monitors system access, detects anomalies, enforces app-level content policies, and audits AI outputs for safety.',
      capabilities: ['anomaly_detection', 'content_moderation', 'access_audit', 'policy_enforcement', 'threat_assessment'],
      requiredPermissions: ['agent:security'],
      canHandoff: ['validator'],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'voice',
    {
      type: 'voice',
      name: 'Voice',
      description:
        'Orchestrates voice-driven workflows including TTS script generation, multi-voice profile routing, and speech interaction planning.',
      capabilities: ['tts_script_generation', 'voice_profile_routing', 'speech_workflow_planning', 'audio_content_planning', 'multi_voice_coordination'],
      requiredPermissions: ['agent:voice'],
      canHandoff: ['creative', 'campaign'],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'travel_planner',
    {
      type: 'travel_planner',
      name: 'Travel Planner',
      description:
        'Multi-modal travel planning including itinerary generation, destination research, budget estimation, and booking workflow coordination.',
      capabilities: ['itinerary_generation', 'destination_research', 'budget_estimation', 'booking_workflow', 'multi_modal_routing'],
      requiredPermissions: ['agent:travel_planner'],
      canHandoff: ['creative', 'voice'],
      memoryEnabled: true,
      defaultProvider: 'gemini',
      defaultModel: 'gemini-1.5-pro',
    },
  ],
  [
    'developer',
    {
      type: 'developer',
      name: 'Developer',
      description:
        'Code generation, refactoring, debugging, architecture design, and GitHub integration workflows for the AmarktAI Network.',
      capabilities: ['code_generation', 'code_refactoring', 'debugging', 'architecture_design', 'github_integration', 'pr_workflow'],
      requiredPermissions: ['agent:developer'],
      canHandoff: ['validator', 'planner'],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o',
    },
  ],
  [
    'support_community',
    {
      type: 'support_community',
      name: 'Support & Community',
      description:
        'Handles user support conversations, community moderation, FAQ routing, escalation workflows, and sentiment monitoring.',
      capabilities: ['support_routing', 'community_moderation', 'faq_resolution', 'escalation_handling', 'sentiment_analysis'],
      requiredPermissions: ['agent:support_community'],
      canHandoff: ['security', 'validator'],
      memoryEnabled: true,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
  [
    'healing',
    {
      type: 'healing',
      name: 'Healing',
      description:
        'Detects degraded services, generates recovery playbooks, routes failovers, and monitors post-recovery stability.',
      capabilities: ['failure_detection', 'recovery_planning', 'failover_routing', 'stability_monitoring', 'alert_suppression'],
      requiredPermissions: ['agent:healing'],
      canHandoff: ['app_ops', 'validator'],
      memoryEnabled: false,
      defaultProvider: 'openai',
      defaultModel: 'gpt-4o-mini',
    },
  ],
])

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a short, collision-resistant task id (no uuid dependency). */
function generateTaskId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Build a system prompt that grounds the LLM in the agent's role.
 *
 * The prompt incorporates the agent's name, description, capabilities, and
 * any extra context supplied with the task input.
 */
function buildSystemPrompt(definition: AgentDefinition, task: AgentTask): string {
  const lines: string[] = [
    `You are the "${definition.name}" agent in the AmarktAI Network.`,
    '',
    definition.description,
    '',
    `Capabilities: ${definition.capabilities.join(', ')}.`,
  ]

  if (task.handoffFrom) {
    lines.push(``, `You received this task via handoff from the "${task.handoffFrom}" agent.`)
  }

  if (task.input.context && Object.keys(task.input.context).length > 0) {
    lines.push(``, `Additional context: ${JSON.stringify(task.input.context)}`)
  }

  lines.push(
    ``,
    `Respond clearly and concisely. Stay within the boundaries of your defined capabilities.`,
  )

  return lines.join('\n')
}

/**
 * Resolve which provider and model to use for a given agent + app combination.
 *
 * Priority: app profile preferred models → agent defaults → global fallback.
 */
function resolveProviderAndModel(
  definition: AgentDefinition,
  appSlug: string,
): { provider: string; model: string } {
  const profile = getAppProfile(appSlug)

  // Use the agent's default provider if the app allows it; otherwise fall back
  // to the first allowed provider on the app profile.
  let provider = definition.defaultProvider ?? 'openai'
  if (!profile.allowed_providers.includes(provider) && profile.allowed_providers.length > 0) {
    provider = profile.allowed_providers[0]
  }

  // Prefer the agent's configured default model; fall back to registry lookup.
  let model = definition.defaultModel ?? getDefaultModelForProvider(provider)

  // Only override with an app-preferred model when it belongs to the resolved
  // provider (avoids mismatched provider/model combos like cohere + gpt-4o).
  if (profile.preferred_models.length > 0 && profile.allowed_models.length > 0) {
    const compatiblePreferred = profile.preferred_models.find((m) =>
      profile.allowed_models.includes(m),
    )
    if (compatiblePreferred) {
      model = compatiblePreferred
    }
  }

  return { provider, model }
}

// ─── In-memory task ledger (lightweight; production would use a durable store)

const activeTasks: Map<string, AgentTask> = new Map()

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns every registered agent definition.
 *
 * @returns A read-only map of AgentType → AgentDefinition.
 */
export function getAgentDefinitions(): ReadonlyMap<AgentType, AgentDefinition> {
  return AGENT_DEFINITIONS
}

/**
 * Returns the definition for a single agent type.
 *
 * @throws {Error} If the agent type is not registered.
 */
export function getAgentDefinition(type: AgentType): AgentDefinition {
  const def = AGENT_DEFINITIONS.get(type)
  if (!def) {
    throw new Error(`[agent-runtime] Unknown agent type: ${type}`)
  }
  return def
}

/**
 * Check whether an app has permission to invoke a specific agent.
 *
 * Permission strings follow the pattern `agent:<type>` and are declared on
 * the app profile's `agent_permissions` array.
 */
export function isAgentPermitted(agentType: AgentType, appSlug: string): boolean {
  const definition = AGENT_DEFINITIONS.get(agentType)
  if (!definition) return false

  const profile = getAppProfile(appSlug)
  return definition.requiredPermissions.every((perm) =>
    profile.agent_permissions.includes(perm),
  )
}

/**
 * Create a new AgentTask (idle, not yet executed).
 *
 * @param agentType  The type of agent to invoke.
 * @param appSlug    Slug of the calling application.
 * @param input      Message and optional context for the agent.
 * @returns A fully initialised AgentTask in `idle` status.
 */
export function createAgentTask(
  agentType: AgentType,
  appSlug: string,
  input: AgentTask['input'],
): AgentTask {
  const definition = getAgentDefinition(agentType)

  // Fail-fast when the app lacks permissions.
  if (!isAgentPermitted(agentType, appSlug)) {
    throw new Error(
      `[agent-runtime] App "${appSlug}" is not permitted to use the "${definition.name}" agent. ` +
        `Required permissions: ${definition.requiredPermissions.join(', ')}`,
    )
  }

  const task: AgentTask = {
    id: generateTaskId(),
    agentType,
    appSlug,
    input,
    status: 'idle',
    output: null,
    error: null,
    startedAt: new Date(),
    completedAt: null,
    latencyMs: null,
  }

  activeTasks.set(task.id, task)
  return task
}

/**
 * Execute an agent task end-to-end.
 *
 * Builds a system prompt from the agent definition, resolves the appropriate
 * provider/model, calls the provider, and returns the completed task.
 *
 * @param task  An AgentTask (typically created via {@link createAgentTask}).
 * @returns The same task object, mutated to reflect completion or failure.
 */
export async function executeAgent(task: AgentTask): Promise<AgentTask> {
  const definition = getAgentDefinition(task.agentType)

  // Mark running.
  task.status = 'running'
  task.startedAt = new Date()

  const systemPrompt = buildSystemPrompt(definition, task)
  const fullMessage = `${systemPrompt}\n\n---\n\nUser request:\n${task.input.message}`

  const { provider, model } = resolveProviderAndModel(definition, task.appSlug)

  let result: ProviderCallResult

  try {
    result = await callProvider(provider, model, fullMessage)
  } catch (err: unknown) {
    task.status = 'failed'
    task.error = err instanceof Error ? err.message : String(err)
    task.completedAt = new Date()
    task.latencyMs = task.completedAt.getTime() - task.startedAt.getTime()
    activeTasks.set(task.id, task)
    return task
  }

  if (result.ok) {
    task.status = 'completed'
    task.output = result.output
  } else {
    task.status = 'failed'
    task.error = result.error ?? 'Provider returned a non-ok response with no error message.'
  }

  task.completedAt = new Date()
  task.latencyMs = result.latencyMs
  activeTasks.set(task.id, task)

  return task
}

/**
 * Hand off a completed (or failed) task to another agent.
 *
 * Creates a new child task for `targetAgentType`, linking it to the current
 * task via `parentTaskId` and `handoffFrom` / `handoffTo` metadata.
 *
 * @param currentTask       The originating task.
 * @param targetAgentType   The agent type to hand off to.
 * @returns A new AgentTask ready for execution.
 * @throws {Error} If the current agent is not allowed to hand off to the target.
 */
export function handoffTask(
  currentTask: AgentTask,
  targetAgentType: AgentType,
): AgentTask {
  const currentDef = getAgentDefinition(currentTask.agentType)

  if (!currentDef.canHandoff.includes(targetAgentType)) {
    throw new Error(
      `[agent-runtime] Agent "${currentDef.name}" is not allowed to hand off to "${targetAgentType}". ` +
        `Allowed handoffs: ${currentDef.canHandoff.join(', ') || 'none'}`,
    )
  }

  // Build the child task input, forwarding the parent output as context.
  const childInput: AgentTask['input'] = {
    message: currentTask.output ?? currentTask.input.message,
    context: {
      ...currentTask.input.context,
      parentOutput: currentTask.output,
    },
    parentTaskId: currentTask.id,
  }

  const childTask = createAgentTask(targetAgentType, currentTask.appSlug, childInput)

  // Annotate handoff lineage.
  childTask.handoffFrom = currentTask.agentType
  currentTask.handoffTo = targetAgentType

  activeTasks.set(currentTask.id, currentTask)
  activeTasks.set(childTask.id, childTask)

  return childTask
}

/**
 * Returns a high-level runtime status summary.
 *
 * Useful for health checks and dashboards.
 */
export function getAgentStatus(): {
  configuredAgents: number
  runningTasks: number
  completedTasks: number
  failedTasks: number
  totalTasks: number
} {
  let running = 0
  let completed = 0
  let failed = 0

  for (const task of activeTasks.values()) {
    if (task.status === 'running') running++
    else if (task.status === 'completed') completed++
    else if (task.status === 'failed') failed++
  }

  return {
    configuredAgents: AGENT_DEFINITIONS.size,
    runningTasks: running,
    completedTasks: completed,
    failedTasks: failed,
    totalTasks: activeTasks.size,
  }
}
