/**
 * @module multi-agent-team
 * @description Multi-Agent Team Orchestration for AmarktAI Network.
 *
 * Implements team-level agent coordination patterns:
 *
 *   - Supervisor / manager agent that coordinates multiple specialist agents
 *   - Per-user agent isolation with shared team knowledge
 *   - Parallel agent execution with result aggregation
 *   - Agent handoff chains with context propagation
 *   - Scheduled / recurring team task execution
 *   - Team knowledge base (shared context across agents)
 *
 * Builds on top of the existing agent-runtime.ts primitives.
 *
 * Server-side only.
 */

import { randomUUID } from 'crypto'
import { createAgentTask, executeAgent } from '@/lib/agent-runtime'
import type { AgentType } from '@/lib/agent-runtime'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamRole = 'supervisor' | 'specialist' | 'reviewer' | 'researcher' | 'communicator'

export type TeamTaskStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TeamMember {
  id: string
  agentType: AgentType
  role: TeamRole
  name: string
  description: string
  /** Specific domains this member specialises in */
  specializations: string[]
  /** Whether this member can be a supervisor */
  canSupervise: boolean
}

export interface TeamDefinition {
  id: string
  name: string
  description: string
  appSlug: string
  members: TeamMember[]
  /** The agent that coordinates the team */
  supervisorAgentType: AgentType
  /** Shared knowledge available to all team members */
  sharedContext: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TeamTaskAssignment {
  memberId: string
  agentType: AgentType
  taskInput: string
  contextOverrides?: Record<string, unknown>
}

export interface TeamTaskResult {
  memberId: string
  agentType: AgentType
  success: boolean
  output: string | null
  error: string | null
  latencyMs: number
}

export interface TeamTask {
  id: string
  teamId: string
  description: string
  status: TeamTaskStatus
  assignments: TeamTaskAssignment[]
  results: TeamTaskResult[]
  supervisorSummary: string | null
  startedAt: string
  completedAt: string | null
  totalLatencyMs: number
}

export interface AgentHandoffChain {
  id: string
  steps: Array<{
    agentType: AgentType
    role: string
    promptTemplate: string
  }>
  contextPropagation: 'full' | 'summary' | 'output_only'
}

// ── Predefined Teams ──────────────────────────────────────────────────────────

const DEFAULT_TEAMS: TeamDefinition[] = [
  {
    id: 'research-team',
    name: 'Research Team',
    description: 'Multi-agent team for deep research: researcher gathers data, analyst synthesizes, writer produces the final document.',
    appSlug: 'default',
    supervisorAgentType: 'planner',
    sharedContext: { teamPurpose: 'research_and_documentation' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: 'researcher-1',
        agentType: 'retrieval',
        role: 'researcher',
        name: 'Research Agent',
        description: 'Gathers comprehensive information on the topic using retrieval and reasoning',
        specializations: ['web_search', 'data_retrieval', 'fact_finding'],
        canSupervise: false,
      },
      {
        id: 'analyst-1',
        agentType: 'learning',
        role: 'specialist',
        name: 'Analysis Agent',
        description: 'Synthesizes research findings into structured insights and key takeaways',
        specializations: ['synthesis', 'analysis', 'pattern_recognition'],
        canSupervise: false,
      },
      {
        id: 'writer-1',
        agentType: 'creative',
        role: 'specialist',
        name: 'Writing Agent',
        description: 'Transforms analyzed findings into polished, audience-appropriate documents',
        specializations: ['content_writing', 'documentation', 'report_generation'],
        canSupervise: false,
      },
      {
        id: 'reviewer-1',
        agentType: 'validator',
        role: 'reviewer',
        name: 'Quality Reviewer',
        description: 'Reviews final output for accuracy, completeness, and quality',
        specializations: ['quality_assurance', 'fact_checking', 'editing'],
        canSupervise: false,
      },
    ],
  },
  {
    id: 'dev-team',
    name: 'Development Team',
    description: 'Engineering team assistant: planner breaks down requirements, developer writes code, reviewer checks quality.',
    appSlug: 'default',
    supervisorAgentType: 'planner',
    sharedContext: { teamPurpose: 'software_development' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: 'planner-1',
        agentType: 'planner',
        role: 'supervisor',
        name: 'Tech Lead',
        description: 'Breaks requirements into tasks, assigns to team members, coordinates delivery',
        specializations: ['requirements_analysis', 'task_decomposition', 'architecture'],
        canSupervise: true,
      },
      {
        id: 'developer-1',
        agentType: 'developer',
        role: 'specialist',
        name: 'Developer Agent',
        description: 'Writes, refactors, and reviews code based on specifications',
        specializations: ['code_generation', 'debugging', 'testing', 'refactoring'],
        canSupervise: false,
      },
      {
        id: 'security-1',
        agentType: 'security',
        role: 'reviewer',
        name: 'Security Reviewer',
        description: 'Reviews code and architecture for security vulnerabilities and compliance',
        specializations: ['security_review', 'vulnerability_scanning', 'compliance'],
        canSupervise: false,
      },
    ],
  },
  {
    id: 'support-team',
    name: 'Customer Support Team',
    description: 'Tiered support team: triage agent categorizes issues, specialist resolves, escalation agent handles complex cases.',
    appSlug: 'default',
    supervisorAgentType: 'router',
    sharedContext: { teamPurpose: 'customer_support' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [
      {
        id: 'triage-1',
        agentType: 'router',
        role: 'supervisor',
        name: 'Triage Agent',
        description: 'Categorizes incoming support requests and routes to appropriate specialist',
        specializations: ['issue_classification', 'routing', 'priority_assessment'],
        canSupervise: true,
      },
      {
        id: 'support-1',
        agentType: 'support_community',
        role: 'specialist',
        name: 'Support Specialist',
        description: 'Resolves standard support queries with empathy and efficiency',
        specializations: ['faq_resolution', 'troubleshooting', 'product_guidance'],
        canSupervise: false,
      },
      {
        id: 'escalation-1',
        agentType: 'app_ops',
        role: 'specialist',
        name: 'Escalation Agent',
        description: 'Handles complex, technical, or sensitive escalations',
        specializations: ['complex_troubleshooting', 'escalation', 'senior_support'],
        canSupervise: false,
      },
    ],
  },
]

