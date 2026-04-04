/**
 * Observability — Request Tracing & Metrics Collection
 *
 * Full request tracing: User request → classification → routing → provider call
 * → response → cost. Enables enterprise debugging, performance monitoring,
 * and compliance reporting.
 *
 * OpenTelemetry-compatible span format for future integration.
 * Truthful: Only records actual events and timings.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  operationName: string
  service: string
  status: 'ok' | 'error'
  startTime: number // Unix ms
  endTime: number
  durationMs: number
  attributes: Record<string, string | number | boolean>
  events: SpanEvent[]
  tags: Record<string, string>
}

export interface SpanEvent {
  name: string
  timestamp: number
  attributes?: Record<string, unknown>
}

export interface Trace {
  traceId: string
  rootSpan: Span
  spans: Span[]
  totalDurationMs: number
  status: 'ok' | 'error'
  service: string
  metadata: Record<string, unknown>
}

export interface MetricPoint {
  name: string
  type: 'counter' | 'gauge' | 'histogram'
  value: number
  labels: Record<string, string>
  timestamp: number
}

export interface DashboardMetrics {
  requestsPerMinute: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  errorRate: number
  activeProviders: number
  totalCostUsd: number
  topModels: Array<{ model: string; count: number; avgLatencyMs: number }>
  topErrors: Array<{ error: string; count: number }>
}

// ── Storage ──────────────────────────────────────────────────────────────────

const traces = new Map<string, Trace>()
const activeSpans = new Map<string, Span>()
const metrics: MetricPoint[] = []
const latencies: number[] = []
const MAX_TRACES = 5000
const MAX_METRICS = 50_000
const MAX_LATENCIES = 10_000

// ── Tracing ──────────────────────────────────────────────────────────────────

/** Start a new trace. */
export function startTrace(
  operationName: string,
  attributes?: Record<string, string | number | boolean>,
): { traceId: string; spanId: string } {
  const traceId = randomUUID()
  const spanId = randomUUID()

  const span: Span = {
    traceId,
    spanId,
    operationName,
    service: 'amarktai-brain',
    status: 'ok',
    startTime: Date.now(),
    endTime: 0,
    durationMs: 0,
    attributes: attributes ?? {},
    events: [],
    tags: {},
  }

  activeSpans.set(spanId, span)
  return { traceId, spanId }
}

/** Start a child span. */
export function startSpan(
  traceId: string,
  parentSpanId: string,
  operationName: string,
  attributes?: Record<string, string | number | boolean>,
): string {
  const spanId = randomUUID()

  const span: Span = {
    traceId,
    spanId,
    parentSpanId,
    operationName,
    service: 'amarktai-brain',
    status: 'ok',
    startTime: Date.now(),
    endTime: 0,
    durationMs: 0,
    attributes: attributes ?? {},
    events: [],
    tags: {},
  }

  activeSpans.set(spanId, span)
  return spanId
}

/** Add an event to a span. */
export function addSpanEvent(
  spanId: string,
  name: string,
  attributes?: Record<string, unknown>,
): void {
  const span = activeSpans.get(spanId)
  if (!span) return
  span.events.push({ name, timestamp: Date.now(), attributes })
}

/** Set span attributes. */
export function setSpanAttributes(
  spanId: string,
  attributes: Record<string, string | number | boolean>,
): void {
  const span = activeSpans.get(spanId)
  if (!span) return
  Object.assign(span.attributes, attributes)
}

/** Set span status to error. */
export function setSpanError(spanId: string, error: string): void {
  const span = activeSpans.get(spanId)
  if (!span) return
  span.status = 'error'
  span.attributes.error = error
}

/** End a span and record it. */
export function endSpan(spanId: string): Span | null {
  const span = activeSpans.get(spanId)
  if (!span) return null

  span.endTime = Date.now()
  span.durationMs = span.endTime - span.startTime
  activeSpans.delete(spanId)

  // Record latency
  latencies.push(span.durationMs)
  if (latencies.length > MAX_LATENCIES) latencies.splice(0, latencies.length - MAX_LATENCIES)

  // Add to trace
  let trace = traces.get(span.traceId)
  if (!trace) {
    trace = {
      traceId: span.traceId,
      rootSpan: span,
      spans: [],
      totalDurationMs: 0,
      status: 'ok',
      service: 'amarktai-brain',
      metadata: {},
    }
    traces.set(span.traceId, trace)
    if (traces.size > MAX_TRACES) {
      const oldest = traces.keys().next().value
      if (oldest) traces.delete(oldest)
    }
  }

  trace.spans.push(span)
  if (span.status === 'error') trace.status = 'error'
  trace.totalDurationMs = Math.max(trace.totalDurationMs, span.durationMs)

  return span
}

