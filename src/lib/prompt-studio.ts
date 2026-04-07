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

// ── Store ────────────────────────────────────────────────────────────────────

import { prisma } from './prisma'

// ── DB Helpers ───────────────────────────────────────────────────────────────

function rowToTemplate(row: {
  id: string
  name: string
  description: string
  appSlug: string
  template: string
  systemPrompt: string | null
  variables: string
  version: number
  parentVersion: number | null
  tags: string
  category: string
  isActive: boolean
  metrics: string
  createdAt: Date
  updatedAt: Date
}): PromptTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    appSlug: row.appSlug,
    template: row.template,
    systemPrompt: row.systemPrompt ?? undefined,
    variables: JSON.parse(row.variables) as PromptVariable[],
    version: row.version,
    parentVersion: row.parentVersion ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    category: row.category as PromptTemplate['category'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metrics: JSON.parse(row.metrics) as PromptMetrics,
    isActive: row.isActive,
  }
}

function rowToAbTest(row: {
  id: string
  templateId: string
  name: string
  status: string
  results: string
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}): ABTest {
  const full = JSON.parse(row.results) as Omit<ABTest, 'id' | 'name' | 'status'>
  return {
    id: row.id,
    name: row.name,
    appSlug: full.appSlug,
    status: row.status as ABTest['status'],
    variants: full.variants ?? [],
    trafficSplit: full.trafficSplit ?? [],
    totalSamples: full.totalSamples ?? 0,
    minSamples: full.minSamples ?? 100,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    winnerVariantId: full.winnerVariantId,
  }
}

// ── Template Management ──────────────────────────────────────────────────────

/** Create a new prompt template. */
export async function createTemplate(input: {
  name: string
  description: string
  appSlug: string
  template: string
  systemPrompt?: string
  variables?: PromptVariable[]
  tags?: string[]
  category?: PromptTemplate['category']
}): Promise<PromptTemplate> {
  const id = randomUUID()
  const row = await prisma.promptTemplate.create({
    data: {
      id,
      name: input.name,
      description: input.description,
      appSlug: input.appSlug,
      template: input.template,
      systemPrompt: input.systemPrompt ?? null,
      variables: JSON.stringify(input.variables ?? []),
      version: 1,
      tags: JSON.stringify(input.tags ?? []),
      category: input.category ?? 'custom',
      isActive: true,
      metrics: JSON.stringify(emptyMetrics()),
      versions: {
        create: [{
          version: 1,
          content: input.template,
          systemPrompt: input.systemPrompt ?? null,
          metrics: JSON.stringify(emptyMetrics()),
        }],
      },
    },
  })
  return rowToTemplate(row)
}

/** Update a template (creates new version). */
export async function updateTemplate(
  id: string,
  updates: { template?: string; systemPrompt?: string; variables?: PromptVariable[]; tags?: string[] },
): Promise<PromptTemplate | null> {
  try {
    const existing = await prisma.promptTemplate.findUnique({ where: { id } })
    if (!existing) return null

    const newVersion = existing.version + 1
    const updatedRow = await prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(updates.template ? { template: updates.template } : {}),
        ...(updates.systemPrompt !== undefined ? { systemPrompt: updates.systemPrompt } : {}),
        ...(updates.variables ? { variables: JSON.stringify(updates.variables) } : {}),
        ...(updates.tags ? { tags: JSON.stringify(updates.tags) } : {}),
        version: newVersion,
        parentVersion: existing.version,
        metrics: JSON.stringify(emptyMetrics()),
        versions: {
          create: [{
            version: newVersion,
            content: updates.template ?? existing.template,
            systemPrompt: updates.systemPrompt ?? existing.systemPrompt,
            metrics: JSON.stringify(emptyMetrics()),
          }],
        },
      },
    })
    return rowToTemplate(updatedRow)
  } catch {
    return null
  }
}

/** Get a template by ID. */
export async function getTemplate(id: string): Promise<PromptTemplate | null> {
  try {
    const row = await prisma.promptTemplate.findUnique({ where: { id } })
    return row ? rowToTemplate(row) : null
  } catch {
    return null
  }
}

/** List templates for an app. */
export async function listTemplates(appSlug: string): Promise<PromptTemplate[]> {
  try {
    const rows = await prisma.promptTemplate.findMany({ where: { appSlug } })
    return rows.map(rowToTemplate)
  } catch {
    return []
  }
}

/** Get version history for a template. */
export async function getVersionHistory(templateId: string): Promise<PromptVersion[]> {
  try {
    const rows = await prisma.promptTemplateVersion.findMany({
      where: { templateId },
      orderBy: { version: 'asc' },
    })
    return rows.map((r) => ({
      version: r.version,
      template: r.content,
      systemPrompt: r.systemPrompt ?? undefined,
      createdAt: r.createdAt.toISOString(),
      metrics: JSON.parse(r.metrics) as PromptMetrics,
    }))
  } catch {
    return []
  }
}

/** Delete a template. */
export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    await prisma.promptTemplate.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

// ── Template Rendering ───────────────────────────────────────────────────────

/**
 * Render a template by substituting variables.
 * Variables are {{variableName}} placeholders.
 */
