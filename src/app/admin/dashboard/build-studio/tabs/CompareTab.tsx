'use client'

/**
 * CompareTab — Side-by-side model comparison in Build Studio.
 * Uses the existing /api/admin/compare endpoint.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Play, Loader2, CheckCircle, XCircle, Gauge, Clock,
  AlertCircle, DollarSign,
} from 'lucide-react'

interface ModelOption { id: string; name: string; provider: string; category: string }
interface CompareResult {
  modelId: string; modelName: string; provider: string
  success: boolean; output: string | null; error: string | null
  latencyMs: number; confidenceScore: number | null
  imageUrl?: string | null; audioUrl?: string | null
}

export default function CompareTab() {
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CompareResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/models')
      if (res.ok) { const d = await res.json(); setModels(d.models ?? []) }
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const toggleModel = (id: string) => {
    setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : prev.length < 4 ? [...prev, id] : prev)
  }

  const compare = useCallback(async () => {
    if (!prompt.trim() || selectedModels.length < 2) return
    setRunning(true); setError(null); setResults([])
    try {
      const res = await fetch('/api/admin/compare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, modelIds: selectedModels, taskType: 'chat' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResults(data.results ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Comparison failed') } finally { setRunning(false) }
  }, [prompt, selectedModels])

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400">
        Compare outputs from multiple models side-by-side. Select 2–4 models, enter a prompt, and run.
      </div>

      {/* Model selection */}
      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium">Select models to compare ({selectedModels.length}/4)</div>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {models.map(m => (
            <button key={m.id} onClick={() => toggleModel(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all
                ${selectedModels.includes(m.id) ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
              {m.name} <span className="text-slate-600">({m.provider})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Enter prompt to compare across models…"
        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 resize-none" />

      <button onClick={compare} disabled={running || !prompt.trim() || selectedModels.length < 2}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
        {running ? 'Comparing…' : 'Compare Models'}
      </button>

      {error && <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}

      {/* Results side-by-side */}
      {results.length > 0 && (
        <div className={`grid gap-4 ${results.length === 2 ? 'grid-cols-1 md:grid-cols-2' : results.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
          {results.map((r, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white">{r.modelName}</div>
                {r.success ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
              </div>
              <div className="text-[10px] text-slate-500">{r.provider}</div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.latencyMs}ms</span>
                {r.confidenceScore != null && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{(r.confidenceScore * 100).toFixed(0)}%</span>}
              </div>

              {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full rounded-lg border border-white/[0.06]" />}
              {r.audioUrl && <audio controls src={r.audioUrl} className="w-full" />}

              {r.output && !r.imageUrl && !r.audioUrl && (
                <div className="bg-white/[0.02] rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {r.output}
                </div>
              )}

              {r.error && <div className="text-[11px] text-red-300">{r.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
