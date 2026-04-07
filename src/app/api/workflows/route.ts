import { NextRequest, NextResponse } from 'next/server'
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  deleteWorkflow,
  executeWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
} from '@/lib/workflow-engine'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { name, description, appSlug, steps, entryStepId } = body
      if (!name || !steps?.length || !entryStepId) {
        return NextResponse.json(
          { error: 'name, steps, and entryStepId required' },
          { status: 400 },
        )
      }
      const workflow = await createWorkflow({
        name,
        description: description || '',
        appSlug: appSlug || 'default',
        steps,
        entryStepId,
      })
      return NextResponse.json({ success: true, workflow })
    }

    if (action === 'execute') {
      const { workflowId, input } = body
      if (!workflowId) {
        return NextResponse.json({ error: 'workflowId required' }, { status: 400 })
      }
      const run = await executeWorkflow(workflowId, input || {})
      return NextResponse.json({ success: true, run })
    }

    if (action === 'delete') {
      const { workflowId } = body
      if (!workflowId) {
        return NextResponse.json({ error: 'workflowId required' }, { status: 400 })
      }
      const deleted = await deleteWorkflow(workflowId)
      return NextResponse.json({ success: deleted })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: create, execute, delete' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workflowId = searchParams.get('id')
    const runId = searchParams.get('runId')
    const appSlug = searchParams.get('appSlug') || 'default'

    if (runId) {
      const run = await getWorkflowRun(runId)
      if (!run) {
        return NextResponse.json({ error: 'Workflow run not found' }, { status: 404 })
      }
      return NextResponse.json({ run })
    }

    if (workflowId) {
      const workflow = await getWorkflow(workflowId)
      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }
      const runs = await listWorkflowRuns(workflowId)
      return NextResponse.json({ workflow, runs })
    }

    const workflows = await listWorkflows(appSlug)
    return NextResponse.json({ workflows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list workflows'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
