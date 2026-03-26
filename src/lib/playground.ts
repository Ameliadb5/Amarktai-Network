/**
 * Playground & Project Storage — AmarktAI Network
 *
 * Admin-only workspace for:
 *   - Testing prompts against all enabled models
 *   - Comparing outputs across models
 *   - Prototyping agents and workflows
 *   - Storing prompt history, files, agent configs, and workflows
 *   - Saving named projects for later continuation
 *
 * All project data persists in the PlaygroundProject DB table.
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProjectType =
  | 'prompt_test'
  | 'agent_prototype'
  | 'workflow'
  | 'code_assistant'
  | 'comparison'
  | 'general'

export type ProjectStatus = 'draft' | 'active' | 'archived'

export interface PromptHistoryEntry {
  id: string
  timestamp: string
  prompt: string
  model: string
  provider: string
  response: string
  latencyMs: number | null
  tokensUsed: number | null
  notes: string
}

export interface ProjectFile {
  id: string
  name: string
  type: 'snippet' | 'config' | 'prompt' | 'workflow' | 'note'
  content: string
  language: string | null
  createdAt: string
  updatedAt: string
}

export interface PlaygroundProjectData {
  id: number
  name: string
  type: ProjectType
  status: ProjectStatus
  description: string
  promptHistory: PromptHistoryEntry[]
  files: ProjectFile[]
  agentConfigs: Record<string, unknown>[]
  workflows: Record<string, unknown>[]
  tags: string[]
  githubRepo: string | null
  githubBranch: string | null
  lastPushedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  type: ProjectType
  description?: string
  tags?: string[]
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: ProjectStatus
  tags?: string[]
  promptHistory?: PromptHistoryEntry[]
  files?: ProjectFile[]
  agentConfigs?: Record<string, unknown>[]
  workflows?: Record<string, unknown>[]
  githubRepo?: string | null
  githubBranch?: string | null
}

// ── Serialization helpers ─────────────────────────────────────────────────────

function deserializeProject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
): PlaygroundProjectData {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ProjectType,
    status: row.status as ProjectStatus,
    description: row.description ?? '',
    promptHistory: safeJson(row.promptHistoryJson, []),
    files: safeJson(row.filesJson, []),
    agentConfigs: safeJson(row.agentConfigsJson, []),
    workflows: safeJson(row.workflowsJson, []),
    tags: safeJson(row.tagsJson, []),
    githubRepo: row.githubRepo ?? null,
    githubBranch: row.githubBranch ?? null,
    lastPushedAt: row.lastPushedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function listProjects(
  opts: { type?: ProjectType; status?: ProjectStatus } = {},
): Promise<PlaygroundProjectData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (opts.type)   where.type   = opts.type
  if (opts.status) where.status = opts.status

  const rows = await prisma.playgroundProject.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(deserializeProject)
}

export async function getProject(id: number): Promise<PlaygroundProjectData | null> {
  const row = await prisma.playgroundProject.findUnique({ where: { id } })
  return row ? deserializeProject(row) : null
}

export async function createProject(
  input: CreateProjectInput,
): Promise<PlaygroundProjectData> {
  const row = await prisma.playgroundProject.create({
    data: {
      name: input.name,
      type: input.type,
      description: input.description ?? '',
      status: 'draft',
      promptHistoryJson: '[]',
      filesJson: '[]',
      agentConfigsJson: '[]',
      workflowsJson: '[]',
      tagsJson: JSON.stringify(input.tags ?? []),
    },
  })
  return deserializeProject(row)
}

export async function updateProject(
  id: number,
  input: UpdateProjectInput,
): Promise<PlaygroundProjectData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {}
  if (input.name        !== undefined) data.name             = input.name
  if (input.description !== undefined) data.description      = input.description
  if (input.status      !== undefined) data.status           = input.status
  if (input.tags        !== undefined) data.tagsJson          = JSON.stringify(input.tags)
  if (input.promptHistory !== undefined) data.promptHistoryJson = JSON.stringify(input.promptHistory)
  if (input.files       !== undefined) data.filesJson         = JSON.stringify(input.files)
  if (input.agentConfigs !== undefined) data.agentConfigsJson = JSON.stringify(input.agentConfigs)
  if (input.workflows   !== undefined) data.workflowsJson     = JSON.stringify(input.workflows)
  if (input.githubRepo  !== undefined) data.githubRepo        = input.githubRepo
  if (input.githubBranch !== undefined) data.githubBranch     = input.githubBranch

  try {
    const row = await prisma.playgroundProject.update({ where: { id }, data })
    return deserializeProject(row)
  } catch {
    return null
  }
}

export async function deleteProject(id: number): Promise<boolean> {
  try {
    await prisma.playgroundProject.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

export async function addPromptToHistory(
  projectId: number,
  entry: Omit<PromptHistoryEntry, 'id' | 'timestamp'>,
): Promise<PlaygroundProjectData | null> {
  const project = await getProject(projectId)
  if (!project) return null

  const newEntry: PromptHistoryEntry = {
    ...entry,
    id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  }

  const history = [newEntry, ...project.promptHistory].slice(0, 500) // keep last 500
  return updateProject(projectId, { promptHistory: history })
}

export async function addFileToProject(
  projectId: number,
  file: Omit<ProjectFile, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PlaygroundProjectData | null> {
  const project = await getProject(projectId)
  if (!project) return null

  const now = new Date().toISOString()
  const newFile: ProjectFile = {
    ...file,
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  }

  return updateProject(projectId, { files: [...project.files, newFile] })
}
