import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { maskApiKey } from '@/lib/providers'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'
import { encryptVaultKey } from '@/lib/crypto-vault'

const createSchema = z.object({
  providerKey: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  enabled: z.boolean().default(false),
  apiKey: z.string().default(''),
  baseUrl: z.string().default(''),
  defaultModel: z.string().default(''),
  fallbackModel: z.string().default(''),
  notes: z.string().default(''),
  sortOrder: z.number().int().default(99),
})

/** GET /api/admin/providers — all providers, raw key NEVER returned */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cfg = validateConfig()
  if (!cfg.valid) {
    return NextResponse.json({ ...configErrorResponse(cfg), providers: [] }, { status: 503 })
  }

  try {
    const providers = await prisma.aiProvider.findMany({
      orderBy: { sortOrder: 'asc' },
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
        // apiKey intentionally excluded
      },
    })
    return NextResponse.json(providers)
  } catch (error) {
    const { category, message } = classifyDbError(error)
    console.error('[providers] GET failed:', category, message)
    return NextResponse.json(
      { error: message, category },
      { status: category === 'config_invalid' ? 503 : 500 },
    )
  }
}

/** POST /api/admin/providers — create a new provider (admin use only) */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cfg = validateConfig()
  if (!cfg.valid) {
    return NextResponse.json({ ...configErrorResponse(cfg) }, { status: 503 })
  }

  try {
    const body = await request.json()
    const data = createSchema.parse(body)
    const masked = maskApiKey(data.apiKey)
    const encryptedKey = data.apiKey ? encryptVaultKey(data.apiKey) : ''
    const provider = await prisma.aiProvider.create({
      data: {
        ...data,
        apiKey: encryptedKey,
        maskedPreview: masked,
        healthStatus: data.apiKey ? 'configured' : 'unconfigured',
        healthMessage: data.apiKey ? 'Key configured · not yet tested' : 'No API key configured',
      },
    })
    // Return without raw key
    const { apiKey: _omit, ...safe } = provider
    return NextResponse.json(safe, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    const { category, message } = classifyDbError(error)
    console.error('[providers] POST failed:', category, message)
    return NextResponse.json(
      { error: message, category },
      { status: category === 'config_invalid' ? 503 : 500 },
    )
  }
}
