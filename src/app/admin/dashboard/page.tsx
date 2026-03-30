'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, AlertCircle, AlertTriangle, WifiOff, Clock,
  RefreshCw, Zap, Activity, Brain, Database, Server,
  ArrowRight, Cpu, Gauge, DollarSign, Bell,
  ShieldAlert, Puzzle,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import MetricCard from '@/components/ui/MetricCard'

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
}

interface MemoryStatusData {
  available: boolean
  totalEntries: number
  appSlugs: string[]
  statusLabel: 'saving' | 'empty' | 'not_configured'
  error: string | null
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

const SEV = {
  critical: { color: 'text-red-400',   bg: 'bg-red-400/10',   dot: 'bg-red-400' },
  error:    { color: 'text-red-400',   bg: 'bg-red-400/10',   dot: 'bg-red-400' },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
  info:     { color: 'text-blue-400',  bg: 'bg-blue-400/10',  dot: 'bg-blue-400' },
} as const

/* ── Animation ─────────────────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

const CARD = 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl'
const INNER = 'bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]'

/* ── Helpers ───────────────────────────────────────────────────── */
function appStatusCfg(status: string, health: string | undefined) {
  if (health === 'error') return { label: 'Issue', dot: 'bg-red-400', color: 'text-red-400' }
  if (status === 'active' && (health === 'healthy' || !health))
    return { label: 'Live', dot: 'bg-emerald-400', color: 'text-emerald-400' }
  return { label: 'Idle', dot: 'bg-amber-400', color: 'text-amber-400' }
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [memory, setMemory] = useState<MemoryStatusData | null>(null)
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
      setLastRefreshed(new Date())
    } catch {
      // silently fail — data stays as-is
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Derived ─────────────────────────────────────────────────── */
  const healthyProviders  = providers.filter(p => p.healthStatus === 'healthy')
  const enabledProviders  = providers.filter(p => p.enabled)
  const unconfiguredProvs = providers.filter(p => p.healthStatus === 'unconfigured')
  const totalApps  = data?.productStats.length ?? 0
  const totalReqs  = data?.brainStats?.totalRequests ?? 0
  const successReqs = data?.brainStats?.successCount ?? 0
  const errorReqs  = data?.brainStats?.errorCount ?? 0
  const successRate = totalReqs > 0 ? Math.round((successReqs / totalReqs) * 100) : 100

  const systemHealth = totalReqs > 0
    ? Math.round(((successReqs / totalReqs) * 0.7 + (healthyProviders.length > 0 ? 0.3 : 0)) * 100)
    : healthyProviders.length > 0 ? 85 : enabledProviders.length > 0 ? 50 : 0
  const alertEvents = data?.recentEvents.filter(e => e.severity === 'critical' || e.severity === 'error') ?? []
  const errorEvents = alertEvents.slice(0, 6)

  /* ── Loading state ───────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        <p className="text-sm text-slate-500 font-mono">Loading control center…</p>
      </div>
    )
  }

  /* ── Error state ─────────────────────────────────────────────── */
  if (!data && dbError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-400 font-semibold">Failed to load dashboard</p>
        <p className="text-xs text-slate-500 max-w-md">{dbError}</p>
        <button
          onClick={() => { setLoading(true); load() }}
          className="mt-2 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white hover:bg-white/[0.1] transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">

      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Control Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">System overview &amp; network health</p>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ─── DB Error Banner ────────────────────────────────────── */}
      {dbError && (
        <motion.div variants={fadeUp} className="bg-red-500/[0.06] border border-red-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Database Connection Error</p>
            <p className="text-xs text-red-400/70 mt-0.5">{dbError}</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Set a valid <code className="text-slate-400 font-mono text-[11px]">DATABASE_URL</code> and check the{' '}
              <Link href="/admin/dashboard/readiness" className="text-blue-400 hover:text-blue-300 underline transition-colors">Readiness</Link> page.
            </p>
          </div>
        </motion.div>
      )}

      {/* ─── Top Strip: 5 Metric Cards ──────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="System Health"  value={`${systemHealth}%`}               icon={<Gauge className="w-4 h-4" />} />
        <MetricCard label="Active Apps"    value={totalApps}                         icon={<Server className="w-4 h-4" />} />
        <MetricCard label="AI Activity"    value={totalReqs.toLocaleString()}        icon={<Brain className="w-4 h-4" />} suffix="reqs" />
        <MetricCard label="Cost Burn"      value="—"                                icon={<DollarSign className="w-4 h-4" />} /> {/* TODO: wire to billing API */}
        <MetricCard label="Alerts"         value={alertEvents.length}               icon={<Bell className="w-4 h-4" />} />
      </motion.div>

      {/* ─── Main 3-Column Grid ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — App Network */}
        <div className={CARD}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" /> App Network
            </h2>
            <Link href="/admin/dashboard/apps" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-1.5 max-h-[380px] overflow-y-auto">
            {totalApps === 0 ? (
              <div className="py-10 text-center">
                <Server className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No apps registered</p>
                <Link href="/admin/dashboard/apps" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Register your first app →
                </Link>
              </div>
            ) : (
              data?.productStats.map(app => {
                const cfg = appStatusCfg(app.status, app.integration?.healthStatus)
                return (
                  <div key={app.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
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

        {/* CENTER — Intelligence Activity */}
        <div className={CARD}>
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Intelligence Activity
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Brain performance */}
            <div className="grid grid-cols-3 gap-2">
              <div className={INNER}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Success</p>
                <p className={`text-lg font-bold font-mono mt-1 ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                  {totalReqs > 0 ? `${successRate}%` : '—'}
                </p>
              </div>
              <div className={INNER}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</p>
                <p className="text-lg font-bold font-mono mt-1 text-white">
                  {data?.brainStats?.avgLatencyMs ? `${data.brainStats.avgLatencyMs}ms` : '—'}
                </p>
              </div>
              <div className={INNER}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Errors</p>
                <p className={`text-lg font-bold font-mono mt-1 ${errorReqs > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {errorReqs.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Provider usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Providers</p>
                <Link href="/admin/dashboard/ai-providers" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">Manage →</Link>
              </div>
              {providers.length === 0 ? (
                <p className="text-xs text-slate-600 py-3 text-center">No providers configured</p>
              ) : (
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {enabledProviders.map(p => {
                    const cfg = H[p.healthStatus as keyof typeof H] ?? H.unconfigured
                    return (
                      <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-white truncate flex-1">{p.displayName}</span>
                        <span className={`text-[10px] font-mono ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Memory status */}
            <div className={INNER}>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Memory</p>
                <span className={`ml-auto text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                  memory?.statusLabel === 'saving'
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : memory?.statusLabel === 'empty'
                    ? 'bg-amber-400/10 text-amber-400'
                    : 'bg-slate-500/10 text-slate-500'
                }`}>
                  {memory?.statusLabel === 'saving' ? 'ACTIVE' : memory?.statusLabel === 'empty' ? 'EMPTY' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-white">{(memory?.totalEntries ?? 0).toLocaleString()} <span className="text-slate-500">entries</span></span>
                <span className="text-white">{memory?.appSlugs?.length ?? 0} <span className="text-slate-500">ns</span></span>
              </div>
              {memory?.error && (
                <p className="text-[10px] text-red-400/70 font-mono mt-2 truncate">{memory.error}</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Alerts & Issues */}
        <div className={CARD}>
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" /> Alerts &amp; Issues
            </h2>
          </div>
          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
            {/* Missing API keys */}
            {unconfiguredProvs.length > 0 && (
              <div>
                <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Missing API Keys
                </p>
                <div className="space-y-1">
                  {unconfiguredProvs.map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-400/[0.04] border border-amber-400/10">
                      <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-xs text-white truncate flex-1">{p.displayName}</span>
                      <Link href="/admin/dashboard/ai-providers" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                        Configure
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent errors */}
            <div>
              <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" /> Recent Errors
              </p>
              {errorEvents.length === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400/40 mx-auto mb-1" />
                  <p className="text-xs text-slate-600">No errors — all clear</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {errorEvents.map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs text-white truncate flex-1">{ev.title}</span>
                      <span className="text-[10px] text-slate-600 font-mono shrink-0">
                        {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TODO: Capability gaps — wire to analysis API */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Puzzle className="w-3 h-3" /> Capability Gaps
              </p>
              <div className="py-3 text-center rounded-lg bg-white/[0.02] border border-dashed border-white/[0.06]">
                <p className="text-[11px] text-slate-600">Analysis coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Bottom Section ─────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (spans 2 cols) */}
        <div className={`${CARD} lg:col-span-2`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" /> Recent Activity
            </h2>
            <Link href="/admin/dashboard/events" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {(data?.recentEvents.length ?? 0) === 0 ? (
              <div className="py-8 text-center">
                <Activity className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No events logged yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data?.recentEvents.slice(0, 8).map(ev => {
                  const sev = SEV[ev.severity as keyof typeof SEV] ?? { color: 'text-slate-400', bg: 'bg-white/[0.03]', dot: 'bg-slate-500' }
                  return (
                    <div key={ev.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ev.title}</p>
                        <p className="text-[11px] text-slate-600">{ev.product?.name ?? '—'}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${sev.bg} ${sev.color}`}>{ev.severity}</span>
                        <span className="text-[10px] text-slate-600 font-mono w-20 text-right">
                          {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* System Summary */}
        <div className={CARD}>
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" /> System Summary
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: 'Total Apps',       value: String(data?.metrics.totalProducts ?? 0) },
              { label: 'Active Providers',  value: `${enabledProviders.length} / ${providers.length}` },
              { label: 'Healthy Providers', value: String(healthyProviders.length) },
              { label: 'Total Requests',    value: totalReqs.toLocaleString() },
              { label: 'Error Rate',        value: totalReqs > 0 ? `${100 - successRate}%` : '0%' },
              { label: 'Memory Entries',    value: (memory?.totalEntries ?? 0).toLocaleString() },
              { label: 'Contacts',          value: String(data?.metrics.totalContacts ?? 0) },
              { label: 'Waitlist',          value: String(data?.metrics.totalWaitlist ?? 0) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-slate-500">{row.label}</span>
                <span className="text-xs font-mono text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
