'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, AlertCircle, AlertTriangle, WifiOff, Clock,
  RefreshCw, ArrowRight, Zap, Activity, Shield,
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

// ── Provider summary from /api/admin/providers ─────────────────
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

// ── Memory status from /api/admin/memory ──────────────────────
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
  critical: 'text-red-400',
  error:    'text-red-400',
  warning:  'text-amber-400',
  info:     'text-blue-400',
} as const

// ── Card wrapper ───────────────────────────────────────────────
function Card({ title, action, children, className = '' }: {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-[#0A1020] border border-white/8 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {action && (
          <Link href={action.href} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            {action.label} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Stat tile ──────────────────────────────────────────────────
function StatTile({ label, value, sub, accent = false }: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-blue-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [memory, setMemory] = useState<MemoryStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)

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
        // If response is an array it's a provider list; otherwise it's an error body
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
  const connectedApps     = data?.productStats.filter(a => a.integration !== null) ?? []
  const totalApps         = data?.productStats.length ?? 0
  const alertCount        = data?.recentEvents.filter(e => ['critical','error'].includes(e.severity)).length ?? 0
  const memoryActive      = memory?.available === true && memory.totalEntries > 0
  // Setup score: 50 pts = healthy provider, 25 pts = enabled provider (not yet tested),
  // 30 pts = app with integration, 20 pts = any brain requests made, 10 pts = memory active
  const setupScore        = Math.round(
    ((healthyProviders.length > 0 ? 50 : enabledProviders.length > 0 ? 25 : 0) +
     (connectedApps.length > 0 ? 30 : 0) +
     ((data?.brainStats?.totalRequests ?? 0) > 0 ? 20 : 0) +
     (memoryActive ? 10 : 0))
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/4 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-white/4 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-white/4 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">AmarktAI Status</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* DB / config error banner */}
      {dbError && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Database unavailable — some data may not load</p>
            <p className="text-xs text-red-400/80 mt-0.5">{dbError}</p>
            <p className="text-xs text-slate-500 mt-1.5">
              Set a real <code className="text-slate-400 font-mono">DATABASE_URL</code> and ensure the database is reachable.
              Visit the <a href="/admin/dashboard/readiness" className="text-blue-400 hover:text-blue-300 underline" aria-label="Go to Go-Live Readiness diagnostic page">Go-Live Readiness</a> page for a full diagnostic.
            </p>
          </div>
        </div>
      )}

      {/* ROW 1 — Top-level status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="AmarktAI Status"
          value={(data?.brainStats?.totalRequests ?? 0) > 0 ? 'Active' : connectedApps.length > 0 ? 'Ready' : 'Standby'}
          sub={(data?.brainStats?.totalRequests ?? 0) > 0 ? `${data?.brainStats?.totalRequests} total requests` : 'No requests yet'}
          accent
        />
        <StatTile
          label="Setup Completeness"
          value={`${setupScore}%`}
          sub={healthyProviders.length > 0 ? `${healthyProviders.length} provider${healthyProviders.length > 1 ? 's' : ''} healthy` : 'No providers healthy yet'}
        />
        <StatTile
          label="Connected Apps"
          value={`${connectedApps.length} / ${totalApps}`}
          sub={connectedApps.length > 0 ? 'Integration active' : 'No app connections yet'}
        />
        <StatTile
          label="Active Alerts"
          value={alertCount}
          sub={alertCount > 0 ? 'Errors or criticals in events' : 'No recent alerts'}
        />
      </div>

      {/* ROW 2 — Execution + Connections + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Execution Layer Setup */}
        <Card title="Execution Layer" action={{ label: 'Configure', href: '/admin/dashboard/ai-providers' }}>
          {providers.length === 0 ? (
            <div className="text-center py-6">
              <WifiOff className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No providers configured</p>
              <Link href="/admin/dashboard/ai-providers" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
                Set up AI providers →
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {providers.map(p => {
                const cfg = H[p.healthStatus as keyof typeof H] ?? H.unconfigured
                const Icon = cfg.icon
                return (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-sm text-white truncate">{p.displayName}</span>
                      {!p.enabled && <span className="text-[10px] text-slate-600 font-mono ml-1">off</span>}
                    </div>
                    <span className={`flex items-center gap-1 text-xs flex-shrink-0 ml-2 ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* App Connections */}
        <Card title="App Connections" action={{ label: 'Manage', href: '/admin/dashboard/apps' }}>
          {totalApps === 0 ? (
            <div className="text-center py-6">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No apps registered</p>
              <Link href="/admin/dashboard/apps" className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300">
                Register an app →
              </Link>
            </div>
          ) : (
            <div className="space-y-0">
              {data?.productStats.map(app => {
                const health = app.integration?.healthStatus ?? 'no_integration'
                const dot =
                  health === 'healthy'  ? 'bg-emerald-400' :
                  health === 'degraded' ? 'bg-amber-400' :
                  health === 'error'    ? 'bg-red-400' :
                  health === 'no_integration' ? 'bg-slate-700' : 'bg-slate-500'
                return (
                  <div key={app.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="text-sm text-white truncate">{app.name}</span>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                      {app.integration
                        ? (app.integration.lastHeartbeatAt
                            ? formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })
                            : 'Connected')
                        : 'No integration'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Recent Activity (Brain stats) */}
        <Card title="Recent Activity" action={{ label: 'View Events', href: '/admin/dashboard/events' }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-xs text-slate-500">Total Requests</p>
                <p className="text-xl font-bold text-white mt-0.5">{data?.brainStats?.totalRequests ?? 0}</p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-xs text-slate-500">Success Rate</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {data?.brainStats && data.brainStats.totalRequests > 0
                    ? `${Math.round((data.brainStats.successCount / data.brainStats.totalRequests) * 100)}%`
                    : '—'}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-xs text-slate-500">Avg Latency</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {data?.brainStats?.avgLatencyMs ? `${data.brainStats.avgLatencyMs}ms` : '—'}
                </p>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <p className="text-xs text-slate-500">Errors</p>
                <p className={`text-xl font-bold mt-0.5 ${(data?.brainStats?.errorCount ?? 0) > 0 ? 'text-red-400' : 'text-white'}`}>
                  {data?.brainStats?.errorCount ?? 0}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ROW 3 — Events + Readiness + Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent Events */}
        <Card title="Recent Events" action={{ label: 'All Events', href: '/admin/dashboard/events' }} className="lg:col-span-2">
          {(data?.recentEvents.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 py-2 text-center">No events logged yet</p>
          ) : (
            <div className="space-y-0">
              {data?.recentEvents.slice(0, 6).map(ev => {
                const color = SEV[ev.severity as keyof typeof SEV] ?? 'text-slate-400'
                return (
                  <div key={ev.id} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                    <span className={`text-xs font-medium capitalize flex-shrink-0 pt-0.5 w-14 ${color}`}>
                      {ev.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{ev.title}</p>
                      <p className="text-xs text-slate-600">{ev.product?.name ?? '—'}</p>
                    </div>
                    <span className="text-xs text-slate-600 flex-shrink-0">
                      {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* System Readiness */}
        <Card title="System Readiness">
          <div className="space-y-3">
            {[
              { label: 'AI provider configured', ok: enabledProviders.length > 0 },
              { label: 'Provider health-checked', ok: healthyProviders.length > 0 },
              { label: 'App registered', ok: totalApps > 0 },
              { label: 'App integration active', ok: connectedApps.length > 0 },
              { label: 'Brain requests made', ok: (data?.brainStats?.totalRequests ?? 0) > 0 },
              { label: 'Memory layer active', ok: memoryActive },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{item.label}</span>
                {item.ok
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-slate-600 flex-shrink-0" />}
              </div>
            ))}

            {/* Memory status detail */}
            <div className="pt-2 mt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Memory status</span>
                {memory === null ? (
                  <span className="text-slate-600">Loading…</span>
                ) : memory.statusLabel === 'saving' ? (
                  <span className="text-emerald-400">Saving · {memory.totalEntries} entr{memory.totalEntries === 1 ? 'y' : 'ies'}</span>
                ) : memory.statusLabel === 'empty' ? (
                  <span className="text-amber-400">Table ready · no entries yet</span>
                ) : (
                  <span className="text-slate-500" title={memory.error ?? ''}>Migration required</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">Setup progress</span>
                <span className="text-xs text-white font-semibold">{setupScore}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${setupScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick nav row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Configure Providers', href: '/admin/dashboard/ai-providers', icon: Zap },
          { label: 'App Registry', href: '/admin/dashboard/apps', icon: Shield },
          { label: 'Events & Logs', href: '/admin/dashboard/events', icon: Activity },
          { label: 'Brain Chat', href: '/admin/dashboard/brain-chat', icon: Activity },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] border border-white/8 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] hover:border-white/15 transition-all group"
          >
            <item.icon className="w-3.5 h-3.5 flex-shrink-0 group-hover:text-blue-400" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
