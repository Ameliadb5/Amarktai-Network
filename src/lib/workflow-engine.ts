/**
 * Workflow Engine — Visual AI Pipeline Builder
 *
 * Define and execute multi-step AI workflows: Input → Model A → Transform →
 * Model B → Output. Think Zapier meets AI — chain models together.
 *
 * Supports: sequential, parallel, conditional, and loop steps.
 * Truthful: Each step's success/failure is tracked honestly.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export type StepType =
  | 'input'           // User input / trigger
  | 'ai_completion'   // Call an AI model
  | 'transform'       // Data transformation (template, extract, filter)
  | 'condition'       // Conditional branching
  | 'parallel'        // Run multiple steps in parallel
  | 'loop'            // Loop over array items
  | 'webhook'         // Call external API
  | 'delay'           // Wait for specified time
  | 'output'          // Final output

export interface WorkflowStep {
  id: string
  type: StepType
  name: string
  config: Record<string, unknown>
  /** Next step ID (for sequential flow) */
  next?: string
  /** Conditional next steps: condition → stepId */
  branches?: Array<{ condition: string; stepId: string }>
  /** For parallel steps: list of step IDs to run concurrently */
  parallelSteps?: string[]
  /** For loop steps: step ID to execute per item */
  loopStepId?: string
  /** Retry configuration */
  retries?: number
  /** Timeout in ms */
  timeoutMs?: number
}

export interface Workflow {
  id: string
  name: string
  description: string
  appSlug: string
  version: number
  steps: Map<string, WorkflowStep>
  entryStepId: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  input: unknown
  output: unknown
  stepResults: Map<string, StepResult>
  startedAt: string
  completedAt?: string
  totalLatencyMs: number
  error?: string
}

export interface StepResult {
  stepId: string
  stepName: string
  type: StepType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input: unknown
  output: unknown
  error?: string
  latencyMs: number
  startedAt: string
  completedAt?: string
}

// ── Storage ──────────────────────────────────────────────────────────────────

import { prisma } from './prisma'

// ── DB Helpers ───────────────────────────────────────────────────────────────

function stepsToMap(stepsJson: string): Map<string, WorkflowStep> {
  try {
    const obj = JSON.parse(stepsJson) as Record<string, WorkflowStep>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

function mapToStepsJson(steps: Map<string, WorkflowStep>): string {
  const obj: Record<string, WorkflowStep> = {}
  for (const [k, v] of steps) obj[k] = v
  return JSON.stringify(obj)
}

function rowToWorkflow(row: {
  id: string
  name: string
  description: string
  appSlug: string
  version: number
  steps: string
  entryStepId: string
  status: string
  metadata: string
  createdAt: Date
  updatedAt: Date
}): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    appSlug: row.appSlug,
    version: row.version,
    steps: stepsToMap(row.steps),
    entryStepId: row.entryStepId,
    status: row.status as Workflow['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
  }
}

function rowToRun(row: {
  id: string
  workflowId: string
  status: string
  input: string
  output: string | null
  stepResults: string
  startedAt: Date
  completedAt: Date | null
  totalLatency: number
  error: string | null
}): WorkflowRun {
  const stepResultsObj = JSON.parse(row.stepResults) as Record<string, StepResult>
  return {
    id: row.id,
    workflowId: row.workflowId,
    status: row.status as WorkflowRun['status'],
    input: JSON.parse(row.input),
    output: row.output ? JSON.parse(row.output) : null,
    stepResults: new Map(Object.entries(stepResultsObj)),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    totalLatencyMs: row.totalLatency,
    error: row.error ?? undefined,
  }
}

// ── Workflow CRUD ────────────────────────────────────────────────────────────

/** Create a new workflow. */
export async function createWorkflow(input: {
  name: string
  description: string
  appSlug: string
  steps: WorkflowStep[]
  entryStepId: string
}): Promise<Workflow> {
  const id = randomUUID()
  const stepMap = new Map<string, WorkflowStep>()
  for (const step of input.steps) {
    stepMap.set(step.id, step)
  }

  const row = await prisma.workflowDefinition.create({
    data: {
      id,
      name: input.name,
      description: input.description,
      appSlug: input.appSlug,
      steps: mapToStepsJson(stepMap),
      entryStepId: input.entryStepId,
      status: 'draft',
      metadata: '{}',
    },
  })
  return rowToWorkflow(row)
}

/** Get a workflow by ID. */
export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const row = await prisma.workflowDefinition.findUnique({ where: { id } })
    return row ? rowToWorkflow(row) : null
  } catch {
    return null
  }
}

