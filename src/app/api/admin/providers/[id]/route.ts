import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { maskApiKey } from '@/lib/providers'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  apiKey: z.string().optional(),       // present only when updating the key
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
  fallbackModel: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

/** GET /api/admin/providers/[id] — single provider, raw key NEVER returned */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cfg = validateConfig()
  if (!cfg.valid) return NextResponse.json({ ...configErrorResponse(cfg) }, { status: 503 })
  const { id } = await params
  try {
    const provider = await prisma.aiProvider.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        providerKey: true,
        displayName: true,
        enabled: true,
        maskedPreview: true,
        baseUrl: true,
        defaultModel: true,
        fallbackModel: true,
        healthStatus: true,
        healthMessage: true,
        lastCheckedAt: true,
        notes: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!provider) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(provider)
  } catch (error) {
    const { category, message } = classifyDbError(error)
    return NextResponse.json({ error: message, category }, { status: category === 'config_invalid' ? 503 : 500 })
  }
}

/** PATCH /api/admin/providers/[id] — update config; if apiKey present, overwrites securely */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cfg = validateConfig()
  if (!cfg.valid) return NextResponse.json({ ...configErrorResponse(cfg) }, { status: 503 })
  const { id } = await params

  try {
    const body = await request.json()
    const data = patchSchema.parse(body)

    // Build the update payload — only include fields that were provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}

    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled
      // When disabling, mark health as disabled too
      if (!data.enabled) {
        updateData.healthStatus = 'disabled'
        updateData.healthMessage = 'Provider is disabled'
      }
    }
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl
    if (data.defaultModel !== undefined) updateData.defaultModel = data.defaultModel
    if (data.fallbackModel !== undefined) updateData.fallbackModel = data.fallbackModel
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    // Key update — overwrite atomically
    if (data.apiKey !== undefined) {
      if (data.apiKey.trim() === '') {
        // Clearing the key
        updateData.apiKey = ''
        updateData.maskedPreview = ''
        updateData.healthStatus = 'unconfigured'
        updateData.healthMessage = 'No API key configured'
        updateData.lastCheckedAt = null
      } else {
        updateData.apiKey = data.apiKey.trim()
        updateData.maskedPreview = maskApiKey(data.apiKey.trim())
        // Reset health to "configured but not tested" after key change
        updateData.healthStatus = 'configured'
        updateData.healthMessage = 'Key updated · run a health check to validate'
        updateData.lastCheckedAt = null
      }
    }

    // If enabling and key exists, set to configured if still unconfigured
    if (data.enabled === true) {
      // Only check DB if we are NOT also providing a new API key in this request
      // (if apiKey is provided, the key-update block above already set the correct health status)
      if (data.apiKey === undefined) {
        const existing = await prisma.aiProvider.findUnique({ where: { id: parseInt(id) }, select: { apiKey: true, healthStatus: true } })
        if (existing?.apiKey && existing.healthStatus === 'disabled') {
          updateData.healthStatus = 'configured'
          updateData.healthMessage = 'Key configured · run a health check to validate'
        } else if (!existing?.apiKey) {
          updateData.healthStatus = 'unconfigured'
          updateData.healthMessage = 'No API key configured'
        }
      }
    }

    const updated = await prisma.aiProvider.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        providerKey: true,
        displayName: true,
        enabled: true,
        maskedPreview: true,
        baseUrl: true,
        defaultModel: true,
        fallbackModel: true,
        healthStatus: true,
        healthMessage: true,
        lastCheckedAt: true,
        notes: true,
        sortOrder: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('[providers] PATCH failed:', error)
    const { category, message } = classifyDbError(error)
    return NextResponse.json({ error: message, category }, { status: category === 'config_invalid' ? 503 : 500 })
  }
}
