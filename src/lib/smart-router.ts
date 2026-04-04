/**
 * Smart Router — Self-Optimizing ML-Based Model Selection
 *
 * Uses historical performance data from the learning engine to train a
 * routing classifier that automatically picks the best model for each
 * task type. The system gets smarter over time as more data is collected.
 *
 * Truthful: Only uses real BrainEvent data for scoring.
 * Falls back to static routing when insufficient data.
 */

import { getModelRegistry, getEnabledModels, type ModelEntry } from './model-registry'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelScore {
  modelId: string
  provider: string
  compositeScore: number
  factors: {
    successRate: number
    avgLatencyMs: number
    avgConfidence: number
    costEfficiency: number
    recentTrend: 'improving' | 'stable' | 'declining'
  }
  sampleSize: number
  lastUpdated: string
}

export interface RoutingDecision {
  selectedModel: ModelEntry
  reason: string
  confidence: number
  alternativeModels: Array<{ model: ModelEntry; score: number }>
  usedSmartRouting: boolean
  dataPointsUsed: number
}

export interface PerformanceRecord {
  modelId: string
  provider: string
  taskType: string
  success: boolean
  latencyMs: number
  confidence: number
  costEstimate: number
  timestamp: number
}

export interface RoutingProfile {
  taskType: string
  preferredModels: string[]
  avoidModels: string[]
  maxLatencyMs: number
  minConfidence: number
}

// ── Score Storage ────────────────────────────────────────────────────────────

// Model scores by taskType → modelId
const modelScores = new Map<string, Map<string, ModelScore>>()
const performanceHistory: PerformanceRecord[] = []
const MAX_HISTORY = 10_000
const MIN_SAMPLES_FOR_SMART_ROUTING = 10

// Custom routing profiles
const routingProfiles = new Map<string, RoutingProfile>()

// ── Performance Recording ────────────────────────────────────────────────────

/** Record a model's performance for a task. */
export function recordPerformance(record: PerformanceRecord): void {
  performanceHistory.push(record)
  if (performanceHistory.length > MAX_HISTORY) {
    performanceHistory.splice(0, performanceHistory.length - MAX_HISTORY)
  }

  // Update model scores
  updateModelScore(record.taskType, record)
}

function updateModelScore(taskType: string, record: PerformanceRecord): void {
  if (!modelScores.has(taskType)) {
    modelScores.set(taskType, new Map())
  }
  const taskScores = modelScores.get(taskType)!

  const existing = taskScores.get(record.modelId)
  if (!existing) {
    taskScores.set(record.modelId, {
      modelId: record.modelId,
      provider: record.provider,
      compositeScore: record.success ? 0.7 : 0.3,
      factors: {
        successRate: record.success ? 1.0 : 0.0,
        avgLatencyMs: record.latencyMs,
        avgConfidence: record.confidence,
        costEfficiency: 1.0 / Math.max(0.0001, record.costEstimate),
        recentTrend: 'stable',
      },
      sampleSize: 1,
      lastUpdated: new Date().toISOString(),
    })
    return
  }

  // Update running averages using exponential moving average
  const alpha = 0.1 // Learning rate
  const n = existing.sampleSize + 1
  const newSuccessRate = existing.factors.successRate + alpha * ((record.success ? 1 : 0) - existing.factors.successRate)
  const newLatency = existing.factors.avgLatencyMs + alpha * (record.latencyMs - existing.factors.avgLatencyMs)
  const newConfidence = existing.factors.avgConfidence + alpha * (record.confidence - existing.factors.avgConfidence)
  const newCostEff = existing.factors.costEfficiency + alpha * ((1.0 / Math.max(0.0001, record.costEstimate)) - existing.factors.costEfficiency)

  // Detect trend
  const oldScore = existing.compositeScore
  const newComposite = computeCompositeScore(newSuccessRate, newLatency, newConfidence, newCostEff)
  const trend: 'improving' | 'stable' | 'declining' =
    newComposite > oldScore + 0.05 ? 'improving' :
    newComposite < oldScore - 0.05 ? 'declining' : 'stable'

  taskScores.set(record.modelId, {
    modelId: record.modelId,
    provider: record.provider,
    compositeScore: newComposite,
    factors: {
      successRate: newSuccessRate,
      avgLatencyMs: newLatency,
      avgConfidence: newConfidence,
      costEfficiency: newCostEff,
      recentTrend: trend,
    },
    sampleSize: n,
    lastUpdated: new Date().toISOString(),
  })
}

function computeCompositeScore(
  successRate: number,
  latencyMs: number,
  confidence: number,
  costEfficiency: number,
): number {
  // Weighted combination — success and confidence matter most
  const latencyScore = Math.max(0, 1 - latencyMs / 30000) // 30s = 0 score
  const normalizedCost = Math.min(1, costEfficiency / 100) // Normalize
  return (
    successRate * 0.35 +
    confidence * 0.30 +
    latencyScore * 0.20 +
    normalizedCost * 0.15
  )
}

// ── Smart Routing ────────────────────────────────────────────────────────────

