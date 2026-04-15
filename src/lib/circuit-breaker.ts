/**
 * Circuit Breaker + Retry System — AmarktAI Network
 *
 * Implements the circuit breaker pattern for provider calls with:
 *   - Exponential backoff with jitter
 *   - Provider-specific circuit breakers
 *   - Dead-letter queue visibility
 *   - Automatic recovery detection
 *
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 *
 * Server-side only.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number
  /** How long (ms) to wait before attempting recovery */
  resetTimeoutMs: number
  /** Number of successes needed in HALF_OPEN to close again */
  successThreshold: number
  /** Rolling window (ms) for failure counting */
  windowMs: number
}

export interface CircuitBreakerStatus {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
  openedAt: Date | null
  halfOpenAt: Date | null
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Base delay in ms */
  baseDelayMs: number
  /** Maximum delay in ms (cap for exponential growth) */
  maxDelayMs: number
  /** Jitter factor (0-1). 0.25 = ±25% jitter */
  jitterFactor: number
  /** Whether to use exponential backoff */
  exponential: boolean
}

// ── Default Configs ──────────────────────────────────────────────────────────

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,    // 30 seconds
  successThreshold: 2,
  windowMs: 60_000,          // 1 minute window
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitterFactor: 0.25,
  exponential: true,
}

// ── Circuit Breaker Registry ─────────────────────────────────────────────────

interface CircuitEntry {
  config: CircuitBreakerConfig
  state: CircuitState
  failures: number[]    // Timestamps of recent failures
  successCount: number  // Consecutive successes in HALF_OPEN
  openedAt: Date | null
  halfOpenAt: Date | null
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
}

const circuits = new Map<string, CircuitEntry>()

function getCircuit(key: string, config?: Partial<CircuitBreakerConfig>): CircuitEntry {
  if (!circuits.has(key)) {
    circuits.set(key, {
      config: { ...DEFAULT_CIRCUIT_CONFIG, ...config },
      state: 'CLOSED',
      failures: [],
      successCount: 0,
      openedAt: null,
      halfOpenAt: null,
      lastFailureAt: null,
      lastSuccessAt: null,
    })
  }
  return circuits.get(key)!
}

// ── Circuit Breaker Operations ───────────────────────────────────────────────

/**
 * Check if a circuit allows traffic (CLOSED or HALF_OPEN after timeout).
 */
export function canRequest(key: string, config?: Partial<CircuitBreakerConfig>): boolean {
  const circuit = getCircuit(key, config)

  if (circuit.state === 'CLOSED') return true

  if (circuit.state === 'OPEN') {
    // Check if enough time has passed to try recovery
    const elapsed = Date.now() - (circuit.openedAt?.getTime() ?? 0)
    if (elapsed >= circuit.config.resetTimeoutMs) {
      circuit.state = 'HALF_OPEN'
      circuit.halfOpenAt = new Date()
      circuit.successCount = 0
      return true
    }
    return false
  }

  // HALF_OPEN: allow limited traffic
  return true
}

/**
 * Record a successful request.
 */
export function recordSuccess(key: string): void {
  const circuit = getCircuit(key)

  circuit.lastSuccessAt = new Date()

  if (circuit.state === 'HALF_OPEN') {
    circuit.successCount++
    if (circuit.successCount >= circuit.config.successThreshold) {
      circuit.state = 'CLOSED'
      circuit.failures = []
      circuit.openedAt = null
      circuit.halfOpenAt = null
    }
  }
}

/**
 * Record a failed request.
 */
export function recordFailure(key: string): void {
  const circuit = getCircuit(key)
  const now = Date.now()

  circuit.lastFailureAt = new Date()

  if (circuit.state === 'HALF_OPEN') {
    // Failure in half-open → reopen
    circuit.state = 'OPEN'
    circuit.openedAt = new Date()
    circuit.successCount = 0
    return
  }

  // Remove old failures outside window
  circuit.failures = circuit.failures.filter(
    t => now - t < circuit.config.windowMs,
  )
  circuit.failures.push(now)

  if (circuit.failures.length >= circuit.config.failureThreshold) {
    circuit.state = 'OPEN'
    circuit.openedAt = new Date()
  }
}

/**
 * Get the status of a specific circuit breaker.
 */
