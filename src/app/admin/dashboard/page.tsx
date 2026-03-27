'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, AlertCircle, AlertTriangle, WifiOff, Clock,
  RefreshCw, Zap, Activity, Shield, Brain, Database, Server,
  ArrowRight, CircleDot, Cpu, BarChart3, Gauge,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────
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
    product: { name: string }
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

// ── Health config ──────────────────────────────────────────────
const H = {
  healthy:      { label: 'Healthy',      color: 'text-emerald-400', dot: 'bg-emerald-400', icon: CheckCircle },
  configured:   { label: 'Key Set',      color: 'text-amber-400',   dot: 'bg-amber-400',   icon: Clock },
  degraded:     { label: 'Degraded',     color: 'text-amber-400',   dot: 'bg-amber-400',   icon: AlertTriangle },
  error:        { label: 'Error',        color: 'text-red-400',     dot: 'bg-red-400',     icon: AlertCircle },
  unconfigured: { label: 'Not Set',      color: 'text-slate-500',   dot: 'bg-slate-600',   icon: WifiOff },
  disabled:     { label: 'Disabled',     color: 'text-slate-500',   dot: 'bg-slate-600',   icon: WifiOff },
} as const

const SEV = {
  critical: { color: 'text-red-400',   bg: 'bg-red-400/10',   dot: 'bg-red-400' },
  error:    { color: 'text-red-400',   bg: 'bg-red-400/10',   dot: 'bg-red-400' },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
  info:     { color: 'text-blue-400',  bg: 'bg-blue-400/10',  dot: 'bg-blue-400' },
} as const

// ── Staggered entrance animation ──────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