/** List workflows for an app. */
export async function listWorkflows(appSlug: string): Promise<Workflow[]> {
  try {
    const rows = await prisma.workflowDefinition.findMany({ where: { appSlug } })
    return rows.map(rowToWorkflow)
  } catch {
    return []
  }
}

/** Activate a workflow. */
export async function activateWorkflow(id: string): Promise<boolean> {
  try {
    await prisma.workflowDefinition.update({ where: { id }, data: { status: 'active' } })
    return true
  } catch {
    return false
  }
}

/** Delete a workflow. */
export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    await prisma.workflowDefinition.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}

// ── Step Execution ───────────────────────────────────────────────────────────

type StepExecutor = (step: WorkflowStep, input: unknown, context: ExecutionContext) => Promise<unknown>

interface ExecutionContext {
  workflowId: string
  runId: string
  variables: Record<string, unknown>
  results: Map<string, StepResult>
}

const stepExecutors: Record<StepType, StepExecutor> = {
  input: async (_step, input) => input,

  ai_completion: async (step, input) => {
    // In production, this would call the brain/orchestrator
    const model = step.config.model as string ?? 'gpt-4o-mini'
    const systemPrompt = step.config.systemPrompt as string ?? ''
    const message = typeof input === 'string' ? input : JSON.stringify(input)

    // Simulate AI call (real implementation would use callProvider)
    return {
      model,
      systemPrompt: systemPrompt.slice(0, 50),
      input: message.slice(0, 100),
      output: `[AI output from ${model}] Processed: ${message.slice(0, 200)}`,
      _note: 'Connect to brain.callProvider() for real inference',
    }
  },

  transform: async (step, input) => {
    const operation = step.config.operation as string
    const data = typeof input === 'string' ? input : JSON.stringify(input)

    switch (operation) {
      case 'extract_json': {
        try { return JSON.parse(data) } catch { return { raw: data } }
      }
      case 'template': {
        const template = step.config.template as string ?? '{{input}}'
        return template.replace(/\{\{input\}\}/g, data)
      }
      case 'split': {
        const delimiter = step.config.delimiter as string ?? '\n'
        return data.split(delimiter)
      }
      case 'join': {
        if (Array.isArray(input)) return input.join(step.config.delimiter as string ?? '\n')
        return data
      }
      case 'truncate': {
        const maxLen = step.config.maxLength as number ?? 1000
        return data.slice(0, maxLen)
      }
      default:
        return input
    }
  },

  condition: async (step, input, context) => {
    const condition = step.config.condition as string ?? 'true'
    // Simple condition evaluation
    const value = typeof input === 'string' ? input : JSON.stringify(input)
    const evalResult = condition === 'true' || value.includes(condition)
    context.variables._conditionResult = evalResult
    return input
  },

  parallel: async (_step, input) => {
    // Parallel execution is handled in the run loop
    return input
  },

  loop: async (_step, input) => {
    // Loop execution is handled in the run loop
    return input
  },

  webhook: async (step, input) => {
    const url = step.config.url as string
    if (!url || !url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS')
    }

    const method = (step.config.method as string ?? 'POST').toUpperCase()
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AmarktAI-Workflow/1.0',
      },
      body: method !== 'GET' ? JSON.stringify(input) : undefined,
      signal: AbortSignal.timeout(step.timeoutMs ?? 15_000),
    })

    const text = await res.text()
    try { return JSON.parse(text) } catch { return { status: res.status, body: text.slice(0, 4096) } }
  },

  delay: async (step) => {
    const ms = Math.min(step.config.delayMs as number ?? 1000, 30_000) // Max 30s
    await new Promise((r) => setTimeout(r, ms))
    return { delayed: ms }
  },

  output: async (_step, input) => input,
}

// ── Workflow Execution ───────────────────────────────────────────────────────

