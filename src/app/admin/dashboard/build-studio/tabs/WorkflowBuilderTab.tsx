'use client'

/**
 * WorkflowBuilderTab — Workflow skill templates & execution inside Build Studio.
 *
 * API contracts used:
 *   GET  /api/admin/skill-templates?launchReady   → { templates: SkillTemplate[] }
 *   GET  /api/workflows?appSlug=workspace         → { workflows: WorkflowRecord[] }
 *   POST /api/workflows { action:'create', ... }  → { workflow: { id } }
 *   POST /api/workflows { action:'execute', workflowId, input } → { run }
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Play, Loader2, CheckCircle, AlertCircle, Clock,
  ArrowRight, RefreshCw, Tag,
} from 'lucide-react'

// Shape returned by GET /api/admin/skill-templates
interface SkillTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  requiredCapabilities: string[]
  requiresExternalService: boolean
  launchReady: boolean
  steps: Array<{ id: string; name: string; type: string }>
  entryStepId: string
  exampleInput: Record<string, unknown>
}

// Shape returned by GET /api/workflows?appSlug=workspace
interface WorkflowRecord {
  id: string
  name: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
}

export default function WorkflowBuilderTab() {
  const [templates, setTemplates] = useState<SkillTemplate[]>([])
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Per-template running state: templateId → 'creating' | 'executing' | null
  const [running, setRunning] = useState<Record<string, string | null>>({})
  const [runSuccess, setRunSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [tRes, wRes] = await Promise.all([
        // Real skill-templates endpoint (launchReady only for workspace)
        fetch('/api/admin/skill-templates?launchReady'),
        // Real workflows listing for workspace
        fetch('/api/workflows?appSlug=workspace'),
      ])
      if (tRes.ok) {
        const d = await tRes.json()
        setTemplates(d.templates ?? [])
      } else {
        // Non-fatal: templates may be empty on first run
        setTemplates([])
      }
      if (wRes.ok) {
        const d = await wRes.json()
        setWorkflows(d.workflows ?? [])
      } else {
        setWorkflows([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const runTemplate = useCallback(async (template: SkillTemplate) => {
    setRunning(prev => ({ ...prev, [template.id]: 'creating' }))
    setError(null)
    setRunSuccess(null)

    try {
      // Step 1: Create a workflow instance from the template
      const createRes = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: template.name,
          description: template.description,
          appSlug: 'workspace',
          steps: template.steps,
          entryStepId: template.entryStepId,
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Workflow creation failed (HTTP ${createRes.status})`)
      }
      const createData = await createRes.json() as { workflow?: { id: string } }
      const workflowId = createData.workflow?.id
      if (!workflowId) throw new Error('Workflow created but no ID returned')

      // Step 2: Execute the workflow with the template's example input
      setRunning(prev => ({ ...prev, [template.id]: 'executing' }))
      const execRes = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          workflowId,
          input: template.exampleInput,
        }),
      })
      if (!execRes.ok) {
        const d = await execRes.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Workflow execution failed (HTTP ${execRes.status})`)
      }

      setRunSuccess(template.id)
      // Reload workflow list to show the new entry
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workflow run failed')
    } finally {
      setRunning(prev => ({ ...prev, [template.id]: null }))
    }
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading workflow templates…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400">
        Select a launch-ready workflow template. Each run creates and executes a new workflow instance in the workspace.
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">
            Launch-Ready Templates
            {templates.length > 0 && <span className="ml-2 text-slate-600">({templates.length})</span>}
          </div>
          <button onClick={load} className="text-xs text-slate-500 hover:text-white transition">
            <RefreshCw className="w-3 h-3 inline mr-1" />Refresh
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="text-xs text-slate-500 bg-white/[0.02] border border-white/[0.06] rounded-lg p-6 text-center">
            No launch-ready templates found. Templates require at least one configured AI provider.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map(t => {
              const runState = running[t.id]
              const isRunning = !!runState
              const succeeded = runSuccess === t.id
              return (
                <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-white truncate">{t.name}</div>
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400 capitalize">{t.category}</span>
                  </div>
                  <p className="text-xs text-slate-400">{t.description}</p>

                  {/* Step pipeline */}
                  <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-500">
                    {t.steps.map((s, i) => (
                      <span key={s.id} className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{s.name}</span>
                        {i < t.steps.length - 1 && <ArrowRight className="w-3 h-3 shrink-0" />}
                      </span>
                    ))}
                  </div>

                  {/* Required capabilities */}
                  {t.requiredCapabilities.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Tag className="w-3 h-3 text-slate-600 shrink-0" />
                      {t.requiredCapabilities.map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{c}</span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => runTemplate(t)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    {isRunning
                      ? <><Loader2 className="w-3 h-3 animate-spin" />{runState === 'creating' ? 'Creating…' : 'Executing…'}</>
                      : succeeded
                        ? <><CheckCircle className="w-3 h-3 text-emerald-300" />Ran — run again</>
                        : <><Play className="w-3 h-3" />Run</>
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Workspace Workflows (recent workflow instances) */}
      {workflows.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-medium">Workspace Workflow Instances ({workflows.length})</div>
          {workflows.slice(0, 10).map(w => (
            <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
              <span className="text-slate-300 truncate mr-2">{w.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {w.status === 'completed'
                  ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                  : w.status === 'failed'
                    ? <AlertCircle className="w-3 h-3 text-red-400" />
                    : <Clock className="w-3 h-3 text-amber-400" />
                }
                <span className="text-slate-500 capitalize">{w.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
