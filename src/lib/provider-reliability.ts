/**
 * Provider Reliability Layer — AmarktAI Network
 *
 * Rolling-window health scoring per provider with automatic downgrade
 * and recovery detection. Integrates with the circuit breaker and
 * routing engine to prefer stable providers.
 *
 * Each provider has:
 *   - Rolling 1h health score (0-100)
 *   - Failure rate tracking
 *   - Latency percentiles
 *   - Automatic state transitions: healthy → degraded → error → recovering → healthy
 *   - Historical trend persistence
 *
 * Server-side only.
 */

import { canRequest, recordSuccess, recordFailure, getCircuitStatus } from './circuit-breaker'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderHealthState = 'healthy' | 'degraded' | 'error' | 'recovering' | 'unknown'

export interface ProviderMetric {
  timestamp: number
  latencyMs: number
  success: boolean
  errorType?: string
}

export interface ProviderReliability {
  providerKey: string
  state: ProviderHealthState
  healthScore: number             // 0-100
  successRate: number             // 0-1
  avgLatencyMs: number
  p95LatencyMs: number
  requestCount: number
  failureCount: number
  lastSuccessAt: Date | null
  lastFailureAt: Date | null
  circuitState: string
  stateChangedAt: Date
}

// ── Configuration ────────────────────────────────────────────────────────────

const WINDOW_MS = 60 * 60 * 1000      // 1-hour rolling window
const MAX_METRICS_PER_PROVIDER = 500

const THRESHOLDS = {
  degradedSuccessRate: 0.85,           // Below 85% = degraded
  errorSuccessRate: 0.50,              // Below 50% = error
  recoverySuccessRate: 0.90,           // Above 90% in recovery = promote to healthy
  degradedLatencyMs: 8000,             // Over 8s avg = degraded
  minSamplesForDecision: 5,            // Need at least 5 samples
}

// ── In-Memory Metrics Store ──────────────────────────────────────────────────

const providerMetrics = new Map<string, ProviderMetric[]>()
const providerStates = new Map<string, { state: ProviderHealthState; changedAt: Date }>()

function getMetrics(providerKey: string): ProviderMetric[] {
  if (!providerMetrics.has(providerKey)) {
    providerMetrics.set(providerKey, [])
  }
  return providerMetrics.get(providerKey)!
}

function cleanOldMetrics(metrics: ProviderMetric[]): ProviderMetric[] {
  const cutoff = Date.now() - WINDOW_MS
  const filtered = metrics.filter(m => m.timestamp > cutoff)
  // Trim to max size
  if (filtered.length > MAX_METRICS_PER_PROVIDER) {
    return filtered.slice(filtered.length - MAX_METRICS_PER_PROVIDER)
  }
  return filtered
}

// ── Recording ────────────────────────────────────────────────────────────────

/**
 * Record a provider request outcome. Automatically triggers state evaluation.
 */
export function recordProviderMetric(
  providerKey: string,
  latencyMs: number,
  success: boolean,
  errorType?: string,
): void {
  const metrics = getMetrics(providerKey)

  metrics.push({
    timestamp: Date.now(),
    latencyMs,
    success,
    errorType,
  })

  // Clean old entries
  const cleaned = cleanOldMetrics(metrics)
  providerMetrics.set(providerKey, cleaned)

  // Update circuit breaker
  const circuitKey = `provider:${providerKey}`
  if (success) {
    recordSuccess(circuitKey)
  } else {
    recordFailure(circuitKey)
  }

  // Re-evaluate health state
  evaluateProviderState(providerKey)
}

// ── State Evaluation ─────────────────────────────────────────────────────────

