/**
 * Amarktai Network — AmarktAI Orchestration Layer
 *
 * Single source of truth for:
 *   - Task classification (complexity, execution mode, validation flags)
 *   - Specialist profile mapping (per app category)
 *   - Unified execution engine (delegates to routing-engine, agent-runtime,
 *     retrieval-engine, multimodal-router)
 *   - Confidence scoring
 *
 * Called exclusively by the Brain Gateway (/api/brain/request).
 * Server-side only. Never import from client components.
 *
 * ROUTING FLOW (unified):
 *   classifyTask() → routing-engine.routeRequest() → mode-specific execution
 *
 * Supported modes:
 *   - direct / specialist  → single model call
 *   - review               → primary + validator
 *   - consensus             → two independent generations
 *   - retrieval_chain       → retrieval-engine → model
 *   - agent_chain           → agent-runtime → model(s)
 *   - multimodal_chain      → multimodal-router
 *   - premium_escalation    → escalated model call
 *
 * CONFIDENCE SCORING LOGIC (heuristic, truthful, explainable):
 *   - Base: 0.70 for any routed provider
 *   - +0.15 if provider health is "healthy"
 *   - +0.05 if task category matches provider specialty
 *   - -0.10 if fallback provider was used
 *   - -0.10 if validation step failed or was skipped due to no second provider
 *   - -0.05 per warning beyond the first
 *   Clamped to [0.10, 0.99].
 */

import { callProvider, type ProviderCallResult } from '@/lib/brain'
import { prisma } from '@/lib/prisma'
import {
  getDefaultModelForProvider,
  getModelRegistry,
  setProviderHealth,
  type ProviderHealthStatus,
} from '@/lib/model-registry'
import { routeRequest, type RoutingDecision } from '@/lib/routing-engine'
import { isProviderWithinBudget } from '@/lib/budget-tracker'
import { createAgentTask, executeAgent, handoffTask, isAgentPermitted } from '@/lib/agent-runtime'
import { retrieve, type RetrievalResult } from '@/lib/retrieval-engine'
import { generateContent, type MultimodalResult } from '@/lib/multimodal-router'

// Consensus synthesizer: prefer longer response if it exceeds primary by this ratio
const CONSENSUS_LENGTH_RATIO_THRESHOLD = 1.2
// Warn about differing consensus outputs if length difference exceeds this (chars)
const CONSENSUS_LENGTH_DIFF_THRESHOLD = 200

/** Task types that require image-generation routing (evaluated once at module load). */
const IMAGE_TASK_TYPES_SET = new Set(['image_generation', 'image', 'image_gen', 'generate_image', 'create_image'])

// ── Classification ────────────────────────────────────────────────────────────

export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type ExecutionMode =
  | 'direct'
  | 'specialist'
  | 'review'
  | 'consensus'
  | 'retrieval_chain'
  | 'agent_chain'
  | 'multimodal_chain'
  | 'premium_escalation'

export interface ClassificationResult {
  taskComplexity: TaskComplexity
  executionMode: ExecutionMode
  requiresValidation: boolean
  requiresConsensus: boolean
  memoryRetrievalNeeded: boolean
  lowLatencyRequired: boolean
  appCategory: string
  taskType: string
}

/**
 * Classify a task before orchestration.
 *
 * Rules (transparent and minimal — not over-engineered):
 *
 * Complexity:
 *   - simple   → short message (<= 120 chars) AND generic taskType (chat|help|ping)
 *   - complex  → taskType contains analysis|review|audit|forecast|decision|report
 *                OR category is crypto/finance/forex AND taskType is not 'chat'
 *   - moderate → everything else
 *
 * Execution mode:
 *   - direct    → simple tasks
 *   - specialist → moderate tasks (routes to best specialist for the category)
 *   - review    → complex tasks OR financial/operational categories
 *   - consensus → explicit consensus taskType OR very high-stakes category + complex
 *
 * Validation: required for review/consensus modes.
 * Consensus:  only when explicit or complex + financial.
 * Memory:     reserved for future — always false for now.
 * Low latency: simple direct tasks are considered latency-sensitive.
 */
export function classifyTask(
  appCategory: string,
  taskType: string,
  message: string,
): ClassificationResult {
  const cat = (appCategory ?? '').toLowerCase()
  const task = (taskType ?? '').toLowerCase()
  const msgLen = (message ?? '').length

  const isFinancial = cat.includes('crypto') || cat.includes('finance') || cat.includes('forex') || cat.includes('trading')
  const isGenericTask = task === 'chat' || task === 'help' || task === 'ping' || task === 'support'
  const isComplexTask =
    task.includes('analysis') || task.includes('review') || task.includes('audit') ||
    task.includes('forecast') || task.includes('decision') || task.includes('report') ||
    task.includes('strategy') || task.includes('recommendation')
  const isConsensusTask = task.includes('consensus') || task.includes('compare')

  // Complexity
  let taskComplexity: TaskComplexity
  if (msgLen <= 120 && isGenericTask) {
    taskComplexity = 'simple'
  } else if (isComplexTask || (isFinancial && !isGenericTask)) {
    taskComplexity = 'complex'
  } else {
    taskComplexity = 'moderate'
  }

  // Execution mode
  let executionMode: ExecutionMode
  if (taskComplexity === 'simple') {
    executionMode = 'direct'
  } else if (isConsensusTask || (taskComplexity === 'complex' && isFinancial)) {
    executionMode = 'consensus'
  } else if (taskComplexity === 'complex' || isFinancial) {
    executionMode = 'review'
  } else {
    executionMode = 'specialist'
  }

  const requiresValidation = executionMode === 'review' || executionMode === 'consensus'
  const requiresConsensus = executionMode === 'consensus'

  return {
    taskComplexity,
    executionMode,
    requiresValidation,
    requiresConsensus,
    memoryRetrievalNeeded: false, // reserved for memory layer
    lowLatencyRequired: executionMode === 'direct',
    appCategory: cat,
    taskType: task,
  }
}

