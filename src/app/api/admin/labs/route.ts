import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import {
  generateApp,
  refineApp,
  getProjectTypes,
  getSessionHistory,
  getSession as getCodingSession,
  listSessions,
} from '@/lib/coding-agent'
import type { ProjectType, GenerateOptions } from '@/lib/coding-agent'
import { pushProjectToGitHub } from '@/lib/github-integration'

/** GET /api/admin/labs — list sessions or get session details */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  const action = searchParams.get('action')

  try {
    // Return project types
    if (action === 'types') {
      return NextResponse.json({ types: getProjectTypes() })
    }

    // Return specific session history
    if (sessionId && action === 'history') {
      const history = getSessionHistory(sessionId)
      return NextResponse.json({ history })
    }

    // Return specific session
    if (sessionId) {
      const s = getCodingSession(sessionId)
      if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      return NextResponse.json({ session: s })
    }

    // List all sessions
    const sessions = listSessions()
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to process request' },
      { status: 500 },
    )
  }
}

/** POST /api/admin/labs — generate, refine, or deploy */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action } = body

    // ── Generate ────────────────────────────────────────────────────────
    if (action === 'generate') {
      const { description, projectType, options } = body
      if (!description || !projectType) {
        return NextResponse.json(
          { error: 'description and projectType are required' },
          { status: 400 },
        )
      }
      const result = generateApp(
        description as string,
        projectType as ProjectType,
        (options ?? {}) as GenerateOptions,
      )
      return NextResponse.json({ session: result }, { status: 201 })
    }

    // ── Refine ──────────────────────────────────────────────────────────
    if (action === 'refine') {
      const { sessionId, feedback } = body
      if (!sessionId || !feedback) {
        return NextResponse.json(
          { error: 'sessionId and feedback are required' },
          { status: 400 },
        )
      }
      const result = refineApp(sessionId as string, feedback as string)
      return NextResponse.json({ session: result })
    }

    // ── Deploy to GitHub ────────────────────────────────────────────────
    if (action === 'deploy') {
      const { sessionId, repoFullName, branch, commitMessage } = body
      if (!sessionId || !repoFullName) {
        return NextResponse.json(
          { error: 'sessionId and repoFullName are required' },
          { status: 400 },
        )
      }

      const codingSession = getCodingSession(sessionId as string)
      if (!codingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const files = codingSession.files.map((f) => ({
        path: f.path,
        content: f.content,
      }))

      const result = await pushProjectToGitHub({
        projectId: 0, // Labs-generated projects don't have a playground project ID
        repoFullName: repoFullName as string,
        branch: (branch as string) || 'labs/generated-app',
        commitMessage: (commitMessage as string) || `[Labs] Generated: ${codingSession.description}`,
        files,
      })

      return NextResponse.json({ result })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to process request' },
      { status: 500 },
    )
  }
}
