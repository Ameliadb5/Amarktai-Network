import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { routeRequest, type RoutingContext } from '@/lib/routing-engine'
import {
  getModelRegistry,
  getUsableModels,
  setProviderHealth,
  type ProviderHealthStatus,
} from '@/lib/model-registry'
import { getDetailedCapabilityStatus } from '@/lib/capability-engine'
import { prisma } from '@/lib/prisma'

/**
 * Sync the model-registry health cache from DB provider state so that
 * getUsableModels() reflects real configuration for this request.
 */
async function syncHealthCacheFromDB(): Promise<void> {
  try {
    const dbProviders = await prisma.aiProvider.findMany({
      where: { enabled: true },
      select: { providerKey: true, healthStatus: true, apiKey: true },
    })
    const configuredKeys = new Set<string>()
    for (const p of dbProviders) {
      if (p.apiKey) {
        setProviderHealth(p.providerKey, p.healthStatus as ProviderHealthStatus)
        configuredKeys.add(p.providerKey)
      }
    }
    // Mark all other known providers as unconfigured
    const allKeys = new Set(getModelRegistry().map(m => m.provider))
    for (const key of Array.from(allKeys)) {
      if (!configuredKeys.has(key)) {
        setProviderHealth(key, 'unconfigured')
      }
    }
  } catch (err) {
    // Best-effort — fall through with empty cache (all models treated as usable).
    // Log so operators can diagnose DB connectivity issues affecting routing stats.
    console.warn('[routing] syncHealthCacheFromDB failed; stats will reflect static registry:', err)
  }
}

/**
 * GET /api/admin/routing — returns routing status summary for the Intelligence dashboard.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Sync health cache from DB so getUsableModels() reflects real configuration
    await syncHealthCacheFromDB()

    const allModels = getModelRegistry()
    const usableModels = getUsableModels()
    const detailedCapabilities = getDetailedCapabilityStatus()

    // Build a summary of routing capabilities from truly usable models
    const providerSet = new Set<string>()
    const taskTypes = new Set<string>()
    for (const m of usableModels) {
      providerSet.add(m.provider)
      if (m.supports_chat) taskTypes.add('chat')
      if (m.supports_code) taskTypes.add('code')
      if (m.supports_reasoning) taskTypes.add('reasoning')
      if (m.supports_embeddings) taskTypes.add('embeddings')
      if (m.supports_vision) taskTypes.add('vision')
      if (m.supports_image_generation) taskTypes.add('image')
      if (m.supports_tts) taskTypes.add('tts')
      if (m.supports_voice_interaction) taskTypes.add('voice')
      if (m.supports_video_planning) taskTypes.add('video')
      if (m.supports_tool_use) taskTypes.add('tool_use')
    }

    // Generate sample routing decisions for common task types
    const sampleTasks = ['chat', 'code', 'reasoning', 'embeddings', 'vision']
    const routes = sampleTasks.map(taskType => {
      try {
        const decision = routeRequest({
          appSlug: '__dashboard__',
          appCategory: 'generic',
          taskType,
          taskComplexity: 'moderate',
          message: `Sample ${taskType} request`,
          requiresRetrieval: false,
          requiresMultimodal: false,
        })
        return {
          taskType,
          model: decision.primaryModel?.model_name ?? decision.primaryModel?.model_id ?? '—',
          provider: decision.primaryModel?.provider ?? '—',
          status: decision.primaryModel ? 'active' : 'no_route',
          reasoning: decision.reason,
          mode: decision.mode,
          costEstimate: decision.costEstimate,
          latencyEstimate: decision.latencyEstimate,
        }
      } catch {
        return { taskType, model: '—', provider: '—', status: 'error', reasoning: 'Routing failed', mode: 'direct', costEstimate: 'unknown', latencyEstimate: 'unknown' }
      }
    })

    const capabilityEntries = detailedCapabilities.map((entry) => ({
      capability: entry.capability,
      available: entry.available,
      reason: entry.reason,
      routeExists: entry.routeExists,
    }))

    return NextResponse.json({
      routes,
      stats: {
        total_models: allModels.length,
        enabled_models: usableModels.length,
        active_providers: providerSet.size,
        supported_tasks: taskTypes.size,
      },
      capabilities: capabilityEntries,
    })
  } catch (err) {
    console.error('[routing] GET error:', err)
    return NextResponse.json({ routes: [], stats: {}, capabilities: [] }, { status: 500 })
  }
}

/**
 * POST /api/admin/routing — test the routing engine with a given context.
 *
 * Body:
 *   appSlug: string
 *   appCategory: string
 *   taskType: string
 *   taskComplexity: 'simple' | 'moderate' | 'complex'
 *   message: string
 *   requiresRetrieval?: boolean
 *   requiresMultimodal?: boolean
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as Partial<RoutingContext>

    if (!body.appSlug || !body.taskType || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: appSlug, taskType, message' },
        { status: 422 },
      )
    }

    const context: RoutingContext = {
      appSlug: body.appSlug,
      appCategory: body.appCategory ?? 'generic',
      taskType: body.taskType,
      taskComplexity: body.taskComplexity ?? 'moderate',
      message: body.message,
      requiresRetrieval: body.requiresRetrieval ?? false,
      requiresMultimodal: body.requiresMultimodal ?? false,
      preferredProvider: body.preferredProvider,
      maxCostTier: body.maxCostTier,
      maxLatencyTier: body.maxLatencyTier,
    }

    const decision = routeRequest(context)
    return NextResponse.json({ context, decision })
  } catch (err) {
    console.error('[routing] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to compute routing decision' },
      { status: 500 },
    )
  }
}
