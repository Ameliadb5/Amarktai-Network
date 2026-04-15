/**
 * Global Error Handler — AmarktAI Network
 *
 * Central error management with categorization, structured logging,
 * recovery strategy mapping, and UI-safe error surfaces.
 *
 * Error categories:
 *   - PROVIDER_ERROR:   external AI provider failures
 *   - ROUTING_ERROR:    model/provider selection failures
 *   - EXECUTION_ERROR:  job/task execution failures
 *   - VALIDATION_ERROR: request/data validation failures
 *   - INFRA_ERROR:      infrastructure (DB, Redis, storage) failures
 *   - AUTH_ERROR:       authentication/authorization failures
 *   - BUDGET_ERROR:     budget/limit exceeded
 *   - UNKNOWN_ERROR:    unclassified errors
 *
 * Server-side only.
 */

import { createAlert } from '@/lib/alert-engine'

// ── Error Categories ─────────────────────────────────────────────────────────

export type ErrorCategory =
  | 'PROVIDER_ERROR'
  | 'ROUTING_ERROR'
  | 'EXECUTION_ERROR'
  | 'VALIDATION_ERROR'
  | 'INFRA_ERROR'
  | 'AUTH_ERROR'
  | 'BUDGET_ERROR'
  | 'UNKNOWN_ERROR'

export type RecoveryStrategy =
  | 'retry'          // Retry the operation
  | 'fallback'       // Use fallback provider/model
  | 'skip'           // Skip and continue
  | 'alert_operator' // Alert human operator
  | 'circuit_break'  // Stop requests to failing resource
  | 'degrade'        // Degrade service gracefully
  | 'none'           // No recovery possible

export interface StructuredError {
  id: string
  category: ErrorCategory
  code: string
  message: string
  userMessage: string            // Safe message for UI display
  details: Record<string, unknown>
  recovery: RecoveryStrategy
  retryable: boolean
  timestamp: Date
  source: string                  // Module that originated the error
  appSlug?: string
  provider?: string
  traceId?: string
}

// ── Error Classification ─────────────────────────────────────────────────────

const PROVIDER_ERROR_PATTERNS = [
  /api.?key/i, /unauthorized/i, /forbidden/i, /rate.?limit/i,
  /quota.?exceeded/i, /model.?not.?found/i, /timeout/i,
  /openai/i, /anthropic/i, /groq/i, /gemini/i, /grok/i,
  /500\s+internal/i, /502\s+bad/i, /503\s+service/i, /504\s+gateway/i,
]

const INFRA_ERROR_PATTERNS = [
  /ECONNREFUSED/i, /ENOTFOUND/i, /database/i, /prisma/i,
  /redis/i, /connection.*reset/i, /ENOMEM/i, /disk.?full/i,
  /storage/i, /qdrant/i,
]

const VALIDATION_PATTERNS = [
  /validation/i, /invalid/i, /required/i, /missing/i,
  /schema/i, /parse/i, /format/i, /malformed/i,
]

const AUTH_PATTERNS = [
  /auth/i, /session/i, /token.*expired/i, /not.*logged/i,
  /permission/i, /access.*denied/i,
]

const BUDGET_PATTERNS = [
  /budget/i, /limit.*exceeded/i, /quota/i, /paused/i,
  /cap.*reached/i,
]

/**
 * Classify an error into a structured category with recovery strategy.
 */
