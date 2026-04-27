/**
 * POST /api/admin/workspace/diff
 *
 * AI Code Change Engine — Phase 3C.
 *
 * Accepts selected files + an instruction and returns:
 *   - summary: plain-text summary of the proposed changes
 *   - filesChanged: [{path, oldContent, newContent}]
 *   - unifiedDiff: unified diff text for all changed files
 *   - riskNotes: AI assessment of risk/impact
 *   - verifyCommands: recommended test/verify commands
 *   - changesetId: DB ID of the saved WorkspaceChangeset draft
 *
 * The changeset is saved to the DB in "draft" status.
 * The user reviews the diff, then calls /api/admin/workspace/apply to approve.
 *
 * Body:
 * {
 *   instruction:   string  — user's AI instruction
 *   files:         [{path: string, content: string, language?: string}]
 *   repoFullName?: string  — e.g. "owner/repo" (for context only)
 *   branch?:       string  — current branch (for context)
 *   policyOverride?: string — model policy override
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { routeWorkspaceTask } from '@/lib/workspace-executor'
import { randomUUID } from 'crypto'

interface FileInput {
  path: string
  content: string
  language?: string
}

interface FileChange {
  path: string
  oldContent: string
  newContent: string
  language?: string
}

interface ParsedDiffResponse {
  summary: string
  filesChanged: FileChange[]
  riskNotes: string
  verifyCommands: string[]
}

const DIFF_SYSTEM_PROMPT = `You are an expert software engineer performing code changes on behalf of the user.

You will receive:
1. The user's instruction
2. Selected file contexts with paths and contents

Your response MUST be valid JSON matching this exact schema:
{
  "summary": "Plain English summary of all changes (2-4 sentences)",
  "filesChanged": [
    {
      "path": "relative/file/path.ts",
      "oldContent": "original file content verbatim",
      "newContent": "modified file content with changes applied"
    }
  ],
  "riskNotes": "Risk assessment: breaking changes, dependencies affected, rollback notes",
  "verifyCommands": ["npm test", "npm run build", "specific test command if known"]
}

Rules:
- Only include files that are actually changed (different newContent from oldContent)
- Preserve file formatting, indentation, and line endings exactly
- Do not include binary files or files you cannot safely modify
- The oldContent must be the EXACT content provided to you for that file
- The newContent must be the complete modified file (not a partial diff)
- Do not include markdown fences around the JSON
- Return ONLY the JSON object, nothing else`

function buildUnifiedDiff(changes: FileChange[]): string {
  const lines: string[] = []
  for (const change of changes) {
    lines.push(`--- a/${change.path}`)
    lines.push(`+++ b/${change.path}`)
    const oldLines = change.oldContent.split('\n')
    const newLines = change.newContent.split('\n')
    lines.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`)
    for (const l of oldLines) lines.push(`-${l}`)
    for (const l of newLines) lines.push(`+${l}`)
    lines.push('')
  }
  return lines.join('\n')
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

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
  const files = Array.isArray(body.files) ? (body.files as FileInput[]) : []
  const repoFullName = typeof body.repoFullName === 'string' ? body.repoFullName : ''
  const branch = typeof body.branch === 'string' ? body.branch : 'main'
  const policyOverride = typeof body.policyOverride === 'string' ? body.policyOverride : undefined

  if (!instruction) {
    return NextResponse.json({ error: 'instruction is required' }, { status: 400 })
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'At least one file context must be provided in files[]' }, { status: 400 })
  }
  if (files.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 files per changeset request' }, { status: 400 })
  }

  // Build task prompt
  const fileList = files
    .map(f => `### File: ${f.path}\n\`\`\`${f.language ?? ''}\n${f.content}\n\`\`\``)
    .join('\n\n')

  const task = `User instruction: ${instruction}

${repoFullName ? `Repository: ${repoFullName} (branch: ${branch})\n` : ''}
Selected files:

${fileList}

Return a JSON object with the schema described in the system prompt. Make the requested changes.`

  const start = Date.now()

  const result = await routeWorkspaceTask({
    task,
    systemPrompt: DIFF_SYSTEM_PROMPT,
    capability: 'code',
    operationType: 'code',
    policyOverride: policyOverride as 'best' | 'cheap' | 'balanced' | 'fixed' | undefined,
    maxTokens: 8192,
    temperature: 0.2,
  })

  const latencyMs = Date.now() - start

  if (!result.success || !result.output) {
    return NextResponse.json({
      success: false,
      error: result.error ?? 'AI did not return a response',
      resolvedModel: result.resolvedModel,
    }, { status: 422 })
  }

  // Parse the JSON response
  let parsed: ParsedDiffResponse
  try {
    // Strip markdown fences if the model wrapped it anyway
    const raw = result.output.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(raw) as ParsedDiffResponse
  } catch {
    return NextResponse.json({
      success: false,
      error: 'AI returned an invalid response format. Try again or use a different model.',
      rawOutput: result.output.slice(0, 500),
      resolvedModel: result.resolvedModel,
    }, { status: 422 })
  }

  // Validate filesChanged
  const filesChanged: FileChange[] = (parsed.filesChanged ?? []).filter(
    (f): f is FileChange =>
      typeof f === 'object' &&
      typeof f.path === 'string' &&
      typeof f.oldContent === 'string' &&
      typeof f.newContent === 'string' &&
      f.oldContent !== f.newContent
  )

  if (filesChanged.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'AI produced no file changes. The instruction may have been satisfied without modifying files, or try rephrasing.',
      summary: parsed.summary ?? '',
      resolvedModel: result.resolvedModel,
    }, { status: 422 })
  }

  const unifiedDiff = buildUnifiedDiff(filesChanged)
  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const riskNotes = typeof parsed.riskNotes === 'string' ? parsed.riskNotes : ''
  const verifyCommands: string[] = Array.isArray(parsed.verifyCommands)
    ? parsed.verifyCommands.filter((c): c is string => typeof c === 'string')
    : []

  // Save changeset to DB as draft
  let changesetId: string | null = null
  try {
    const changeset = await prisma.workspaceChangeset.create({
      data: {
        traceId: result.traceId,
        repoFullName,
        branch,
        instruction,
        summary,
        unifiedDiff,
        filesChanged: JSON.stringify(filesChanged),
        riskNotes,
        verifyCommands: JSON.stringify(verifyCommands),
        status: 'draft',
        resolvedModel: result.resolvedModel,
        latencyMs,
      },
    })
    changesetId = changeset.id
  } catch {
    // Non-fatal — return result even if DB save fails
  }

  return NextResponse.json({
    success: true,
    changesetId,
    summary,
    filesChanged: filesChanged.map(f => ({
      path: f.path,
      language: f.language,
      linesAdded: f.newContent.split('\n').length - f.oldContent.split('\n').length,
    })),
    unifiedDiff,
    riskNotes,
    verifyCommands,
    resolvedModel: result.resolvedModel,
    latencyMs,
    fileCount: filesChanged.length,
  })
}
