'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, AlertCircle, AlertTriangle, WifiOff, Clock,
  RefreshCw, Zap, Brain, Database, Server,
  ArrowRight, Cpu, Gauge, DollarSign, Bell,
  ShieldAlert, Sparkles,
  FlaskConical, Activity, Layers,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ─────────────────────────────────────────────────────── */
interface DashboardData {
  metrics: {
    totalProducts: number
    totalContacts: number
    totalWaitlist: number
    totalIntegrations: number
  }
  recentEvents: Array<{
    id: number
    eventType: string
    severity: string
    title: string
    timestamp: string
    product: { name: string } | null
  }>
  recentBrainEvents?: Array<{
    id: number
    traceId: string
    appSlug: string
    taskType: string
    routedProvider: string | null
    success: boolean
    latencyMs: number | null
    timestamp: string
  }>
  productStats: Array<{
    id: number
    name: string
    status: string
    integration: { healthStatus: string; lastHeartbeatAt: string | null } | null
  }>
  brainStats: {
    totalRequests: number
    successCount: number
    errorCount: number
    avgLatencyMs: number | null
  } | null
}

interface ProviderSummary {
  id: number
  providerKey: string
  displayName: string
  enabled: boolean
  maskedPreview: string
  healthStatus: string
  healthMessage: string
  lastCheckedAt: string | null
  launchRequired?: boolean
}

interface MemoryStatusData {
  available: boolean
  totalEntries: number
  appSlugs: string[]
  statusLabel: 'saving' | 'empty' | 'not_configured'
  error: string | null
}

interface TruthSummary {
  totalProviders: number
  activeProviders: number
  configuredProviders: number
  totalModels: number
  usableModels: number
  totalCapabilities: number
  availableCapabilities: number
  blockedCapabilities: number
  unavailableCapabilities: number
  notImplemented: number
  systemHealth: number
}

/* ── Health config ─────────────────────────────────────────────── */
const H = {
  healthy:      { label: 'Healthy',  color: 'text-emerald-400', dot: 'bg-emerald-400', icon: CheckCircle },
  configured:   { label: 'Key Set',  color: 'text-amber-400',   dot: 'bg-amber-400',   icon: Clock },
  degraded:     { label: 'Degraded', color: 'text-amber-400',   dot: 'bg-amber-400',   icon: AlertTriangle },
  error:        { label: 'Error',    color: 'text-red-400',     dot: 'bg-red-400',     icon: AlertCircle },
  unconfigured: { label: 'Not Set',  color: 'text-slate-500',   dot: 'bg-slate-600',   icon: WifiOff },
  disabled:     { label: 'Disabled', color: 'text-slate-500',   dot: 'bg-slate-600',   icon: WifiOff },
} as const

/* ── Animation ─────────────────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

/* ── Helpers ───────────────────────────────────────────────────── */
function appStatusCfg(status: string, health: string | undefined) {
  if (health === 'error') return { label: 'Issue', dot: 'bg-red-400', color: 'text-red-400' }
  if (status === 'active' && (health === 'healthy' || !health))
    return { label: 'Live', dot: 'bg-emerald-400', color: 'text-emerald-400' }
  return { label: 'Idle', dot: 'bg-amber-400', color: 'text-amber-400' }
}

const CARD = 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden'