// ── Specialist Profiles ───────────────────────────────────────────────────────

/**
 * Centralized specialist profile mapping.
 * Maps app category → system-level instruction for that domain.
 * Used to build the specialist prompt prefix passed to providers.
 */
export const SPECIALIST_PROFILES: Record<string, string> = {
  crypto:    'You are a specialist AI assistant for cryptocurrency and digital asset trading. Provide accurate, data-aware responses. Always note that outputs are not financial advice.',
  finance:   'You are a specialist AI assistant for financial analysis and markets. Provide rigorous, well-reasoned responses. Always note that outputs are not financial advice.',
  forex:     'You are a specialist AI assistant for forex and currency markets. Provide accurate, data-aware responses. Always note that outputs are not financial advice.',
  trading:   'You are a specialist AI assistant for trading strategy and market analysis. Provide structured, reasoned responses. Always note that outputs are not financial advice.',
  equine:    'You are a specialist AI assistant for equine care, horse management, and related lifestyle topics. Provide practical, expert-informed responses.',
  horse:     'You are a specialist AI assistant for equine care, horse management, and related lifestyle topics. Provide practical, expert-informed responses.',
  family:    'You are a helpful AI assistant for family lifestyle topics including health, education, and wellbeing. Provide warm, practical, and safe responses.',
  marketing: 'You are a specialist AI assistant for marketing strategy, brand content, and growth campaigns. Provide creative, structured, and actionable responses.',
  content:   'You are a specialist AI assistant for content creation, copywriting, and creative strategy. Provide clear, engaging, and audience-aware responses.',
  generic:   'You are a helpful and knowledgeable AI assistant. Provide clear, accurate, and useful responses.',
}

export function getSpecialistProfile(appCategory: string): string {
  const cat = (appCategory ?? '').toLowerCase()
  for (const key of Object.keys(SPECIALIST_PROFILES)) {
    if (cat.includes(key)) return SPECIALIST_PROFILES[key]
  }
  return SPECIALIST_PROFILES.generic
}

// ── Available Provider Record ─────────────────────────────────────────────────

interface AvailableProvider {
  providerKey: string
  model: string
  healthStatus: string
  isHealthy: boolean
}

/**
 * Resolve the default model for a provider.
 *
 * Delegates to the canonical model registry to avoid duplicate
 * switch-statements scattered across the codebase.
 */
function defaultModelFor(providerKey: string): string {
  return getDefaultModelForProvider(providerKey)
}

/**
 * Load available providers from the DB for fallback/validation use.
 * Used only as a secondary source when the routing engine's model-based
 * decisions need to be verified against actual DB state.
 */
async function loadAvailableProviders(): Promise<AvailableProvider[]> {
  const providers = await prisma.aiProvider.findMany({
    where: { enabled: true, healthStatus: { notIn: ['disabled', 'error'] } },
    orderBy: { sortOrder: 'asc' },
    select: { providerKey: true, defaultModel: true, healthStatus: true, apiKey: true },
  })

  return providers
    .filter(p => p.apiKey)
    .map(p => ({
      providerKey: p.providerKey,
      model: p.defaultModel || defaultModelFor(p.providerKey),
      healthStatus: p.healthStatus,
      isHealthy: p.healthStatus === 'healthy',
    }))
}

/**
 * Sync the model-registry provider health cache from DB-loaded providers.
 *
 * IMPORTANT: This **must** be called before any call to `routeRequest()` or
 * `decideExecution()` so that `getUsableModels()` / `isProviderUsable()` return
 * results that reflect actual DB configuration rather than the static registry
 * defaults (which mark every known model as enabled/configured).
 *
 * Marks each DB-configured provider with its real health status, and marks
 * every other known provider key (from the static registry) as 'unconfigured'.
 */
function syncProviderHealthCache(available: AvailableProvider[]): void {
  const configuredKeys = new Set(available.map(p => p.providerKey))

  // Mark configured providers with their real DB health status
  for (const p of available) {
    setProviderHealth(p.providerKey, p.healthStatus as ProviderHealthStatus)
  }

  // Mark all other known provider keys as unconfigured
  const allProviderKeys = new Set(getModelRegistry().map(m => m.provider))
  for (const key of Array.from(allProviderKeys)) {
    if (!configuredKeys.has(key)) {
      setProviderHealth(key, 'unconfigured')
    }
  }
}