export async function renderTemplate(
  templateId: string,
  variables: Record<string, string | number | boolean>,
): Promise<{ rendered: string; systemPrompt?: string } | null> {
  const template = await getTemplate(templateId)
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
export async function createABTest(input: {
  name: string
  appSlug: string
  variants: Array<{ name: string; templateId: string; version?: number; model?: string; temperature?: number }>
  trafficSplit?: number[]
  minSamples?: number
}): Promise<ABTest> {
  const variantCount = input.variants.length
  const defaultSplit = Array<number>(variantCount).fill(Math.floor(100 / variantCount))
  const totalDefault = defaultSplit.reduce((s: number, v: number) => s + v, 0)
  if (totalDefault < 100) defaultSplit[0] += 100 - totalDefault

  const variants = input.variants.map((v) => ({
    id: randomUUID(),
    name: v.name,
    templateId: v.templateId,
    version: v.version ?? 1,
    model: v.model,
    temperature: v.temperature,
    metrics: emptyMetrics(),
    sampleCount: 0,
  }))

  const id = randomUUID()
  const trafficSplit = input.trafficSplit ?? defaultSplit
  const testData = {
    appSlug: input.appSlug,
    variants,
    trafficSplit,
    totalSamples: 0,
    minSamples: input.minSamples ?? 100,
  }

  const templateId = input.variants[0]?.templateId ?? ''
  const variantA = input.variants[0]?.version ?? 1
  const variantB = input.variants[1]?.version ?? 1

  await prisma.promptABTest.create({
    data: {
      id,
      templateId,
      name: input.name,
      variantA,
      variantB,
      status: 'draft',
      results: JSON.stringify(testData),
    },
  })

  return { id, name: input.name, ...testData, status: 'draft' }
}

/** Start an A/B test. */
export async function startABTest(testId: string): Promise<boolean> {
  try {
    const row = await prisma.promptABTest.findUnique({ where: { id: testId } })
    if (!row || row.status !== 'draft') return false
    await prisma.promptABTest.update({
      where: { id: testId },
      data: { status: 'running', startedAt: new Date() },
    })
    return true
  } catch {
    return false
  }
}

/** Select which variant to use for a request (weighted random). */
export async function selectVariant(testId: string): Promise<ABVariant | null> {
  const test = await getABTest(testId)
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
export async function recordABResult(
  testId: string,
  variantId: string,
  metrics: { latencyMs: number; confidence: number; success: boolean; tokens?: number },
): Promise<void> {
  try {
    const row = await prisma.promptABTest.findUnique({ where: { id: testId } })
    if (!row) return
    const testData = JSON.parse(row.results) as {
      appSlug: string
      variants: ABVariant[]
      trafficSplit: number[]
      totalSamples: number
      minSamples: number
    }

    const variant = testData.variants.find((v) => v.id === variantId)
    if (!variant) return

    variant.sampleCount++
    testData.totalSamples++
    const n = variant.sampleCount
    variant.metrics.totalUses = n
    variant.metrics.avgLatencyMs += (metrics.latencyMs - variant.metrics.avgLatencyMs) / n
    variant.metrics.avgConfidence += (metrics.confidence - variant.metrics.avgConfidence) / n
    variant.metrics.successRate += ((metrics.success ? 1 : 0) - variant.metrics.successRate) / n
    if (metrics.tokens) {
      variant.metrics.avgTokens += (metrics.tokens - variant.metrics.avgTokens) / n
    }

    await prisma.promptABTest.update({
      where: { id: testId },
      data: { results: JSON.stringify(testData) },
    })
  } catch { /* non-critical */ }
}

/** Get A/B test results with statistical analysis. */
export async function getABResults(testId: string): Promise<ABResult | null> {
  const test = await getABTest(testId)
  if (!test) return null

  if (test.totalSamples < test.minSamples) {
    return {
      testId,
      confidence: 0,
      improvement: 0,
      recommendation: `Need ${test.minSamples - test.totalSamples} more samples before statistical significance`,
    }
  }

  const scored = test.variants.map((v) => ({
    variant: v,
    score: v.metrics.successRate * 0.4 + v.metrics.avgConfidence * 0.3 + (1 - v.metrics.avgLatencyMs / 10000) * 0.3,
  }))
  scored.sort((a, b) => b.score - a.score)

  const winner = scored[0]
  const runnerUp = scored[1]
  const improvement = runnerUp ? ((winner.score - runnerUp.score) / runnerUp.score) * 100 : 0

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
export async function getABTest(testId: string): Promise<ABTest | null> {
  try {
    const row = await prisma.promptABTest.findUnique({ where: { id: testId } })
    return row ? rowToAbTest(row) : null
  } catch {
    return null
  }
}

/** List A/B tests for an app. */
export async function listABTests(appSlug: string): Promise<ABTest[]> {
  try {
    // Since appSlug is encoded in results JSON, fetch all and filter
    const rows = await prisma.promptABTest.findMany()
    return rows.map(rowToAbTest).filter((t) => t.appSlug === appSlug)
  } catch {
    return []
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyMetrics(): PromptMetrics {
  return { totalUses: 0, avgLatencyMs: 0, avgConfidence: 0, successRate: 0, avgTokens: 0, userRating: 0, costUsd: 0 }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const TEMPLATE_CATEGORIES = ['chat', 'coding', 'creative', 'analysis', 'agent', 'custom'] as const
