import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getProject, updateProject, deleteProject, addPromptToHistory, addFileToProject } from '@/lib/playground'

/** GET /api/admin/playground/[id] — get a specific project */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const projectId = parseInt(id, 10)
  if (isNaN(projectId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const project = await getProject(projectId)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(project)
}

/** PATCH /api/admin/playground/[id] — update a project */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const projectId = parseInt(id, 10)
  if (isNaN(projectId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const body = await req.json()

    // Handle special actions
    if (body._action === 'add_prompt') {
      const updated = await addPromptToHistory(projectId, body.entry)
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(updated)
    }

    if (body._action === 'add_file') {
      const updated = await addFileToProject(projectId, body.file)
      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(updated)
    }

    // General update
    const updated = await updateProject(projectId, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Update failed' },
      { status: 500 },
    )
  }
}

/** DELETE /api/admin/playground/[id] — delete a project */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const projectId = parseInt(id, 10)
  if (isNaN(projectId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const ok = await deleteProject(projectId)
  if (!ok) return NextResponse.json({ error: 'Not found or already deleted' }, { status: 404 })

  return NextResponse.json({ success: true })
}
