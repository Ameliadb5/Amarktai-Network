'use client'

/**
 * WorkflowBuilderTab — Workflow templates & chained workflows inside Build Studio.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Play, Loader2, CheckCircle, AlertCircle, Clock,
  ArrowRight, RefreshCw,
} from 'lucide-react'

interface WorkflowTemplate {
  id: string; name: string; description: string; category: string
  steps: Array<{ id: string; name: string; type: string }>
}

interface WorkflowRun {
  id: string; workflowId: string; status: string; startedAt: string; completedAt: string | null
}

export default function WorkflowBuilderTab() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [tRes, rRes] = await Promise.all([
        fetch('/api/workflows?action=templates'),
        fetch('/api/workflows?action=runs&limit=10'),
      ])
      if (tRes.ok) { const d = await tRes.json(); setTemplates(d.templates ?? []) }
      if (rRes.ok) { const d = await rRes.json(); setRuns(d.runs ?? []) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load workflows') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const runWorkflow = useCallback(async (templateId: string) => {
    setRunning(templateId)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', templateId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Run failed') }
      load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Workflow run failed') } finally { setRunning(null) }
  }, [load])

  if (loading) {
    return <div className="flex items-center gap-2 py-16 justify-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading workflows…</div>
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400">Run pre-built AI workflow templates. Custom workflow creation is coming soon.</div>

      {error && <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}

      {/* Templates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">Workflow Templates</div>
          <button onClick={load} className="text-xs text-slate-500 hover:text-white"><RefreshCw className="w-3 h-3 inline mr-1" />Refresh</button>
        </div>
        {templates.length === 0 ? (
          <div className="text-xs text-slate-500 bg-white/[0.02] border border-white/[0.06] rounded-lg p-6 text-center">
            No workflow templates configured yet. Templates are defined in the skill-templates system.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map(t => (
              <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-white">{t.name}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400">{t.category}</span>
                </div>
                <p className="text-xs text-slate-400">{t.description}</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  {t.steps.map((s, i) => (
                    <span key={s.id} className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{s.name}</span>
                      {i < t.steps.length - 1 && <ArrowRight className="w-3 h-3" />}
                    </span>
                  ))}
                </div>
                <button onClick={() => runWorkflow(t.id)} disabled={running === t.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-40 transition-colors">
                  {running === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  Run
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent runs */}
      {runs.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-medium">Recent Runs</div>
          {runs.map(r => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
              <span className="text-slate-300">{r.workflowId}</span>
              <div className="flex items-center gap-2">
                {r.status === 'completed' ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : r.status === 'failed' ? <AlertCircle className="w-3 h-3 text-red-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                <span className="text-slate-500">{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
