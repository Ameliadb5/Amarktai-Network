/**
 * Routing Policy Engine for the AmarktAI Network.
 *
 * Replaces the scattered routing logic in orchestrator.ts with a
 * policy-driven routing engine that reads from the model registry
 * and per-app profiles. Every routing decision is data-driven:
 *   1. App profile gates which providers/models are eligible.
 *   2. Model registry supplies capability, cost, and latency metadata.
 *   3. Escalation & validator rules fire when complexity or task type
 *      matches the app profile's configured thresholds.
 *
 * Server-side only – no browser APIs or external imports.
 */

import {
  type ModelEntry,
  getEnabledModels,
  getModelById,
} from '@/lib/model-registry'

import {
  type AppProfile,
  getAppProfile,
  isProviderAllowed,
  isModelAllowed,
  shouldEscalate,
  requiresValidation,
} from '@/lib/app-profiles'

// ── Types ───────────────────────────────────────────────────────────────

/**
 * Supported routing modes.
 *
 * | Mode                | Description                                    |
 * |---------------------|------------------------------------------------|
 * | direct              | Single model, no validation                    |
 * | specialist          | Single model with specialist system prompt      |
 * | review              | Primary + validator from a different provider   |
 * | consensus           | Two independent generations, best-of selection  |
 * | retrieval_chain     | Retrieval-augmented generation pipeline         |
 * | agent_chain         | Multi-step agent planning pipeline              |
 * | multimodal_chain    | Creative / vision / multimodal pipeline         |
 * | premium_escalation  | Escalated to a premium-tier model               |
 */
export type RoutingMode =
  | 'direct'
  | 'specialist'
  | 'review'
  | 'consensus'
  | 'retrieval_chain'
  | 'agent_chain'
  | 'multimodal_chain'
  | 'premium_escalation'

/** Cost estimate for the routed model set. */
export type CostEstimate = 'very_low' | 'low' | 'medium' | 'high' | 'premium'

/** Latency estimate for the primary model. */
export type LatencyEstimate = 'ultra_low' | 'low' | 'medium' | 'high'

/**
 * The output of the routing engine – everything downstream needs to
 * execute a request against one or more models.
 */
export interface RoutingDecision {
  /** The execution pipeline to use. */
  mode: RoutingMode
  /** Best-fit model for the request. `null` only when no eligible model exists. */
  primaryModel: ModelEntry | null
  /** Validator / consensus partner (if the mode requires one). */
  secondaryModel: ModelEntry | null
  /** Ordered fallback list (first entry = highest-priority fallback). */
  fallbackModels: ModelEntry[]
  /** Human-readable explanation of why these models were chosen. */
  reason: string
  /** Non-fatal issues encountered during routing. */
  warnings: string[]
  /** Aggregate cost estimate based on the selected models. */
  costEstimate: CostEstimate
  /** Latency estimate based on the primary model. */
  latencyEstimate: LatencyEstimate
}

/**
 * All the information the routing engine needs from the caller.
 */
export interface RoutingContext {
  /** App identifier used to look up the profile (e.g. `'amarktai-crypto'`). */
  appSlug: string
  /** High-level category such as `'finance'`, `'creative'`, `'general'`. */
  appCategory: string
  /** Specific task type such as `'market_analysis'`, `'code_review'`. */
  taskType: string
  /** Assessed complexity of the current request. */
  taskComplexity: 'simple' | 'moderate' | 'complex'
  /** The raw user message (used for heuristic checks only). */
  message: string
  /** Whether the request requires retrieval-augmented generation. */
  requiresRetrieval: boolean
  /** Whether the request involves vision, image, or other multimodal IO. */
  requiresMultimodal: boolean
  /** Optional caller-supplied provider preference. */
  preferredProvider?: string
  /** Optional ceiling on model cost tier. */
  maxCostTier?: string
  /** Optional ceiling on model latency tier. */
  maxLatencyTier?: string
}

// ── Constants ───────────────────────────────────────────────────────────

/** Numeric ordering for cost tiers (lower = cheaper). */
const COST_TIER_ORDER: Record<string, number> = {
  free: 0,
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  premium: 5,
}

/** Numeric ordering for latency tiers (lower = faster). */
const LATENCY_TIER_ORDER: Record<string, number> = {
  ultra_low: 0,
  low: 1,
  medium: 2,
  high: 3,
}

