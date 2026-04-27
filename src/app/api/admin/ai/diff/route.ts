import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { routeWorkspaceTask } from '@/lib/workspace-executor'

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg',
  'mp3', 'mp4', 'wav', 'ogg', 'flac', 'aac',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z', 'wasm', 'bin',
  'ttf', 'woff', 'woff2', 'eot',
])

function isBinaryPath(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return BINARY_EXTENSIONS.has(ext)
}

const DIFF_SYSTEM_PROMPT = `You are an expert code change engine for the Amarktai Network platform.

Given file context and an instruction, you must return a structured JSON response ONLY.
No prose before or after the JSON. No markdown fences.

Response schema:
{
  "summary": "<1-2 sentence plain-English summary of what was changed>",
  "filesChanged": [
    {
      "path": "<file path>",
      "action": "modified" | "created" | "deleted",
      "diff": "<unified diff for this file, or full content if new>",
      "description": "<short description of change>"
    }
  ],
  "riskNotes": ["<any risk or caveat>"],
  "verificationCommands": ["<command to verify the change works, e.g. npm test>"]
}

Rules:
- Only output valid JSON. Never output anything outside the JSON object.
- For modified files: provide a standard unified diff (--- a/path, +++ b/path, @@ hunks).
- For new files: set action="created" and put the full file content in diff.
- For deleted files: set action="deleted" and diff="".
- Do not modify binary files. Skip them entirely.
- Be precise. Only change what the instruction asks.
- If the instruction is unclear, still produce the best possible change and add a risk note.`

/**
 * POST /api/admin/ai/diff
 *
 * Body:
 *   instruction   string   — what the AI should do
 *   files         Array    — [{ path: string, content: string }] file contexts
 *   policyOverride string? — 'best' | 'cheap' | 'balanced' | 'fixed'
 *   fixedModel    string?  — exact model ID when policy='fixed'
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { instruction, files, policyOverride, fixedModel } = body

    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 })
    }
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'files array is required and must be non-empty' }, { status: 400 })
    }

    // Filter out binary files
    const textFiles = files.filter((f: { path: string; content: string }) => !isBinaryPath(f.path))
    const binarySkipped = files.filter((f: { path: string }) => isBinaryPath(f.path)).map((f: { path: string }) => f.path)

    if (textFiles.length === 0) {
      return NextResponse.json({
        error: 'All selected files are binary. Only text/code files can be edited by AI.',
        binarySkipped,
      }, { status: 400 })
    }

    // Build the user task
    const fileList = textFiles.map((f: { path: string; content: string }) =>
      `=== FILE: ${f.path} ===\n${f.content}`
    ).join('\n\n')

    const task = `INSTRUCTION: ${instruction.trim()}

FILES:
${fileList}

Return ONLY the JSON response schema described in your system prompt.`

    const result = await routeWorkspaceTask({
      task,
      systemPrompt: DIFF_SYSTEM_PROMPT,
      fileContexts: textFiles.map((f: { path: string; content: string }) => ({
        path: f.path,
        content: f.content,
      })),
      capability: 'code',
      operationType: 'code',
      policyOverride: policyOverride ?? undefined,
      fixedModelOverride: fixedModel ?? undefined,
      maxTokens: 8192,
    })

    if (!result.success || !result.output) {
      return NextResponse.json({
        error: result.error ?? 'AI did not produce a response',
        model: result.resolvedModel,
        traceId: result.traceId,
      }, { status: 422 })
    }

    // Parse the AI JSON output
    let parsed: {
      summary: string
      filesChanged: Array<{ path: string; action: string; diff: string; description: string }>
      riskNotes: string[]
      verificationCommands: string[]
    }
    try {
      // Strip any accidental markdown fences
      const cleaned = result.output
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: 'AI returned non-JSON output',
        rawOutput: result.output.slice(0, 1000),
        model: result.resolvedModel,
        traceId: result.traceId,
      }, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      summary: parsed.summary ?? '',
      filesChanged: Array.isArray(parsed.filesChanged) ? parsed.filesChanged : [],
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
      verificationCommands: Array.isArray(parsed.verificationCommands) ? parsed.verificationCommands : [],
      binarySkipped,
      model: result.resolvedModel,
      traceId: result.traceId,
      latencyMs: result.latencyMs,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Diff generation failed' },
      { status: 500 },
    )
  }
}