/* ── Main ──────────────────────────────────────────────────────── */
export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [memory, setMemory] = useState<MemoryStatusData | null>(null)
  const [budgetData, setBudgetData] = useState<{ totalEstimatedSpendUsd: number } | null>(null)
  const [truth, setTruth] = useState<TruthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setDbError(null)
    try {
      const [dashRes, provRes, memRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/providers'),
        fetch('/api/admin/memory'),
      ])
      if (dashRes.ok) setData(await dashRes.json())
      if (provRes.ok) {
        const body = await provRes.json()
        if (Array.isArray(body)) {
          setProviders(body)
        } else if (body.error) {
          setDbError(body.error)
        }
      } else {
        const body = await provRes.json().catch(() => ({}))
        if (body.error) setDbError(body.error)
      }
      if (memRes.ok) setMemory(await memRes.json())
      try {
        const budgetRes = await fetch('/api/admin/budgets')
        if (budgetRes.ok) setBudgetData(await budgetRes.json())
      } catch (err) {
        console.warn('[dashboard] Budget fetch failed:', err instanceof Error ? err.message : err)
      }
      try {
        const truthRes = await fetch('/api/admin/truth?section=summary')
        if (truthRes.ok) {
          const truthBody = await truthRes.json()
          if (truthBody.summary) setTruth(truthBody.summary)
        }
      } catch (err) {
        console.warn('[dashboard] Truth fetch failed:', err instanceof Error ? err.message : err)
      }
      setLastRefreshed(new Date())
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Derived ─────────────────────────────────────────────────── */
  const healthyProviders  = providers.filter(p => p.healthStatus === 'healthy')
  const _enabledProviders  = providers.filter(p => p.enabled)
  const unconfiguredProvs = providers.filter(p => p.healthStatus === 'unconfigured')
  const totalApps  = data?.productStats?.length ?? 0
  const totalReqs  = data?.brainStats?.totalRequests ?? 0
  const successReqs = data?.brainStats?.successCount ?? 0
  const errorReqs  = data?.brainStats?.errorCount ?? 0
  const successRate = totalReqs > 0 ? Math.round((successReqs / totalReqs) * 100) : 0
  const systemHealth = totalReqs > 0
    ? Math.round(((successReqs / totalReqs) * 0.7 + (healthyProviders.length > 0 ? 0.3 : 0)) * 100)
    : 0
  const alertEvents = (data?.recentEvents ?? []).filter(e => e.severity === 'critical' || e.severity === 'error')
  const errorEvents = alertEvents.slice(0, 5)
  const healthScore = truth?.systemHealth ?? systemHealth

  /* ── Loading state ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.06] flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
        <p className="text-sm text-slate-500">Loading command center…</p>
      </div>
    )
  }

  /* ── Error state ─────────────────────────────────────────────── */
  if (!data && dbError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-sm text-red-400 font-semibold">Failed to load dashboard</p>
        <p className="text-xs text-slate-500 max-w-md">{dbError}</p>
        <button
          onClick={() => { setLoading(true); load() }}
          className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white hover:bg-white/[0.08] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.06] flex items-center justify-center">
            <Gauge className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Command Center</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">System overview &amp; network health</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-600 font-mono hidden sm:inline">
              {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ─── DB Error Banner ────────────────────────────────────── */}
      {dbError && (
        <motion.div variants={fadeUp} className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Database Connection Error</p>
            <p className="text-xs text-red-400/70 mt-0.5">{dbError}</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Set a valid <code className="text-slate-400 font-mono text-[11px]">DATABASE_URL</code> and check the{' '}
              <Link href="/admin/dashboard/access" className="text-blue-400 hover:text-blue-300 underline transition-colors">Settings</Link> page.
            </p>
          </div>
        </motion.div>
      )}

      {/* ─── Key Metrics ────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Health', value: `${healthScore}%`, icon: Gauge,      color: healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-red-400', gradient: 'from-emerald-500/8 to-emerald-500/3' },
            { label: 'Apps',   value: totalApps,         icon: Server,     color: 'text-blue-400',    gradient: 'from-blue-500/8 to-blue-500/3' },
            { label: 'Requests', value: totalReqs.toLocaleString(), icon: Brain, color: 'text-violet-400', gradient: 'from-violet-500/8 to-violet-500/3' },
            { label: 'Spend',  value: budgetData?.totalEstimatedSpendUsd != null ? `$${budgetData.totalEstimatedSpendUsd.toFixed(2)}` : '—', icon: DollarSign, color: 'text-amber-400', gradient: 'from-amber-500/8 to-amber-500/3' },
            { label: 'Alerts', value: alertEvents.length, icon: Bell,       color: alertEvents.length > 0 ? 'text-red-400' : 'text-slate-500', gradient: alertEvents.length > 0 ? 'from-red-500/8 to-red-500/3' : 'from-slate-500/8 to-slate-500/3' },
          ].map(m => (
            <div key={m.label} className={`bg-gradient-to-br ${m.gradient} border border-white/[0.05] rounded-2xl px-4 py-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{m.label}</span>
                <m.icon className={`w-3.5 h-3.5 ${m.color} opacity-60`} />
              </div>
              <p className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Primary Grid: Apps + Intelligence ──────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* App Network */}
        <div className={CARD}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" /> App Network
            </h2>
            <Link href="/admin/dashboard/apps" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-1 max-h-[280px] overflow-y-auto">
            {totalApps === 0 ? (
              <div className="py-8 text-center">
                <Server className="w-5 h-5 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No apps registered</p>
                <Link href="/admin/dashboard/apps" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Register your first app →
                </Link>
              </div>
            ) : (
              data?.productStats?.map(app => {
                const cfg = appStatusCfg(app.status, app.integration?.healthStatus)
                return (
                  <div key={app.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className="relative flex h-2 w-2 shrink-0">
                      {cfg.label === 'Live' && <span className={`animate-ping absolute inset-0 rounded-full ${cfg.dot} opacity-75`} />}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{app.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono ${cfg.color}`}>{cfg.label}</span>
                        {app.integration?.lastHeartbeatAt && (
                          <span className="text-[10px] text-slate-600 font-mono">
                            {formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Intelligence Performance */}
        <div className={CARD}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Intelligence
            </h2>
            <Link href="/admin/dashboard/operations" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">Providers →</Link>
          </div>
          <div className="p-4 space-y-3">
            {/* Performance metrics */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Success', value: totalReqs > 0 ? `${successRate}%` : '—', color: successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-red-400' },
                { label: 'Latency', value: data?.brainStats?.avgLatencyMs ? `${data.brainStats.avgLatencyMs}ms` : '—', color: 'text-white' },
                { label: 'Errors',  value: errorReqs.toLocaleString(), color: errorReqs > 0 ? 'text-red-400' : 'text-slate-500' },
              ].map(m => (
                <div key={m.label} className="bg-white/[0.02] rounded-xl p-2.5 border border-white/[0.04]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                  <p className={`text-base font-bold font-mono mt-0.5 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Providers + Memory in a compact row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Providers */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Providers</p>
                {providers.length === 0 ? (
                  <p className="text-xs text-slate-600 py-2 text-center">None configured</p>
                ) : (
                  <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                    {providers.slice(0, 5).map(p => {
                      const cfg = H[p.healthStatus as keyof typeof H] ?? H.unconfigured
                      const isActive = p.healthStatus === 'healthy'
                      return (
                        <div key={p.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className={`text-[11px] truncate flex-1 ${isActive ? 'text-white' : 'text-slate-500'}`}>{p.displayName}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Memory */}
              <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">Memory</p>
                  <span className={`ml-auto text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${
                    memory?.statusLabel === 'saving'
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : memory?.statusLabel === 'empty'
                      ? 'bg-amber-400/10 text-amber-400'
                      : 'bg-slate-500/10 text-slate-500'
                  }`}>
                    {memory?.statusLabel === 'saving' ? 'ON' : memory?.statusLabel === 'empty' ? 'EMPTY' : 'OFF'}
                  </span>
                </div>
                <div className="space-y-0.5 text-[11px] font-mono">
                  <div className="text-white">{(memory?.totalEntries ?? 0).toLocaleString()} <span className="text-slate-500">entries</span></div>
                  <div className="text-white">{memory?.appSlugs?.length ?? 0} <span className="text-slate-500">ns</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Secondary Grid: Activity + Alerts + Actions ─────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent AI Activity — spans 2 cols */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Recent Activity
            </h2>
            <Link href="/admin/dashboard/events" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {(data?.recentBrainEvents?.length ?? 0) === 0 ? (
              <div className="py-8 text-center">
                <Brain className="w-5 h-5 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No AI requests logged yet</p>
                <p className="text-[11px] text-slate-600 mt-1">Activity appears here once apps start making requests</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {(data?.recentBrainEvents ?? []).slice(0, 8).map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white truncate font-mono">{ev.taskType}</p>
                      <p className="text-[10px] text-slate-600 truncate">{ev.appSlug} · {ev.routedProvider ?? 'no provider'}</p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg ${ev.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {ev.success ? 'ok' : 'err'}
                      </span>
                      {ev.latencyMs != null && (
                        <span className="text-[10px] text-slate-600 font-mono">{ev.latencyMs}ms</span>
                      )}
                      <span className="text-[10px] text-slate-600 font-mono w-16 text-right hidden sm:inline">
                        {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alerts + Quick Actions combined */}
        <div className="space-y-5">
          {/* Alerts */}
          {(unconfiguredProvs.length > 0 || errorEvents.length > 0) && (
            <div className={CARD}>
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" /> Alerts
                </h2>
              </div>
              <div className="p-4 space-y-3 max-h-[200px] overflow-y-auto">
                {unconfiguredProvs.length > 0 && (
                  <div>
                    <p className="text-[9px] text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Missing Keys
                    </p>
                    <div className="space-y-1">
                      {unconfiguredProvs.slice(0, 3).map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-400/[0.04] border border-amber-400/10">
                          <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-white truncate flex-1">{p.displayName}</span>
                          <Link href="/admin/dashboard/operations" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors shrink-0">Fix</Link>
                        </div>
                      ))}
                      {unconfiguredProvs.length > 3 && <p className="text-[10px] text-slate-600 pl-2">+{unconfiguredProvs.length - 3} more</p>}
                    </div>
                  </div>
                )}
                {errorEvents.length > 0 && (
                  <div>
                    <p className="text-[9px] text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Recent Errors
                    </p>
                    <div className="space-y-1">
                      {errorEvents.map(ev => (
                        <div key={ev.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          <span className="text-[11px] text-white truncate flex-1">{ev.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No alerts — show all-clear */}
          {unconfiguredProvs.length === 0 && errorEvents.length === 0 && (
            <div className={CARD}>
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" /> Status
                </h2>
              </div>
              <div className="p-4 py-6 text-center">
                <CheckCircle className="w-5 h-5 text-emerald-400/40 mx-auto mb-2" />
                <p className="text-xs text-slate-500">All systems operational</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className={CARD}>
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Quick Actions
              </h2>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Studio',    href: '/admin/dashboard/build-studio',  icon: FlaskConical, gradient: 'from-blue-500/15 to-violet-500/15' },
                { label: 'Apps',      href: '/admin/dashboard/apps',          icon: Server,       gradient: 'from-cyan-500/15 to-blue-500/15' },
                { label: 'Models',    href: '/admin/dashboard/models',        icon: Brain,        gradient: 'from-violet-500/15 to-purple-500/15' },
                { label: 'Providers', href: '/admin/dashboard/operations',    icon: Activity,     gradient: 'from-rose-500/15 to-pink-500/15' },
                { label: 'Artifacts', href: '/admin/dashboard/artifacts',     icon: Layers,       gradient: 'from-amber-500/15 to-yellow-500/15' },
                { label: 'Events',    href: '/admin/dashboard/events',        icon: Cpu,          gradient: 'from-emerald-500/15 to-green-500/15' },
              ].map(action => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-gradient-to-br ${action.gradient} border border-white/[0.06] hover:border-white/[0.12] hover:scale-[1.02] transition-all text-center`}
                >
                  <action.icon className="w-4 h-4 text-white" />
                  <span className="text-[10px] text-white font-medium">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
