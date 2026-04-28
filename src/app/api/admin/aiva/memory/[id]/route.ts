/**
 * DELETE /api/admin/aiva/memory/[id] — delete an AivaMemory by id
 *
 * Requires an active admin session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    try {
      await prisma.aivaMemory.delete({ where: { id } })
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({ error: 'Memory not found or table unavailable' }, { status: 404 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
