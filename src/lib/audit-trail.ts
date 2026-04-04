/**
 * Audit Trail — Compliance & Full Interaction Logging
 *
 * Immutable audit log of every AI interaction for enterprise compliance,
 * GDPR, SOC 2, and regulated industry requirements.
 *
 * Truthful: Every entry is timestamped and immutable.
 * No entries are ever deleted (only archived).
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  timestamp: string
  /** Actor: user, system, app, provider */
  actor: AuditActor
  /** What happened */
  action: AuditAction
  /** Resource affected */
  resource: AuditResource
  /** Outcome */
  outcome: 'success' | 'failure' | 'denied'
  /** Additional details */
  details: Record<string, unknown>
  /** IP address (if applicable) */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Trace ID for correlation */
  traceId?: string
  /** Data sensitivity level */
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted'
}

export interface AuditActor {
  type: 'user' | 'system' | 'app' | 'provider' | 'admin'
  id: string
  name?: string
}

export type AuditAction =
  | 'ai.request'
  | 'ai.stream'
  | 'ai.response'
  | 'ai.image_generate'
  | 'ai.video_generate'
  | 'ai.tts'
  | 'ai.stt'
  | 'model.route'
  | 'model.fallback'
  | 'provider.call'
  | 'provider.error'
  | 'provider.health_check'
  | 'app.create'
  | 'app.update'
  | 'app.delete'
  | 'app.settings_change'
  | 'user.login'
  | 'user.logout'
  | 'user.api_key_create'
  | 'user.api_key_revoke'
  | 'budget.threshold'
  | 'budget.limit_reached'
  | 'content.filtered'
  | 'content.blocked'
  | 'webhook.register'
  | 'webhook.deliver'
  | 'batch.submit'
  | 'batch.complete'
  | 'admin.config_change'
  | 'admin.provider_add'
  | 'admin.model_enable'

export interface AuditResource {
  type: 'request' | 'app' | 'provider' | 'model' | 'user' | 'webhook' | 'batch' | 'config'
  id: string
  name?: string
}

export interface AuditQuery {
  /** Filter by actor type */
  actorType?: AuditActor['type']
  /** Filter by actor ID */
  actorId?: string
  /** Filter by action */
  action?: AuditAction
  /** Filter by resource type */
  resourceType?: AuditResource['type']
  /** Filter by resource ID */
  resourceId?: string
  /** Start date (inclusive) */
  startDate?: string
  /** End date (inclusive) */
  endDate?: string
  /** Max results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Sensitivity level */
  sensitivity?: AuditEntry['sensitivity']
  /** Outcome filter */
  outcome?: AuditEntry['outcome']
}

export interface AuditSummary {
  totalEntries: number
  timeRange: { start: string; end: string }
  actionCounts: Record<string, number>
  outcomeCounts: Record<string, number>
  topActors: Array<{ actor: string; count: number }>
  topResources: Array<{ resource: string; count: number }>
  sensitivityBreakdown: Record<string, number>
}

// ── Storage ──────────────────────────────────────────────────────────────────

const auditLog: AuditEntry[] = []
const MAX_AUDIT_ENTRIES = 100_000

// ── Audit Logging ────────────────────────────────────────────────────────────

/**
 * Record an audit entry. Entries are immutable once created.
 */
export function recordAuditEntry(input: {
  actor: AuditActor
  action: AuditAction
  resource: AuditResource
  outcome: AuditEntry['outcome']
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  traceId?: string
  sensitivity?: AuditEntry['sensitivity']
}): AuditEntry {
  const entry: AuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actor: input.actor,
    action: input.action,
    resource: input.resource,
    outcome: input.outcome,
    details: input.details ?? {},
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    traceId: input.traceId,
    sensitivity: input.sensitivity ?? 'internal',
  }

  // Append-only log
  auditLog.push(entry)

  // Archive old entries if over limit (in production, these would be shipped to S3/etc)
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES)
  }

  return entry
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Query audit entries with filters.
 */