// ── Decision Engine (delegates to routing-engine) ─────────────────────────────

export interface DecisionResult {
  executionMode: ExecutionMode
  primaryProvider: AvailableProvider | null
  secondaryProvider: AvailableProvider | null  // for review / consensus
  fallbackEligible: boolean
  fallbackUsed: boolean
  reason: string
  warnings: string[]
  /** The raw routing-engine decision (for traceability). */
  routingDecision?: RoutingDecision
}

/**
 * Detect whether the task has multimodal markers (creative, marketing, etc.).
 */
function detectMultimodal(appCategory: string, taskType: string): boolean {
  const cat = appCategory.toLowerCase()
  const task = taskType.toLowerCase()
  // Marketing / content creation categories
  if (cat.includes('marketing') || cat.includes('content') || cat.includes('creative')) {
    if (task.includes('campaign') || task.includes('ad') || task.includes('image') ||
        task.includes('video') || task.includes('reel') || task.includes('brand') ||
        task.includes('calendar') || task.includes('social') || task.includes('caption')) {
      return true
    }
  }
  return false
}

/**
 * Detect whether the task may benefit from retrieval-augmented generation.
 */
function detectRetrieval(taskType: string, message: string): boolean {
  const task = taskType.toLowerCase()
  // Explicit retrieval signals
  if (task.includes('recall') || task.includes('history') || task.includes('context') ||
      task.includes('previous') || task.includes('retrieval') || task.includes('memory')) {
    return true
  }
  // Message-based heuristic: "remember", "last time", "previously"
  const msg = message.toLowerCase()
  if (msg.includes('remember') || msg.includes('last time') || msg.includes('previously') ||
      msg.includes('recall') || msg.includes('past conversation')) {
    return true
  }
  return false
}

/**
 * Decision engine: given classification + context, uses the routing-engine
 * as the single source of truth for model/provider selection.
 *
 * Falls back to DB-based provider lookup when the routing engine has no models.
 */
export async function decideExecution(
  classification: ClassificationResult,
  available: AvailableProvider[],
  appSlug?: string,
): Promise<DecisionResult> {
  const warnings: string[] = []

  // Use the routing engine to make the model selection decision
  const routingCtx = {
    appSlug: appSlug ?? 'unknown',
    appCategory: classification.appCategory,
    taskType: classification.taskType,
    taskComplexity: classification.taskComplexity,
    message: '',
    requiresRetrieval: false,
    requiresMultimodal: false,
  }
  const routingDecision = routeRequest(routingCtx)

  if (routingDecision.primaryModel) {
    // Convert routing-engine's ModelEntry to AvailableProvider format
    const primary: AvailableProvider = {
      providerKey: routingDecision.primaryModel.provider,
      model: routingDecision.primaryModel.model_id,
      healthStatus: routingDecision.primaryModel.health_status,
      isHealthy: routingDecision.primaryModel.health_status === 'healthy' || routingDecision.primaryModel.health_status === 'configured',
    }
    const secondary = routingDecision.secondaryModel
      ? {
          providerKey: routingDecision.secondaryModel.provider,
          model: routingDecision.secondaryModel.model_id,
          healthStatus: routingDecision.secondaryModel.health_status,
          isHealthy: routingDecision.secondaryModel.health_status === 'healthy' || routingDecision.secondaryModel.health_status === 'configured',
        }
      : null

    // Map routing mode to execution mode
    let executionMode: ExecutionMode = routingDecision.mode as ExecutionMode

    // Validate secondary provider availability for review/consensus
    if ((executionMode === 'review' || executionMode === 'consensus') && !secondary) {
      executionMode = 'specialist'
      warnings.push(
        `${routingDecision.mode} mode requires 2 providers — only 1 available; downgraded to specialist mode`,
      )
    }

    warnings.push(...routingDecision.warnings)

    return {
      executionMode,
      primaryProvider: primary,
      secondaryProvider: secondary,
      fallbackEligible: routingDecision.fallbackModels.length > 0,
      fallbackUsed: false,
      reason: routingDecision.reason,
      warnings,
      routingDecision,
    }
  }

  // Fallback: routing engine had no models — use DB-loaded providers
  if (available.length === 0) {
    return {
      executionMode: 'direct',
      primaryProvider: null,
      secondaryProvider: null,
      fallbackEligible: false,
      fallbackUsed: false,
      reason: 'No providers available',
      warnings: ['No configured AI providers available'],
    }
  }

  warnings.push('Routing engine returned no eligible models — falling back to DB provider list')

  const primaryProvider = available[0]
  let secondaryProvider: AvailableProvider | null = null
  let executionMode: ExecutionMode = classification.executionMode

  if (executionMode === 'review' || executionMode === 'consensus') {
    secondaryProvider = available.find(p => p.providerKey !== primaryProvider.providerKey) ?? null
    if (!secondaryProvider) {
      executionMode = 'specialist'
      warnings.push(
        `${classification.executionMode} mode requires 2 providers — only 1 available; downgraded to specialist mode`,
      )
    }
  }

  return {
    executionMode,
    primaryProvider,
    secondaryProvider,
    fallbackEligible: available.length > 1,
    fallbackUsed: false,
    reason: `Fallback to DB providers — routed via ${primaryProvider.providerKey}`,
    warnings,
  }
}

