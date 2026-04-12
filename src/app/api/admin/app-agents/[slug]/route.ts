/**
 * Admin API — App Agent Detail
 *
 * GET    /api/admin/app-agents/[slug]  → Get agent config
 * PATCH  /api/admin/app-agents/[slug]  → Update agent config
 * DELETE /api/admin/app-agents/[slug]  → Delete agent
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAppAgent, updateAppAgent, deleteAppAgent, syncAdminNotesToRules } from '@/lib/app-agent'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const agent = await getAppAgent(slug)
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({ agent })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body = await req.json() as Record<string, unknown>

  // Handle admin notes → structured rules sync
  if (typeof body.adminNotes === 'string') {
    await syncAdminNotesToRules(slug, body.adminNotes)
    delete body.adminNotes // Already processed
    delete body.structuredRules // Will be set by sync
  }

  try {
    const agent = await updateAppAgent(slug, body)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return NextResponse.json({ agent })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const ok = await deleteAppAgent(slug)
  if (!ok) {
    return NextResponse.json({ error: 'Agent not found or delete failed' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
