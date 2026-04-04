/**
 * Prompt Studio — Template Management, Versioning & A/B Testing
 *
 * Manages prompt templates with versioning, variable injection, and
 * performance tracking. Enables teams to iterate on prompts scientifically
 * with A/B testing and comparison metrics.
 *
 * Truthful: Performance data comes from actual BrainEvent metrics.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string
  name: string
  description: string
  appSlug: string
  /** Template with {{variable}} placeholders */
  template: string
  /** System prompt to prepend */
  systemPrompt?: string
  /** Variable definitions */
  variables: PromptVariable[]
  /** Version tracking */
  version: number
  parentVersion?: number
  /** Metadata */
  tags: string[]
  category: 'chat' | 'coding' | 'creative' | 'analysis' | 'agent' | 'custom'
  createdAt: string
  updatedAt: string
  /** Performance metrics */
  metrics: PromptMetrics
  /** Whether this is the active/deployed version */
  isActive: boolean
}

export interface PromptVariable {
  name: string
  description: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  required: boolean
  defaultValue?: string
  enumValues?: string[]
}

export interface PromptMetrics {
  totalUses: number
  avgLatencyMs: number
  avgConfidence: number
  successRate: number
  avgTokens: number
  userRating: number // 0-5 stars
  costUsd: number
}

export interface PromptVersion {
  version: number
  template: string
  systemPrompt?: string
  createdAt: string
  metrics: PromptMetrics
}

export interface ABTest {
  id: string
  name: string
  appSlug: string
  status: 'draft' | 'running' | 'completed' | 'cancelled'
  variants: ABVariant[]
  trafficSplit: number[] // Percentage per variant (must sum to 100)
  startedAt?: string
  completedAt?: string
  winnerVariantId?: string
  totalSamples: number
  minSamples: number // Minimum samples before declaring winner
}

export interface ABVariant {
  id: string
  name: string
  templateId: string
  version: number
  /** Override model for this variant */
  model?: string
  /** Override temperature */
  temperature?: number
  metrics: PromptMetrics
  sampleCount: number
}

export interface ABResult {
  testId: string
  winner?: ABVariant
  confidence: number // Statistical confidence (0-1)
  improvement: number // % improvement over control
  recommendation: string
}

// ── In-Memory Store ──────────────────────────────────────────────────────────

const templates = new Map<string, PromptTemplate>()
const versions = new Map<string, PromptVersion[]>() // templateId → versions
const abTests = new Map<string, ABTest>()

// ── Template Management ──────────────────────────────────────────────────────

/** Create a new prompt template. */
export function createTemplate(input: {
  name: string
  description: string
  appSlug: string
  template: string
  systemPrompt?: string
  variables?: PromptVariable[]
  tags?: string[]
  category?: PromptTemplate['category']
}): PromptTemplate {
  const id = randomUUID()
  const now = new Date().toISOString()
  const template: PromptTemplate = {
    id,
    name: input.name,
    description: input.description,
    appSlug: input.appSlug,
    template: input.template,
    systemPrompt: input.systemPrompt,
    variables: input.variables ?? [],
    version: 1,
    tags: input.tags ?? [],
    category: input.category ?? 'custom',
    createdAt: now,
    updatedAt: now,
    metrics: emptyMetrics(),
    isActive: true,
  }

  templates.set(id, template)
  versions.set(id, [{ version: 1, template: input.template, systemPrompt: input.systemPrompt, createdAt: now, metrics: emptyMetrics() }])
  return template
}

/** Update a template (creates new version). */
export function updateTemplate(
  id: string,
  updates: { template?: string; systemPrompt?: string; variables?: PromptVariable[]; tags?: string[] },
): PromptTemplate | null {
  const existing = templates.get(id)
  if (!existing) return null

  const newVersion = existing.version + 1
  const now = new Date().toISOString()

  const updated: PromptTemplate = {
    ...existing,
    ...(updates.template ? { template: updates.template } : {}),
    ...(updates.systemPrompt !== undefined ? { systemPrompt: updates.systemPrompt } : {}),
    ...(updates.variables ? { variables: updates.variables } : {}),
    ...(updates.tags ? { tags: updates.tags } : {}),
    version: newVersion,
    parentVersion: existing.version,
    updatedAt: now,
    metrics: emptyMetrics(),
  }

  templates.set(id, updated)

  // Track version history
  const versionHistory = versions.get(id) ?? []
  versionHistory.push({
    version: newVersion,
    template: updated.template,
    systemPrompt: updated.systemPrompt,
    createdAt: now,
    metrics: emptyMetrics(),
  })
  versions.set(id, versionHistory)

  return updated
}

/** Get a template by ID. */
export function getTemplate(id: string): PromptTemplate | null {
  return templates.get(id) ?? null
}

/** List templates for an app. */
export function listTemplates(appSlug: string): PromptTemplate[] {
  return Array.from(templates.values()).filter((t) => t.appSlug === appSlug)
}

/** Get version history for a template. */
export function getVersionHistory(templateId: string): PromptVersion[] {
  return versions.get(templateId) ?? []
}

/** Delete a template. */
export function deleteTemplate(id: string): boolean {
  versions.delete(id)
  return templates.delete(id)
}

// ── Template Rendering ───────────────────────────────────────────────────────

/**
 * Render a template by substituting variables.
 * Variables are {{variableName}} placeholders.
 */
