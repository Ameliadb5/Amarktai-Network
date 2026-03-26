import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getGitHubConfig, saveGitHubConfig } from '@/lib/github-integration'

/** GET /api/admin/github — get GitHub integration config (masked) */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getGitHubConfig()
    return NextResponse.json(config ?? { configured: false })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load GitHub config' },
      { status: 500 },
    )
  }
}

/** POST /api/admin/github — save/update GitHub integration config */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { username, accessToken, defaultOwner } = body

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required' }, { status: 400 })
    }

    const config = await saveGitHubConfig({
      username: username ?? '',
      accessToken,
      defaultOwner: defaultOwner ?? username ?? '',
    })
    return NextResponse.json(config)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save GitHub config' },
      { status: 500 },
    )
  }
}