/**
 * Compute a heuristic confidence score. Logic documented in module header.
 * Returns a value between 0.10 and 0.99.
 */
export function computeConfidenceScore(opts: {
  primaryProvider: AvailableProvider
  fallbackUsed: boolean
  validationPassed: boolean | null  // null = validation not attempted
  warnings: string[]
}): number {
  let score = 0.70

  if (opts.primaryProvider.isHealthy) score += 0.15
  else if (opts.primaryProvider.healthStatus === 'configured') score += 0.05

  if (opts.fallbackUsed) score -= 0.10

  if (opts.validationPassed === false) score -= 0.10
  else if (opts.validationPassed === null) score -= 0.00 // not attempted — neutral

  const extraWarnings = Math.max(0, opts.warnings.length - 1)
  score -= extraWarnings * 0.05

  return Math.min(0.99, Math.max(0.10, Math.round(score * 100) / 100))
}

// ── Execution Engine ──────────────────────────────────────────────────────────

export interface OrchestrationResult {
  output: string | null
  executionMode: ExecutionMode
  routedProvider: string | null
  routedModel: string | null
  confidenceScore: number | null
  validationUsed: boolean
  consensusUsed: boolean
  fallbackUsed: boolean
  memoryUsed: boolean
  warnings: string[]
  errors: string[]
  latencyMs: number
  classification: ClassificationResult
  /** Human-readable explanation of why this provider/model was chosen. */
  routingReason?: string
}

/**
 * Main orchestration entry point.
 *
 * Classifies the task, delegates to the routing-engine for model selection,
 * then executes in the decided mode — including new modes for agent chains,
 * retrieval chains, multimodal chains, and premium escalation.
 */
