'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Layers, RefreshCw, AlertCircle, Search, Image, Video, Mic, Code, MessageSquare, Sparkles, Music, ShieldCheck, Database } from 'lucide-react'

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

interface CategorySummary {
  text: number
  image: number
  video: number
  voice: number
  code: number
  multimodal: number
  music: number
  moderation: number
  embeddings: number
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const COST_COLORS: Record<string, string> = {
  free:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  very_low:  'text-green-400 bg-green-500/10 border-green-500/20',
  low:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  medium:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  premium:   'text-red-400 bg-red-500/10 border-red-500/20',
}

const LATENCY_COLORS: Record<string, string> = {
  ultra_low: 'text-emerald-400',
  low:       'text-green-400',
  medium:    'text-amber-400',
  high:      'text-red-400',
}

const CATEGORY_TABS = [
  { key: 'all', label: 'All', icon: Layers },
  { key: 'text', label: 'Text', icon: MessageSquare },
  { key: 'image', label: 'Image', icon: Image },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'code', label: 'Code', icon: Code },
  { key: 'multimodal', label: 'Multimodal', icon: Sparkles },
  { key: 'music', label: 'Music', icon: Music },
  { key: 'moderation', label: 'Moderation', icon: ShieldCheck },
  { key: 'embeddings', label: 'Embeddings', icon: Database },
] as const

export default function ModelsPage() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [categorySummary, setCategorySummary] = useState<CategorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterProvider, setFilterProvider] = useState('all')
  const [filterCapability, setFilterCapability] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const raw = Array.isArray(data) ? data : (data?.models ?? [])
      setModels(raw)
      if (data?.categorySummary) setCategorySummary(data.categorySummary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const providers = ['all', ...Array.from(new Set(models.map(m => m.provider).filter(Boolean))).sort()]
  const capabilities = ['all', ...Array.from(new Set(models.flatMap(m => m.capabilities ?? []))).sort()]

  const filtered = models.filter(m => {
    const q = search.toLowerCase()
    if (q && !(m.displayName ?? '').toLowerCase().includes(q) && !(m.id ?? '').toLowerCase().includes(q) && !(m.provider ?? '').toLowerCase().includes(q)) return false
    if (filterProvider !== 'all' && m.provider !== filterProvider) return false
    if (filterCapability !== 'all' && !(m.capabilities ?? []).includes(filterCapability)) return false
    if (filterCategory !== 'all' && m.category !== filterCategory) return false
    return true
  })

  // Group by provider
  const grouped = filtered.reduce<Record<string, ModelEntry[]>>((acc, m) => {
    const key = m.provider || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-heading">Model Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            {models.length} models across {providers.length - 1} providers — availability, latency, and cost tiers
          </p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors mt-1">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Category Tabs */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map(tab => {
          const Icon = tab.icon
          const count = tab.key === 'all'
            ? models.length
            : categorySummary?.[tab.key as keyof CategorySummary] ?? models.filter(m => m.category === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setFilterCategory(tab.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-colors border ${
                filterCategory === tab.key
                  ? 'bg-white/[0.06] text-white border-white/[0.10]'
                  : 'bg-white/[0.04] text-slate-400 border-transparent hover:bg-white/[0.06]'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
              <span className="text-[10px] text-slate-500 ml-0.5">{count}</span>
            </button>
          )
        })}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models…"
            className="pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors w-48"
          />
        </div>
        <select
          value={filterProvider}
          onChange={e => setFilterProvider(e.target.value)}
          className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
        >
          {providers.map(p => <option key={p} value={p} className="bg-[#0a0f1a] text-white">{p === 'all' ? 'All providers' : p}</option>)}
        </select>
        <select
          value={filterCapability}
          onChange={e => setFilterCapability(e.target.value)}
          className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
        >
          {capabilities.map(c => <option key={c} value={c} className="bg-[#0a0f1a] text-white">{c === 'all' ? 'All capabilities' : c}</option>)}
        </select>
        <div className="flex items-center text-xs text-slate-500 ml-auto">
          {filtered.length} of {models.length} models
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Loading models…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={load} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm rounded-xl transition-colors">Retry</button>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Layers className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-500">{models.length === 0 ? 'No models registered.' : 'No models match your filters.'}</p>
        </div>
      ) : (
        <motion.div variants={fadeUp} className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([provider, providerModels]) => (
            <div key={provider} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-mono font-semibold">{provider}</span>
                <span className="text-xs text-slate-600">{providerModels.length} model{providerModels.length !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providerModels.map(m => {
                  const costCls = COST_COLORS[m.costTier ?? ''] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                  const latCls = LATENCY_COLORS[m.latencyTier ?? ''] ?? 'text-slate-400'
                  return (
                    <div key={m.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-3 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{m.displayName ?? m.id}</h3>
                          <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{m.id}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{m.category}</span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${m.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-600/10 text-slate-500 border-slate-600/20'}`}>
                            {m.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{m.role ?? 'unknown'}</span>
                        {m.costTier && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${costCls}`}>{m.costTier.replace('_', ' ')}</span>
                        )}
                        {m.latencyTier && (
                          <span className={`text-[10px] ${latCls} font-mono`}>{m.latencyTier.replace('_', ' ')} latency</span>
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
                        <p className="text-[10px] text-slate-600 font-mono">{(m.contextWindow / 1000).toFixed(0)}k context</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

