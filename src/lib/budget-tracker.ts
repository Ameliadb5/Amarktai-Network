/**
 * Budget Tracker — AmarktAI Network
 *
 * Tracks per-provider spend estimates and enforces configurable budget
 * thresholds. The routing engine can query the budget state to prefer
 * cheaper models when a provider is nearing its limit.
 *
 * All budget data is stored in the ProviderBudget table. Actual spend
 * is estimated from BrainEvent latency + model cost rates when real
 * billing data is not available.
 *
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'

// ── Cost rates (USD per 1K tokens, estimated) ────────────────────────────────

const COST_RATES: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o':                  { input: 0.005,  output: 0.015 },
  'gpt-4o-mini':             { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo':             { input: 0.01,   output: 0.03 },
  'o1-preview':              { input: 0.015,  output: 0.06 },
  'o1-mini':                 { input: 0.003,  output: 0.012 },
  'o4-mini':                 { input: 0.003,  output: 0.012 },
  // Groq (very cheap / free tier)
  'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
  'llama-3.1-8b-instant':    { input: 0.00005, output: 0.00008 },
  'mixtral-8x7b-32768':      { input: 0.00024, output: 0.00024 },
  'whisper-large-v3-turbo':  { input: 0.00011, output: 0.00011 },
  // DeepSeek
  'deepseek-chat':           { input: 0.00014, output: 0.00028 },
  'deepseek-coder':          { input: 0.00014, output: 0.00028 },
  'deepseek-reasoner':       { input: 0.00055, output: 0.00219 },
  // Gemini
  'gemini-2.0-flash':        { input: 0.00010, output: 0.00040 },
  'gemini-1.5-flash':        { input: 0.00008, output: 0.00030 },
  'gemini-1.5-pro':          { input: 0.00125, output: 0.00500 },
  'gemini-2.5-pro':          { input: 0.00150, output: 0.00600 },
  'gemini-2.5-flash':        { input: 0.00015, output: 0.00060 },
  // Grok
  'grok-2-latest':           { input: 0.002,  output: 0.010 },
  'grok-3-mini-beta':        { input: 0.0003, output: 0.0005 },
  // NVIDIA NIM
  'nvidia/llama-3.1-nemotron-70b-instruct': { input: 0.00035, output: 0.00040 },
  // Together AI
  'meta-llama/Llama-3-70b-chat-hf': { input: 0.00090, output: 0.00090 },
  // OpenRouter
  'openai/gpt-4o-mini':      { input: 0.00015, output: 0.0006 },
  // Replicate (per-second pricing approximation)
  'wan-ai/wan2.1-t2v-480p':  { input: 0.0032, output: 0.0032 },
  // HuggingFace (mostly free inference)
  'meta-llama/Llama-3.3-70B-Instruct': { input: 0.00059, output: 0.00079 },
  // Anthropic
  'claude-3.5-sonnet':       { input: 0.003, output: 0.015 },
  'claude-3-opus':           { input: 0.015, output: 0.075 },
  'claude-3-haiku':          { input: 0.00025, output: 0.00125 },
  'claude-sonnet-4':         { input: 0.003, output: 0.015 },
  // Cohere
  'command-r-plus':          { input: 0.003, output: 0.015 },
  'command-r':               { input: 0.0005, output: 0.0015 },
  'embed-english-v3.0':     { input: 0.0001, output: 0.0001 },
  'rerank-english-v3.0':    { input: 0.002, output: 0.002 },
  // Qwen (DashScope pricing)
  'qwen-max':                { input: 0.0016, output: 0.0064 },
  'qwen-plus':               { input: 0.0004, output: 0.0012 },
  'qwen-turbo':              { input: 0.00005, output: 0.0002 },
  'qwen-long':               { input: 0.00005, output: 0.0002 },
  'qwen-coder-plus':         { input: 0.00035, output: 0.0012 },
  'qwen-coder-turbo':        { input: 0.00005, output: 0.0002 },
  'qwen-vl-max':             { input: 0.003,  output: 0.009 },
  'qwen-vl-plus':            { input: 0.0008, output: 0.002 },
  'qvq-72b-preview':         { input: 0.003,  output: 0.009 },
  'qwen2.5-vl-72b-instruct': { input: 0.003,  output: 0.009 },
  'qwen2.5-vl-7b-instruct':  { input: 0.0003, output: 0.0006 },
  'wanx-v1':                 { input: 0.002,  output: 0.002 },
  'wanx2.1-t2i-turbo':       { input: 0.001,  output: 0.001 },
  'wanx2.1-t2v-turbo':       { input: 0.003,  output: 0.003 },
  'wanx2.1-t2v-plus':        { input: 0.006,  output: 0.006 },
  'wanx2.1-i2v-turbo':       { input: 0.003,  output: 0.003 },
  'qwen-audio-turbo':        { input: 0.0003, output: 0.0003 },
  'qwen-audio-chat':         { input: 0.001,  output: 0.002 },
  'text-embedding-v3':       { input: 0.00007, output: 0.00007 },
  'qwen-math-plus':          { input: 0.0004, output: 0.0012 },
  // Fallback
  'default':                 { input: 0.001,  output: 0.002 },
}

export function estimateCostUsd(model: string, estimatedTokens: number): number {
  const rate = COST_RATES[model] ?? COST_RATES['default']
  // Assume 60/40 input/output split when we only have total tokens
  const inputTokens  = estimatedTokens * 0.6
  const outputTokens = estimatedTokens * 0.4
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface BudgetEntry {
  providerKey: string
  displayName: string
  monthlyBudgetUsd: number | null    // null = unlimited
  currentSpendUsd: number
  estimatedSpendUsd: number          // from BrainEvent-derived estimates
  usagePercent: number               // 0–100
  status: 'ok' | 'warning' | 'critical' | 'unknown'
  warningThresholdPct: number        // default 75
  criticalThresholdPct: number       // default 90
  lastUpdated: Date
}

export interface BudgetSummary {
  entries: BudgetEntry[]
  totalEstimatedSpendUsd: number
  totalBudgetUsd: number | null
  providersAtWarning: number
  providersAtCritical: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function estimateProviderSpend(
  providerKey: string,
  since: Date,
): Promise<number> {
  try {
    const events = await prisma.brainEvent.findMany({
      where: {
        routedProvider: providerKey,
        success: true,
        timestamp: { gte: since },
      },
      select: { routedModel: true, latencyMs: true },
    })

    let total = 0
    for (const ev of events) {
      // Rough token estimate: 1ms ≈ 0.5 tokens processed
      const tokens = Math.max(500, (ev.latencyMs ?? 1000) * 0.5)
      total += estimateCostUsd(ev.routedModel ?? 'default', tokens)
    }
    return Math.round(total * 10000) / 10000   // round to 4 decimal places
  } catch {
    return 0
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBudgetSummary(): Promise<BudgetSummary> {
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1) // start of month

  let providers: Array<{
    providerKey: string
    displayName: string
    enabled: boolean
  }> = []

  const budgetSettings: Map<string, {
    monthlyBudgetUsd: number | null
    warningThresholdPct: number
    criticalThresholdPct: number
    currentSpendUsd: number
  }> = new Map()

  try {
    const dbProviders = await prisma.aiProvider.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    providers = dbProviders.map(p => ({
      providerKey: p.providerKey,
      displayName: p.displayName,
      enabled: p.enabled,
    }))

    // Load budget configs from ProviderBudget table
    const dbBudgets = await prisma.providerBudget.findMany()
    for (const b of dbBudgets) {
      budgetSettings.set(b.providerKey, {
        monthlyBudgetUsd: b.monthlyBudgetUsd,
        warningThresholdPct: b.warningThresholdPct,
        criticalThresholdPct: b.criticalThresholdPct,
        currentSpendUsd: b.currentSpendUsd,
      })
    }
  } catch {
    // DB not available; return empty summary
    return {
      entries: [],
      totalEstimatedSpendUsd: 0,
      totalBudgetUsd: null,
      providersAtWarning: 0,
      providersAtCritical: 0,
    }
  }

  const entries: BudgetEntry[] = []

  for (const p of providers) {
    const settings = budgetSettings.get(p.providerKey)
    const monthlyBudget = settings?.monthlyBudgetUsd ?? null
    const warnPct = settings?.warningThresholdPct ?? 75
    const critPct = settings?.criticalThresholdPct ?? 90
    const recordedSpend = settings?.currentSpendUsd ?? 0

    const estimatedSpend = await estimateProviderSpend(p.providerKey, since)
    const totalSpend = Math.max(recordedSpend, estimatedSpend)

    const usagePercent = monthlyBudget
      ? Math.min(100, (totalSpend / monthlyBudget) * 100)
      : 0

    let status: BudgetEntry['status'] = 'ok'
    if (!monthlyBudget) status = 'unknown'
    else if (usagePercent >= critPct) status = 'critical'
    else if (usagePercent >= warnPct) status = 'warning'

    entries.push({
      providerKey: p.providerKey,
      displayName: p.displayName,
      monthlyBudgetUsd: monthlyBudget,
      currentSpendUsd: recordedSpend,
      estimatedSpendUsd: estimatedSpend,
      usagePercent,
      status,
      warningThresholdPct: warnPct,
      criticalThresholdPct: critPct,
      lastUpdated: new Date(),
    })
  }

  const totalEstimated = entries.reduce((s, e) => s + e.estimatedSpendUsd, 0)
  const totalBudget = entries.some(e => e.monthlyBudgetUsd !== null)
    ? entries.reduce((s, e) => s + (e.monthlyBudgetUsd ?? 0), 0)
    : null

  return {
    entries,
    totalEstimatedSpendUsd: Math.round(totalEstimated * 10000) / 10000,
    totalBudgetUsd: totalBudget,
    providersAtWarning: entries.filter(e => e.status === 'warning').length,
    providersAtCritical: entries.filter(e => e.status === 'critical').length,
  }
}

/**
 * Returns true if the given provider is within budget (i.e. routing engine
 * should continue routing to it). Returns false if critical threshold exceeded.
 */
