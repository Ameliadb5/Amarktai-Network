import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { listProjects, createProject } from '@/lib/playground'
import type { ProjectType, ProjectStatus } from '@/lib/playground'

/** GET /api/admin/playground — list all playground projects */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type   = searchParams.get('type')   as ProjectType   | undefined
  const status = searchParams.get('status') as ProjectStatus | undefined

  try {
    const projects = await listProjects({ type: type ?? undefined, status: status ?? undefined })
    return NextResponse.json({ projects })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list projects' },
      { status: 500 },
    )
  }
}

/** POST /api/admin/playground — create a new project */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (!body.name || !body.type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }
    const project = await createProject({
      name: body.name,
      type: body.type as ProjectType,
      description: body.description,
      tags: body.tags,
    })
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create project' },
      { status: 500 },
    )
  }
}
