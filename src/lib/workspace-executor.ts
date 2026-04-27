/**
 * Workspace Executor — GenX-First Task Routing
 *
 * Replaces provider-based callProvider() for workspace tasks with
 * a GenX-first execution path:
 *
 *   1. Fetch workspace config (modelPolicy, fixedModel)
 *   2. Build file context from loaded files
 *   3. Select GenX model using policy + capability
 *   4. Call GenX with context + task
 *   5. Return output
 *   6. Log session to WorkspaceSession table
 *
 * Falls back to callProvider() only when GenX is unavailable AND a
 * fallback provider key is configured.
 *
 * Server-side only.
 */

import { randomUUID } from 'crypto'
import {
  selectGenXModel,
  callGenXChat,
  getGenXStatus,
  type GenXModelPolicy,
  type GenXCapability,
  type GenXOperationType,
  type GenXChatMessage,
} from '@/lib/genx-client'
import { callProvider } from '@/lib/brain'
import { prisma } from '@/lib/prisma'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileContext {
  path: string
  content: string
  language?: string
}

export interface WorkspaceTaskInput {
  task: string
  systemPrompt?: string
  fileContexts?: FileContext[]
  capability?: GenXCapability
  operationType?: GenXOperationType
  /** Override the workspace-level model policy for this individual task. */
  policyOverride?: GenXModelPolicy
  fixedModelOverride?: string
  maxTokens?: number
  temperature?: number
}

export interface WorkspaceTaskResult {
  success: boolean
  output: string | null
  resolvedModel: string
  modelPolicy: GenXModelPolicy
  latencyMs: number
  genxUsed: boolean
  fallbackUsed: boolean
  error: string | null
  traceId: string
}

// ── Workspace Config ──────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  modelPolicy: GenXModelPolicy
  fixedModel: string | null
  enabledFeatures: string[]
  workspaceSessions: unknown[]
  fileContexts: FileContext[]
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  modelPolicy: 'best',
  fixedModel: null,
  enabledFeatures: [],
  workspaceSessions: [],
  fileContexts: [],
}

