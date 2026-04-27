import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createArtifact } from '@/lib/artifact-store'

/**
 * POST /api/admin/ai/apply
 *
 * Saves an approved AI change set as an artifact.
 *
 * Body:
 *   instruction   string  — original instruction
 *   summary       string  — AI-generated summary
 *   filesChanged  Array   — [{ path, action, diff, description }]
 *   riskNotes     Array   — string[]
 *   verificationCommands Array — string[]
 *   model         string  — model used
 *   traceId       string  — trace ID
 *   repo          string? — owner/repo if applicable
 *   branch        string? — branch if applicable
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      instruction, summary, filesChanged, riskNotes,
      verificationCommands, model, traceId, repo, branch,
    } = body

    if (!instruction || !summary || !Array.isArray(filesChanged)) {
      return NextResponse.json(
        { error: 'instruction, summary, and filesChanged are required' },
        { status: 400 },
      )
    }

    const changeSetContent = JSON.stringify({
      instruction,
      summary,
      filesChanged,
      riskNotes: riskNotes ?? [],
      verificationCommands: verificationCommands ?? [],
      repo: repo ?? null,
      branch: branch ?? null,
      model: model ?? null,
      traceId: traceId ?? null,
      approvedAt: new Date().toISOString(),
    }, null, 2)

    const artifact = await createArtifact({
      appSlug: 'workspace',
      type: 'code',
      subType: 'change_set',
      title: `Change set: ${instruction.slice(0, 80)}${instruction.length > 80 ? '…' : ''}`,
      description: summary,
      provider: model ?? 'ai',
      model: model ?? '',
      traceId: traceId ?? '',
      mimeType: 'application/json',
      content: Buffer.from(changeSetContent, 'utf-8'),
      metadata: {
        instruction,
        repo: repo ?? null,
        branch: branch ?? null,
        filesChanged: filesChanged.length,
        changeSetType: 'diff',
      },
    })

    return NextResponse.json({
      success: true,
      artifactId: artifact.id,
      artifactUrl: artifact.storageUrl,
      filesChanged: filesChanged.length,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save change set' },
      { status: 500 },
    )
  }
}
