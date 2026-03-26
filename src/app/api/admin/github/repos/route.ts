import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { listGitHubRepos } from '@/lib/github-integration'

/** GET /api/admin/github/repos — list accessible GitHub repos */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  try {
    const result = await listGitHubRepos(page)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list repos' },
      { status: 500 },
    )
  }
}
