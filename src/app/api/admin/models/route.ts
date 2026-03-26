import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getModelRegistry,
  getModelsByProvider,
  getModelsByRole,
  getEnabledModels,
  getValidatorEligibleModels,
} from '@/lib/model-registry'

/**
 * GET /api/admin/models — returns model registry entries.
 *
 * Query params:
 *   provider  (optional — filter by provider key)
 *   role      (optional — filter by primary/secondary role)
 *   enabled   (optional — 'true' to show only enabled)
 *   validator (optional — 'true' to show only validator-eligible)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const role = searchParams.get('role')
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
    models,
    total: models.length,
    registrySize: getModelRegistry().length,
  })
}
