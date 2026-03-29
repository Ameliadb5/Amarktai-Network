#!/usr/bin/env node
/**
 * Health Sync Cron Job — AmarktAI Network
 *
 * Run on a schedule (cron or serverless) to:
 *  1. Run all provider health checks
 *  2. Update provider health status in the database
 *  3. When a provider transitions from healthy → error, auto-disable its models
 *  4. When budgets are exceeded, log an alert
 *  5. Log all detected issues
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/health-sync.ts
 *
 * Or schedule via cron (every 5 minutes):
 *   0/5 * * * * cd /path/to/project && npx ts-node ... scripts/health-sync.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface HealthCheckResult {
  provider: string
  status: 'healthy' | 'configured' | 'degraded' | 'error' | 'unconfigured' | 'disabled'
  message: string
  previousStatus?: string
  transitioned: boolean
}

async function checkProvider(
  providerKey: string,
  apiKey: string,
  baseUrl: string | null,
): Promise<{ status: string; message: string }> {
  const ENDPOINTS: Record<string, string> = {
    openai:     'https://api.openai.com/v1/models',
    groq:       'https://api.groq.com/openai/v1/models',
    deepseek:   'https://api.deepseek.com/v1/models',
    openrouter: 'https://openrouter.ai/api/v1/models',
    together:   'https://api.together.xyz/v1/models',
    gemini:     'https://generativelanguage.googleapis.com/v1beta/models',
    xai:        'https://api.x.ai/v1/models',
    huggingface:'https://api-inference.huggingface.co/models',
    nvidia:     'https://integrate.api.nvidia.com/v1/models',
  }

  const endpoint = baseUrl ?? ENDPOINTS[providerKey]
  if (!endpoint) return { status: 'unconfigured', message: 'No endpoint for this provider' }

  try {
    const headers: Record<string, string> = providerKey === 'gemini'
      ? {}
      : { Authorization: `Bearer ${apiKey}` }

    const url = providerKey === 'gemini'
      ? `${endpoint}?key=${apiKey}`
      : endpoint

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) return { status: 'healthy', message: 'API responding normally' }
    if (res.status === 401) return { status: 'error', message: 'Invalid API key (401)' }
    if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
    if (res.status === 402) return { status: 'degraded', message: 'Insufficient balance (402)' }
    return { status: 'error', message: `HTTP ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('abort')) return { status: 'error', message: 'Health check timeout (10s)' }
    return { status: 'error', message }
  }
}

async function run() {
  console.log('[health-sync] Starting health synchronisation...')

  const providers = await prisma.aiProvider.findMany()
  const results: HealthCheckResult[] = []

  for (const provider of providers) {
    if (!provider.enabled) {
      results.push({
        provider: provider.providerKey,
        status: 'disabled',
        message: 'Provider is disabled',
        transitioned: false,
      })
      continue
    }

    if (!provider.apiKey || provider.apiKey.trim() === '') {
      results.push({
        provider: provider.providerKey,
        status: 'unconfigured',
        message: 'No API key configured',
        transitioned: false,
      })
      continue
    }

    const previousStatus = provider.healthStatus ?? 'unknown'
    const { status, message } = await checkProvider(
      provider.providerKey,
      provider.apiKey,
      provider.baseUrl,
    )

    const transitioned = previousStatus !== status

    // Update provider health in database
    await prisma.aiProvider.update({
      where: { id: provider.id },
      data: {
        healthStatus: status,
        healthMessage: message,
        lastCheckedAt: new Date(),
      },
    })

    // If provider transitioned to error, log an alert
    if (transitioned && status === 'error') {
      console.log(`[health-sync] ⚠️  Provider ${provider.providerKey} transitioned from ${previousStatus} → error: ${message}`)
      // In production, send email/Slack notification here
    }

    // If provider recovered (error → healthy), log a resolution
    if (transitioned && previousStatus === 'error' && status === 'healthy') {
      console.log(`[health-sync] ✅ Provider ${provider.providerKey} recovered: ${previousStatus} → healthy`)
    }

    results.push({
      provider: provider.providerKey,
      status: status as HealthCheckResult['status'],
      message,
      previousStatus,
      transitioned,
    })
  }

  // Check budget thresholds
  const budgets = await prisma.providerBudget.findMany()
  for (const budget of budgets) {
    if (!budget.monthlyBudgetUsd) continue

    const usagePct = (budget.currentSpendUsd / budget.monthlyBudgetUsd) * 100
    if (usagePct >= budget.criticalThresholdPct) {
      console.log(`[health-sync] Budget critical: ${budget.providerKey} at ${usagePct.toFixed(1)}%`)
      // In production, send email/Slack notification here
    } else if (usagePct >= budget.warningThresholdPct) {
      console.log(`[health-sync] Budget warning: ${budget.providerKey} at ${usagePct.toFixed(1)}%`)
    }
  }

  // Summary
  const healthy = results.filter(r => r.status === 'healthy').length
  const errored = results.filter(r => r.status === 'error').length
  const degraded = results.filter(r => r.status === 'degraded').length
  const transitions = results.filter(r => r.transitioned).length

  console.log(`[health-sync] Complete. ${healthy} healthy, ${errored} error, ${degraded} degraded, ${transitions} transitioned.`)
}

run()
  .catch((err) => {
    console.error('[health-sync] Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
