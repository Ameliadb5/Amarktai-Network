import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const productSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  category: z.string().optional(),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  status: z.enum(['live', 'invite_only', 'in_development', 'coming_soon', 'concept']).optional(),
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
    const data = productSchema.parse(body)
    const product = await prisma.product.update({ where: { id: parseInt(id) }, data })
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