export async function getWorkspaceConfig(): Promise<WorkspaceConfig> {
  try {
    // Use id=1 as the singleton workspace config row
    const row = await prisma.workspaceConfig.findUnique({ where: { id: 1 } })
    if (!row) return DEFAULT_CONFIG

    return {
      modelPolicy: (row.modelPolicy as GenXModelPolicy) ?? 'best',
      fixedModel: row.fixedModel ?? null,
      enabledFeatures: safeParseJson<string[]>(row.enabledFeatures, []),
      workspaceSessions: safeParseJson<unknown[]>(row.workspaceSessions, []),
      fileContexts: safeParseJson<FileContext[]>(row.fileContexts, []),
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveWorkspaceConfig(
  patch: Partial<Omit<WorkspaceConfig, 'workspaceSessions'>>,
): Promise<WorkspaceConfig> {
  const current = await prisma.workspaceConfig.findUnique({ where: { id: 1 } })

  const currentData = current ?? {
    modelPolicy:       'best',
    fixedModel:        null,
    enabledFeatures:   '[]',
    workspaceSessions: '[]',
    fileContexts:      '[]',
  }

  const updated = {
    modelPolicy:      patch.modelPolicy      ?? currentData.modelPolicy,
    fixedModel:       patch.fixedModel       !== undefined ? patch.fixedModel  : currentData.fixedModel,
    enabledFeatures:  patch.enabledFeatures  !== undefined
      ? JSON.stringify(patch.enabledFeatures)
      : currentData.enabledFeatures,
    fileContexts: patch.fileContexts !== undefined
      ? JSON.stringify(patch.fileContexts)
      : currentData.fileContexts,
    workspaceSessions: currentData.workspaceSessions,
  }

  const row = current
    ? await prisma.workspaceConfig.update({ where: { id: 1 }, data: updated })
    : await prisma.workspaceConfig.create({ data: { id: 1, ...updated } })

  return {
    modelPolicy: (row.modelPolicy as GenXModelPolicy) ?? 'best',
    fixedModel: row.fixedModel ?? null,
    enabledFeatures: safeParseJson<string[]>(row.enabledFeatures, []),
    workspaceSessions: safeParseJson<unknown[]>(row.workspaceSessions, []),
    fileContexts: safeParseJson<FileContext[]>(row.fileContexts, []),
  }
}

// ── Workspace Task Execution ──────────────────────────────────────────────────

/**
 * Execute a workspace task using the GenX-first execution path.
 *
 * Flow:
 *   1. Load workspace config to get modelPolicy + fixedModel
 *   2. Apply per-call overrides if present
 *   3. Select GenX model via selectGenXModel(policy, capability, operationType)
 *   4. Build messages array with file context injected as a system message
 *   5. Call GenX chat
 *   6. If GenX unavailable → fallback to provider vault
 *   7. Log session
 *   8. Return result
 */
export async function routeWorkspaceTask(
  input: WorkspaceTaskInput,
): Promise<WorkspaceTaskResult> {
  const traceId = randomUUID()

  // 1 + 2. Resolve policy
  const config = await getWorkspaceConfig()
  const policy: GenXModelPolicy = input.policyOverride ?? config.modelPolicy
  const fixedModelId = input.fixedModelOverride ?? config.fixedModel ?? undefined

  // 3. Select GenX model
  const capability    = input.capability    ?? 'chat'
  const operationType = input.operationType ?? 'chat'
  const resolvedModel = await selectGenXModel(policy, capability, operationType, fixedModelId)

  // 4. Build messages
  const messages: GenXChatMessage[] = []

  // System prompt
  const systemParts: string[] = []
  if (input.systemPrompt) systemParts.push(input.systemPrompt)

  // Inject file contexts
  const allFileContexts = [
    ...config.fileContexts,
    ...(input.fileContexts ?? []),
  ]
  if (allFileContexts.length > 0) {
    systemParts.push('## File Context')
    for (const fc of allFileContexts) {
      const lang = fc.language ?? detectLanguage(fc.path)
      systemParts.push(
        `### ${fc.path}\n\`\`\`${lang}\n${fc.content}\n\`\`\``,
      )
    }
  }

  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') })
  }

  messages.push({ role: 'user', content: input.task })

  // 5. Call GenX
  const genxStatus = getGenXStatus()
  let result: WorkspaceTaskResult

  if (genxStatus.available) {
    const genxResult = await callGenXChat({
      model: resolvedModel,
      messages,
      max_tokens: input.maxTokens ?? 4096,
      temperature: input.temperature,
      metadata: { traceId, source: 'workspace' },
    })

    result = {
      success: genxResult.success,
      output: genxResult.output,
      resolvedModel: genxResult.model,
      modelPolicy: policy,
      latencyMs: genxResult.latencyMs,
      genxUsed: true,
      fallbackUsed: false,
      error: genxResult.error,
      traceId,
    }
  } else {
    // 6. GenX unavailable — fall back to provider vault if configured
    const fallbackResult = await callProviderFallback(
      messages,
    )

    result = {
      success: fallbackResult.ok,
      output: fallbackResult.output,
      resolvedModel: `${fallbackResult.providerKey}/${fallbackResult.model}`,
      modelPolicy: policy,
      latencyMs: fallbackResult.latencyMs,
      genxUsed: false,
      fallbackUsed: true,
      error: fallbackResult.error ?? (fallbackResult.ok ? null : 'Fallback provider call failed'),
      traceId,
    }
  }

  // 7. Log session (non-fatal)
  logWorkspaceSession(result, input, allFileContexts).catch(() => {})

  return result
}

// ── Fallback Provider ─────────────────────────────────────────────────────────

/**
 * Fallback: attempt to call the first available provider in the vault.
 * Uses openai → groq → anthropic preference order.
 * Only called when GenX is unavailable.
 */
async function callProviderFallback(
  messages: GenXChatMessage[],
) {
  // Convert messages to a single user message for legacy callProvider()
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
  const userMsg   = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n')

  const fallbackChain = ['openai', 'groq', 'anthropic', 'gemini', 'deepseek']

  for (const providerKey of fallbackChain) {
    try {
      const res = await callProvider(
        providerKey,
        '',
        userMsg,
        systemMsg || undefined,
      )
      if (res.ok) return res
    } catch {
      // try next
    }
  }

  return {
    ok: false,
    output: null,
    error: 'All fallback providers unavailable',
    latencyMs: 0,
    model: 'none',
    providerKey: 'none',
  }
}

// ── Session Logging ───────────────────────────────────────────────────────────

async function logWorkspaceSession(
  result: WorkspaceTaskResult,
  input: WorkspaceTaskInput,
  fileContexts: FileContext[],
): Promise<void> {
  try {
    await prisma.workspaceSession.create({
      data: {
        traceId:      result.traceId,
        modelPolicy:  result.modelPolicy,
        resolvedModel: result.resolvedModel,
        taskType:     input.operationType ?? 'chat',
        input:        input.task,
        output:       result.output ?? undefined,
        fileContexts: JSON.stringify(
          fileContexts.map((f) => ({ path: f.path, language: f.language })),
        ),
        success:      result.success,
        latencyMs:    result.latencyMs,
        error:        result.error ?? undefined,
      },
    })
  } catch {
    // DB logging is non-fatal
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
    cs: 'csharp', cpp: 'cpp', c: 'c', rb: 'ruby', php: 'php',
    md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
    html: 'html', css: 'css', scss: 'scss', sql: 'sql',
    sh: 'bash', bash: 'bash', zsh: 'bash', dockerfile: 'dockerfile',
    prisma: 'prisma', graphql: 'graphql', toml: 'toml',
  }
  return map[ext] ?? ext
}
