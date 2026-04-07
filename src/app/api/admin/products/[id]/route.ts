import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const productSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  category: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  status: z.enum(['live', 'ready_to_deploy', 'invite_only', 'in_development', 'coming_soon', 'concept', 'offline']).optional(),
  accessType: z.enum(['public', 'invite', 'private']).optional(),
  featured: z.boolean().optional(),
  primaryUrl: z.string().optional(),
  hostedHere: z.boolean().optional(),
  hostingScope: z.string().optional(),
  subdomain: z.string().optional(),
  customDomain: z.string().optional(),
  environment: z.string().optional(),
  publicVisibility: z.boolean().optional(),
  monitoringEnabled: z.boolean().optional(),
  integrationEnabled: z.boolean().optional(),
  appType: z.string().optional(),
  readyToDeploy: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  connectedToBrain: z.boolean().optional(),
  onboardingStatus: z.enum(['unconfigured', 'discovered', 'configuring', 'configured', 'connected']).optional(),
  onboardingCompletedAt: z.string().datetime().optional().nullable(),
  appSecret: z.string().optional(),
  /** When true, a new cryptographically-secure 64-char hex secret is generated server-side.
   *  The generated secret is returned in the response. Takes precedence over `appSecret`. */
  regenerateSecret: z.boolean().optional(),
  customInstructions: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: { integration: true, metricDefinitions: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  try {
    const body = await request.json()
    const { regenerateSecret, ...rest } = productSchema.parse(body)

    // Server-side secret generation — never trust client-supplied entropy
    const updateData = { ...rest }
    if (regenerateSecret) {
      updateData.appSecret = randomBytes(32).toString('hex')
    }

    const product = await prisma.product.update({ where: { id: parseInt(id) }, data: updateData })
    return NextResponse.json(product)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.product.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