export function getCircuitStatus(key: string): CircuitBreakerStatus {
  const circuit = getCircuit(key)
  return {
    state: circuit.state,
    failureCount: circuit.failures.length,
    successCount: circuit.successCount,
    lastFailureAt: circuit.lastFailureAt,
    lastSuccessAt: circuit.lastSuccessAt,
    openedAt: circuit.openedAt,
    halfOpenAt: circuit.halfOpenAt,
  }
}

/**
 * Get all circuit breaker statuses (for dashboard).
 */
export function getAllCircuitStatuses(): Record<string, CircuitBreakerStatus> {
  const statuses: Record<string, CircuitBreakerStatus> = {}
  for (const [key] of circuits) {
    statuses[key] = getCircuitStatus(key)
  }
  return statuses
}

/**
 * Force reset a circuit breaker to CLOSED state.
 */
export function resetCircuit(key: string): void {
  const circuit = getCircuit(key)
  circuit.state = 'CLOSED'
  circuit.failures = []
  circuit.successCount = 0
  circuit.openedAt = null
  circuit.halfOpenAt = null
}

// ── Retry with Backoff ───────────────────────────────────────────────────────

/**
 * Calculate delay for a given retry attempt using exponential backoff with jitter.
 */
export function calculateBackoff(attempt: number, config?: Partial<RetryConfig>): number {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config }

  const baseDelay = cfg.exponential
    ? cfg.baseDelayMs * Math.pow(2, attempt)
    : cfg.baseDelayMs

  // Cap at maxDelay
  const cappedDelay = Math.min(baseDelay, cfg.maxDelayMs)

  // Apply jitter: ±jitterFactor
  const jitterRange = cappedDelay * cfg.jitterFactor
  const jitter = (Math.random() * 2 - 1) * jitterRange

  return Math.max(0, Math.round(cappedDelay + jitter))
}

/**
 * Execute a function with retry logic and circuit breaker integration.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    circuitKey?: string
    retry?: Partial<RetryConfig>
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
  },
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...opts?.retry }
  const circuitKey = opts?.circuitKey

  // Check circuit breaker first
  if (circuitKey && !canRequest(circuitKey)) {
    throw new Error(`Circuit breaker OPEN for ${circuitKey}. Service unavailable.`)
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const result = await fn()

      // Record success with circuit breaker
      if (circuitKey) recordSuccess(circuitKey)

      return result
    } catch (error) {
      lastError = error

      // Record failure with circuit breaker
      if (circuitKey) recordFailure(circuitKey)

      // Don't retry if out of attempts
      if (attempt >= retryConfig.maxRetries) break

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, retryConfig)
      opts?.onRetry?.(attempt + 1, error, delay)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))

      // Re-check circuit breaker before next attempt
      if (circuitKey && !canRequest(circuitKey)) {
        throw new Error(`Circuit breaker OPEN for ${circuitKey} after retry ${attempt + 1}`)
      }
    }
  }

  throw lastError
}

// ── Dead Letter Queue (in-memory for Phase 3; Redis-backed later) ────────────

export interface DeadLetterEntry {
  id: string
  jobType: string
  payload: Record<string, unknown>
  error: string
  failedAt: Date
  attempts: number
  appSlug?: string
}

const deadLetterQueue: DeadLetterEntry[] = []

/**
 * Add a permanently failed job to the dead letter queue.
 */
export function addToDeadLetterQueue(entry: Omit<DeadLetterEntry, 'id'>): void {
  deadLetterQueue.push({
    ...entry,
    id: `dlq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  })

  // Keep last 1000 entries
  if (deadLetterQueue.length > 1000) {
    deadLetterQueue.splice(0, deadLetterQueue.length - 1000)
  }
}

/**
 * Get dead letter queue entries.
 */
export function getDeadLetterQueue(limit?: number): DeadLetterEntry[] {
  const entries = [...deadLetterQueue].reverse()
  return limit ? entries.slice(0, limit) : entries
}

/**
 * Clear the dead letter queue.
 */
export function clearDeadLetterQueue(): number {
  const count = deadLetterQueue.length
  deadLetterQueue.length = 0
  return count
}

/**
 * Get dead letter queue size.
 */
export function getDeadLetterQueueSize(): number {
  return deadLetterQueue.length
}