export async function isProviderWithinBudget(providerKey: string): Promise<boolean> {
  try {
    const budget = await prisma.providerBudget.findUnique({
      where: { providerKey },
    })
    if (!budget?.monthlyBudgetUsd) return true   // no budget configured = always ok

    const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const estimated = await estimateProviderSpend(providerKey, since)
    const usagePct = (estimated / budget.monthlyBudgetUsd) * 100
    return usagePct < budget.criticalThresholdPct
  } catch {
    return true   // default to allowing if check fails
  }
}

// ── Per-App Budget Caps ─────────────────────────────────────────────────────

/** In-memory per-app budget caps (future: store in DB). */
const appBudgetCaps = new Map<string, { monthlyBudgetUsd: number; currentSpendUsd: number }>()

/**
 * Set a per-app monthly budget cap.
 */
export function setAppBudgetCap(appSlug: string, monthlyBudgetUsd: number): void {
  const existing = appBudgetCaps.get(appSlug)
  appBudgetCaps.set(appSlug, {
    monthlyBudgetUsd,
    currentSpendUsd: existing?.currentSpendUsd ?? 0,
  })
}

/**
 * Get the per-app budget cap, or null if none is configured.
 */
export function getAppBudgetCap(appSlug: string): { monthlyBudgetUsd: number; currentSpendUsd: number } | null {
  return appBudgetCaps.get(appSlug) ?? null
}