/** Maps budget_sensitivity → maximum desirable cost tier value. */
const BUDGET_COST_CEILING: Record<string, number> = {
  high: COST_TIER_ORDER.low,      // budget-conscious → prefer low or cheaper
  medium: COST_TIER_ORDER.medium, // balanced → medium or cheaper
  low: COST_TIER_ORDER.premium,   // cost-insensitive → any tier
}

/** Maps latency_sensitivity → maximum desirable latency tier value. */
const LATENCY_CEILING: Record<string, number> = {
  high: LATENCY_TIER_ORDER.low,    // latency-sensitive → prefer low or faster
  medium: LATENCY_TIER_ORDER.medium,
  low: LATENCY_TIER_ORDER.high,    // latency-insensitive → any tier
}

// ── Helpers (internal) ──────────────────────────────────────────────────

/**
 * Filter the global enabled-model list down to models that the app
 * profile allows (by provider *and* by model id).
 */
function getEligibleModels(profile: AppProfile): ModelEntry[] {
  return getEnabledModels().filter(
    (m) => isProviderAllowed(profile, m.provider) && isModelAllowed(profile, m.model_id),
  )
}

/**
 * Sort models by app preference, then by cost tier (ascending).
 *
 * Models listed in the profile's `preferred_models` array appear first,
 * ordered by their position in that array. Remaining models are sorted
 * by cost tier so that budget-sensitive apps naturally gravitate toward
 * cheaper options.
 */
function sortByPreferenceAndCost(models: ModelEntry[], profile: AppProfile): ModelEntry[] {
  const preferredSet = new Map<string, number>()
  profile.preferred_models.forEach((id, idx) => preferredSet.set(id, idx))

  return [...models].sort((a, b) => {
    const aPref = preferredSet.get(a.model_id)
    const bPref = preferredSet.get(b.model_id)

    // Preferred models always come first, ordered by profile priority.
    if (aPref !== undefined && bPref !== undefined) return aPref - bPref
    if (aPref !== undefined) return -1
    if (bPref !== undefined) return 1

    // Non-preferred: cheaper first.
    return (COST_TIER_ORDER[a.cost_tier] ?? 3) - (COST_TIER_ORDER[b.cost_tier] ?? 3)
  })
}

/**
 * Returns `true` when a model's cost tier is within the allowed ceiling
 * given the profile's budget sensitivity and an optional caller override.
 */
function withinCostCeiling(model: ModelEntry, profile: AppProfile, maxCostTier?: string): boolean {
  const ceiling = maxCostTier
    ? (COST_TIER_ORDER[maxCostTier] ?? COST_TIER_ORDER.premium)
    : (BUDGET_COST_CEILING[profile.budget_sensitivity] ?? COST_TIER_ORDER.premium)
  return (COST_TIER_ORDER[model.cost_tier] ?? 3) <= ceiling
}

/**
 * Returns `true` when a model's latency tier is within the allowed
 * ceiling given the profile's latency sensitivity and a caller override.
 */
function withinLatencyCeiling(model: ModelEntry, profile: AppProfile, maxLatencyTier?: string): boolean {
  const ceiling = maxLatencyTier
    ? (LATENCY_TIER_ORDER[maxLatencyTier] ?? LATENCY_TIER_ORDER.high)
    : (LATENCY_CEILING[profile.latency_sensitivity] ?? LATENCY_TIER_ORDER.high)
  return (LATENCY_TIER_ORDER[model.latency_tier] ?? 2) <= ceiling
}

// ── Model selection ─────────────────────────────────────────────────────

/**
 * Select the best primary model for the given context.
 *
 * Selection strategy:
 *   1. Narrow to eligible, cost-appropriate, latency-appropriate models.
 *   2. If the caller specified a preferred provider, boost those first.
 *   3. Sort by app preference then cost.
 *   4. Return the top-ranked model or `null` if nothing is eligible.
 */
