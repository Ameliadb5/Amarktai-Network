import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  category: z.string().default('app'),
  shortDescription: z.string().max(500),
  longDescription: z.string().optional().default(''),
  status: z.enum(['live', 'ready_to_deploy', 'invite_only', 'in_development', 'coming_soon', 'concept', 'offline']).default('in_development'),
  accessType: z.enum(['public', 'invite', 'private']).default('public'),
  featured: z.boolean().default(false),
  primaryUrl: z.string().optional().default(''),
  hostedHere: z.boolean().default(false),
  hostingScope: z.string().optional().default('external_domain'),
  subdomain: z.string().optional().default(''),
  customDomain: z.string().optional().default(''),
  environment: z.string().optional().default('development'),
  publicVisibility: z.boolean().optional().default(true),
  monitoringEnabled: z.boolean().default(false),
  integrationEnabled: z.boolean().default(false),
  appType: z.string().optional().default('app'),
  readyToDeploy: z.boolean().default(false),
  aiEnabled: z.boolean().default(false),
  connectedToBrain: z.boolean().default(false),
  onboardingStatus: z.enum(['unconfigured', 'discovered', 'configuring', 'configured', 'connected']).default('unconfigured'),
  onboardingCompletedAt: z.string().datetime().optional().nullable(),
  appSecret: z.string().optional().default(''),
  customInstructions: z.string().optional().default(''),
  sortOrder: z.number().int().default(99),
})

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { integration: true },
  })
  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = productSchema.parse(body)
    const product = await prisma.product.create({ data })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