export function renderTemplate(
  templateId: string,
  variables: Record<string, string | number | boolean>,
): { rendered: string; systemPrompt?: string } | null {
  const template = templates.get(templateId)
  if (!template) return null

  let rendered = template.template
  for (const v of template.variables) {
    const value = variables[v.name] ?? v.defaultValue ?? ''
    rendered = rendered.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), String(value))
  }

  // Check for unresolved variables
  const unresolved = rendered.match(/\{\{[^}]+\}\}/g)
  if (unresolved) {
    // Replace unresolved with empty string
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '')
  }

  return { rendered: rendered.trim(), systemPrompt: template.systemPrompt }
}

// ── A/B Testing ──────────────────────────────────────────────────────────────

/** Create a new A/B test. */
export function createABTest(input: {
  name: string
  appSlug: string
  variants: Array<{ name: string; templateId: string; version?: number; model?: string; temperature?: number }>
  trafficSplit?: number[]
  minSamples?: number
}): ABTest {
  const variantCount = input.variants.length
  const defaultSplit = Array(variantCount).fill(Math.floor(100 / variantCount))
  // Adjust rounding
  const totalDefault = defaultSplit.reduce((s: number, v: number) => s + v, 0)
  if (totalDefault < 100) defaultSplit[0] += 100 - totalDefault

  const test: ABTest = {
    id: randomUUID(),
    name: input.name,
    appSlug: input.appSlug,
    status: 'draft',
    variants: input.variants.map((v) => ({
      id: randomUUID(),
      name: v.name,
      templateId: v.templateId,
      version: v.version ?? 1,
      model: v.model,
      temperature: v.temperature,
      metrics: emptyMetrics(),
      sampleCount: 0,
    })),
    trafficSplit: input.trafficSplit ?? defaultSplit,
    totalSamples: 0,
    minSamples: input.minSamples ?? 100,
  }

  abTests.set(test.id, test)
  return test
}

/** Start an A/B test. */
export function startABTest(testId: string): boolean {
  const test = abTests.get(testId)
  if (!test || test.status !== 'draft') return false
  test.status = 'running'
  test.startedAt = new Date().toISOString()
  return true
}

/** Select which variant to use for a request (weighted random). */
export function selectVariant(testId: string): ABVariant | null {
  const test = abTests.get(testId)
  if (!test || test.status !== 'running') return null

  const rand = Math.random() * 100
  let cumulative = 0
  for (let i = 0; i < test.variants.length; i++) {
    cumulative += test.trafficSplit[i]
    if (rand < cumulative) return test.variants[i]
  }
  return test.variants[test.variants.length - 1]
}

/** Record a result for an A/B test variant. */
export function recordABResult(
  testId: string,
  variantId: string,
  metrics: { latencyMs: number; confidence: number; success: boolean; tokens?: number },
): void {
  const test = abTests.get(testId)
  if (!test) return

  const variant = test.variants.find((v) => v.id === variantId)
  if (!variant) return

  variant.sampleCount++
  test.totalSamples++

  // Update running averages
  const n = variant.sampleCount
  variant.metrics.totalUses = n
  variant.metrics.avgLatencyMs = variant.metrics.avgLatencyMs + (metrics.latencyMs - variant.metrics.avgLatencyMs) / n
  variant.metrics.avgConfidence = variant.metrics.avgConfidence + (metrics.confidence - variant.metrics.avgConfidence) / n
  variant.metrics.successRate = variant.metrics.successRate + ((metrics.success ? 1 : 0) - variant.metrics.successRate) / n
  if (metrics.tokens) {
    variant.metrics.avgTokens = variant.metrics.avgTokens + (metrics.tokens - variant.metrics.avgTokens) / n
  }
}

/** Get A/B test results with statistical analysis. */
export function getABResults(testId: string): ABResult | null {
  const test = abTests.get(testId)
  if (!test) return null

  if (test.totalSamples < test.minSamples) {
    return {
      testId,
      confidence: 0,
      improvement: 0,
      recommendation: `Need ${test.minSamples - test.totalSamples} more samples before statistical significance`,
    }
  }

  // Find best variant by composite score
  const scored = test.variants.map((v) => ({
    variant: v,
    score: v.metrics.successRate * 0.4 + v.metrics.avgConfidence * 0.3 + (1 - v.metrics.avgLatencyMs / 10000) * 0.3,
  }))
  scored.sort((a, b) => b.score - a.score)

  const winner = scored[0]
  const runnerUp = scored[1]
  const improvement = runnerUp ? ((winner.score - runnerUp.score) / runnerUp.score) * 100 : 0

  // Simplified confidence calculation (would use proper statistical test in production)
  const sampleFactor = Math.min(1, test.totalSamples / (test.minSamples * 2))
  const marginFactor = Math.min(1, Math.abs(improvement) / 10)
  const confidence = sampleFactor * marginFactor

  return {
    testId,
    winner: winner.variant,
    confidence,
    improvement,
    recommendation: confidence > 0.8
      ? `Variant "${winner.variant.name}" is the clear winner with ${improvement.toFixed(1)}% improvement`
      : confidence > 0.5
        ? `Variant "${winner.variant.name}" shows promise but needs more data`
        : 'No statistically significant difference found yet',
  }
}

/** Get an A/B test by ID. */
export function getABTest(testId: string): ABTest | null {
  return abTests.get(testId) ?? null
}

/** List A/B tests for an app. */
export function listABTests(appSlug: string): ABTest[] {
  return Array.from(abTests.values()).filter((t) => t.appSlug === appSlug)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyMetrics(): PromptMetrics {
  return { totalUses: 0, avgLatencyMs: 0, avgConfidence: 0, successRate: 0, avgTokens: 0, userRating: 0, costUsd: 0 }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const TEMPLATE_CATEGORIES = ['chat', 'coding', 'creative', 'analysis', 'agent', 'custom'] as const
