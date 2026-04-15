/**
 * Human Approval Engine API — AmarktAI Network
 *
 * Manages approval requests for sensitive/costly/high-risk actions.
 * Uses SystemAlert as backing store with alertType = 'approval_request'.
 * GET: list pending/resolved approvals
 * POST: create approval request or resolve one
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') ?? 'pending'
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)

    const approvals = await prisma.systemAlert.findMany({
      where: {
        alertType: 'approval_request',
        ...(status === 'pending' ? { resolved: false } : status === 'resolved' ? { resolved: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const mapped = approvals.map(a => ({
      id: a.id,
      title: a.title,
      description: a.message ?? '',
      resource: a.appSlug ?? 'general',
      status: a.resolved ? 'resolved' : 'pending',
      severity: a.severity,
      metadata: a.metadata ? JSON.parse(a.metadata) : {},
      createdAt: a.createdAt,
      resolvedAt: a.resolvedAt,
    }))

    return NextResponse.json({ approvals: mapped, total: mapped.length })
  } catch (e) {
    return NextResponse.json({ approvals: [], total: 0, error: e instanceof Error ? e.message : 'Failed to fetch approvals' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { title, description, category, resource, severity: sev } = body
      if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

      const approval = await prisma.systemAlert.create({
        data: {
          alertType: 'approval_request',
          severity: sev ?? 'warning',
          title,
          message: description ?? '',
          appSlug: resource ?? category ?? null,
          metadata: JSON.stringify({ category: category ?? 'general', requestedAt: new Date().toISOString() }),
        },
      })

      return NextResponse.json({ approval: { id: approval.id, title: approval.title, status: 'pending' } })
    }

    if (action === 'resolve') {
      const { id, decision } = body
      if (!id) return NextResponse.json({ error: 'Approval ID is required' }, { status: 400 })

      await prisma.systemAlert.update({
        where: { id: Number(id) },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          message: `${decision === 'approved' ? 'Approved' : 'Rejected'} by admin`,
        },
      })

      return NextResponse.json({ success: true, decision })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to process approval' }, { status: 500 })
  }
}
