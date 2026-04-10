/**
 * @module app-agent
 * @description Per-app dedicated AI agent for the AmarktAI Super-Brain.
 *
 * Every connected app gets its own App Agent that:
 *   - Holds app-specific rules, tone, knowledge, and policy
 *   - ALWAYS routes through the central AmarktAI orchestration
 *   - NEVER calls providers directly
 *   - Enforces app-isolated memory and retrieval boundaries
 *   - Supports admin plain-English notes → structured rules
 *
 * Request flow:
 *   App → AmarktAI Super-Brain → App Agent → Central Router/Orchestrator → Provider/Tool → Response → App
 *
 * Server-side only. Never import from client components.
 */

import { prisma } from '@/lib/prisma'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AppAgentConfig {
  id: string
  appSlug: string
  appName: string
  appUrl: string
  appType: string
  purpose: string
  active: boolean

  // Behavior
  tone: 'formal' | 'friendly' | 'warm' | 'professional' | 'playful'
  responseLength: 'short' | 'balanced' | 'detailed'
  creativity: 'creative' | 'balanced' | 'strictly_factual'

  // Source behavior
  mustShowSourceForQuotes: boolean
  mustUseTrustedSources: boolean
  canAnswerWithoutSource: 'never' | 'sometimes' | 'allowed'
  separateQuoteFromExplanation: boolean

  // Safety
  adultMode: boolean
  sensitiveTopicMode: 'standard' | 'strict' | 'very_strict'
  mustHandoffSeriousTopics: boolean
  topicsNeedingCare: string[]

  // Handoff
  humanExpertAvailable: boolean
  handoffTriggers: string[]
  humanContactMethod: string

  // Knowledge
  knowledgeCategories: string[]
  knowledgeNotes: string

  // Rules
  mustAlwaysDo: string[]
  mustNeverDo: string[]
  adminNotes: string
  structuredRules: StructuredRule[]

  // Budget
  budgetMode: 'low_cost' | 'balanced' | 'best_quality'
  allowPremiumOnlyWhenNeeded: boolean

  // Capability permissions
  allowedCapabilities: string[]

  // Learning
  learningEnabled: boolean
  autoImprovementEnabled: boolean
  adminReviewRequired: boolean

  // Religious
  religiousMode: 'none' | 'christian' | 'muslim' | 'multi_faith'
  religiousBranch: string
  approvedSourcePacks: string[]
  doctrineAwareRouting: boolean

  // Routing
  preferredProviders: string[]
  preferredModels: string[]
  fallbackChain: string[]

  // Boundaries
  memoryNamespace: string
  retrievalNamespace: string
}

export interface StructuredRule {
  id: string
  type: 'must_do' | 'must_not_do' | 'source_rule' | 'tone_rule' | 'safety_rule' | 'handoff_rule' | 'custom'
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  source: 'admin_notes' | 'setup_flow' | 'learning'
}

export interface AppAgentRequest {
  appSlug: string
  message: string
  taskType: string
  userId?: string
  metadata?: Record<string, unknown>
  traceId?: string
}

export interface AppAgentResponse {
  success: boolean
  output: string | null
  traceId: string
  agentId: string
  appliedRules: string[]
  warnings: string[]
  errors: string[]
  routedProvider: string | null
  routedModel: string | null
  latencyMs: number
  budgetMode: string
  memoryUsed: boolean
  retrievalUsed: boolean
}

// ── App Agent CRUD ──────────────────────────────────────────────────────────

/**
 * Create a new App Agent for a registered app.
 */
export async function createAppAgent(config: {
  appSlug: string
  appName: string
  appUrl?: string
  appType?: string
  purpose?: string
}): Promise<AppAgentConfig> {
  const agent = await prisma.appAgent.create({
    data: {
      appSlug: config.appSlug,
      appName: config.appName,
      appUrl: config.appUrl ?? '',
      appType: config.appType ?? 'general',
      purpose: config.purpose ?? '',
      memoryNamespace: `mem_${config.appSlug}`,
      retrievalNamespace: `ret_${config.appSlug}`,
    },
  })
  return dbRowToConfig(agent)
}

/**
 * Get an App Agent config by app slug.
 */
export async function getAppAgent(appSlug: string): Promise<AppAgentConfig | null> {
  const agent = await prisma.appAgent.findUnique({ where: { appSlug } })
  return agent ? dbRowToConfig(agent) : null
}

/**
 * Update an App Agent's configuration.
 */