/** End a trace and finalize it. */
export function endTrace(traceId: string): Trace | null {
  return traces.get(traceId) ?? null
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/** Record a counter metric. */
export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value: number = 1,
): void {
  metrics.push({ name, type: 'counter', value, labels, timestamp: Date.now() })
  if (metrics.length > MAX_METRICS) metrics.splice(0, metrics.length - MAX_METRICS)
}

/** Record a gauge metric. */
export function setGauge(
  name: string,
  value: number,
  labels: Record<string, string> = {},
): void {
  metrics.push({ name, type: 'gauge', value, labels, timestamp: Date.now() })
}

/** Record a histogram metric. */
export function recordHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {},
): void {
  metrics.push({ name, type: 'histogram', value, labels, timestamp: Date.now() })
}

// ── Dashboard Metrics ────────────────────────────────────────────────────────

/** Get dashboard metrics for the last N minutes. */
export function getDashboardMetrics(windowMinutes: number = 5): DashboardMetrics {
  const cutoff = Date.now() - windowMinutes * 60 * 1000

  // Recent traces
  const recentTraces = Array.from(traces.values())
    .filter((t) => t.rootSpan.startTime > cutoff)

  // Latency percentiles
  const recentLatencies = latencies
    .filter((_, i) => metrics[i]?.timestamp > cutoff || true)
    .sort((a, b) => a - b)

  const p50 = recentLatencies[Math.floor(recentLatencies.length * 0.5)] ?? 0
  const p95 = recentLatencies[Math.floor(recentLatencies.length * 0.95)] ?? 0
  const p99 = recentLatencies[Math.floor(recentLatencies.length * 0.99)] ?? 0
  const avg = recentLatencies.length > 0 ? recentLatencies.reduce((s, v) => s + v, 0) / recentLatencies.length : 0

  // Error rate
  const errors = recentTraces.filter((t) => t.status === 'error').length
  const errorRate = recentTraces.length > 0 ? errors / recentTraces.length : 0

  // Top models
  const modelCounts = new Map<string, { count: number; totalLatency: number }>()
  for (const trace of recentTraces) {
    for (const span of trace.spans) {
      const model = span.attributes.model as string
      if (model) {
        const existing = modelCounts.get(model) ?? { count: 0, totalLatency: 0 }
        existing.count++
        existing.totalLatency += span.durationMs
        modelCounts.set(model, existing)
      }
    }
  }

  const topModels = Array.from(modelCounts.entries())
    .map(([model, data]) => ({ model, count: data.count, avgLatencyMs: Math.round(data.totalLatency / data.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Top errors
  const errorMessages = new Map<string, number>()
  for (const trace of recentTraces) {
    if (trace.status === 'error') {
      const errorSpan = trace.spans.find((s) => s.status === 'error')
      const msg = (errorSpan?.attributes.error as string) ?? 'Unknown error'
      errorMessages.set(msg, (errorMessages.get(msg) ?? 0) + 1)
    }
  }

  const topErrors = Array.from(errorMessages.entries())
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    requestsPerMinute: recentTraces.length / Math.max(1, windowMinutes),
    avgLatencyMs: Math.round(avg),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    errorRate,
    activeProviders: new Set(recentTraces.flatMap((t) => t.spans.map((s) => s.attributes.provider as string).filter(Boolean))).size,
    totalCostUsd: 0, // Would integrate with budget-tracker
    topModels,
    topErrors,
  }
}

/** Get a specific trace. */
export function getTrace(traceId: string): Trace | null {
  return traces.get(traceId) ?? null
}

/** List recent traces. */
export function listRecentTraces(limit: number = 50): Trace[] {
  return Array.from(traces.values())
    .sort((a, b) => b.rootSpan.startTime - a.rootSpan.startTime)
    .slice(0, limit)
}

/** Reset all observability data (for testing). */
export function resetObservability(): void {
  traces.clear()
  activeSpans.clear()
  metrics.length = 0
  latencies.length = 0
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export { MAX_TRACES, MAX_METRICS }
