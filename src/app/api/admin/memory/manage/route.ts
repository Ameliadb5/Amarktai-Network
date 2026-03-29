import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/memory/manage — Export all memory entries for an app.
 * DELETE /api/admin/memory/manage — Clear all memory entries for an app.
 *
 * Both require admin session authentication.
 * Query param: appSlug (required)
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const appSlug = searchParams.get('appSlug')

    if (!appSlug) {
      return NextResponse.json(
        { error: 'appSlug query parameter is required' },
        { status: 400 },
      )
    }

    const entries = await prisma.memoryEntry.findMany({
      where: { appSlug },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        appSlug: true,
        memoryType: true,
        key: true,
        content: true,
        importance: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    return NextResponse.json({
      appSlug,
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      entries,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Export failed', detail: String(err) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const appSlug = searchParams.get('appSlug')

    if (!appSlug) {
      return NextResponse.json(
        { error: 'appSlug query parameter is required' },
        { status: 400 },
      )
    }

    const result = await prisma.memoryEntry.deleteMany({
      where: { appSlug },
    })

    return NextResponse.json({
      success: true,
      appSlug,
      deletedCount: result.count,
      clearedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Clear failed', detail: String(err) },
      { status: 500 },
    )
  }
}