export async function updateAppAgent(
  appSlug: string,
  updates: Partial<Omit<AppAgentConfig, 'id' | 'appSlug'>>,
): Promise<AppAgentConfig | null> {
  // Convert arrays/objects back to JSON strings for DB storage
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (Array.isArray(value) || (typeof value === 'object' && value !== null && !((value as object) instanceof Date))) {
      data[key] = JSON.stringify(value)
    } else {
      data[key] = value
    }
  }

  const agent = await prisma.appAgent.update({
    where: { appSlug },
    data,
  })
  return dbRowToConfig(agent)
}

/**
 * List all App Agents.
 */
export async function listAppAgents(): Promise<AppAgentConfig[]> {
  const agents = await prisma.appAgent.findMany({ orderBy: { createdAt: 'desc' } })
  return agents.map(dbRowToConfig)
}

/**
 * Delete an App Agent.
 */
export async function deleteAppAgent(appSlug: string): Promise<boolean> {
  try {
    await prisma.appAgent.delete({ where: { appSlug } })
    return true
  } catch {
    return false
  }
}

// ── Admin Notes → Structured Rules ──────────────────────────────────────────

/**
 * Parse admin plain-English notes into structured agent rules.
 * This converts notes like "this app must always show source when quoting holy text"
 * into actionable structured rules the agent enforces.
 */
export function parseAdminNotes(notes: string): StructuredRule[] {
  if (!notes.trim()) return []

  const rules: StructuredRule[] = []
  const lines = notes
    .split(/\n|[.;]/)
    .map(l => l.trim())
    .filter(l => l.length > 5)

  let ruleIndex = 0
  for (const line of lines) {
    const lower = line.toLowerCase()
    let type: StructuredRule['type'] = 'custom'
    let priority: StructuredRule['priority'] = 'medium'

    // Detect rule type from keywords
    if (/must\s+always|always\s+must|should\s+always/.test(lower)) {
      type = 'must_do'
      priority = 'high'
    } else if (/must\s+never|never\s+allow|should\s+never|must\s+not|do\s+not/.test(lower)) {
      type = 'must_not_do'
      priority = 'high'
    } else if (/source|quote|cite|reference|scripture|holy\s+text/.test(lower)) {
      type = 'source_rule'
      priority = 'high'
    } else if (/tone|calm|respectful|friendly|formal|warm/.test(lower)) {
      type = 'tone_rule'
      priority = 'medium'
    } else if (/safe|restrict|block|forbid|adult|explicit/.test(lower)) {
      type = 'safety_rule'
      priority = 'critical'
    } else if (/hand\s*off|handover|pass\s+to|refer|escalat|expert|human/.test(lower)) {
      type = 'handoff_rule'
      priority = 'high'
    }

    // Detect critical priority patterns
    if (/urgent|critical|never\s+allow|must\s+never|always\s+block/.test(lower)) {
      priority = 'critical'
    }

    rules.push({
      id: `rule_${Date.now()}_${ruleIndex++}`,
      type,
      description: line,
      priority,
      source: 'admin_notes',
    })
  }

  return rules
}

/**
 * Update an agent's structured rules from admin notes.
 * Preserves rules from other sources (setup_flow, learning).
 */
export async function syncAdminNotesToRules(appSlug: string, notes: string): Promise<StructuredRule[]> {
  const agent = await prisma.appAgent.findUnique({ where: { appSlug } })
  if (!agent) throw new Error(`App agent not found: ${appSlug}`)

  const existingRules = safeJsonParse<StructuredRule[]>(agent.structuredRules, [])
  const nonAdminRules = existingRules.filter(r => r.source !== 'admin_notes')
  const newAdminRules = parseAdminNotes(notes)
  const allRules = [...nonAdminRules, ...newAdminRules]

  await prisma.appAgent.update({
    where: { appSlug },
    data: {
      adminNotes: notes,
      structuredRules: JSON.stringify(allRules),
    },
  })

  return allRules
}

// ── App Agent System Prompt Builder ─────────────────────────────────────────

/**
 * Build the system prompt for an App Agent.
 * This injects app-specific rules, tone, knowledge, and policies into the
 * prompt that the central orchestrator will use when routing through the agent.
 */