// ── Main ──────────────────────────────────────────────────────
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

  // ── Derived ────────────────────────────────────────────────
  const healthyProviders  = providers.filter(p => p.healthStatus === 'healthy')
  const enabledProviders  = providers.filter(p => p.enabled)
  const totalApps         = data?.productStats.length ?? 0

  const totalReqs   = data?.brainStats?.totalRequests ?? 0
  const successReqs = data?.brainStats?.successCount ?? 0
  const errorReqs   = data?.brainStats?.errorCount ?? 0
  const successRate = totalReqs > 0 ? Math.round((successReqs / totalReqs) * 100) : 100
  const systemHealth = totalReqs > 0
    ? Math.round(((successReqs / totalReqs) * 0.7 + (healthyProviders.length > 0 ? 0.3 : 0)) * 100)
    : healthyProviders.length > 0 ? 85 : enabledProviders.length > 0 ? 50 : 0

  const systemOnline = enabledProviders.length > 0 || totalApps > 0

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-white/[0.03] rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white/[0.03] rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white/[0.03] rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl"
    >
      {/* ─── Header Section ──────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 text-transparent bg-clip-text">
            AmarktAI Network
          </h1>
          <p className="text-sm text-slate-500 mt-1">Command Center</p>
        </div>
        <div className="flex items-center gap-4">
          {/* System status */}
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5 ${systemOnline ? '' : ''}`}>
              {systemOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${systemOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            </span>
            <span className={`text-xs font-mono ${systemOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
              {systemOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {/* Last refreshed */}
          {lastRefreshed && (
            <span className="text-xs text-slate-600 font-mono hidden sm:inline">
              {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
            </span>
          )}
          {/* Refresh button */}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ─── DB Error Banner ─────────────────────────────────── */}
      {dbError && (
        <motion.div variants={fadeUp} className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Database unavailable</p>
            <p className="text-xs text-red-400/70 mt-0.5">{dbError}</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Set a valid <code className="text-slate-400 font-mono text-[11px]">DATABASE_URL</code> and check the{' '}
              <Link href="/admin/dashboard/readiness" className="text-blue-400 hover:text-blue-300 underline">Readiness</Link> page.
            </p>
          </div>
        </motion.div>
      )}

      {/* ─── Key Metrics Row ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Apps',
            value: data?.metrics.totalProducts ?? 0,
            icon: Server,
            gradient: 'from-blue-500/20 to-blue-500/5',
            accent: 'text-blue-400',
          },
          {
            label: 'Active Providers',
            value: enabledProviders.length,
            icon: Cpu,
            gradient: 'from-violet-500/20 to-violet-500/5',
            accent: 'text-violet-400',
          },
          {
            label: 'Brain Requests',
            value: totalReqs,
            icon: Brain,
            gradient: 'from-cyan-500/20 to-cyan-500/5',
            accent: 'text-cyan-400',
          },
          {
            label: 'System Health',
            value: `${systemHealth}%`,
            icon: Gauge,
            gradient: 'from-emerald-500/20 to-emerald-500/5',
            accent: systemHealth >= 70 ? 'text-emerald-400' : systemHealth >= 40 ? 'text-amber-400' : 'text-red-400',
          },
        ].map((m) => (
          <div
            key={m.label}
            className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} pointer-events-none`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500 tracking-wide uppercase">{m.label}</span>
                <m.icon className={`w-4 h-4 ${m.accent} opacity-60`} />
              </div>
              <p className={`text-3xl font-bold font-mono ${m.accent}`}>{m.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ─── Provider Status Grid ────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            Provider Status
          </h2>
          <Link href="/admin/dashboard/ai-providers" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {providers.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
            <WifiOff className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No providers configured</p>
            <Link href="/admin/dashboard/ai-providers" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
              Set up AI providers →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map(p => {
              const cfg = H[p.healthStatus as keyof typeof H] ?? H.unconfigured
              const Icon = cfg.icon
              return (
                <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    p.healthStatus === 'healthy' ? 'bg-emerald-400/10' :
                    p.healthStatus === 'error' ? 'bg-red-400/10' :
                    p.healthStatus === 'configured' || p.healthStatus === 'degraded' ? 'bg-amber-400/10' :
                    'bg-white/[0.03]'
                  }`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{p.displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`text-xs font-mono ${cfg.color}`}>{cfg.label}</span>
                      {!p.enabled && <span className="text-[10px] text-slate-600 font-mono ml-1">(disabled)</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* ─── System Subsections (2-column) ───────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Memory Status */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Memory Status
            </h2>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
              memory?.statusLabel === 'saving' ? 'bg-emerald-400/10 text-emerald-400' :
              memory?.statusLabel === 'empty' ? 'bg-amber-400/10 text-amber-400' :
              'bg-slate-500/10 text-slate-500'
            }`}>
              {memory?.statusLabel === 'saving' ? 'ACTIVE' :
               memory?.statusLabel === 'empty' ? 'EMPTY' : 'NOT CONFIGURED'}
            </span>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total Entries</p>
                <p className="text-2xl font-bold font-mono text-white">{memory?.totalEntries ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">App Slugs</p>
                <p className="text-2xl font-bold font-mono text-white">{memory?.appSlugs?.length ?? 0}</p>
              </div>
            </div>
            {memory?.appSlugs && memory.appSlugs.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Connected Apps</p>
                <div className="flex flex-wrap gap-1.5">
                  {memory.appSlugs.map(slug => (
                    <span key={slug} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                      {slug}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {memory?.error && (
              <p className="text-xs text-red-400/70 font-mono">{memory.error}</p>
            )}
          </div>
        </div>

        {/* Brain Stats */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              Brain Stats
            </h2>
            <Link href="/admin/dashboard/brain-chat" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              Open Chat <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] rounded-xl p-3.5">
                <p className="text-xs text-slate-500">Success Rate</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                  {totalReqs > 0 ? `${successRate}%` : '—'}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3.5">
                <p className="text-xs text-slate-500">Avg Latency</p>
                <p className="text-2xl font-bold font-mono mt-1 text-white">
                  {data?.brainStats?.avgLatencyMs ? `${data.brainStats.avgLatencyMs}ms` : '—'}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3.5">
                <p className="text-xs text-slate-500">Success</p>
                <p className="text-2xl font-bold font-mono mt-1 text-emerald-400">{successReqs}</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-3.5">
                <p className="text-xs text-slate-500">Errors</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${errorReqs > 0 ? 'text-red-400' : 'text-white'}`}>{errorReqs}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Quick Actions
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Providers',   href: '/admin/dashboard/ai-providers', icon: Cpu,      desc: 'Manage AI keys' },
              { label: 'Workspace',   href: '/admin/dashboard/apps',         icon: Server,   desc: 'App registry' },
              { label: 'Readiness',   href: '/admin/dashboard/readiness',    icon: Shield,   desc: 'Go-live checks' },
              { label: 'Events',      href: '/admin/dashboard/events',       icon: Activity, desc: 'Logs & alerts' },
              { label: 'Brain Chat',  href: '/admin/dashboard/brain-chat',   icon: Brain,    desc: 'Test AI brain' },
              { label: 'Analytics',   href: '/admin/dashboard/analytics',    icon: BarChart3, desc: 'Usage stats' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all group"
              >
                <item.icon className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{item.label}</p>
                  <p className="text-[11px] text-slate-600 truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Recent Events
            </h2>
            <Link href="/admin/dashboard/events" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4">
            {(data?.recentEvents.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No events logged yet</p>
            ) : (
              <div className="space-y-1">
                {data?.recentEvents.slice(0, 5).map(ev => {
                  const sev = SEV[ev.severity as keyof typeof SEV] ?? { color: 'text-slate-400', bg: 'bg-white/[0.03]', dot: 'bg-slate-500' }
                  return (
                    <div key={ev.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ev.title}</p>
                        <p className="text-[11px] text-slate-600">{ev.product?.name ?? '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${sev.bg} ${sev.color}`}>
                          {ev.severity}
                        </span>
                        <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
                          {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── Product Status Table ────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-cyan-400" />
            Product Status
          </h2>
          <Link href="/admin/dashboard/apps" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            Manage Apps <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {totalApps === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No apps registered</p>
            <Link href="/admin/dashboard/apps" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
              Register your first app →
            </Link>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider px-5 py-3">App Name</th>
                    <th className="text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider px-5 py-3">Health</th>
                    <th className="text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider px-5 py-3">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.productStats.map(app => {
                    const health = app.integration?.healthStatus ?? 'no_integration'
                    const healthCfg = health === 'healthy'
                      ? { label: 'Healthy', color: 'text-emerald-400', dot: 'bg-emerald-400' }
                      : health === 'degraded'
                      ? { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400' }
                      : health === 'error'
                      ? { label: 'Error', color: 'text-red-400', dot: 'bg-red-400' }
                      : { label: 'No Integration', color: 'text-slate-500', dot: 'bg-slate-600' }
                    return (
                      <tr key={app.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-sm text-white font-medium">{app.name}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                            app.status === 'active' ? 'bg-emerald-400/10 text-emerald-400' :
                            app.status === 'draft' ? 'bg-amber-400/10 text-amber-400' :
                            'bg-white/[0.04] text-slate-500'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${healthCfg.dot}`} />
                            <span className={`text-xs font-mono ${healthCfg.color}`}>{healthCfg.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-slate-600 font-mono">
                            {app.integration?.lastHeartbeatAt
                              ? formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
