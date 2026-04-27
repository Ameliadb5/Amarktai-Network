'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, RefreshCw, CheckCircle, AlertCircle, Search,
  ShieldCheck, Layers, MessageSquare, Image, Video,
  Mic, Code, Music, Database, Sparkles,
} from 'lucide-react'

interface GenXStatus {
  configured: boolean
  available: boolean
  error: string | null
  apiUrl: string | null
  modelCount: number
  adultCapability: {
    supported: boolean
    route: string | null
    reason: string | null
  }
}

interface ModelEntry {
  id: string
  displayName: string
  provider: string
  role: string
  capabilities: string[]
  enabled: boolean
  contextWindow?: number
  latencyTier?: string
  costTier?: string
  category?: string
}

const COST_COLORS: Record<string, string> = {
  free:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  very_low: 'text-green-400 bg-green-500/10 border-green-500/20',
  low:      'text-teal-400 bg-teal-500/10 border-teal-500/20',
  medium:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
  premium:  'text-red-400 bg-red-500/10 border-red-500/20',
}

const CATEGORY_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  text: MessageSquare, image: Image, video: Video, voice: Mic,
  code: Code, multimodal: Sparkles, music: Music, moderation: ShieldCheck,
  embeddings: Database,
}

const POLICY_TIERS = [
  { key: 'best',     label: 'Best',     desc: 'Highest capability — used by default',       color: 'text-cyan-400 border-cyan-400/30 bg-cyan-400/5'     },
  { key: 'balanced', label: 'Balanced', desc: 'Cost/quality balance',                       color: 'text-blue-400 border-blue-400/30 bg-blue-400/5'     },
  { key: 'cheap',    label: 'Cheap',    desc: 'Lowest cost for the capability',              color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' },
  { key: 'fixed',    label: 'Fixed',    desc: 'Explicit model ID specified by the caller',  color: 'text-violet-400 border-violet-400/30 bg-violet-400/5'   },
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function GenXModelsPage() {
  const [status, setStatus] = useState<GenXStatus | null>(null)
  const [models, setModels] = useState<ModelEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, modelsRes] = await Promise.allSettled([
        fetch('/api/admin/genx/status'),
        fetch('/api/admin/models'),
      ])
      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        setStatus(await statusRes.value.json())
      }
      if (modelsRes.status === 'fulfilled' && modelsRes.value.ok) {
        const data = await modelsRes.value.json()
        setModels(Array.isArray(data) ? data : (data?.models ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const categories = ['all', ...Array.from(new Set(models.map(m => m.category).filter(Boolean))).sort()] as string[]

  const filtered = models.filter(m => {
    const q = search.toLowerCase()
    if (q && !(m.displayName ?? '').toLowerCase().includes(q) && !(m.id ?? '').toLowerCase().includes(q)) return false
    if (filterCategory !== 'all' && m.category !== filterCategory) return false
    return true
  })

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">AI Engine</h1>
              </div>
              <p className="text-sm text-slate-400">
                All tasks route through the primary AI engine by default.
                Fallback providers are only used when the primary engine is unavailable.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* GenX Status */}
      {status && (
        <motion.div variants={fadeUp}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard
              label="AI Engine Status"
              value={status.available ? 'Online' : status.configured ? 'Unreachable' : 'Not configured'}
              icon={status.available ? CheckCircle : AlertCircle}
              color={status.available ? 'text-emerald-400' : 'text-amber-400'}
            />
            <StatusCard
              label="API Endpoint"
              value={status.apiUrl ?? 'Not set'}
              icon={Zap}
              color="text-cyan-400"
              mono
            />
            <StatusCard
              label="Models in Catalog"
              value={status.modelCount > 0 ? `${status.modelCount} models` : 'Unavailable'}
              icon={Layers}
              color="text-blue-400"
            />
            <StatusCard
              label="Adult Capability"
              value={status.adultCapability?.supported ? 'Enabled' : 'Not available'}
              icon={ShieldCheck}
              color={status.adultCapability?.supported ? 'text-violet-400' : 'text-slate-500'}
            />
          </div>
        </motion.div>
      )}

      {/* Policy Tiers */}
      <motion.div variants={fadeUp}>
        <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Model Policy</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {POLICY_TIERS.map(tier => (
            <div key={tier.key} className={`rounded-xl border p-3 ${tier.color}`}>
              <p className="text-sm font-semibold">{tier.label}</p>
              <p className="mt-0.5 text-xs opacity-70">{tier.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Model catalog */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              className="pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors w-48"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const Icon = cat !== 'all' ? (CATEGORY_ICONS[cat] ?? Layers) : Layers
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-colors border ${
                    filterCategory === cat
                      ? 'bg-white/[0.06] text-white border-white/[0.10]'
                      : 'bg-white/[0.02] text-slate-400 border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cat === 'all' ? 'All' : cat}
                </button>
              )
            })}
          </div>
          <span className="ml-auto text-xs text-slate-500">{filtered.length} of {models.length} models</span>
        </div>

        {loading && models.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="ml-3 text-sm text-slate-400">Loading GenX catalog…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{models.length === 0 ? 'No models available. Check GenX API configuration.' : 'No models match your filters.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => {
              const costCls = COST_COLORS[m.costTier ?? ''] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
              return (
                <div key={m.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-2 hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{m.displayName ?? m.id}</h3>
                      <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{m.id}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{m.category}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${m.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-600/10 text-slate-500 border-slate-600/20'}`}>
                        {m.enabled ? 'Active' : 'Off'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.costTier && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${costCls}`}>{m.costTier.replace('_', ' ')}</span>
                    )}
                    {m.latencyTier && (
                      <span className="text-[10px] text-slate-400 font-mono">{m.latencyTier.replace('_', ' ')} latency</span>
                    )}
                  </div>
                  {(m.capabilities ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(m.capabilities ?? []).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{c}</span>
                      ))}
                    </div>
                  )}
                  {m.contextWindow != null && (
                    <p className="text-[10px] text-slate-600 font-mono">{(m.contextWindow / 1000).toFixed(0)}k ctx</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Non-GenX providers note */}
      <motion.div variants={fadeUp}>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-slate-500">
            <span className="text-slate-400 font-medium">Fallback providers</span> (OpenAI, Groq, Anthropic, Gemini, etc.) are only used when GenX is unavailable or returns an error.
            Configure them in{' '}
            <a href="/admin/dashboard/settings" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">Settings</a>.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatusCard({
  label, value, icon: Icon, color, mono,
}: {
  label: string
  value: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <p className={`text-sm font-semibold text-white truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}
