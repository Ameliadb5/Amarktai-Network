/**
 * Moderation Pipeline — Per-Request Audit Trail, Output Scanning & Fallback Moderation
 *
 * Provides a unified moderation layer that:
 *   1. Records a per-request audit trail entry for every content scan
 *   2. Scans both input AND output with the full moderation stack
 *   3. Falls back through multiple moderation strategies:
 *      a. OpenAI Moderation API (primary, ML-based)
 *      b. Keyword scanner (secondary, zero-latency)
 *      c. Guardrails engine checks (tertiary, PII/toxicity/bias)
 *
 * Every scan — pass or fail — is recorded to the audit trail with:
 *   - trace ID, app slug, actor, timestamp
 *   - scanner used, categories flagged, confidence
 *   - whether the request was blocked or allowed
 *
 * This module is the single integration point called from Brain routes.
 * It composes content-filter.ts, guardrails.ts, and audit-trail.ts.
 */

import {
  scanContent,
  scanContentWithModeration,
  buildModerationAlert,
  getAppSafetyConfig,
  type ContentFilterResult,
  type ModerationAlert,
} from './content-filter'

import {
  runGuardrails,
  type GuardrailResult,
  type GuardrailPolicy,
  DEFAULT_POLICY,
} from './guardrails'

import {
  recordAuditEntry,
  type AuditEntry,
} from './audit-trail'

// ── Types ────────────────────────────────────────────────────────────────────

export type ScanDirection = 'input' | 'output'

export interface ModerationScanResult {
  /** Whether the content was blocked. */
  blocked: boolean
  /** Content filter result (OpenAI Moderation or keyword). */
  contentFilter: ContentFilterResult
  /** Guardrails result (PII, toxicity, bias, etc.). */
  guardrails: GuardrailResult | null
  /** Moderation alert (for logging / webhook delivery). */
  alert: ModerationAlert | null
  /** Audit trail entry ID. */
  auditEntryId: string
  /** Which scanners were attempted. */
  scannersUsed: string[]
  /** Total moderation latency in milliseconds. */
  latencyMs: number
}

export interface ModerationContext {
  /** Unique trace ID for the request. */
  traceId: string
  /** App slug (for per-app safety config). */
  appSlug: string
  /** Actor performing the request. */
  actorId: string
  /** Actor type. */
  actorType: 'user' | 'system' | 'app'
  /** IP address (if available). */
  ipAddress?: string
  /** User agent (if available). */
  userAgent?: string
  /** Optional guardrail policy override. */
  guardrailPolicy?: GuardrailPolicy
}

// ── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full moderation pipeline on a piece of text.
 *
 * Execution order:
 *   1. OpenAI Moderation API (async, ML-based) — primary
 *   2. If OpenAI unavailable → keyword scanner (sync, zero-latency) — fallback
 *   3. Guardrails engine (PII, toxicity, bias checks) — always runs
 *   4. Record audit trail entry for the scan
 *
 * Returns a unified result with all scan outcomes and audit entry ID.
 */