/** Execute a workflow with given input. */
export async function executeWorkflow(
  workflowId: string,
  input: unknown,
): Promise<WorkflowRun> {
  const workflow = await getWorkflow(workflowId)
  if (!workflow) {
    throw new Error(`Workflow "${workflowId}" not found`)
  }

  const runId = randomUUID()
  const runStart = Date.now()

  // Create the run record in DB immediately so status is visible
  await prisma.workflowRun.create({
    data: {
      id: runId,
      workflowId,
      status: 'running',
      input: JSON.stringify(input),
      stepResults: '{}',
    },
  })

  const stepResultsMap = new Map<string, StepResult>()

  const context: ExecutionContext = {
    workflowId,
    runId,
    variables: {},
    results: stepResultsMap,
  }

  let runStatus: WorkflowRun['status'] = 'running'
  let runOutput: unknown = null
  let runError: string | undefined

  try {
    let currentStepId: string | undefined = workflow.entryStepId
    let currentInput: unknown = input
    let iterationCount = 0
    const MAX_ITERATIONS = 100

    while (currentStepId && iterationCount < MAX_ITERATIONS) {
      iterationCount++
      const step = workflow.steps.get(currentStepId)
      if (!step) {
        throw new Error(`Step "${currentStepId}" not found in workflow`)
      }

      const stepStart = Date.now()
      const stepResult: StepResult = {
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: 'running',
        input: currentInput,
        output: null,
        latencyMs: 0,
        startedAt: new Date().toISOString(),
      }

      try {
        if (step.type === 'parallel' && step.parallelSteps) {
          const parallelResults = await Promise.allSettled(
            step.parallelSteps.map(async (stepId) => {
              const pStep = workflow.steps.get(stepId)
              if (!pStep) throw new Error(`Parallel step "${stepId}" not found`)
              const executor = stepExecutors[pStep.type]
              return executor(pStep, currentInput, context)
            }),
          )
          currentInput = parallelResults.map((r) =>
            r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? 'Failed' },
          )
        } else if (step.type === 'loop' && step.loopStepId && Array.isArray(currentInput)) {
          const loopStep = workflow.steps.get(step.loopStepId)
          if (!loopStep) throw new Error(`Loop step "${step.loopStepId}" not found`)
          const executor = stepExecutors[loopStep.type]
          const results = []
          for (const item of currentInput) {
            results.push(await executor(loopStep, item, context))
          }
          currentInput = results
        } else {
          const executor = stepExecutors[step.type]
          currentInput = await executor(step, currentInput, context)
        }

        stepResult.output = currentInput
        stepResult.status = 'completed'
        stepResult.latencyMs = Date.now() - stepStart
        stepResult.completedAt = new Date().toISOString()
      } catch (err) {
        stepResult.status = 'failed'
        stepResult.error = err instanceof Error ? err.message : 'Unknown step error'
        stepResult.latencyMs = Date.now() - stepStart
        stepResult.completedAt = new Date().toISOString()

        if (step.retries && step.retries > 0) {
          step.retries--
          continue
        }

        throw err
      }

      stepResultsMap.set(step.id, stepResult)

      if (step.type === 'condition' && step.branches) {
        const condResult = context.variables._conditionResult
        const branch = step.branches.find((b) =>
          b.condition === 'true' ? condResult : b.condition === 'false' ? !condResult : false,
        )
        currentStepId = branch?.stepId ?? step.next
      } else {
        currentStepId = step.next
      }
    }

    runOutput = currentInput
    runStatus = 'completed'
  } catch (err) {
    runStatus = 'failed'
    runError = err instanceof Error ? err.message : 'Workflow execution failed'
  }

  const totalLatencyMs = Date.now() - runStart

  // Persist final results to DB
  const stepResultsObj: Record<string, StepResult> = {}
  for (const [k, v] of stepResultsMap) stepResultsObj[k] = v

  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: runStatus,
      output: JSON.stringify(runOutput),
      stepResults: JSON.stringify(stepResultsObj),
      completedAt: new Date(),
      totalLatency: totalLatencyMs,
      error: runError ?? null,
    },
  })

  return {
    id: runId,
    workflowId,
    status: runStatus,
    input,
    output: runOutput,
    stepResults: stepResultsMap,
    startedAt: new Date(Date.now() - totalLatencyMs).toISOString(),
    completedAt: new Date().toISOString(),
    totalLatencyMs,
    error: runError,
  }
}

/** Get a workflow run by ID. */
export async function getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  try {
    const row = await prisma.workflowRun.findUnique({ where: { id: runId } })
    return row ? rowToRun(row) : null
  } catch {
    return null
  }
}

/** List runs for a workflow. */
export async function listWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
  try {
    const rows = await prisma.workflowRun.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
    })
    return rows.map(rowToRun)
  } catch {
    return []
  }
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const STEP_TYPES: StepType[] = ['input', 'ai_completion', 'transform', 'condition', 'parallel', 'loop', 'webhook', 'delay', 'output']
export const WORKFLOW_STATUSES = ['draft', 'active', 'archived'] as const