export function buildAgentSystemPrompt(config: AppAgentConfig): string {
  const sections: string[] = []

  // Identity
  sections.push(`You are the dedicated AI assistant for "${config.appName}".`)
  if (config.purpose) {
    sections.push(`App purpose: ${config.purpose}`)
  }

  // Tone
  const toneMap: Record<string, string> = {
    formal: 'Use a formal, professional tone.',
    friendly: 'Use a friendly, approachable tone.',
    warm: 'Use a warm, caring tone.',
    professional: 'Use a professional, balanced tone.',
    playful: 'Use a playful, engaging tone.',
  }
  sections.push(toneMap[config.tone] || toneMap.professional)

  // Response length
  const lengthMap: Record<string, string> = {
    short: 'Keep responses brief and concise.',
    balanced: 'Provide balanced-length responses.',
    detailed: 'Provide detailed, comprehensive responses.',
  }
  sections.push(lengthMap[config.responseLength] || lengthMap.balanced)

  // Creativity
  const creativityMap: Record<string, string> = {
    creative: 'Be creative and imaginative in your responses.',
    balanced: 'Balance creativity with factual accuracy.',
    strictly_factual: 'Be strictly factual. Do not speculate or guess.',
  }
  sections.push(creativityMap[config.creativity] || creativityMap.balanced)

  // Source rules
  if (config.mustShowSourceForQuotes) {
    sections.push('RULE: Always show the source when quoting text.')
  }
  if (config.mustUseTrustedSources) {
    sections.push('RULE: Only use trusted, verified sources.')
  }
  if (config.canAnswerWithoutSource === 'never') {
    sections.push('RULE: Never provide answers without citing a source.')
  }
  if (config.separateQuoteFromExplanation) {
    sections.push('RULE: Always separate direct quotes from your explanation.')
  }

  // Safety
  if (config.sensitiveTopicMode === 'strict' || config.sensitiveTopicMode === 'very_strict') {
    sections.push(`SAFETY: Apply ${config.sensitiveTopicMode} content filtering.`)
  }
  if (config.mustHandoffSeriousTopics) {
    sections.push('SAFETY: Immediately hand off serious/urgent topics to a human expert.')
  }
  if (config.topicsNeedingCare.length > 0) {
    sections.push(`CAUTION TOPICS: ${config.topicsNeedingCare.join(', ')}. Handle with extra care.`)
  }
  if (!config.adultMode) {
    sections.push('SAFETY: Adult content is not allowed.')
  }

  // Handoff
  if (config.humanExpertAvailable && config.handoffTriggers.length > 0) {
    sections.push(`HANDOFF: When these situations arise, refer to a human expert: ${config.handoffTriggers.join(', ')}.`)
    if (config.humanContactMethod) {
      sections.push(`Human contact: ${config.humanContactMethod}`)
    }
  }

  // Knowledge
  if (config.knowledgeNotes) {
    sections.push(`KNOWLEDGE: ${config.knowledgeNotes}`)
  }

  // Must always/never do
  if (config.mustAlwaysDo.length > 0) {
    sections.push(`MUST ALWAYS: ${config.mustAlwaysDo.join('; ')}`)
  }
  if (config.mustNeverDo.length > 0) {
    sections.push(`MUST NEVER: ${config.mustNeverDo.join('; ')}`)
  }

  // Structured rules from admin notes
  const criticalRules = config.structuredRules.filter(r => r.priority === 'critical')
  const highRules = config.structuredRules.filter(r => r.priority === 'high')
  if (criticalRules.length > 0) {
    sections.push(`CRITICAL RULES:\n${criticalRules.map(r => `- ${r.description}`).join('\n')}`)
  }
  if (highRules.length > 0) {
    sections.push(`IMPORTANT RULES:\n${highRules.map(r => `- ${r.description}`).join('\n')}`)
  }

  // Religious
  if (config.religiousMode !== 'none') {
    sections.push(buildReligiousInstructions(config))
  }

  return sections.join('\n\n')
}

/**
 * Build religious-specific instructions for the agent.
 */
function buildReligiousInstructions(config: AppAgentConfig): string {
  const parts: string[] = []

  parts.push(`RELIGIOUS MODE: ${config.religiousMode}`)

  if (config.religiousBranch) {
    parts.push(`Tradition/branch: ${config.religiousBranch}`)
  }

  parts.push('RELIGIOUS RULES:')
  parts.push('- NEVER fabricate or guess scripture references.')
  parts.push('- Always distinguish between: direct holy text, scholarly commentary, interpretation, and general explanation.')
  parts.push('- Prefer approved source packs when available.')

  if (config.mustShowSourceForQuotes) {
    parts.push('- Always show the exact source (book, chapter, verse or surah, ayah) when quoting holy text.')
  }

  if (config.doctrineAwareRouting) {
    parts.push('- Be aware of doctrinal differences. Do not mix traditions without disclosure.')
  }

  if (config.approvedSourcePacks.length > 0) {
    parts.push(`- Approved source packs: ${config.approvedSourcePacks.join(', ')}`)
  }

  parts.push('- For difficult or controversial religious questions, recommend consulting a qualified scholar/pastor/imam.')
  parts.push('- Remain respectful and careful at all times.')

  return parts.join('\n')
}

