import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  createMusic,
  generateLyrics,
  getMusicArtifactAsync,
  getMusicArtifactsByAppAsync,
  getAllMusicArtifactsAsync,
  getMusicStudioStatus,
  getMusicStudioSummaryAsync,
  AVAILABLE_GENRES,
  AVAILABLE_VOCAL_STYLES,
  type MusicCreationRequest,
} from '@/lib/music-studio'

/**
 * GET /api/admin/music-studio
 *
 * Query params:
 *   id       - get a single artifact by ID
 *   appSlug  - filter artifacts by app
 *   summary  - return summary stats only
 *   status   - return music studio status
 *   genres   - return available genres
 *   styles   - return available vocal styles
 *   limit    - max results (default 20)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const appSlug = searchParams.get('appSlug')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100)

  if (searchParams.has('status')) {
    return NextResponse.json({ status: getMusicStudioStatus() })
  }

  if (searchParams.has('summary')) {
    return NextResponse.json({ summary: await getMusicStudioSummaryAsync() })
  }

  if (searchParams.has('genres')) {
    return NextResponse.json({ genres: AVAILABLE_GENRES })
  }

  if (searchParams.has('styles')) {
    return NextResponse.json({ styles: AVAILABLE_VOCAL_STYLES })
  }

  if (id) {
    const artifact = await getMusicArtifactAsync(id)
    if (!artifact) {
      return NextResponse.json({ error: `Artifact not found: ${id}` }, { status: 404 })
    }
    return NextResponse.json({ artifact })
  }

  const artifacts = appSlug
    ? await getMusicArtifactsByAppAsync(appSlug, limit)
    : await getAllMusicArtifactsAsync(limit)

  return NextResponse.json({
    artifacts,
    count: artifacts.length,
    status: getMusicStudioStatus(),
  })
}

/**
 * POST /api/admin/music-studio
 *
 * Body:
 *   action: 'create' | 'lyrics_only'
 *   request: MusicCreationRequest
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action?: string; request?: Partial<MusicCreationRequest> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action = 'create', request: req } = body
  if (!req) {
    return NextResponse.json({ error: 'Missing request body' }, { status: 400 })
  }
  if (!req.theme || !req.genre || !req.vocalStyle || !req.appSlug) {
    return NextResponse.json(
      { error: 'Required fields: theme, genre, vocalStyle, appSlug' },
      { status: 400 },
    )
  }

  const musicRequest = req as MusicCreationRequest

  try {
    if (action === 'lyrics_only') {
      const lyrics = await generateLyrics(musicRequest)
      return NextResponse.json({ lyrics })
    }

    // action === 'create' (default)
    const result = await createMusic(musicRequest)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Music studio error' },
      { status: 500 },
    )
  }
}