export function selectPrimaryModel(
  context: RoutingContext,
  profile: AppProfile,
  eligibleModels: ModelEntry[],
): ModelEntry | null {
  let candidates = eligibleModels
    .filter((m) => withinCostCeiling(m, profile, context.maxCostTier))
    .filter((m) => withinLatencyCeiling(m, profile, context.maxLatencyTier))

  // Apply preferred-provider boost by moving those to the front.
  if (context.preferredProvider) {
    const preferred = candidates.filter((m) => m.provider === context.preferredProvider)
    const rest = candidates.filter((m) => m.provider !== context.preferredProvider)
    candidates = [...preferred, ...rest]
  } else {
    candidates = sortByPreferenceAndCost(candidates, profile)
  }

  return candidates[0] ?? null
}

/**
 * Select a validator / consensus model from a **different** provider than
 * the primary model to ensure independence.
 *
 * Falls back to any validator-eligible model if no cross-provider
 * candidate exists.
 */
export function selectValidatorModel(
  context: RoutingContext,
  profile: AppProfile,
  eligibleModels: ModelEntry[],
  primaryProvider: string,
): ModelEntry | null {
  // First pass: cross-provider, validator-eligible, within budget.
  const crossProvider = eligibleModels
    .filter((m) => m.provider !== primaryProvider)
    .filter((m) => m.validator_eligible)
    .filter((m) => withinCostCeiling(m, profile, context.maxCostTier))

  const sorted = sortByPreferenceAndCost(crossProvider, profile)
  if (sorted.length > 0) return sorted[0]

  // Second pass: any validator-eligible model (even same provider).
  const sameProvider = eligibleModels
    .filter((m) => m.validator_eligible)
    .filter((m) => withinCostCeiling(m, profile, context.maxCostTier))

  const sortedFallback = sortByPreferenceAndCost(sameProvider, profile)
  return sortedFallback[0] ?? null
}

/**
 * Build an ordered fallback list excluding models from the given provider.
 *
 * The list is sorted by `fallback_priority` (ascending – 1 = first
 * choice) and capped at 3 entries to keep retry overhead bounded.
 */
export function buildFallbackList(
  context: RoutingContext,
  profile: AppProfile,
  eligibleModels: ModelEntry[],
  excludeProvider?: string,
): ModelEntry[] {
  const MAX_FALLBACKS = 3

  return eligibleModels
    .filter((m) => !excludeProvider || m.provider !== excludeProvider)
    .filter((m) => withinCostCeiling(m, profile, context.maxCostTier))
    .sort((a, b) => a.fallback_priority - b.fallback_priority)
    .slice(0, MAX_FALLBACKS)
}

/**
 * Derive a single cost estimate from the set of models that will be
 * invoked during execution.
 *
 * Returns the **highest** cost tier across all models (worst-case).
 */
export function estimateCost(models: ModelEntry[]): CostEstimate {
  if (models.length === 0) return 'low'

  const maxValue = Math.max(
    ...models.map((m) => COST_TIER_ORDER[m.cost_tier] ?? 0),
  )

  const tierByValue: Record<number, CostEstimate> = {
    0: 'very_low', // free → report as very_low
    1: 'very_low',
    2: 'low',
    3: 'medium',
    4: 'high',
    5: 'premium',
  }

  return tierByValue[maxValue] ?? 'medium'
}

/**
 * Map a model's latency tier to a routing-level latency estimate.
 */
export function estimateLatency(model: ModelEntry): LatencyEstimate {
  return model.latency_tier as LatencyEstimate
}

// ── Core routing function ───────────────────────────────────────────────

/**
 * Route an incoming request to one or more models based on the app
 * profile, model registry, and runtime context.
 *
 * This is the **single entry-point** that downstream code should call
 * instead of hand-rolling provider selection.
 *
 * @example
 * ```ts
 * const decision = routeRequest({
 *   appSlug: 'amarktai-crypto',
 *   appCategory: 'finance',
 *   taskType: 'market_analysis',
 *   taskComplexity: 'complex',
 *   message: 'Analyse BTC/USDT 4h chart',
 *   requiresRetrieval: true,
 *   requiresMultimodal: false,
 * })
 * ```
 */