/**
 * Record spend against an app's budget.
 */
export function recordAppSpend(appSlug: string, amountUsd: number): void {
  const cap = appBudgetCaps.get(appSlug)
  if (cap) {
    cap.currentSpendUsd += amountUsd
  }
}

/**
 * Check if an app is within its budget cap.
 * Returns true if no cap is set or if spend is under the cap.
 */
export function isAppWithinBudget(appSlug: string): boolean {
  const cap = appBudgetCaps.get(appSlug)
  if (!cap) return true
  return cap.currentSpendUsd < cap.monthlyBudgetUsd
}

// ── Model Tier Downgrade Logic ──────────────────────────────────────────────

export type ModelTier = 'premium' | 'mid' | 'cheap'

/**
 * Model tier classification based on cost rates.
 * Returns recommended tier based on remaining budget percentage.
 */
export function getRecommendedModelTier(usagePercent: number): ModelTier {
  if (usagePercent >= 90) return 'cheap'
  if (usagePercent >= 70) return 'mid'
  return 'premium'
}

/**
 * Estimate cost for a single request given the model, input tokens, and output tokens.
 * Returns USD amount.
 */
export function estimateRequestCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = COST_RATES[model] ?? COST_RATES['default']
  return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
}

/**
 * Get cost tier label for a given model based on its rate.
 */
export function getModelCostLabel(model: string): 'cheap' | 'balanced' | 'premium' {
  const rate = COST_RATES[model] ?? COST_RATES['default']
  const avgRate = (rate.input + rate.output) / 2
  if (avgRate < 0.0005) return 'cheap'
  if (avgRate < 0.005) return 'balanced'
  return 'premium'
}

/**
 * Select the best cost tier based on provider budget status.
 * Implements automatic tier downgrade when nearing budget limits.
 */
export async function selectCostTierForRequest(
  providerKey: string,
  preferredTier?: 'cheap' | 'balanced' | 'premium',
): Promise<'cheap' | 'balanced' | 'premium'> {
  const budgetTier = await suggestModelTier(providerKey)
  // Map ModelTier to cost tier
  const tierMap: Record<ModelTier, 'cheap' | 'balanced' | 'premium'> = {
    cheap: 'cheap',
    mid: 'balanced',
    premium: 'premium',
  }
  const budgetSuggestion = tierMap[budgetTier]
  // If budget forces a cheaper tier, respect that regardless of preference
  const tierOrder = { cheap: 0, balanced: 1, premium: 2 }
  if (preferredTier && tierOrder[preferredTier] <= tierOrder[budgetSuggestion]) {
    return preferredTier
  }
  return budgetSuggestion
}

/**
 * Suggest a model downgrade based on budget status.
 * Returns the tier that should be used for new requests.
 */
export async function suggestModelTier(providerKey: string): Promise<ModelTier> {
  try {
    const budget = await prisma.providerBudget.findUnique({
      where: { providerKey },
    })
    if (!budget?.monthlyBudgetUsd) return 'premium' // no budget = use best

    const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const estimated = await estimateProviderSpend(providerKey, since)
    const usagePct = (estimated / budget.monthlyBudgetUsd) * 100

    return getRecommendedModelTier(usagePct)
  } catch {
    return 'premium' // default to premium if check fails
  }
}