export async function orchestrate(opts: {
  appSlug?: string
  appCategory: string
  taskType: string
  message: string
}): Promise<OrchestrationResult> {
  const start = Date.now()
  const { appSlug, appCategory, taskType, message } = opts

  // 1. Classify
  const classification = classifyTask(appCategory, taskType, message)

  // 2. Load DB providers FIRST and sync the model-registry health cache so that
  //    getUsableModels() / isProviderUsable() reflect real configured state before
  //    any routing decision is made.
  const available = await loadAvailableProviders()

  // 2b. Pre-filter providers that have exceeded their budget critical threshold.
  //     Providers over budget are removed from the available list so the routing
  //     engine and fallback logic won't select them. If ALL are over budget,
  //     we keep all to avoid a total outage (the request route has a 429 guard).
  let filteredAvailable = available
  try {
    const budgetOk = await Promise.all(available.map(p => isProviderWithinBudget(p.providerKey)))
    const withinBudget = available.filter((_, i) => budgetOk[i])
    if (withinBudget.length > 0 && withinBudget.length < available.length) {
      filteredAvailable = withinBudget
    }
  } catch {
    // Budget DB unavailable — proceed with all providers
  }

  syncProviderHealthCache(filteredAvailable)

  // 3. Build routing context with signal detection
  const isMultimodal = detectMultimodal(appCategory, taskType)
  const isRetrieval = detectRetrieval(taskType, message)
  const normalizedTask = (taskType ?? '').toLowerCase()
  const isImageTask = IMAGE_TASK_TYPES_SET.has(normalizedTask)

  const routingCtx = {
    appSlug: appSlug ?? 'unknown',
    appCategory: classification.appCategory,
    taskType: classification.taskType,
    taskComplexity: classification.taskComplexity,
    message,
    requiresRetrieval: isRetrieval,
    requiresMultimodal: isMultimodal,
    ...(isImageTask ? { requiredModality: 'image' as const } : {}),
  }

  // 4. Route via the routing-engine (now health-aware — only configured providers considered)
  const routingDecision = routeRequest(routingCtx)

  // 5. Build decision from routing-engine result (also uses health-aware cache internally)
  const decision = await decideExecution(classification, filteredAvailable, appSlug)

  // Override the execution mode with the routing engine's mode when it returns valid models
  let effectiveMode: ExecutionMode = decision.executionMode
  if (routingDecision.primaryModel) {
    effectiveMode = routingDecision.mode as ExecutionMode
    // But still respect downgrade for review/consensus without secondary
    if ((effectiveMode === 'review' || effectiveMode === 'consensus') && !decision.secondaryProvider) {
      effectiveMode = 'specialist'
    }
  }

  // 6. No providers at all
  if (!decision.primaryProvider) {
    return {
      output: null,
      executionMode: effectiveMode,
      routedProvider: null,
      routedModel: null,
      confidenceScore: null,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed: false,
      warnings: decision.warnings,
      errors: ['No AI provider is available — all providers are unconfigured or disabled'],
      latencyMs: Date.now() - start,
      classification,
      routingReason: decision.reason,
    }
  }

  // 7. Build specialist prompt
  const systemProfile = getSpecialistProfile(classification.appCategory)
  const specialistMessage = effectiveMode === 'direct'
    ? message
    : `${systemProfile}\n\n---\n\n${message}`

  // 8. Execute based on the resolved mode
  const warnings = [...decision.warnings]
  const errors: string[] = []

  switch (effectiveMode) {
    // ── Agent Chain ─────────────────────────────────────────────────────
    case 'agent_chain': {
      return await executeAgentChain({
        appSlug: appSlug ?? 'unknown',
        message,
        start,
        classification,
        decision,
        warnings,
      })
    }

    // ── Retrieval Chain ─────────────────────────────────────────────────
    case 'retrieval_chain': {
      return await executeRetrievalChain({
        appSlug: appSlug ?? 'unknown',
        message,
        specialistMessage,
        start,
        classification,
        decision,
        warnings,
      })
    }

    // ── Multimodal Chain ────────────────────────────────────────────────
    case 'multimodal_chain': {
      return await executeMultimodalChain({
        appSlug: appSlug ?? 'unknown',
        appCategory,
        taskType,
        message,
        start,
        classification,
        decision,
        warnings,
      })
    }

    // ── Premium Escalation ──────────────────────────────────────────────
    case 'premium_escalation': {
      const result = await callProvider(
        decision.primaryProvider.providerKey,
        decision.primaryProvider.model,
        specialistMessage,
      )
      if (!result.ok) {
        errors.push(result.error ?? 'Premium escalation provider call failed')
        // Try fallback from routing decision
        if (routingDecision.fallbackModels.length > 0) {
          const fb = routingDecision.fallbackModels[0]
          warnings.push(`Premium escalation failed — attempting fallback to ${fb.provider}/${fb.model_id}`)
          const fallback = await callProvider(fb.provider, fb.model_id, specialistMessage)
          if (fallback.ok) {
            const confidence = computeConfidenceScore({
              primaryProvider: { ...decision.primaryProvider, providerKey: fb.provider, isHealthy: true, healthStatus: 'configured', model: fb.model_id },
              fallbackUsed: true,
              validationPassed: null,
              warnings,
            })
            return {
              output: fallback.output,
              executionMode: 'premium_escalation',
              routedProvider: fallback.providerKey,
              routedModel: fallback.model,
              confidenceScore: confidence,
              validationUsed: false,
              consensusUsed: false,
              fallbackUsed: true,
              memoryUsed: false,
              warnings,
              errors,
              latencyMs: Date.now() - start,
              classification,
            }
          }
          errors.push(fallback.error ?? 'Fallback also failed')
        }
      }
      const confidence = result.ok
        ? computeConfidenceScore({ primaryProvider: decision.primaryProvider, fallbackUsed: false, validationPassed: null, warnings })
        : null
      return {
        output: result.output,
        executionMode: 'premium_escalation',
        routedProvider: result.providerKey,
        routedModel: result.model,
        confidenceScore: confidence,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: false,
        memoryUsed: false,
        warnings,
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    // ── Direct / Specialist ─────────────────────────────────────────────
    case 'direct':
    case 'specialist': {
      const result = await callProvider(
        decision.primaryProvider.providerKey,
        decision.primaryProvider.model,
        specialistMessage,
      )
      if (!result.ok) {
        errors.push(result.error ?? 'Provider call failed')
        // Attempt fallback if a secondary is available
        if (decision.secondaryProvider) {
          warnings.push(`Primary provider failed — attempting fallback to ${decision.secondaryProvider.providerKey}`)
          const fallback = await callProvider(
            decision.secondaryProvider.providerKey,
            decision.secondaryProvider.model,
            specialistMessage,
          )
          if (fallback.ok) {
            const confidence = computeConfidenceScore({
              primaryProvider: decision.secondaryProvider,
              fallbackUsed: true,
              validationPassed: null,
              warnings,
            })
            return {
              output: fallback.output,
              executionMode: decision.executionMode,
              routedProvider: fallback.providerKey,
              routedModel: fallback.model,
              confidenceScore: confidence,
              validationUsed: false,
              consensusUsed: false,
              fallbackUsed: true,
              memoryUsed: false,
              warnings,
              errors,
              latencyMs: Date.now() - start,
              classification,
            }
          }
          errors.push(fallback.error ?? 'Fallback provider also failed')
        }
      }
      const confidence = result.ok
        ? computeConfidenceScore({ primaryProvider: decision.primaryProvider, fallbackUsed: decision.fallbackUsed, validationPassed: null, warnings })
        : null
      return {
        output: result.output,
        executionMode: decision.executionMode,
        routedProvider: result.providerKey,
        routedModel: result.model,
        confidenceScore: confidence,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: decision.fallbackUsed,
        memoryUsed: false,
        warnings,
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    case 'review': {
      // Step 1: Primary produces draft
      const primary = await callProvider(
        decision.primaryProvider.providerKey,
        decision.primaryProvider.model,
        specialistMessage,
      )
      if (!primary.ok) {
        errors.push(primary.error ?? 'Primary provider failed in review mode')
        return {
          output: null,
          executionMode: 'review',
          routedProvider: primary.providerKey,
          routedModel: primary.model,
          confidenceScore: null,
          validationUsed: false,
          consensusUsed: false,
          fallbackUsed: decision.fallbackUsed,
          memoryUsed: false,
          warnings,
          errors,
          latencyMs: Date.now() - start,
          classification,
        }
      }

      // Step 2: Validator reviews
      let validationPassed: boolean | null = null
      if (decision.secondaryProvider) {
        const validatorPrompt =
          `${systemProfile}\n\n---\n\nYou are a validator. Review the following AI-generated response for quality, accuracy, and consistency with the user request.\n\nOriginal Request:\n${message}\n\nGenerated Response:\n${primary.output ?? ''}\n\nProvide a brief validation verdict: start your reply with "VALID:" if the response is acceptable, or "INVALID:" if it has significant issues. Then explain briefly.`
        const validation = await callProvider(
          decision.secondaryProvider.providerKey,
          decision.secondaryProvider.model,
          validatorPrompt,
        )
        if (validation.ok && validation.output) {
          const verdict = validation.output.trim().toUpperCase()
          validationPassed = verdict.startsWith('VALID:')
          if (!validationPassed) {
            warnings.push('Validator flagged response quality — review recommended')
          }
        } else {
          warnings.push('Validation step failed — returning primary response without validation')
          validationPassed = null
        }
      }

      const confidence = computeConfidenceScore({
        primaryProvider: decision.primaryProvider,
        fallbackUsed: decision.fallbackUsed,
        validationPassed,
        warnings,
      })
      return {
        output: primary.output,
        executionMode: 'review',
        routedProvider: primary.providerKey,
        routedModel: primary.model,
        confidenceScore: confidence,
        validationUsed: decision.secondaryProvider !== null,
        consensusUsed: false,
        fallbackUsed: decision.fallbackUsed,
        memoryUsed: false,
        warnings,
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    case 'consensus': {
      // Both providers generate independently
      const [result1, result2] = await Promise.all([
        callProvider(
          decision.primaryProvider.providerKey,
          decision.primaryProvider.model,
          specialistMessage,
        ),
        decision.secondaryProvider
          ? callProvider(
              decision.secondaryProvider.providerKey,
              decision.secondaryProvider.model,
              specialistMessage,
            )
          : Promise.resolve(null as ProviderCallResult | null),
      ])

      if (!result1.ok) {
        errors.push(result1.error ?? 'Primary provider failed in consensus mode')
        if (!result2 || !result2.ok) {
          if (result2 && result2.error) errors.push(result2.error)
          return {
            output: null,
            executionMode: 'consensus',
            routedProvider: null,
            routedModel: null,
            confidenceScore: null,
            validationUsed: false,
            consensusUsed: false,
            fallbackUsed: decision.fallbackUsed,
            memoryUsed: false,
            warnings,
            errors,
            latencyMs: Date.now() - start,
            classification,
          }
        }
        // Only secondary succeeded — return it as fallback
        warnings.push('Primary provider failed in consensus — returning secondary result only')
        const confidence = computeConfidenceScore({
          primaryProvider: decision.secondaryProvider!,
          fallbackUsed: true,
          validationPassed: null,
          warnings,
        })
        return {
          output: result2.output,
          executionMode: 'consensus',
          routedProvider: result2.providerKey,
          routedModel: result2.model,
          confidenceScore: confidence,
          validationUsed: false,
          consensusUsed: false,
          fallbackUsed: true,
          memoryUsed: false,
          warnings,
          errors,
          latencyMs: Date.now() - start,
          classification,
        }
      }

      // Both succeeded — synthesizer selects the better response
      let finalOutput = result1.output
      let consensusUsed = false

      if (result2?.ok && result2.output) {
        consensusUsed = true
        // Simple synthesizer: prefer the longer, more detailed response unless both are similar
        const len1 = (result1.output ?? '').length
        const len2 = result2.output.length
        // Pick the longer response as the primary signal; add a note if they differ significantly
        finalOutput = len2 > len1 * CONSENSUS_LENGTH_RATIO_THRESHOLD ? result2.output : result1.output
        if (Math.abs(len1 - len2) > CONSENSUS_LENGTH_DIFF_THRESHOLD) {
          warnings.push('Consensus responses differed in length — selected most detailed response')
        }
      }

      const confidence = computeConfidenceScore({
        primaryProvider: decision.primaryProvider,
        fallbackUsed: decision.fallbackUsed,
        validationPassed: consensusUsed ? true : null,
        warnings,
      })
      return {
        output: finalOutput,
        executionMode: 'consensus',
        routedProvider: result1.providerKey,
        routedModel: result1.model,
        confidenceScore: confidence,
        validationUsed: consensusUsed,
        consensusUsed,
        fallbackUsed: decision.fallbackUsed,
        memoryUsed: false,
        warnings,
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    default:
      return {
        output: null,
        executionMode: classification.executionMode as ExecutionMode,
        routedProvider: null,
        routedModel: null,
        confidenceScore: null,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: false,
        memoryUsed: false,
        warnings,
        errors: ['Unknown execution mode'],
        latencyMs: Date.now() - start,
        classification,
      }
  }
}

// ── Agent Chain Execution ─────────────────────────────────────────────────────

async function executeAgentChain(opts: {
  appSlug: string
  message: string
  start: number
  classification: ClassificationResult
  decision: DecisionResult
  warnings: string[]
}): Promise<OrchestrationResult> {
  const { appSlug, message, start, classification, decision, warnings } = opts
  const errors: string[] = []

  try {
    // Step 1: Planner agent decomposes the task
    if (!isAgentPermitted('planner', appSlug)) {
      warnings.push('App does not have planner agent permission — falling back to specialist mode')
      // Fallback to specialist execution
      const result = await callProvider(
        decision.primaryProvider!.providerKey,
        decision.primaryProvider!.model,
        message,
      )
      return {
        output: result.output,
        executionMode: 'agent_chain',
        routedProvider: result.providerKey,
        routedModel: result.model,
        confidenceScore: result.ok ? 0.60 : null,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: false,
        memoryUsed: false,
        warnings,
        errors: result.ok ? [] : [result.error ?? 'Provider call failed'],
        latencyMs: Date.now() - start,
        classification,
      }
    }

    // Execute the planner agent
    const plannerTask = createAgentTask('planner', appSlug, {
      message: `Plan the following task: ${message}`,
      context: { taskType: classification.taskType, complexity: classification.taskComplexity },
    })
    const plannerResult = await executeAgent(plannerTask)

    if (plannerResult.status === 'failed') {
      errors.push(`Planner agent failed: ${plannerResult.error}`)
      // Fallback: use direct provider call instead
      warnings.push('Agent chain planner failed — falling back to direct provider call')
      const result = await callProvider(
        decision.primaryProvider!.providerKey,
        decision.primaryProvider!.model,
        message,
      )
      return {
        output: result.output,
        executionMode: 'agent_chain',
        routedProvider: result.providerKey,
        routedModel: result.model,
        confidenceScore: result.ok ? 0.50 : null,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: true,
        memoryUsed: false,
        warnings,
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    // Step 2: Execute the task with planner output as context
    const plannerOutput = plannerResult.output ?? message
    const result = await callProvider(
      decision.primaryProvider!.providerKey,
      decision.primaryProvider!.model,
      `[Agent Plan]\n${plannerOutput}\n\n[Execute the plan for this request]\n${message}`,
    )

    // Step 3: Validate if permitted
    let validationPassed: boolean | null = null
    if (isAgentPermitted('validator', appSlug) && result.ok) {
      try {
        // Hand off from planner to router (tracks lineage)
        const routerTask = handoffTask(plannerTask, 'router')
        await executeAgent(routerTask)

        // Create and execute a validator task
        const valTask = createAgentTask('validator', appSlug, {
          message: `Validate the following response for quality and accuracy:\n\nOriginal request: ${message}\n\nResponse: ${result.output}`,
          context: { parentOutput: plannerOutput },
        })
        const valResult = await executeAgent(valTask)
        if (valResult.status === 'completed' && valResult.output) {
          validationPassed = valResult.output.toUpperCase().includes('VALID')
          if (!validationPassed) {
            warnings.push('Agent validator flagged response quality — review recommended')
          }
        }
      } catch {
        warnings.push('Agent validation step failed — returning unvalidated response')
      }
    }

    const confidence = result.ok
      ? computeConfidenceScore({
          primaryProvider: decision.primaryProvider!,
          fallbackUsed: false,
          validationPassed,
          warnings,
        })
      : null

    return {
      output: result.output,
      executionMode: 'agent_chain',
      routedProvider: result.providerKey,
      routedModel: result.model,
      confidenceScore: confidence,
      validationUsed: validationPassed !== null,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed: false,
      warnings,
      errors: result.ok ? errors : [...errors, result.error ?? 'Provider call failed'],
      latencyMs: Date.now() - start,
      classification,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Agent chain error: ${msg}`)
    return {
      output: null,
      executionMode: 'agent_chain',
      routedProvider: null,
      routedModel: null,
      confidenceScore: null,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed: false,
      warnings,
      errors,
      latencyMs: Date.now() - start,
      classification,
    }
  }
}

// ── Retrieval Chain Execution ─────────────────────────────────────────────────

async function executeRetrievalChain(opts: {
  appSlug: string
  message: string
  specialistMessage: string
  start: number
  classification: ClassificationResult
  decision: DecisionResult
  warnings: string[]
}): Promise<OrchestrationResult> {
  const { appSlug, message, specialistMessage, start, classification, decision, warnings } = opts
  const errors: string[] = []

  try {
    // Step 1: Retrieve relevant context using the retrieval engine
    const retrievalResult: RetrievalResult = await retrieve({
      appSlug,
      query: message,
      maxResults: 5,
      includeGlobal: true,
    })

    const memoryUsed = retrievalResult.entries.length > 0

    // Step 2: Build augmented message with retrieved context
    let augmentedMessage = specialistMessage
    if (retrievalResult.entries.length > 0) {
      const contextBlock = retrievalResult.entries
        .map(e => `[${e.source}/${e.memoryType}] (score: ${e.finalScore.toFixed(2)}) ${e.content}`)
        .join('\n')
      augmentedMessage = `[Retrieved Context — ${retrievalResult.entries.length} entries, ${retrievalResult.retrievalLatencyMs}ms]\n${contextBlock}\n\n---\n\n${specialistMessage}`
    } else {
      warnings.push('Retrieval chain: no relevant memories found — proceeding without augmentation')
    }

    // Step 3: Call the primary model with augmented context
    const result = await callProvider(
      decision.primaryProvider!.providerKey,
      decision.primaryProvider!.model,
      augmentedMessage,
    )

    if (!result.ok) {
      errors.push(result.error ?? 'Retrieval chain provider call failed')
    }

    const confidence = result.ok
      ? computeConfidenceScore({
          primaryProvider: decision.primaryProvider!,
          fallbackUsed: false,
          validationPassed: null,
          warnings,
        })
      : null

    return {
      output: result.output,
      executionMode: 'retrieval_chain',
      routedProvider: result.providerKey,
      routedModel: result.model,
      confidenceScore: confidence,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed,
      warnings,
      errors,
      latencyMs: Date.now() - start,
      classification,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Retrieval chain error: ${msg}`)
    // Fallback to non-retrieval call
    warnings.push('Retrieval chain failed — falling back to direct call')
    const result = await callProvider(
      decision.primaryProvider!.providerKey,
      decision.primaryProvider!.model,
      specialistMessage,
    )
    return {
      output: result.output,
      executionMode: 'retrieval_chain',
      routedProvider: result.providerKey,
      routedModel: result.model,
      confidenceScore: result.ok ? 0.55 : null,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: true,
      memoryUsed: false,
      warnings,
      errors,
      latencyMs: Date.now() - start,
      classification,
    }
  }
}

// ── Multimodal Chain Execution ────────────────────────────────────────────────

async function executeMultimodalChain(opts: {
  appSlug: string
  appCategory: string
  taskType: string
  message: string
  start: number
  classification: ClassificationResult
  decision: DecisionResult
  warnings: string[]
}): Promise<OrchestrationResult> {
  const { appSlug, taskType, message, start, classification, decision, warnings } = opts
  const errors: string[] = []

  try {
    // Map task type to content type
    const contentType = detectContentType(taskType)

    const multimodalResult: MultimodalResult = await generateContent({
      appSlug,
      contentType,
      prompt: message,
      outputFormat: 'markdown',
    })

    if (!multimodalResult.success) {
      errors.push(...multimodalResult.errors)
      // Fallback to regular provider call
      warnings.push('Multimodal chain failed — falling back to specialist call')
      const result = await callProvider(
        decision.primaryProvider!.providerKey,
        decision.primaryProvider!.model,
        message,
      )
      return {
        output: result.output,
        executionMode: 'multimodal_chain',
        routedProvider: result.providerKey,
        routedModel: result.model,
        confidenceScore: result.ok ? 0.55 : null,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: true,
        memoryUsed: multimodalResult.metadata.usedBrandMemory || multimodalResult.metadata.usedCampaignMemory,
        warnings: [...warnings, ...multimodalResult.warnings],
        errors,
        latencyMs: Date.now() - start,
        classification,
      }
    }

    warnings.push(...multimodalResult.warnings)

    return {
      output: multimodalResult.output,
      executionMode: 'multimodal_chain',
      routedProvider: multimodalResult.metadata.providerUsed,
      routedModel: multimodalResult.metadata.modelUsed,
      confidenceScore: 0.80,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed: multimodalResult.metadata.usedBrandMemory || multimodalResult.metadata.usedCampaignMemory,
      warnings,
      errors,
      latencyMs: Date.now() - start,
      classification,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Multimodal chain error: ${msg}`)
    return {
      output: null,
      executionMode: 'multimodal_chain',
      routedProvider: null,
      routedModel: null,
      confidenceScore: null,
      validationUsed: false,
      consensusUsed: false,
      fallbackUsed: false,
      memoryUsed: false,
      warnings,
      errors,
      latencyMs: Date.now() - start,
      classification,
    }
  }
}

/**
 * Map a task type string to the most appropriate multimodal content type.
 */
function detectContentType(taskType: string): import('@/lib/multimodal-router').ContentType {
  const t = taskType.toLowerCase()
  if (t.includes('campaign')) return 'campaign_plan'
  if (t.includes('ad') || t.includes('advert')) return 'ad_concept'
  if (t.includes('image') || t.includes('visual')) return 'image_prompt'
  if (t.includes('video')) return 'video_concept'
  if (t.includes('reel') || t.includes('short')) return 'reel_concept'
  if (t.includes('calendar') || t.includes('schedule')) return 'content_calendar'
  if (t.includes('social') || t.includes('post')) return 'social_post'
  if (t.includes('caption')) return 'caption'
  if (t.includes('brand') || t.includes('voice')) return 'brand_voice'
  return 'text'
}
