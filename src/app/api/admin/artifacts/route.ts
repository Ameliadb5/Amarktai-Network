import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  listArtifacts,
  getArtifact,
  getArtifactCounts,
  deleteArtifact,
  createArtifact,
  type ArtifactType,
  type ArtifactStatus,
} from '@/lib/artifact-store'

/**
 * GET /api/admin/artifacts
 *
 * Query params:
 *   id       — get single artifact
 *   appSlug  — filter by app
 *   type     — filter by type
 *   status   — filter by status
 *   counts   — return counts only
 *   limit    — max results (default 50)
 *   offset   — pagination offset
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // Single artifact
  const id = searchParams.get('id')
  if (id) {
    const artifact = await getArtifact(id)
    if (!artifact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ artifact })
  }

  // Counts only
  if (searchParams.has('counts')) {
    const appSlug = searchParams.get('appSlug') ?? undefined
    const counts = await getArtifactCounts(appSlug)
    return NextResponse.json({ counts })
  }

  // List with filters
  const result = await listArtifacts({
    appSlug: searchParams.get('appSlug') ?? undefined,
    type: (searchParams.get('type') ?? undefined) as ArtifactType | undefined,
    status: (searchParams.get('status') ?? undefined) as ArtifactStatus | undefined,
    limit: Math.min(parseInt(searchParams.get('limit') ?? '50') || 50, 200),
    offset: parseInt(searchParams.get('offset') ?? '0') || 0,
  })

  return NextResponse.json(result)
}

/**
 * POST /api/admin/artifacts
 *
 * Body:
 * {
 *   appSlug?: string
 *   type: ArtifactType
 *   subType?: string
 *   title?: string
 *   description?: string
 *   provider?: string
 *   model?: string
 *   traceId?: string
 *   mimeType?: string
 *   costUsdCents?: number
 *   metadata?: Record<string, unknown>
 *   contentUrl?: string
 *   contentBase64?: string
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body.type as ArtifactType | undefined
  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  const rawContentBase64 = body.contentBase64 as string | undefined
  const rawContentUrl = body.contentUrl as string | undefined

  let content: Buffer | undefined
  let contentUrl: string | undefined = rawContentUrl
  let mimeType = body.mimeType as string | undefined

  if (rawContentBase64 && typeof rawContentBase64 === 'string') {
    content = Buffer.from(rawContentBase64, 'base64')
  } else if (rawContentUrl && typeof rawContentUrl === 'string' && rawContentUrl.startsWith('data:')) {
    const match = rawContentUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      mimeType = mimeType ?? match[1]
      content = Buffer.from(match[2], 'base64')
      contentUrl = undefined
    }
  }

  try {
    const artifact = await createArtifact({
      appSlug: (body.appSlug as string) || '__workspace__',
      type,
      subType: body.subType as string | undefined,
      title: body.title as string | undefined,
      description: body.description as string | undefined,
      provider: body.provider as string | undefined,
      model: body.model as string | undefined,
      traceId: body.traceId as string | undefined,
      mimeType,
      costUsdCents: typeof body.costUsdCents === 'number' ? body.costUsdCents : undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? {},
      content,
      contentUrl,
    })
    return NextResponse.json({ artifact }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create artifact' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/artifacts
 *
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Artifact id required' }, { status: 400 })
  }

  const deleted = await deleteArtifact(body.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Not found or delete failed' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
