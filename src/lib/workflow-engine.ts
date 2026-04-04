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

const workflows = new Map<string, Workflow>()
const workflowRuns = new Map<string, WorkflowRun>()

// ── Workflow CRUD ────────────────────────────────────────────────────────────

/** Create a new workflow. */
export function createWorkflow(input: {
  name: string
  description: string
  appSlug: string
  steps: WorkflowStep[]
  entryStepId: string
}): Workflow {
  const id = randomUUID()
  const now = new Date().toISOString()
  const stepMap = new Map<string, WorkflowStep>()
  for (const step of input.steps) {
    stepMap.set(step.id, step)
  }

  const workflow: Workflow = {
    id,
    name: input.name,
    description: input.description,
    appSlug: input.appSlug,
    version: 1,
    steps: stepMap,
    entryStepId: input.entryStepId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    metadata: {},
  }

  workflows.set(id, workflow)
  return workflow
}

/** Get a workflow by ID. */
export function getWorkflow(id: string): Workflow | null {
  return workflows.get(id) ?? null
}

/** List workflows for an app. */
export function listWorkflows(appSlug: string): Workflow[] {
  return Array.from(workflows.values()).filter((w) => w.appSlug === appSlug)
}

/** Activate a workflow. */
export function activateWorkflow(id: string): boolean {
  const wf = workflows.get(id)
  if (!wf) return false
  wf.status = 'active'
  wf.updatedAt = new Date().toISOString()
  return true
}

/** Delete a workflow. */
export function deleteWorkflow(id: string): boolean {
  return workflows.delete(id)
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
  const workflow = workflows.get(workflowId)
  if (!workflow) {
    throw new Error(`Workflow "${workflowId}" not found`)
  }

  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId,
    status: 'running',
    input,
    output: null,
    stepResults: new Map(),
    startedAt: new Date().toISOString(),
    totalLatencyMs: 0,
  }
  workflowRuns.set(run.id, run)

  const context: ExecutionContext = {
    workflowId,
    runId: run.id,
    variables: {},
    results: run.stepResults,
  }

  const runStart = Date.now()

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
        // Handle parallel steps
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
        }
        // Handle loop steps
        else if (step.type === 'loop' && step.loopStepId && Array.isArray(currentInput)) {
          const loopStep = workflow.steps.get(step.loopStepId)
          if (!loopStep) throw new Error(`Loop step "${step.loopStepId}" not found`)
          const executor = stepExecutors[loopStep.type]
          const results = []
          for (const item of currentInput) {
            results.push(await executor(loopStep, item, context))
          }
          currentInput = results
        }
        // Normal step execution
        else {
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

        // Retry logic
        if (step.retries && step.retries > 0) {
          // Simple retry (decrement and try again)
          step.retries--
          continue
        }

        throw err
      }

      run.stepResults.set(step.id, stepResult)

      // Determine next step
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

    run.output = currentInput
    run.status = 'completed'
  } catch (err) {
    run.status = 'failed'
    run.error = err instanceof Error ? err.message : 'Workflow execution failed'
  }

  run.completedAt = new Date().toISOString()
  run.totalLatencyMs = Date.now() - runStart
  return run
}

/** Get a workflow run by ID. */
export function getWorkflowRun(runId: string): WorkflowRun | null {
  return workflowRuns.get(runId) ?? null
}

/** List runs for a workflow. */
export function listWorkflowRuns(workflowId: string): WorkflowRun[] {
  return Array.from(workflowRuns.values())
    .filter((r) => r.workflowId === workflowId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const STEP_TYPES: StepType[] = ['input', 'ai_completion', 'transform', 'condition', 'parallel', 'loop', 'webhook', 'delay', 'output']
export const WORKFLOW_STATUSES = ['draft', 'active', 'archived'] as const
