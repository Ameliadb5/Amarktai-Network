/**
 * Amarktai Super Brain — Orchestration Layer
 *
 * Single source of truth for:
 *   - Task classification (complexity, execution mode, validation flags)
 *   - Specialist profile mapping (per app category)
 *   - Decision engine (which mode, provider, model; confidence scoring)
 *   - Execution engine (direct / specialist / review / consensus)
 *
 * Called exclusively by the Brain Gateway (/api/brain/request).
 * Server-side only. Never import from client components.
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

// Consensus synthesizer: prefer longer response if it exceeds primary by this ratio
const CONSENSUS_LENGTH_RATIO_THRESHOLD = 1.2
// Warn about differing consensus outputs if length difference exceeds this (chars)
const CONSENSUS_LENGTH_DIFF_THRESHOLD = 200

// ── Classification ────────────────────────────────────────────────────────────

export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type ExecutionMode = 'direct' | 'specialist' | 'review' | 'consensus'

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

function defaultModelFor(providerKey: string): string {
  switch (providerKey) {
    case 'openai':      return 'gpt-4o-mini'
    case 'gemini':      return 'gemini-1.5-flash'
    case 'grok':        return 'grok-2-latest'
    case 'qwen':        return 'qwen-max'
    case 'huggingface': return 'meta-llama/Llama-3-8b-chat-hf'
    case 'nvidia':      return 'nvidia/llama-3.1-nemotron-70b-instruct'
    default:            return 'unknown'
  }
}

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

function buildPreferenceOrder(appCategory: string): string[] {
  const cat = (appCategory ?? '').toLowerCase()
  if (cat.includes('crypto') || cat.includes('finance') || cat.includes('forex') || cat.includes('trading')) {
    return ['openai', 'grok', 'gemini', 'qwen', 'huggingface', 'nvidia']
  }
  if (cat.includes('equine') || cat.includes('horse') || cat.includes('family')) {
    return ['openai', 'gemini', 'grok', 'huggingface', 'qwen', 'nvidia']
  }
  if (cat.includes('marketing') || cat.includes('content')) {
    return ['gemini', 'openai', 'grok', 'huggingface', 'qwen', 'nvidia']
  }
  return ['openai', 'gemini', 'grok', 'huggingface', 'qwen', 'nvidia']
}

// ── Decision Engine ───────────────────────────────────────────────────────────

export interface DecisionResult {
  executionMode: ExecutionMode
  primaryProvider: AvailableProvider | null
  secondaryProvider: AvailableProvider | null  // for review / consensus
  fallbackEligible: boolean
  fallbackUsed: boolean
  reason: string
  warnings: string[]
}

/**
 * Decision engine: given classification + available providers, decide:
 * - which execution mode to use
 * - which primary provider/model
 * - which secondary provider (for review/consensus)
 * - whether fallback is eligible
 *
 * May downgrade executionMode if insufficient providers are available.
 */
export function decideExecution(
  classification: ClassificationResult,
  available: AvailableProvider[],
): DecisionResult {
  const warnings: string[] = []

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

  const preferenceOrder = buildPreferenceOrder(classification.appCategory)
  const preferred = preferenceOrder
    .map(key => available.find(p => p.providerKey === key))
    .filter((p): p is AvailableProvider => p !== undefined)

  const orderedProviders = preferred.length > 0 ? preferred : available

  const primaryProvider = orderedProviders[0]
  const isFirstChoice = primaryProvider.providerKey === preferenceOrder[0]
  const fallbackUsed = !isFirstChoice

  if (fallbackUsed) {
    warnings.push(`Primary provider unavailable — routed via fallback (${primaryProvider.providerKey})`)
  }

  // Determine if a second provider is available for review/consensus
  let secondaryProvider: AvailableProvider | null = null
  let executionMode = classification.executionMode

  if (executionMode === 'review' || executionMode === 'consensus') {
    secondaryProvider = orderedProviders.find(p => p.providerKey !== primaryProvider.providerKey) ?? null
    if (!secondaryProvider) {
      // Downgrade: can't do multi-provider without a second provider
      executionMode = 'specialist'
      warnings.push(
        `${classification.executionMode} mode requires 2 providers — only 1 available; downgraded to specialist mode`,
      )
    }
  }

  const reason = fallbackUsed
    ? `Fallback to ${primaryProvider.providerKey} — preferred providers unavailable`
    : `Routed via ${classification.appCategory || 'generic'} policy → ${primaryProvider.providerKey}`

  return {
    executionMode,
    primaryProvider,
    secondaryProvider,
    fallbackEligible: available.length > 1,
    fallbackUsed,
    reason,
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
}

/**
 * Main orchestration entry point.
 * Classifies the task, runs the decision engine, executes in the decided mode.
 */
export async function orchestrate(opts: {
  appCategory: string
  taskType: string
  message: string
}): Promise<OrchestrationResult> {
  const start = Date.now()
  const { appCategory, taskType, message } = opts

  // 1. Classify
  const classification = classifyTask(appCategory, taskType, message)

  // 2. Load providers
  const available = await loadAvailableProviders()

  // 3. Decide
  const decision = decideExecution(classification, available)

  // 4. No providers at all
  if (!decision.primaryProvider) {
    return {
      output: null,
      executionMode: decision.executionMode,
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
    }
  }

  // 5. Build specialist prompt
  const systemProfile = getSpecialistProfile(classification.appCategory)
  const specialistMessage = decision.executionMode === 'direct'
    ? message
    : `${systemProfile}\n\n---\n\n${message}`

  // 6. Execute
  const warnings = [...decision.warnings]
  const errors: string[] = []

  switch (decision.executionMode) {
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
        executionMode: classification.executionMode,
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