export function routeRequest(context: RoutingContext): RoutingDecision {
  const warnings: string[] = []
  const profile = getAppProfile(context.appSlug)
  const eligible = getEligibleModels(profile)

  if (eligible.length === 0) {
    return {
      mode: 'direct',
      primaryModel: null,
      secondaryModel: null,
      fallbackModels: [],
      reason: `No eligible models found for app "${context.appSlug}". All models are either disabled or excluded by the app profile.`,
      warnings: ['No eligible models – request will fail without manual intervention.'],
      costEstimate: 'low',
      latencyEstimate: 'medium',
    }
  }

  // ── 1. Premium escalation ──────────────────────────────────────────
  const escalation = shouldEscalate(profile, context.taskComplexity, context.taskType)

  if (escalation) {
    const escalatedModel = getModelById(escalation.escalate_to_provider, escalation.escalate_to_model)
    if (escalatedModel && escalatedModel.enabled) {
      const fallbacks = buildFallbackList(context, profile, eligible, escalatedModel.provider)
      return {
        mode: 'premium_escalation',
        primaryModel: escalatedModel,
        secondaryModel: null,
        fallbackModels: fallbacks,
        reason: `Escalated to ${escalatedModel.model_name} (${escalatedModel.provider}) per app profile rule: complexity="${context.taskComplexity}", taskType="${context.taskType}".`,
        warnings,
        costEstimate: estimateCost([escalatedModel]),
        latencyEstimate: estimateLatency(escalatedModel),
      }
    }
    warnings.push(
      `Escalation rule matched (→ ${escalation.escalate_to_provider}/${escalation.escalate_to_model}) but target model is unavailable. Falling through to standard routing.`,
    )
  }

  // ── 2. Multimodal chain ────────────────────────────────────────────
  if (context.requiresMultimodal) {
    const multimodalCandidates = eligible.filter(
      (m) => m.supports_vision || m.supports_image_generation,
    )
    const sorted = sortByPreferenceAndCost(multimodalCandidates, profile)
    const primary = sorted[0] ?? selectPrimaryModel(context, profile, eligible)
    const fallbacks = buildFallbackList(context, profile, eligible, primary?.provider)

    if (multimodalCandidates.length === 0) {
      warnings.push('No multimodal-capable model found among eligible models; falling back to best available.')
    }

    return {
      mode: 'multimodal_chain',
      primaryModel: primary,
      secondaryModel: null,
      fallbackModels: fallbacks,
      reason: primary
        ? `Multimodal request routed to ${primary.model_name} (${primary.provider}) which supports vision/image capabilities.`
        : 'Multimodal request but no suitable model found.',
      warnings,
      costEstimate: estimateCost(primary ? [primary] : []),
      latencyEstimate: primary ? estimateLatency(primary) : 'medium',
    }
  }

  // ── 3. Retrieval chain ─────────────────────────────────────────────
  if (context.requiresRetrieval) {
    const primary = selectPrimaryModel(context, profile, eligible)
    const fallbacks = buildFallbackList(context, profile, eligible, primary?.provider)

    return {
      mode: 'retrieval_chain',
      primaryModel: primary,
      secondaryModel: null,
      fallbackModels: fallbacks,
      reason: primary
        ? `Retrieval-augmented generation via ${primary.model_name} (${primary.provider}).`
        : 'Retrieval chain requested but no eligible model found.',
      warnings,
      costEstimate: estimateCost(primary ? [primary] : []),
      latencyEstimate: primary ? estimateLatency(primary) : 'medium',
    }
  }

  // ── 4. Validation / review ─────────────────────────────────────────
  const validationRule = requiresValidation(profile, context.taskType, context.taskComplexity)

  if (validationRule) {
    const primary = selectPrimaryModel(context, profile, eligible)
    const validator = primary
      ? selectValidatorModel(context, profile, eligible, primary.provider)
      : null

    const involvedModels = [primary, validator].filter(Boolean) as ModelEntry[]
    const fallbacks = buildFallbackList(context, profile, eligible, primary?.provider)

    if (!validator) {
      warnings.push('Validation rule matched but no validator model available; proceeding with primary model only.')
    }

    return {
      mode: 'review',
      primaryModel: primary,
      secondaryModel: validator,
      fallbackModels: fallbacks,
      reason: primary && validator
        ? `Review mode: ${primary.model_name} generates, ${validator.model_name} validates (taskType="${context.taskType}", complexity="${context.taskComplexity}").`
        : `Review mode requested for taskType="${context.taskType}" but ${!primary ? 'no primary model' : 'no validator'} available.`,
      warnings,
      costEstimate: estimateCost(involvedModels),
      latencyEstimate: primary ? estimateLatency(primary) : 'medium',
    }
  }

  // ── 5. Consensus (complex + financial) ─────────────────────────────
  if (context.taskComplexity === 'complex' && isFinancialDomain(context)) {
    const primary = selectPrimaryModel(context, profile, eligible)
    const secondary = primary
      ? selectValidatorModel(context, profile, eligible, primary.provider)
      : null

    const involvedModels = [primary, secondary].filter(Boolean) as ModelEntry[]
    const fallbacks = buildFallbackList(context, profile, eligible, primary?.provider)

    return {
      mode: 'consensus',
      primaryModel: primary,
      secondaryModel: secondary,
      fallbackModels: fallbacks,
      reason: primary && secondary
        ? `Consensus mode for complex financial task: ${primary.model_name} and ${secondary.model_name} generate independently.`
        : `Consensus mode desired for complex financial task but only ${involvedModels.length} model(s) available.`,
      warnings,
      costEstimate: estimateCost(involvedModels),
      latencyEstimate: primary ? estimateLatency(primary) : 'medium',
    }
  }

  // ── 6. Complexity-based fallback ───────────────────────────────────
  const mode = complexityToMode(context.taskComplexity, profile)
  const primary = selectPrimaryModel(context, profile, eligible)
  const needsSecondary = mode === 'review' || mode === 'consensus'
  const secondary = needsSecondary && primary
    ? selectValidatorModel(context, profile, eligible, primary.provider)
    : null

  const involvedModels = [primary, secondary].filter(Boolean) as ModelEntry[]
  const fallbacks = buildFallbackList(context, profile, eligible, primary?.provider)

  if (needsSecondary && !secondary) {
    warnings.push(`Mode "${mode}" benefits from a secondary model but none was available.`)
  }

  return {
    mode,
    primaryModel: primary,
    secondaryModel: secondary,
    fallbackModels: fallbacks,
    reason: buildDefaultReason(mode, primary, secondary, context),
    warnings,
    costEstimate: estimateCost(involvedModels),
    latencyEstimate: primary ? estimateLatency(primary) : 'medium',
  }
}

