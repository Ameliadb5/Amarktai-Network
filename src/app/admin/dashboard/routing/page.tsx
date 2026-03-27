'use client'

import { useEffect, useState, useCallback } from 'react'
import { Route, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react'

interface RoutingDecision {
  mode: string
  primary: { provider: string; model_id: string; display_name: string } | null
  secondary: { provider: string; model_id: string; display_name: string } | null
  fallbacks: { provider: string; model_id: string; display_name: string }[]
  reason: string
  warnings: string[]
  costEstimate: { tier: string; label: string }
  latencyEstimate: { tier: string; label: string }
}

interface RoutingContext {
  appSlug: string
  appCategory: string
  taskType: string
  taskComplexity: string
  message: string
  requiresRetrieval: boolean
  requiresMultimodal: boolean
}

interface RoutingResponse {
  context: RoutingContext
  decision: RoutingDecision
  error?: string
}

const SAMPLE_CONTEXTS: { label: string; body: Partial<RoutingContext> }[] = [
  {
    label: 'Simple Chat',
    body: { appSlug: 'demo-app', appCategory: 'generic', taskType: 'chat', taskComplexity: 'simple', message: 'Hello, how are you?' },
  },
  {
    label: 'Complex Analysis',
    body: { appSlug: 'finance-app', appCategory: 'finance', taskType: 'analysis', taskComplexity: 'complex', message: 'Analyze quarterly revenue trends and forecast next quarter.' },
  },
  {
    label: 'Creative + Multimodal',
    body: { appSlug: 'marketing-app', appCategory: 'marketing', taskType: 'content_generation', taskComplexity: 'moderate', message: 'Create a social media campaign for product launch.', requiresMultimodal: true },
  },
  {
    label: 'RAG Retrieval',
    body: { appSlug: 'knowledge-base', appCategory: 'generic', taskType: 'question_answering', taskComplexity: 'moderate', message: 'What were the key decisions from last sprint?', requiresRetrieval: true },
  },
]

const DEFAULT_MODE_COLOR = 'text-slate-400 bg-slate-500/10 border-slate-500/20'

const MODE_COLORS: Record<string, string> = {
  direct: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  specialist: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  review: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  consensus: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  premium: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  retrieval_chain: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  multimodal: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  validation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
}

export default function RoutingPage() {
  const [result, setResult] = useState<RoutingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedContext, setSelectedContext] = useState(0)

  const load = useCallback(async (idx: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_CONTEXTS[idx].body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to test routing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(selectedContext) }, [load, selectedContext])

  const decision = result?.decision

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Routing Policies</h1>
          <p className="text-sm text-slate-500 mt-1">
            Test the routing engine with different contexts to see model selection logic.
          </p>
        </div>
        <button
          onClick={() => load(selectedContext)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Re-run
        </button>
      </div>

      {/* Context selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {SAMPLE_CONTEXTS.map((ctx, i) => (
          <button
            key={ctx.label}
            onClick={() => setSelectedContext(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedContext === i
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {ctx.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : decision ? (
        <>
          {/* Routing mode */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Route className="w-5 h-5 text-pink-400" />
              <h2 className="text-sm font-bold text-white">Routing Decision</h2>
              <span className={`ml-auto text-xs font-medium uppercase px-2.5 py-1 rounded-full border ${MODE_COLORS[decision.mode] ?? DEFAULT_MODE_COLOR}`}>
                {decision.mode}
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-3">{decision.reason}</p>

            {/* Model chain */}
            <div className="flex items-center gap-2 flex-wrap">
              {decision.primary && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-500 uppercase">Primary</p>
                  <p className="text-sm text-white font-medium">{decision.primary.display_name || decision.primary.model_id}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{decision.primary.provider}</p>
                </div>
              )}
              {decision.secondary && (
                <>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-500 uppercase">Secondary</p>
                    <p className="text-sm text-white font-medium">{decision.secondary.display_name || decision.secondary.model_id}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{decision.secondary.provider}</p>
                  </div>
                </>
              )}
            </div>

            {/* Fallbacks */}
            {decision.fallbacks && decision.fallbacks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 uppercase mb-2">Fallback Chain</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {decision.fallbacks.map((fb, i) => (
                    <span key={i} className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded font-mono">
                      {fb.display_name || fb.model_id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Estimates */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
              {decision.costEstimate && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Cost:</span>
                  <span className="text-xs text-amber-400">{decision.costEstimate.label || decision.costEstimate.tier}</span>
                </div>
              )}
              {decision.latencyEstimate && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Latency:</span>
                  <span className="text-xs text-cyan-400">{decision.latencyEstimate.label || decision.latencyEstimate.tier}</span>
                </div>
              )}
            </div>

            {/* Warnings */}
            {decision.warnings && decision.warnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                {decision.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Input context */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Input Context</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {result?.context && Object.entries(result.context).map(([key, val]) => (
                <div key={key}>
                  <p className="text-[10px] text-slate-500 uppercase">{key}</p>
                  <p className="text-sm text-slate-300 truncate">{String(val)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <p className="text-xs text-slate-600">
        Select a routing scenario above to see how the engine selects models. Results reflect current registry and provider state.
      </p>
    </div>
  )
}