// ── App Agent Request Processing ────────────────────────────────────────────

/**
 * Process a request through the App Agent → Super-Brain pipeline.
 *
 * Flow: App → Super-Brain → App Agent (augment with rules) → Central Orchestrator → Provider → Response
 *
 * The agent does NOT call providers directly. It prepares the augmented request
 * and delegates to the central orchestrator.
 */
export async function processAppAgentRequest(
  request: AppAgentRequest,
): Promise<AppAgentResponse> {
  const start = Date.now()
  const traceId = request.traceId || `agt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const warnings: string[] = []
  const appliedRules: string[] = []

  // 1. Load agent config
  const agent = await getAppAgent(request.appSlug)
  if (!agent) {
    return {
      success: false,
      output: null,
      traceId,
      agentId: '',
      appliedRules: [],
      warnings: [],
      errors: [`No app agent found for: ${request.appSlug}`],
      routedProvider: null,
      routedModel: null,
      latencyMs: Date.now() - start,
      budgetMode: 'balanced',
      memoryUsed: false,
      retrievalUsed: false,
    }
  }

  if (!agent.active) {
    return {
      success: false,
      output: null,
      traceId,
      agentId: agent.id,
      appliedRules: [],
      warnings: [],
      errors: ['App agent is currently inactive'],
      routedProvider: null,
      routedModel: null,
      latencyMs: Date.now() - start,
      budgetMode: agent.budgetMode,
      memoryUsed: false,
      retrievalUsed: false,
    }
  }

  // 2. Build the augmented system prompt
  const systemPrompt = buildAgentSystemPrompt(agent)
  appliedRules.push(`tone:${agent.tone}`, `creativity:${agent.creativity}`, `budget:${agent.budgetMode}`)

  if (agent.structuredRules.length > 0) {
    appliedRules.push(`structured_rules:${agent.structuredRules.length}`)
  }
  if (agent.religiousMode !== 'none') {
    appliedRules.push(`religious:${agent.religiousMode}`)
  }

  // 3. Enforce capability permissions
  const taskCapability = mapTaskTypeToCapability(request.taskType)
  if (agent.allowedCapabilities.length > 0 && taskCapability && !agent.allowedCapabilities.includes(taskCapability)) {
    return {
      success: false,
      output: null,
      traceId,
      agentId: agent.id,
      appliedRules,
      warnings: [],
      errors: [
        `Capability "${taskCapability}" is not allowed for this app agent. ` +
        `Allowed: ${agent.allowedCapabilities.join(', ')}. ` +
        `Update the agent's allowed capabilities in Admin → App Agents.`,
      ],
      routedProvider: null,
      routedModel: null,
      latencyMs: Date.now() - start,
      budgetMode: agent.budgetMode,
      memoryUsed: false,
      retrievalUsed: false,
    }
  }

  // 4. Budget mode is now passed directly to orchestrator for real enforcement
  const budgetMode = agent.budgetMode as 'low_cost' | 'balanced' | 'best_quality'

  // 4. Build the augmented message with system context
  const augmentedMessage = `[System Instructions]\n${systemPrompt}\n\n[User Message]\n${request.message}`

  // 5. The agent delegates to central orchestration
  // Import dynamically to avoid circular dependencies
  const { orchestrate } = await import('@/lib/orchestrator')

  const result = await orchestrate({
    appSlug: request.appSlug,
    appCategory: agent.appType,
    taskType: request.taskType,
    message: augmentedMessage,
    budgetMode,
  })

  return {
    success: result.output !== null && result.errors.length === 0,
    output: result.output,
    traceId,
    agentId: agent.id,
    appliedRules,
    warnings: [...warnings, ...result.warnings],
    errors: result.errors,
    routedProvider: result.routedProvider,
    routedModel: result.routedModel,
    latencyMs: Date.now() - start,
    budgetMode: agent.budgetMode,
    memoryUsed: result.memoryUsed,
    retrievalUsed: false,
  }
}

// ── Budget Resolution ───────────────────────────────────────────────────────

// ── Capability Permission Helpers ───────────────────────────────────────────

