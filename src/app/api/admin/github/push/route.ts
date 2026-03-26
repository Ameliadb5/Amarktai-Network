import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { pushProjectToGitHub, getGitHubPushLog } from '@/lib/github-integration'

/** POST /api/admin/github/push — push project files to GitHub */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { projectId, repoFullName, branch, commitMessage, files } = body

    if (!projectId || !repoFullName || !branch || !files) {
      return NextResponse.json({ error: 'projectId, repoFullName, branch, and files are required' }, { status: 400 })
    }

    const result = await pushProjectToGitHub({
      projectId: parseInt(projectId, 10),
      repoFullName,
      branch,
      commitMessage: commitMessage ?? `AmarktAI Playground export — ${new Date().toISOString()}`,
      files,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 422 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Push failed' },
      { status: 500 },
    )
  }
}

/** GET /api/admin/github/push — get push audit log */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const log = await getGitHubPushLog(30)
    return NextResponse.json({ log })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load push log' },
      { status: 500 },
    )
  }
}