function evaluateProviderState(providerKey: string): void {
  const metrics = cleanOldMetrics(getMetrics(providerKey))
  if (metrics.length < THRESHOLDS.minSamplesForDecision) return

  const successes = metrics.filter(m => m.success).length
  const successRate = successes / metrics.length
  const avgLatency = metrics.reduce((sum, m) => sum + m.latencyMs, 0) / metrics.length

  const currentEntry = providerStates.get(providerKey) ?? {
    state: 'unknown' as ProviderHealthState,
    changedAt: new Date(),
  }
  const currentState = currentEntry.state

  let newState: ProviderHealthState = currentState

  if (successRate < THRESHOLDS.errorSuccessRate) {
    newState = 'error'
  } else if (successRate < THRESHOLDS.degradedSuccessRate || avgLatency > THRESHOLDS.degradedLatencyMs) {
    newState = currentState === 'error' ? 'recovering' : 'degraded'
  } else if (successRate >= THRESHOLDS.recoverySuccessRate) {
    newState = 'healthy'
  } else if (currentState === 'recovering' && successRate >= THRESHOLDS.recoverySuccessRate) {
    newState = 'healthy'
  }

  if (newState !== currentState) {
    providerStates.set(providerKey, { state: newState, changedAt: new Date() })
    console.log(`[provider-reliability] ${providerKey}: ${currentState} → ${newState} (rate=${(successRate * 100).toFixed(1)}%, latency=${avgLatency.toFixed(0)}ms)`)
  }
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Get full reliability report for a single provider.
 */
export function getProviderReliability(providerKey: string): ProviderReliability {
  const metrics = cleanOldMetrics(getMetrics(providerKey))
  const stateEntry = providerStates.get(providerKey) ?? {
    state: 'unknown' as ProviderHealthState,
    changedAt: new Date(),
  }

  if (metrics.length === 0) {
    return {
      providerKey,
      state: stateEntry.state,
      healthScore: stateEntry.state === 'unknown' ? 50 : 0,
      successRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      requestCount: 0,
      failureCount: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      circuitState: getCircuitStatus(`provider:${providerKey}`).state,
      stateChangedAt: stateEntry.changedAt,
    }
  }

  const successes = metrics.filter(m => m.success)
  const failures = metrics.filter(m => !m.success)
  const successRate = successes.length / metrics.length

  const latencies = metrics.map(m => m.latencyMs).sort((a, b) => a - b)
  const avgLatencyMs = latencies.reduce((s, l) => s + l, 0) / latencies.length
  const p95Index = Math.floor(latencies.length * 0.95)
  const p95LatencyMs = latencies[p95Index] ?? 0

  // Health score formula: success rate (60%) + latency quality (30%) + circuit (10%)
  const latencyScore = Math.max(0, 100 - (avgLatencyMs / 100))
  const circuitBonus = canRequest(`provider:${providerKey}`) ? 10 : 0
  const healthScore = Math.round(
    Math.min(100, successRate * 60 + Math.min(30, latencyScore * 0.3) + circuitBonus),
  )

  const lastSuccess = successes.length > 0
    ? new Date(Math.max(...successes.map(m => m.timestamp)))
    : null
  const lastFailure = failures.length > 0
    ? new Date(Math.max(...failures.map(m => m.timestamp)))
    : null

  return {
    providerKey,
    state: stateEntry.state,
    healthScore,
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    requestCount: metrics.length,
    failureCount: failures.length,
    lastSuccessAt: lastSuccess,
    lastFailureAt: lastFailure,
    circuitState: getCircuitStatus(`provider:${providerKey}`).state,
    stateChangedAt: stateEntry.changedAt,
  }
}

/**
 * Get reliability reports for all tracked providers.
 */
export function getAllProviderReliability(): ProviderReliability[] {
  const allKeys = new Set([...providerMetrics.keys(), ...providerStates.keys()])
  return Array.from(allKeys).map(getProviderReliability)
}

/**
 * Get ranked providers (highest health score first) — used by routing engine.
 */
export function getProviderRanking(): Array<{ providerKey: string; healthScore: number; state: ProviderHealthState }> {
  return getAllProviderReliability()
    .map(r => ({ providerKey: r.providerKey, healthScore: r.healthScore, state: r.state }))
    .sort((a, b) => b.healthScore - a.healthScore)
}

/**
 * Check if a provider is usable (not in error/open circuit state).
 */
export function isProviderReliable(providerKey: string): boolean {
  const reliability = getProviderReliability(providerKey)
  return reliability.state !== 'error' && canRequest(`provider:${providerKey}`)
}