/** Exact match table for task type → capability mapping (module-scoped for performance). */
const TASK_TYPE_TO_CAPABILITY: Record<string, string> = {
  chat: 'chat', conversation: 'chat', converse: 'chat',
  image: 'image_generation', image_generation: 'image_generation', image_gen: 'image_generation',
  generate_image: 'image_generation', create_image: 'image_generation',
  stt: 'speech_to_text', speech_to_text: 'speech_to_text', transcribe: 'speech_to_text', transcription: 'speech_to_text',
  tts: 'text_to_speech', text_to_speech: 'text_to_speech', synthesize: 'text_to_speech', speak: 'text_to_speech',
  realtime_voice: 'realtime_voice', voice_interaction: 'realtime_voice', realtime: 'realtime_voice',
  embeddings: 'embeddings', embedding: 'embeddings', embed: 'embeddings', vector: 'embeddings',
  moderation: 'moderation', moderate: 'moderation', content_moderation: 'moderation',
  search: 'search', web_search: 'search',
  video: 'video', video_generation: 'video', video_planning: 'video',
  code: 'code', coding: 'code',
  reasoning: 'reasoning', analysis: 'reasoning', research: 'reasoning',
}

/**
 * Map a task type keyword to a canonical capability for permission checking.
 * Uses exact prefix/suffix matching to avoid false positives (e.g. 'invoice_search').
 * Returns null if the task type doesn't map to a restricted capability.
 */
function mapTaskTypeToCapability(taskType: string): string | null {
  const t = taskType.toLowerCase().trim()

  if (TASK_TYPE_TO_CAPABILITY[t]) return TASK_TYPE_TO_CAPABILITY[t]

  // Prefix match for compound types like 'image_edit', 'video_plan'
  if (t.startsWith('image_') || t.startsWith('generate_image')) return 'image_generation'
  if (t.startsWith('video_')) return 'video'
  if (t.startsWith('voice_') || t.startsWith('realtime_')) return 'realtime_voice'

  return null // unknown task types are not restricted
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToConfig(row: any): AppAgentConfig {
  return {
    id: row.id,
    appSlug: row.appSlug,
    appName: row.appName,
    appUrl: row.appUrl ?? '',
    appType: row.appType ?? 'general',
    purpose: row.purpose ?? '',
    active: row.active ?? true,
    tone: row.tone ?? 'professional',
    responseLength: row.responseLength ?? 'balanced',
    creativity: row.creativity ?? 'balanced',
    mustShowSourceForQuotes: row.mustShowSourceForQuotes ?? false,
    mustUseTrustedSources: row.mustUseTrustedSources ?? false,
    canAnswerWithoutSource: row.canAnswerWithoutSource ?? 'sometimes',
    separateQuoteFromExplanation: row.separateQuoteFromExplanation ?? false,
    adultMode: row.adultMode ?? false,
    sensitiveTopicMode: row.sensitiveTopicMode ?? 'standard',
    mustHandoffSeriousTopics: row.mustHandoffSeriousTopics ?? false,
    topicsNeedingCare: safeJsonParse(row.topicsNeedingCare, []),
    humanExpertAvailable: row.humanExpertAvailable ?? false,
    handoffTriggers: safeJsonParse(row.handoffTriggers, []),
    humanContactMethod: row.humanContactMethod ?? '',
    knowledgeCategories: safeJsonParse(row.knowledgeCategories, []),
    knowledgeNotes: row.knowledgeNotes ?? '',
    mustAlwaysDo: safeJsonParse(row.mustAlwaysDo, []),
    mustNeverDo: safeJsonParse(row.mustNeverDo, []),
    adminNotes: row.adminNotes ?? '',
    structuredRules: safeJsonParse(row.structuredRules, []),
    budgetMode: row.budgetMode ?? 'balanced',
    allowPremiumOnlyWhenNeeded: row.allowPremiumOnlyWhenNeeded ?? true,
    allowedCapabilities: safeJsonParse(row.allowedCapabilities, ['chat', 'reasoning', 'code']),
    learningEnabled: row.learningEnabled ?? false,
    autoImprovementEnabled: row.autoImprovementEnabled ?? false,
    adminReviewRequired: row.adminReviewRequired ?? true,
    religiousMode: row.religiousMode ?? 'none',
    religiousBranch: row.religiousBranch ?? '',
    approvedSourcePacks: safeJsonParse(row.approvedSourcePacks, []),
    doctrineAwareRouting: row.doctrineAwareRouting ?? false,
    preferredProviders: safeJsonParse(row.preferredProviders, []),
    preferredModels: safeJsonParse(row.preferredModels, []),
    fallbackChain: safeJsonParse(row.fallbackChain, []),
    memoryNamespace: row.memoryNamespace ?? '',
    retrievalNamespace: row.retrievalNamespace ?? '',
  }
}