// ── In-memory stores ──────────────────────────────────────────────────────────

const teamStore = new Map<string, TeamDefinition>()
const taskStore = new Map<string, TeamTask>()

// Pre-load default teams
for (const team of DEFAULT_TEAMS) {
  teamStore.set(team.id, team)
}

// ── Team Management ───────────────────────────────────────────────────────────

/** Get all teams (default + custom) */
export function getAllTeams(): TeamDefinition[] {
  return Array.from(teamStore.values())
}

/** Get a team by ID */
export function getTeam(teamId: string): TeamDefinition | undefined {
  return teamStore.get(teamId)
}

/** Create a custom team */
export function createTeam(
  params: Omit<TeamDefinition, 'id' | 'createdAt' | 'updatedAt'>,
): TeamDefinition {
  const team: TeamDefinition = {
    ...params,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  teamStore.set(team.id, team)
  return team
}

/** Delete a custom team (cannot delete default teams) */
export function deleteTeam(teamId: string): boolean {
  const isDefault = DEFAULT_TEAMS.some((t) => t.id === teamId)
  if (isDefault) return false
  return teamStore.delete(teamId)
}

// ── Team Task Execution ───────────────────────────────────────────────────────

export interface TeamExecutionOptions {
  /** Strategy for aggregating member results */
  aggregationStrategy: 'sequential' | 'parallel' | 'supervisor_directed'
  /** Whether the supervisor should produce a final synthesis */
  includeSupervisorSummary: boolean
  /** Max time to allow for the full team task (ms) */
  timeoutMs?: number
}

/**
 * Execute a task using a team of agents.
 *
 * Steps:
 *   1. Supervisor decomposes the task into member-specific sub-tasks
 *   2. Members execute their assigned sub-tasks (sequential or parallel)
 *   3. Supervisor aggregates results into a final summary
 */
export async function executeTeamTask(
  teamId: string,
  taskDescription: string,
  appSlug: string,
  options: TeamExecutionOptions = {
    aggregationStrategy: 'sequential',
    includeSupervisorSummary: true,
  },
): Promise<TeamTask> {
  const team = teamStore.get(teamId)
  if (!team) {
    throw new Error(`Team not found: ${teamId}`)
  }

  const start = Date.now()
  const taskId = randomUUID()

  const task: TeamTask = {
    id: taskId,
    teamId,
    description: taskDescription,
    status: 'running',
    assignments: [],
    results: [],
    supervisorSummary: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalLatencyMs: 0,
  }

  taskStore.set(taskId, task)

  try {
    // Step 1: Supervisor decomposes the task
    const decomposition = await supervisorDecompose(team, taskDescription, appSlug)
    task.assignments = decomposition

    // Step 2: Execute member tasks
    if (options.aggregationStrategy === 'parallel') {
      // Run all assignments in parallel
      const memberPromises = decomposition.map((assignment) =>
        executeMemberTask(assignment, appSlug, team.sharedContext),
      )
      task.results = await Promise.all(memberPromises)
    } else {
      // Execute sequentially, passing prior output as context
      let priorContext = ''
      for (const assignment of decomposition) {
        const enhancedAssignment = {
          ...assignment,
          contextOverrides: {
            ...assignment.contextOverrides,
            priorContext,
          },
        }
        const result = await executeMemberTask(enhancedAssignment, appSlug, team.sharedContext)
        task.results.push(result)
        if (result.output) {
          priorContext += `\n\n[${assignment.agentType}]: ${result.output}`
        }
      }
    }

    // Step 3: Supervisor summary
    if (options.includeSupervisorSummary) {
      task.supervisorSummary = await supervisorSummarize(team, taskDescription, task.results, appSlug)
    }

    task.status = 'completed'
  } catch (err) {
    task.status = 'failed'
    task.supervisorSummary = `Team task failed: ${err instanceof Error ? err.message : 'Unknown error'}`
  }

  task.completedAt = new Date().toISOString()
  task.totalLatencyMs = Date.now() - start
  taskStore.set(taskId, task)

  return task
}

/** Internal helper: create + execute an agent task and return output/error. */
async function runAgent(
  agentType: AgentType,
  appSlug: string,
  message: string,
  context: Record<string, unknown>,
): Promise<{ output: string | null; error: string | null }> {
  try {
    const task = createAgentTask(agentType, appSlug, { message, context })
    const result = await executeAgent(task)
    return { output: result.output, error: result.error }
  } catch (err) {
    return { output: null, error: err instanceof Error ? err.message : 'Agent error' }
  }
}

async function supervisorDecompose(
  team: TeamDefinition,
  taskDescription: string,
  appSlug: string,
): Promise<TeamTaskAssignment[]> {
  // Build member descriptions for the supervisor prompt
  const memberList = team.members
    .map((m) => `- ${m.name} (${m.agentType}): ${m.description}`)
    .join('\n')

  const result = await runAgent(
    team.supervisorAgentType,
    appSlug,
    `You are the team supervisor. Decompose this task into specific sub-tasks for each team member.\n\nTask: ${taskDescription}\n\nTeam members:\n${memberList}\n\nFor each member, write their specific sub-task. Be concise and specific.`,
    { role: 'supervisor', task: taskDescription },
  )

  // Parse the supervisor's decomposition into assignments
  const lines = (result.output ?? '').split('\n').filter(Boolean)
  const assignments: TeamTaskAssignment[] = []

  for (const member of team.members) {
    const memberLine = lines.find((l) =>
      l.toLowerCase().includes(member.name.toLowerCase()) ||
      l.toLowerCase().includes(member.agentType.toLowerCase()),
    )
    assignments.push({
      memberId: member.id,
      agentType: member.agentType,
      taskInput: memberLine
        ? memberLine.replace(/^[-*•]\s*/, '').replace(/.*?:\s*/, '')
        : taskDescription,
    })
  }

  return assignments
}

async function executeMemberTask(
  assignment: TeamTaskAssignment,
  appSlug: string,
  sharedContext: Record<string, unknown>,
): Promise<TeamTaskResult> {
  const start = Date.now()
  try {
    const result = await runAgent(
      assignment.agentType,
      appSlug,
      assignment.taskInput,
      { ...sharedContext, ...assignment.contextOverrides },
    )
    return {
      memberId: assignment.memberId,
      agentType: assignment.agentType,
      success: !result.error,
      output: result.output,
      error: result.error,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      memberId: assignment.memberId,
      agentType: assignment.agentType,
      success: false,
      output: null,
      error: err instanceof Error ? err.message : 'Agent execution failed',
      latencyMs: Date.now() - start,
    }
  }
}

async function supervisorSummarize(
  team: TeamDefinition,
  originalTask: string,
  results: TeamTaskResult[],
  appSlug: string,
): Promise<string> {
  const resultsSummary = results
    .map((r) => `[${r.agentType}] ${r.success ? '✓' : '✗'}: ${r.output ?? r.error ?? 'no output'}`)
    .join('\n\n')

  const result = await runAgent(
    team.supervisorAgentType,
    appSlug,
    `You are the team supervisor. Synthesize your team's work into a final, cohesive response.\n\nOriginal task: ${originalTask}\n\nTeam results:\n${resultsSummary}\n\nProvide a well-structured final answer that incorporates the team's work.`,
    { role: 'supervisor_summary' },
  )

  return result.output ?? 'Supervisor summary unavailable.'
}

// ── Task Accessors ────────────────────────────────────────────────────────────

/** Get a task by ID */
export function getTeamTask(taskId: string): TeamTask | undefined {
  return taskStore.get(taskId)
}

/** Get all tasks for a team */
export function getTeamTaskHistory(teamId: string, limit = 20): TeamTask[] {
  return Array.from(taskStore.values())
    .filter((t) => t.teamId === teamId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit)
}

// ── Predefined Handoff Chains ─────────────────────────────────────────────────

export const HANDOFF_CHAINS: AgentHandoffChain[] = [
  {
    id: 'research-to-report',
    steps: [
      { agentType: 'retrieval', role: 'researcher', promptTemplate: 'Research the following topic comprehensively: {input}' },
      { agentType: 'learning', role: 'analyst', promptTemplate: 'Analyze and synthesize the following research: {prior_output}' },
      { agentType: 'creative', role: 'writer', promptTemplate: 'Write a professional report based on this analysis: {prior_output}' },
      { agentType: 'validator', role: 'reviewer', promptTemplate: 'Review and improve this report for accuracy and quality: {prior_output}' },
    ],
    contextPropagation: 'output_only',
  },
  {
    id: 'plan-build-review',
    steps: [
      { agentType: 'planner', role: 'planner', promptTemplate: 'Create a detailed technical plan for: {input}' },
      { agentType: 'developer', role: 'developer', promptTemplate: 'Implement the following plan: {prior_output}' },
      { agentType: 'validator', role: 'reviewer', promptTemplate: 'Review this implementation for quality and correctness: {prior_output}' },
    ],
    contextPropagation: 'full',
  },
  {
    id: 'triage-support-escalate',
    steps: [
      { agentType: 'router', role: 'triage', promptTemplate: 'Triage this support request and determine severity: {input}' },
      { agentType: 'support_community', role: 'resolver', promptTemplate: 'Resolve this support issue: {input}. Triage notes: {prior_output}' },
    ],
    contextPropagation: 'summary',
  },
]

/** Get a predefined handoff chain by ID */
export function getHandoffChain(chainId: string): AgentHandoffChain | undefined {
  return HANDOFF_CHAINS.find((c) => c.id === chainId)
}

/**
 * Execute a handoff chain.
 * Each step receives the output of the prior step as context.
 */
export async function executeHandoffChain(
  chainId: string,
  input: string,
  appSlug: string,
): Promise<{
  chainId: string
  steps: Array<{ agentType: string; output: string | null; error: string | null; latencyMs: number }>
  finalOutput: string | null
  totalLatencyMs: number
}> {
  const chain = getHandoffChain(chainId)
  if (!chain) throw new Error(`Handoff chain not found: ${chainId}`)

  const start = Date.now()
  const steps: Array<{ agentType: string; output: string | null; error: string | null; latencyMs: number }> = []
  let priorOutput = input

  for (const step of chain.steps) {
    const stepStart = Date.now()
    const prompt = step.promptTemplate
      .replace('{input}', input)
      .replace('{prior_output}', priorOutput)

    try {
      const result = await runAgent(
        step.agentType,
        appSlug,
        prompt,
        { chainId, role: step.role },
      )
      const stepOutput = result.output ?? null
      steps.push({ agentType: step.agentType, output: stepOutput, error: result.error, latencyMs: Date.now() - stepStart })
      if (stepOutput) priorOutput = stepOutput
    } catch (err) {
      steps.push({ agentType: step.agentType, output: null, error: err instanceof Error ? err.message : 'Step failed', latencyMs: Date.now() - stepStart })
    }
  }

  return {
    chainId,
    steps,
    finalOutput: steps.at(-1)?.output ?? null,
    totalLatencyMs: Date.now() - start,
  }
}

// ── Team Summary ──────────────────────────────────────────────────────────────

export function getMultiAgentSummary(): {
  totalTeams: number
  defaultTeams: number
  customTeams: number
  teamNames: string[]
  handoffChains: number
  activeTasks: number
} {
  const allTeams = getAllTeams()
  return {
    totalTeams: allTeams.length,
    defaultTeams: DEFAULT_TEAMS.length,
    customTeams: allTeams.length - DEFAULT_TEAMS.length,
    teamNames: allTeams.map((t) => t.name),
    handoffChains: HANDOFF_CHAINS.length,
    activeTasks: Array.from(taskStore.values()).filter((t) => t.status === 'running').length,
  }
}
