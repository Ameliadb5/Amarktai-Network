import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getModelRegistry,
  getModelsByProvider,
  getModelsByRole,
  getModelsByCategory,
  getEnabledModels,
  getValidatorEligibleModels,
  getCategorySummary,
  setProviderHealth,
  getProviderHealth,
  type ProviderHealthStatus,
  type ModelEntry,
} from '@/lib/model-registry'
import { prisma } from '@/lib/prisma'

/**
 * Derives a capabilities string array from a model's boolean flag fields.
 * UI components expect a capabilities: string[] rather than individual flags.
 */
function deriveCapabilities(m: ModelEntry): string[] {
  const caps: string[] = []
  if (m.supports_chat) caps.push('chat')
  if (m.supports_reasoning) caps.push('reasoning')
  if (m.supports_code) caps.push('code')
  if (m.supports_tool_use) caps.push('tool_use')
  if (m.supports_multilingual) caps.push('multilingual')
  if (m.supports_structured_output) caps.push('structured_output')
  if (m.supports_embeddings) caps.push('embeddings')
  if (m.supports_reranking) caps.push('reranking')
  if (m.supports_vision) caps.push('vision')
  if (m.supports_image_generation) caps.push('image_generation')
  if (m.supports_video_planning) caps.push('video_planning')
  if (m.supports_video_generation) caps.push('video_generation')
  if (m.supports_stt) caps.push('stt')
  if (m.supports_tts) caps.push('tts')
  if (m.supports_voice_interaction) caps.push('voice_interaction')
  if (m.supports_agent_planning) caps.push('agent_planning')
  return caps
}

/**
 * Sync the model-registry health cache from DB so that model listings
 * accurately reflect which providers are actually configured.
 * Uses the same pattern as /api/admin/routing.
 */
async function syncHealthCacheFromDB(): Promise<void> {
  try {
    const dbProviders = await prisma.aiProvider.findMany({
      where: { enabled: true },
      select: { providerKey: true, healthStatus: true, apiKey: true },
    })
    const configured = new Set<string>()
    for (const p of dbProviders) {
      if (p.apiKey) {
        setProviderHealth(p.providerKey, p.healthStatus as ProviderHealthStatus)
        configured.add(p.providerKey)
      }
    }
    // Mark all unconfigured providers so getUsableModels() returns accurate data
    const allKeys = new Set(getModelRegistry().map(m => m.provider))
    for (const key of Array.from(allKeys)) {
      if (!configured.has(key)) setProviderHealth(key, 'unconfigured')
    }
  } catch (err) {
    // Log so operators can diagnose DB connectivity issues affecting model listings.
    console.warn('[models] syncHealthCacheFromDB failed; health overlay may be stale:', err)
  }
}

/**
 * GET /api/admin/models — returns model registry entries.
 *
 * Query params:
 *   provider  (optional — filter by provider key)
 *   role      (optional — filter by primary/secondary role)
 *   category  (optional — filter by model category: text/image/video/voice/code/multimodal)
 *   enabled   (optional — 'true' to show only enabled)
 *   validator (optional — 'true' to show only validator-eligible)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sync provider health from DB so model listings reflect real configuration
  await syncHealthCacheFromDB()

  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const role = searchParams.get('role')
  const category = searchParams.get('category')
  const enabledOnly = searchParams.get('enabled') === 'true'
  const validatorOnly = searchParams.get('validator') === 'true'

  let models = getModelRegistry()

  if (provider) {
    models = getModelsByProvider(provider)
  }
  if (role) {
    const roleModels = getModelsByRole(role as import('@/lib/model-registry').ModelRole)
    const roleIds = new Set(roleModels.map(m => `${m.provider}:${m.model_id}`))
    models = models.filter(m => roleIds.has(`${m.provider}:${m.model_id}`))
  }
  if (category) {
    const catModels = getModelsByCategory(category as import('@/lib/model-registry').ModelCategory)
    const catIds = new Set(catModels.map(m => `${m.provider}:${m.model_id}`))
    models = models.filter(m => catIds.has(`${m.provider}:${m.model_id}`))
  }
  if (enabledOnly) {
    const enabled = getEnabledModels()
    const enabledIds = new Set(enabled.map(m => `${m.provider}:${m.model_id}`))
    models = models.filter(m => enabledIds.has(`${m.provider}:${m.model_id}`))
  }
  if (validatorOnly) {
    const validators = getValidatorEligibleModels()
    const validatorIds = new Set(validators.map(m => `${m.provider}:${m.model_id}`))
    models = models.filter(m => validatorIds.has(`${m.provider}:${m.model_id}`))
  }

  return NextResponse.json({
    models: Array.from(models).map((m) => ({
      ...m,
      // camelCase aliases expected by UI components
      id: m.model_id,
      displayName: m.model_name,
      role: m.primary_role,
      capabilities: deriveCapabilities(m),
      contextWindow: m.context_window,
      latencyTier: m.latency_tier,
      costTier: m.cost_tier,
      // legacy snake_case aliases kept for backward compat
      display_name: m.model_name,
      roles: [m.primary_role, ...m.secondary_roles],
      health: m.health_status,
      effectiveHealth: getProviderHealth(m.provider),
    })),
    total: models.length,
    registrySize: getModelRegistry().length,
    categorySummary: getCategorySummary(),
  })
}
