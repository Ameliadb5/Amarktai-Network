/**
 * GET  /api/admin/aiva/memory — list all AivaMemory entries
 * POST /api/admin/aiva/memory — create a new AivaMemory entry
 *
 * Both require an active admin session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const memories = await prisma.aivaMemory.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({ memories })
    } catch {
      // Table may not exist yet before migration
      return NextResponse.json({ memories: [] })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memoryType, key, content, importance, tags } = body as {
      memoryType?: string
      key?: string
      content: string
      importance?: number
      tags?: string[]
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    try {
      const memory = await prisma.aivaMemory.create({
        data: {
          memoryType: memoryType ?? 'preference',
          key: key ?? '',
          content,
          importance: importance ?? 0.5,
          tags: JSON.stringify(tags ?? []),
        },
      })
      return NextResponse.json({ memory }, { status: 201 })
    } catch {
      return NextResponse.json({ error: 'Failed to create memory — table may not exist yet' }, { status: 503 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