// ── Internal routing helpers ────────────────────────────────────────────

/** Financial-domain keywords used for consensus-mode gating. */
const FINANCIAL_CATEGORIES = new Set([
  'finance',
  'trading',
  'crypto',
  'forex',
  'defi',
])

/**
 * Returns `true` when the context's app category or task type suggests a
 * financial domain where consensus routing is warranted.
 */
function isFinancialDomain(context: RoutingContext): boolean {
  const category = context.appCategory.toLowerCase()
  const task = context.taskType.toLowerCase()
  return (
    FINANCIAL_CATEGORIES.has(category) ||
    FINANCIAL_CATEGORIES.has(task) ||
    task.includes('trading') ||
    task.includes('financial')
  )
}

/**
 * Map task complexity to a default routing mode, optionally overridden
 * by the app profile's `default_routing_mode`.
 */
function complexityToMode(
  complexity: 'simple' | 'moderate' | 'complex',
  profile: AppProfile,
): RoutingMode {
  // If the profile specifies a non-direct default, respect it for
  // moderate+ complexity.
  if (complexity !== 'simple' && profile.default_routing_mode !== 'direct') {
    return profile.default_routing_mode as RoutingMode
  }

  switch (complexity) {
    case 'simple':
      return 'direct'
    case 'moderate':
      return 'specialist'
    case 'complex':
      return 'review'
  }
}

/**
 * Build a human-readable reason string for the default (non-escalated)
 * routing path.
 */
function buildDefaultReason(
  mode: RoutingMode,
  primary: ModelEntry | null,
  secondary: ModelEntry | null,
  context: RoutingContext,
): string {
  if (!primary) {
    return `No eligible model found for "${context.appSlug}" (complexity=${context.taskComplexity}).`
  }

  const base = `${mode} mode for ${context.taskComplexity} "${context.taskType}" task → ${primary.model_name} (${primary.provider})`

  if (secondary) {
    return `${base}, validated by ${secondary.model_name} (${secondary.provider}).`
  }

  return `${base}.`
}
