'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, RefreshCw, AlertCircle, ArrowRight, Search,
  Zap, Shield, Clock, CheckCircle, ChevronRight, Activity,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────── */

interface FallbackNode {
  provider: string
  model: string
  priority: number
}

interface RouteEntry {
  id: string
  appSlug: string
  taskType: string
  primaryProvider: string
  primaryModel: string
  fallbackChain: FallbackNode[]
  successRate: number
  avgLatencyMs: number
  active: boolean
}

interface RoutingDecisionEvent {
  id: string
  timestamp: string
  appSlug: string
  taskType: string
  chosenProvider: string
  chosenModel: string
  wasFallback: boolean
  latencyMs: number
  success: boolean
}

interface RoutingStats {
  totalRoutes: number
  activeFallbacks: number
  avgLatencyMs: number
  successRate: number
}

interface RoutingData {
  routes: RouteEntry[]
  fallbackChains: FallbackNode[][]
  stats: RoutingStats
  recentDecisions?: RoutingDecisionEvent[]
}

/* ── Stat card ─────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: string; icon: LucideIcon; color: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">{label}</p>
        <div className={`p-1.5 rounded-lg bg-white/[0.04] ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-3xl font-extrabold tracking-tight ${color}`}>{value}</p>
    </motion.div>
  )
}

/* ── Fallback chain visualization ──────────────────────────── */

function FallbackChain({ primary, chain }: {
  primary: { provider: string; model: string }
  chain: FallbackNode[]
}) {
  const nodes = [
    { provider: primary.provider, model: primary.model, label: 'Primary' },
    ...chain.map((n, i) => ({ ...n, label: `Fallback ${i + 1}` })),
  ]
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono ${
            i === 0
              ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
              : 'bg-white/[0.03] border-white/[0.06] text-slate-400'
          }`}>
            <span className="text-[10px] text-slate-500 block leading-tight">{node.label}</span>
            {node.model}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────── */

export default function RoutingPage() {
  const [data, setData] = useState<RoutingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/routing')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = data?.stats
  const routes = data?.routes ?? []
  const decisions = data?.recentDecisions ?? []

  const filtered = routes.filter(r =>
    !search ||
    r.appSlug.toLowerCase().includes(search.toLowerCase()) ||
    r.primaryProvider.toLowerCase().includes(search.toLowerCase()) ||
    r.primaryModel.toLowerCase().includes(search.toLowerCase()) ||
    r.taskType.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Stat cards config ─────────────────────────────────── */
  const statCards: { label: string; value: string; icon: LucideIcon; color: string }[] = [
    { label: 'Total Routes', value: String(stats?.totalRoutes ?? 0), icon: Route, color: 'text-blue-400' },
    { label: 'Active Fallbacks', value: String(stats?.activeFallbacks ?? 0), icon: Shield, color: 'text-violet-400' },
    { label: 'Avg Latency', value: `${stats?.avgLatencyMs ?? 0}ms`, icon: Clock, color: 'text-cyan-400' },
    { label: 'Success Rate', value: `${(stats?.successRate ?? 0).toFixed(1)}%`, icon: CheckCircle, color: 'text-emerald-400' },
  ]

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AI Request Routing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor how requests flow through providers, models, and fallback chains.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.06} />
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by app, provider, or task…"
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] backdrop-blur-xl rounded-xl text-sm text-white placeholder-slate-500 border border-white/[0.06] focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Loading / Error */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Route table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Route className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Route Table</h2>
              <span className="ml-auto text-xs text-slate-500">{filtered.length} route{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Route className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No routes match your filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filtered.map((route, i) => (
                  <motion.div
                    key={route.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <button
                      onClick={() => setExpanded(expanded === route.id ? null : route.id)}
                      className="w-full text-left px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white truncate">{route.appSlug}</span>
                            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border bg-violet-500/10 border-violet-500/25 text-violet-400">
                              {route.taskType}
                            </span>
                            {!route.active && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/20 text-slate-500">inactive</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono truncate">
                            {route.primaryProvider}/{route.primaryModel}
                            {route.fallbackChain.length > 0 && (
                              <span className="text-slate-600"> → {route.fallbackChain.length} fallback{route.fallbackChain.length !== 1 ? 's' : ''}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-5 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Success</p>
                            <p className={`text-sm font-semibold ${route.successRate >= 95 ? 'text-emerald-400' : route.successRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                              {route.successRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Latency</p>
                            <p className="text-sm font-semibold text-cyan-400">{route.avgLatencyMs}ms</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${expanded === route.id ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </button>

                    {/* Expanded fallback visualization */}
                    <AnimatePresence>
                      {expanded === route.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-1">
                            <p className="text-[10px] text-slate-500 uppercase mb-2">Fallback Chain</p>
                            <FallbackChain
                              primary={{ provider: route.primaryProvider, model: route.primaryModel }}
                              chain={route.fallbackChain}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent routing decisions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-bold text-white">Recent Routing Decisions</h2>
            </div>

            {decisions.length === 0 ? (
              <div className="p-10 text-center">
                <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No recent decisions recorded.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {decisions.slice(0, 15).map((d, i) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.03 }}
                    className="px-5 py-3 flex items-center gap-4"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="font-medium">{d.appSlug}</span>
                        <span className="text-slate-500 mx-1.5">·</span>
                        <span className="text-slate-400">{d.taskType}</span>
                      </p>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        {d.chosenProvider}/{d.chosenModel}
                        {d.wasFallback && (
                          <span className="ml-1.5 text-amber-400">(fallback)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <span className="text-xs text-cyan-400 font-mono">{d.latencyMs}ms</span>
                      <span className="text-xs text-slate-600 w-24 truncate">
                        {new Date(d.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      <p className="text-xs text-slate-600">
        Routes reflect current provider registry state. Fallback chains activate automatically on provider failure.
      </p>
    </div>
  )
}
