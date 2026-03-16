import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { randomBytes } from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await request.json()

  if (body.regenerateToken) {
    const newToken = `amkt_${randomBytes(32).toString('hex')}`
    const updated = await prisma.appIntegration.update({
      where: { id: parseInt(id) },
      data: { integrationToken: newToken },
    })
    return NextResponse.json({ ...updated, integrationToken: newToken, _tokenRegenerated: true })
  }

  const data: Record<string, unknown> = {}
  if (body.heartbeatEnabled !== undefined) data.heartbeatEnabled = body.heartbeatEnabled
  if (body.metricsEnabled !== undefined) data.metricsEnabled = body.metricsEnabled
  if (body.eventsEnabled !== undefined) data.eventsEnabled = body.eventsEnabled
  if (body.vpsEnabled !== undefined) data.vpsEnabled = body.vpsEnabled
  if (body.healthStatus !== undefined) data.healthStatus = body.healthStatus
  if (body.environment !== undefined) data.environment = body.environment

  const updated = await prisma.appIntegration.update({ where: { id: parseInt(id) }, data })
  return NextResponse.json({
    ...updated,
    integrationToken: `${updated.integrationToken.slice(0, 10)}...${updated.integrationToken.slice(-4)}`,
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.appIntegration.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}
