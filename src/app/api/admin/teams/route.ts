import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getAllTeams,
  getTeam,
  createTeam,
  deleteTeam,
  executeTeamTask,
  getTeamTask,
  getTeamTaskHistory,
  getMultiAgentSummary,
  HANDOFF_CHAINS,
  executeHandoffChain,
} from '@/lib/multi-agent-team'

/**
 * GET /api/admin/teams
 *
 * Query params:
 *   id          - get single team definition
 *   taskId      - get a specific task result
 *   history     - teamId to get task history for
 *   summary     - return multi-agent summary
 *   chains      - list handoff chain definitions
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const taskId = searchParams.get('taskId')
  const historyTeamId = searchParams.get('history')
  const summaryOnly = searchParams.has('summary')
  const chainsOnly = searchParams.has('chains')

  if (summaryOnly) {
    return NextResponse.json({ summary: getMultiAgentSummary() })
  }

  if (chainsOnly) {
    return NextResponse.json({ chains: HANDOFF_CHAINS })
  }

  if (taskId) {
    const task = getTeamTask(taskId)
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ task })
  }

  if (historyTeamId) {
    const history = getTeamTaskHistory(historyTeamId)
    return NextResponse.json({ tasks: history })
  }

  if (id) {
    const team = getTeam(id)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    return NextResponse.json({ team })
  }

  const teams = getAllTeams()
  return NextResponse.json({ teams, summary: getMultiAgentSummary() })
}

/**
 * POST /api/admin/teams
 *
 * Body actions:
 *   { action: 'create', name, description, appSlug, members, supervisorAgentType }
 *   { action: 'execute', teamId, task, appSlug, options }
 *   { action: 'execute_chain', chainId, input, appSlug }
 *   { action: 'delete', teamId }
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      const { name, description, appSlug, members, supervisorAgentType } = body
      if (!name || !members?.length || !supervisorAgentType) {
        return NextResponse.json(
          { error: 'name, members, and supervisorAgentType are required' },
          { status: 400 },
        )
      }
      const team = createTeam({ name, description: description ?? '', appSlug: appSlug ?? 'default', members, supervisorAgentType, sharedContext: body.sharedContext ?? {} })
      return NextResponse.json({ success: true, team })
    }

    if (action === 'execute') {
      const { teamId, task, appSlug, options } = body
      if (!teamId || !task) {
        return NextResponse.json({ error: 'teamId and task are required' }, { status: 400 })
      }
      const result = await executeTeamTask(teamId, task, appSlug ?? 'default', options)
      return NextResponse.json({ success: true, result })
    }

    if (action === 'execute_chain') {
      const { chainId, input, appSlug } = body
      if (!chainId || !input) {
        return NextResponse.json({ error: 'chainId and input are required' }, { status: 400 })
      }
      const result = await executeHandoffChain(chainId, input, appSlug ?? 'default')
      return NextResponse.json({ success: true, result })
    }

    if (action === 'delete') {
      const { teamId } = body
      if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })
      const deleted = deleteTeam(teamId)
      if (!deleted) return NextResponse.json({ error: 'Cannot delete default team or team not found' }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action. Use: create, execute, execute_chain, delete' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Team operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