export function classifyError(
  error: unknown,
  context?: {
    source?: string
    appSlug?: string
    provider?: string
    traceId?: string
  },
): StructuredError {
  const err = error instanceof Error ? error : new Error(String(error))
  const msg = err.message || 'Unknown error'

  // Determine category
  let category: ErrorCategory = 'UNKNOWN_ERROR'
  let recovery: RecoveryStrategy = 'alert_operator'
  let retryable = false
  let userMessage = 'An unexpected error occurred. Please try again.'

  if (matchesPatterns(msg, PROVIDER_ERROR_PATTERNS)) {
    category = 'PROVIDER_ERROR'
    recovery = msg.match(/timeout|rate.?limit/i) ? 'retry' : 'fallback'
    retryable = true
    userMessage = 'The AI provider encountered an issue. Retrying with an alternative.'
  } else if (matchesPatterns(msg, INFRA_ERROR_PATTERNS)) {
    category = 'INFRA_ERROR'
    recovery = msg.match(/redis/i) ? 'degrade' : 'alert_operator'
    retryable = msg.match(/ECONNREFUSED|timeout/i) !== null
    userMessage = 'A system component is temporarily unavailable. We\'re working on it.'
  } else if (matchesPatterns(msg, VALIDATION_PATTERNS)) {
    category = 'VALIDATION_ERROR'
    recovery = 'none'
    retryable = false
    userMessage = 'The request contains invalid data. Please check your input.'
  } else if (matchesPatterns(msg, AUTH_PATTERNS)) {
    category = 'AUTH_ERROR'
    recovery = 'none'
    retryable = false
    userMessage = 'Authentication failed. Please log in again.'
  } else if (matchesPatterns(msg, BUDGET_PATTERNS)) {
    category = 'BUDGET_ERROR'
    recovery = 'alert_operator'
    retryable = false
    userMessage = 'Usage limit has been reached. Contact your administrator.'
  } else if (context?.source?.includes('route') || context?.source?.includes('routing')) {
    category = 'ROUTING_ERROR'
    recovery = 'fallback'
    retryable = true
    userMessage = 'Unable to find a suitable model. Trying alternatives.'
  } else if (context?.source?.includes('job') || context?.source?.includes('worker') || context?.source?.includes('queue')) {
    category = 'EXECUTION_ERROR'
    recovery = 'retry'
    retryable = true
    userMessage = 'Task execution failed. It will be retried automatically.'
  }

  return {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category,
    code: `${category}/${context?.source ?? 'unknown'}`,
    message: msg,
    userMessage,
    details: {
      stack: err.stack?.split('\n').slice(0, 5),
      name: err.name,
    },
    recovery,
    retryable,
    timestamp: new Date(),
    source: context?.source ?? 'unknown',
    appSlug: context?.appSlug,
    provider: context?.provider,
    traceId: context?.traceId,
  }
}

// ── Error Handling ───────────────────────────────────────────────────────────

/**
 * Handle an error: classify, log, alert if needed, return structured error.
 */
export async function handleError(
  error: unknown,
  context?: {
    source?: string
    appSlug?: string
    provider?: string
    traceId?: string
  },
): Promise<StructuredError> {
  const structured = classifyError(error, context)

  // Always log to console
  const logLevel = structured.category === 'VALIDATION_ERROR' ? 'warn' : 'error'
  console[logLevel](`[ErrorHandler] [${structured.category}] ${structured.message}`, {
    id: structured.id,
    source: structured.source,
    recovery: structured.recovery,
    appSlug: structured.appSlug,
  })

  // Create alert for critical errors
  if (structured.category === 'PROVIDER_ERROR' || structured.category === 'INFRA_ERROR') {
    try {
      await createAlert({
        alertType: structured.category === 'PROVIDER_ERROR' ? 'provider_failure' : 'routing_failure',
        severity: structured.category === 'INFRA_ERROR' ? 'critical' : 'warning',
        title: `${structured.category}: ${structured.source}`,
        message: structured.message,
        appSlug: structured.appSlug,
        metadata: {
          errorId: structured.id,
          provider: structured.provider,
          recovery: structured.recovery,
        },
      })
    } catch {
      // Alert creation is best-effort
    }
  }

  return structured
}

/**
 * Create a safe error response for API routes.
 */
export function errorResponse(
  structured: StructuredError,
  statusCode?: number,
): { status: number; body: Record<string, unknown> } {
  const status = statusCode ?? getStatusCode(structured.category)

  return {
    status,
    body: {
      error: true,
      message: structured.userMessage,
      code: structured.code,
      errorId: structured.id,
      retryable: structured.retryable,
      recovery: structured.recovery,
    },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchesPatterns(msg: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(msg))
}

function getStatusCode(category: ErrorCategory): number {
  switch (category) {
    case 'VALIDATION_ERROR': return 400
    case 'AUTH_ERROR': return 401
    case 'BUDGET_ERROR': return 429
    case 'PROVIDER_ERROR': return 502
    case 'ROUTING_ERROR': return 503
    case 'INFRA_ERROR': return 503
    case 'EXECUTION_ERROR': return 500
    default: return 500
  }
}

/**
 * Error category display names for dashboard.
 */
export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  PROVIDER_ERROR: 'Provider Error',
  ROUTING_ERROR: 'Routing Error',
  EXECUTION_ERROR: 'Execution Error',
  VALIDATION_ERROR: 'Validation Error',
  INFRA_ERROR: 'Infrastructure Error',
  AUTH_ERROR: 'Authentication Error',
  BUDGET_ERROR: 'Budget/Limit Error',
  UNKNOWN_ERROR: 'Unknown Error',
}