/**
 * Select the best model for a task using learned performance data.
 * Falls back to static routing when insufficient data.
 */
export function selectBestModel(
  taskType: string,
  candidates: ModelEntry[],
  constraints?: {
    maxLatencyMs?: number
    minConfidence?: number
    preferProvider?: string
    avoidProviders?: string[]
  },
): RoutingDecision {
  if (candidates.length === 0) {
    return {
      selectedModel: getEnabledModels()[0] ?? getModelRegistry()[0],
      reason: 'No candidates available — using first enabled model',
      confidence: 0.1,
      alternativeModels: [],
      usedSmartRouting: false,
      dataPointsUsed: 0,
    }
  }

  // Check custom routing profile
  const profile = routingProfiles.get(taskType)
  const taskScores = modelScores.get(taskType)

  // If we have enough data, use smart routing
  if (taskScores && taskScores.size >= 2) {
    const scored = candidates
      .map((model) => {
        const score = taskScores.get(model.model_id)
        if (!score || score.sampleSize < MIN_SAMPLES_FOR_SMART_ROUTING) {
          // Not enough data — give neutral score
          return { model, score: 0.5, dataPoints: score?.sampleSize ?? 0 }
        }

        let adjustedScore = score.compositeScore

        // Apply constraints
        if (constraints?.maxLatencyMs && score.factors.avgLatencyMs > constraints.maxLatencyMs) {
          adjustedScore *= 0.5 // Penalize slow models
        }
        if (constraints?.minConfidence && score.factors.avgConfidence < constraints.minConfidence) {
          adjustedScore *= 0.7
        }
        if (constraints?.preferProvider && model.provider === constraints.preferProvider) {
          adjustedScore *= 1.1
        }
        if (constraints?.avoidProviders?.includes(model.provider)) {
          adjustedScore *= 0.3
        }

        // Apply routing profile preferences
        if (profile) {
          if (profile.preferredModels.includes(model.model_id)) adjustedScore *= 1.2
          if (profile.avoidModels.includes(model.model_id)) adjustedScore *= 0.2
        }

        // Boost trending models
        if (score.factors.recentTrend === 'improving') adjustedScore *= 1.05
        if (score.factors.recentTrend === 'declining') adjustedScore *= 0.95

        return { model, score: Math.min(1, adjustedScore), dataPoints: score.sampleSize }
      })
      .sort((a, b) => b.score - a.score)

    const totalDataPoints = scored.reduce((sum, s) => sum + s.dataPoints, 0)

    return {
      selectedModel: scored[0].model,
      reason: `Smart routing selected ${scored[0].model.model_id} (score: ${scored[0].score.toFixed(3)})`,
      confidence: scored[0].score,
      alternativeModels: scored.slice(1, 4).map((s) => ({ model: s.model, score: s.score })),
      usedSmartRouting: true,
      dataPointsUsed: totalDataPoints,
    }
  }

  // Fall back to static routing (by fallback_priority)
  const sorted = [...candidates].sort((a, b) => (a.fallback_priority ?? 99) - (b.fallback_priority ?? 99))
  return {
    selectedModel: sorted[0],
    reason: 'Insufficient data for smart routing — using priority-based selection',
    confidence: 0.5,
    alternativeModels: sorted.slice(1, 4).map((m) => ({ model: m, score: 0.5 })),
    usedSmartRouting: false,
    dataPointsUsed: 0,
  }
}

// ── Profile Management ───────────────────────────────────────────────────────

/** Set a custom routing profile for a task type. */
export function setRoutingProfile(profile: RoutingProfile): void {
  routingProfiles.set(profile.taskType, profile)
}

/** Get a routing profile for a task type. */
export function getRoutingProfile(taskType: string): RoutingProfile | null {
  return routingProfiles.get(taskType) ?? null
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** Get model scores for a task type. */
export function getModelScores(taskType: string): ModelScore[] {
  const scores = modelScores.get(taskType)
  if (!scores) return []
  return Array.from(scores.values()).sort((a, b) => b.compositeScore - a.compositeScore)
}

/** Get all task types with routing data. */
export function getTrackedTaskTypes(): string[] {
  return Array.from(modelScores.keys())
}

/** Get performance history summary. */
export function getPerformanceSummary(): {
  totalRecords: number
  taskTypes: number
  modelsTracked: number
  avgCompositeScore: number
} {
  const allModels = new Set<string>()
  let totalScore = 0
  let scoreCount = 0
  for (const taskScores of modelScores.values()) {
    for (const score of taskScores.values()) {
      allModels.add(score.modelId)
      totalScore += score.compositeScore
      scoreCount++
    }
  }
  return {
    totalRecords: performanceHistory.length,
    taskTypes: modelScores.size,
    modelsTracked: allModels.size,
    avgCompositeScore: scoreCount > 0 ? totalScore / scoreCount : 0,
  }
}

/** Reset all learned data (for testing). */
export function resetSmartRouter(): void {
  modelScores.clear()
  performanceHistory.length = 0
  routingProfiles.clear()
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export { MIN_SAMPLES_FOR_SMART_ROUTING, MAX_HISTORY, computeCompositeScore }
