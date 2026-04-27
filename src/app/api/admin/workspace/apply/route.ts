/**
 * POST /api/admin/workspace/apply
 *
 * Approve and apply a workspace changeset (Phase 3C).
 *
 * Steps:
 *   1. Load changeset from DB by ID
 *   2. Mark as "approved"
 *   3. Save a 'changeset' artifact with the unified diff as content
 *   4. Optionally commit + push to GitHub if repoFullName + push=true
 *   5. Return artifact ID and changeset status
 *
 * Body:
 * {
 *   changesetId: string   — ID of the WorkspaceChangeset to apply
 *   push?:       boolean  — if true, also commit/push to GitHub
 *   commitMessage?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createArtifact } from '@/lib/artifact-store'
import { pushProjectToGitHub } from '@/lib/github-integration'

interface FileChange {
  path: string
  oldContent: string
  newContent: string
  language?: string
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const changesetId = typeof body.changesetId === 'string' ? body.changesetId.trim() : ''
  const shouldPush  = body.push === true
  const commitMsg   = typeof body.commitMessage === 'string' ? body.commitMessage.trim() : ''

  if (!changesetId) {
    return NextResponse.json({ error: 'changesetId is required' }, { status: 400 })
  }

  // Load changeset
  let changeset: Awaited<ReturnType<typeof prisma.workspaceChangeset.findUnique>>
  try {
    changeset = await prisma.workspaceChangeset.findUnique({ where: { id: changesetId } })
  } catch {
    return NextResponse.json({ error: 'Failed to load changeset' }, { status: 500 })
  }

  if (!changeset) {
    return NextResponse.json({ error: 'Changeset not found' }, { status: 404 })
  }

  if (changeset.status === 'applied' || changeset.status === 'committed') {
    return NextResponse.json({ error: `Changeset is already ${changeset.status}` }, { status: 409 })
  }

  if (changeset.status === 'rejected') {
    return NextResponse.json({ error: 'Changeset has been rejected and cannot be applied' }, { status: 409 })
  }

  const filesChanged: FileChange[] = (() => {
    try { return JSON.parse(changeset.filesChanged) as FileChange[] } catch { return [] }
  })()

  // Save changeset as a 'changeset' artifact
  let artifactId: string | null = null
  try {
    const artifact = await createArtifact({
      appSlug: 'workspace',
      type: 'changeset',
      subType: 'code_diff',
      title: `Changeset: ${changeset.summary.slice(0, 80)}`,
      description: `Instruction: ${changeset.instruction}\n\nFiles changed: ${filesChanged.length}\n\nRisk: ${changeset.riskNotes}`,
      provider: 'workspace',
      model: changeset.resolvedModel,
      traceId: changeset.traceId,
      mimeType: 'text/plain',
      content: changeset.unifiedDiff,
      metadata: {
        repoFullName: changeset.repoFullName,
        branch: changeset.branch,
        fileCount: filesChanged.length,
        filePaths: filesChanged.map(f => f.path),
        verifyCommands: (() => { try { return JSON.parse(changeset.verifyCommands) } catch { return [] } })(),
      },
      status: 'completed',
    })
    artifactId = artifact.id
  } catch {
    // Non-fatal
  }

  // Mark as approved + applied
  await prisma.workspaceChangeset.update({
    where: { id: changesetId },
    data: {
      status: 'applied',
      appliedAt: new Date(),
      artifactId: artifactId ?? undefined,
    },
  })

  // Optionally push to GitHub
  let commitSha: string | null = null
  let pushError: string | null = null

  if (shouldPush && changeset.repoFullName && filesChanged.length > 0) {
    const defaultMsg = `AI changeset: ${changeset.summary.slice(0, 72)}`
    const message = commitMsg || defaultMsg

    try {
      // Get a playground project id (use changeset id as a standin — create a temp project)
      let projectId: number
      const existingProject = await prisma.playgroundProject.findFirst({
        where: { githubRepo: changeset.repoFullName },
      })

      if (existingProject) {
        projectId = existingProject.id
      } else {
        const newProject = await prisma.playgroundProject.create({
          data: {
            name: `Workspace: ${changeset.repoFullName}`,
            type: 'code_assistant',
            status: 'active',
            githubRepo: changeset.repoFullName,
            githubBranch: changeset.branch,
          },
        })
        projectId = newProject.id
      }

      const pushResult = await pushProjectToGitHub({
        projectId,
        repoFullName: changeset.repoFullName,
        branch: changeset.branch,
        commitMessage: message,
        files: filesChanged.map(f => ({ path: f.path, content: f.newContent })),
      })

      if (pushResult.success) {
        commitSha = pushResult.commitSha ?? null
        await prisma.workspaceChangeset.update({
          where: { id: changesetId },
          data: {
            status: 'committed',
            committedAt: new Date(),
            commitSha: commitSha ?? undefined,
          },
        })
      } else {
        pushError = pushResult.error ?? 'Push failed'
      }
    } catch (e) {
      pushError = e instanceof Error ? e.message : 'Push failed'
    }
  }

  return NextResponse.json({
    success: true,
    changesetId,
    status: changeset.repoFullName && shouldPush && !pushError ? 'committed' : 'applied',
    artifactId,
    commitSha,
    pushError,
    filesApplied: filesChanged.length,
  })
}
