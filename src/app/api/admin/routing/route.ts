import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { routeRequest, type RoutingContext } from '@/lib/routing-engine'
import { getModelRegistry, getEnabledModels } from '@/lib/model-registry'
import { getCapabilityStatus } from '@/lib/capability-engine'

/**
 * GET /api/admin/routing — returns routing status summary for the Intelligence dashboard.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allModels = getModelRegistry()
    const enabledModels = getEnabledModels()
    const capabilityStatus = getCapabilityStatus()

    // Build a summary of routing capabilities
    const providerSet = new Set<string>()
    const taskTypes = new Set<string>()
    for (const m of enabledModels) {
      providerSet.add(m.provider)
      for (const cap of m.capabilities ?? []) {
        taskTypes.add(cap)
      }
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

    const capabilityEntries = Object.entries(capabilityStatus).map(([capability, available]) => ({
      capability,
      available,
    }))

    return NextResponse.json({
      routes,
      stats: {
        total_models: allModels.length,
        enabled_models: enabledModels.length,
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