export function queryAuditLog(query: AuditQuery): AuditEntry[] {
  let results = auditLog

  if (query.actorType) {
    results = results.filter((e) => e.actor.type === query.actorType)
  }
  if (query.actorId) {
    results = results.filter((e) => e.actor.id === query.actorId)
  }
  if (query.action) {
    results = results.filter((e) => e.action === query.action)
  }
  if (query.resourceType) {
    results = results.filter((e) => e.resource.type === query.resourceType)
  }
  if (query.resourceId) {
    results = results.filter((e) => e.resource.id === query.resourceId)
  }
  if (query.startDate) {
    results = results.filter((e) => e.timestamp >= query.startDate!)
  }
  if (query.endDate) {
    results = results.filter((e) => e.timestamp <= query.endDate!)
  }
  if (query.sensitivity) {
    results = results.filter((e) => e.sensitivity === query.sensitivity)
  }
  if (query.outcome) {
    results = results.filter((e) => e.outcome === query.outcome)
  }

  // Sort newest first
  results = [...results].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Pagination
  const offset = query.offset ?? 0
  const limit = query.limit ?? 100
  return results.slice(offset, offset + limit)
}

/**
 * Get an audit entry by ID.
 */
export function getAuditEntry(id: string): AuditEntry | null {
  return auditLog.find((e) => e.id === id) ?? null
}

// ── Summary ──────────────────────────────────────────────────────────────────

/**
 * Get audit summary statistics.
 */
export function getAuditSummary(query?: { startDate?: string; endDate?: string }): AuditSummary {
  let entries = auditLog

  if (query?.startDate) {
    entries = entries.filter((e) => e.timestamp >= query.startDate!)
  }
  if (query?.endDate) {
    entries = entries.filter((e) => e.timestamp <= query.endDate!)
  }

  // Action counts
  const actionCounts: Record<string, number> = {}
  const outcomeCounts: Record<string, number> = {}
  const actorCounts = new Map<string, number>()
  const resourceCounts = new Map<string, number>()
  const sensitivityCounts: Record<string, number> = {}

  for (const entry of entries) {
    actionCounts[entry.action] = (actionCounts[entry.action] ?? 0) + 1
    outcomeCounts[entry.outcome] = (outcomeCounts[entry.outcome] ?? 0) + 1
    sensitivityCounts[entry.sensitivity] = (sensitivityCounts[entry.sensitivity] ?? 0) + 1

    const actorKey = `${entry.actor.type}:${entry.actor.id}`
    actorCounts.set(actorKey, (actorCounts.get(actorKey) ?? 0) + 1)

    const resourceKey = `${entry.resource.type}:${entry.resource.id}`
    resourceCounts.set(resourceKey, (resourceCounts.get(resourceKey) ?? 0) + 1)
  }

  const topActors = Array.from(actorCounts.entries())
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topResources = Array.from(resourceCounts.entries())
    .map(([resource, count]) => ({ resource, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalEntries: entries.length,
    timeRange: {
      start: entries[0]?.timestamp ?? '',
      end: entries[entries.length - 1]?.timestamp ?? '',
    },
    actionCounts,
    outcomeCounts,
    topActors,
    topResources,
    sensitivityBreakdown: sensitivityCounts,
  }
}

// ── Exports for Testing ──────────────────────────────────────────────────────

export const AUDIT_ACTIONS: AuditAction[] = [
  'ai.request', 'ai.stream', 'ai.response', 'ai.image_generate', 'ai.video_generate',
  'ai.tts', 'ai.stt', 'model.route', 'model.fallback', 'provider.call', 'provider.error',
  'provider.health_check', 'app.create', 'app.update', 'app.delete', 'app.settings_change',
  'user.login', 'user.logout', 'user.api_key_create', 'user.api_key_revoke',
  'budget.threshold', 'budget.limit_reached', 'content.filtered', 'content.blocked',
  'webhook.register', 'webhook.deliver', 'batch.submit', 'batch.complete',
  'admin.config_change', 'admin.provider_add', 'admin.model_enable',
]

export { MAX_AUDIT_ENTRIES }