export async function runModerationPipeline(
  text: string,
  direction: ScanDirection,
  context: ModerationContext,
): Promise<ModerationScanResult> {
  const start = Date.now()
  const scannersUsed: string[] = []

  // ── Step 1: Content filter (OpenAI Moderation → keyword fallback) ────
  let contentFilter: ContentFilterResult
  try {
    contentFilter = await scanContentWithModeration(text, context.appSlug)
    scannersUsed.push(contentFilter.scanner)
  } catch {
    // OpenAI Moderation failed — use keyword scanner
    contentFilter = scanContent(text, context.appSlug)
    scannersUsed.push('keyword_fallback')
  }

  // ── Step 2: Guardrails engine (PII, toxicity, bias) ──────────────────
  let guardrails: GuardrailResult | null = null
  try {
    const policy = context.guardrailPolicy ?? DEFAULT_POLICY
    guardrails = await runGuardrails(text, policy)
    scannersUsed.push('guardrails')
  } catch {
    // Guardrails engine failed — continue without it
  }

  // ── Step 3: Determine if content should be blocked ───────────────────
  // When suggestiveMode is enabled for this app (output direction only),
  // guardrail toxicity failures do NOT block — the app has opted into
  // allowing suggestive language. ALWAYS_BLOCKED categories are still enforced
  // via the content filter (contentFilter.flagged checks ALWAYS_BLOCKED only).
  const appSafety = context.appSlug ? getAppSafetyConfig(context.appSlug) : null
  const suggestiveModeActive =
    direction === 'output' &&
    appSafety != null &&
    !appSafety.safeMode &&
    appSafety.suggestiveMode

  const blocked =
    contentFilter.flagged ||
    (!suggestiveModeActive &&
      guardrails !== null &&
      !guardrails.passed &&
      guardrails.metadata.criticalFailures > 0)

  // ── Step 4: Build moderation alert ───────────────────────────────────
  const alert = blocked
    ? buildModerationAlert(context.traceId, context.appSlug, contentFilter, text)
    : null

  // ── Step 5: Record audit trail entry ─────────────────────────────────
  const auditEntry = recordModerationAudit({
    context,
    direction,
    blocked,
    contentFilter,
    guardrails,
    scannersUsed,
    latencyMs: Date.now() - start,
  })

  return {
    blocked,
    contentFilter,
    guardrails,
    alert,
    auditEntryId: auditEntry.id,
    scannersUsed,
    latencyMs: Date.now() - start,
  }
}

/**
 * Run a fast synchronous scan (keyword-only, no async API calls).
 * Used for pre-auth input scanning where latency is critical.
 */
export function runFastModerationScan(
  text: string,
  direction: ScanDirection,
  context: ModerationContext,
): ModerationScanResult {
  const start = Date.now()

  const contentFilter = scanContent(text, context.appSlug)
  const blocked = contentFilter.flagged

  const alert = blocked
    ? buildModerationAlert(context.traceId, context.appSlug, contentFilter, text)
    : null

  const auditEntry = recordModerationAudit({
    context,
    direction,
    blocked,
    contentFilter,
    guardrails: null,
    scannersUsed: ['keyword_fallback'],
    latencyMs: Date.now() - start,
  })

  return {
    blocked,
    contentFilter,
    guardrails: null,
    alert,
    auditEntryId: auditEntry.id,
    scannersUsed: ['keyword_fallback'],
    latencyMs: Date.now() - start,
  }
}

// ── Audit Trail Recording ────────────────────────────────────────────────────

function recordModerationAudit(opts: {
  context: ModerationContext
  direction: ScanDirection
  blocked: boolean
  contentFilter: ContentFilterResult
  guardrails: GuardrailResult | null
  scannersUsed: string[]
  latencyMs: number
}): AuditEntry {
  const { context, direction, blocked, contentFilter, guardrails, scannersUsed, latencyMs } = opts

  return recordAuditEntry({
    actor: {
      type: context.actorType,
      id: context.actorId,
      name: context.appSlug,
    },
    action: blocked ? 'content.blocked' : 'content.filtered',
    resource: {
      type: 'request',
      id: context.traceId,
      name: `${direction}_scan`,
    },
    outcome: blocked ? 'denied' : 'success',
    details: {
      direction,
      scanner: contentFilter.scanner,
      scannersUsed,
      flagged: contentFilter.flagged,
      categories: contentFilter.categories,
      confidence: contentFilter.confidence,
      guardrailsPassed: guardrails?.passed ?? null,
      guardrailsChecksRun: guardrails?.metadata.checksRun ?? 0,
      guardrailsCriticalFailures: guardrails?.metadata.criticalFailures ?? 0,
      guardrailsBlockedCategories: guardrails?.blockedCategories ?? [],
      latencyMs,
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    traceId: context.traceId,
    sensitivity: blocked ? 'restricted' : 'internal',
  })
}
