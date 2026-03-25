'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle, AlertCircle, Clock, ChevronRight,
  BrainCircuit, Plug, Activity, RefreshCw, Loader2,
  Shield, Zap, LayoutGrid, WifiOff, AlertTriangle,
  ArrowRight, Info, Radio,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────
interface AiProvider {
  id: number
  providerKey: string
  displayName: string
  enabled: boolean
  maskedPreview: string
  healthStatus: string
  healthMessage: string
  lastCheckedAt: string | null
  defaultModel: string
}

interface AppStat {
  id: number
  name: string
  status: string
  integration: { healthStatus: string; lastHeartbeatAt: string | null } | null
}

interface BrainStats {
  totalRequests: number
  successCount: number
  errorCount: number
  avgLatencyMs: number | null
}

interface RecentEvent {
  id: number
  eventType: string
  severity: string
  title: string
  timestamp: string
  product: { name: string }
}

interface ControlPlaneData {
  providers: AiProvider[]
  apps: AppStat[]
  brainStats: BrainStats | null
  recentEvents: RecentEvent[]
  loadedAt: string
}

// ── Health Status Config ──────────────────────────────────────────
const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: typeof CheckCircle }> = {
  healthy:      { label: 'Healthy',       color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400',  icon: CheckCircle },
  configured:   { label: 'Key Set',       color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400',    icon: Clock },
  degraded:     { label: 'Degraded',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400',    icon: AlertTriangle },
  error:        { label: 'Error',         color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       dot: 'bg-red-400',      icon: AlertCircle },
  unconfigured: { label: 'No Key',        color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/30',   dot: 'bg-slate-500',    icon: WifiOff },
  disabled:     { label: 'Disabled',      color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/30',   dot: 'bg-slate-500',    icon: WifiOff },
}

const APP_HEALTH_CONFIG: Record<string, { color: string; dot: string }> = {
  healthy:   { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  degraded:  { color: 'text-amber-400',   dot: 'bg-amber-400' },
  error:     { color: 'text-red-400',     dot: 'bg-red-400' },
  unknown:   { color: 'text-slate-500',   dot: 'bg-slate-500' },
  offline:   { color: 'text-slate-500',   dot: 'bg-slate-500' },
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: typeof Info }> = {
  info:     { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: Info },
  warning:  { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle },
  error:    { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',     icon: AlertCircle },
  critical: { color: 'text-red-500',    bg: 'bg-red-500/15 border-red-500/30',     icon: AlertCircle },
}

// ── Go-Live Verdict ───────────────────────────────────────────────
type Verdict = 'READY' | 'PARTIAL' | 'NOT_READY'

function computeVerdict(data: ControlPlaneData): { verdict: Verdict; blockers: string[] } {
  const blockers: string[] = []

  // Check providers
  const enabledProviders = data.providers.filter(p => p.enabled)
  const healthyProviders = data.providers.filter(p => p.healthStatus === 'healthy')

  if (enabledProviders.length === 0) {
    blockers.push('No AI providers enabled — brain requests cannot execute')
  } else if (healthyProviders.length === 0) {
    blockers.push('No AI providers have been health-checked as healthy — test connections in AI Providers')
  }

  // Check apps
  const connectedApps = data.apps.filter(a => a.integration !== null)
  if (data.apps.length === 0) {
    blockers.push('No apps in registry — create apps to enable brain connections')
  } else if (connectedApps.length === 0) {
    blockers.push('No apps have integration credentials — enable integrations in App Registry')
  }

  // Check routing
  const requiredProviders = ['openai', 'gemini', 'grok']
  const configuredRequired = data.providers.filter(
    p => requiredProviders.includes(p.providerKey) && p.maskedPreview && p.enabled
  )
  if (configuredRequired.length === 0 && enabledProviders.length === 0) {
    blockers.push('No tier-1 providers configured (OpenAI, Gemini, or Grok)')
  }

  if (blockers.length === 0) return { verdict: 'READY', blockers: [] }
  if (blockers.length <= 2 && enabledProviders.length > 0) return { verdict: 'PARTIAL', blockers }
  return { verdict: 'NOT_READY', blockers }
}

// ── Card ──────────────────────────────────────────────────────────
function SectionCard({ title, children, action }: {
  title: string
  children: React.ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            {action.label} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Provider Row ──────────────────────────────────────────────────
function ProviderRow({ provider }: { provider: AiProvider }) {
  const cfg = HEALTH_CONFIG[provider.healthStatus] ?? HEALTH_CONFIG.unconfigured
  const Icon = cfg.icon
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{provider.displayName}</p>
          {provider.defaultModel && (
            <p className="text-[11px] text-slate-600 font-mono">{provider.defaultModel}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        {!provider.enabled && (
          <span className="text-[10px] text-slate-600 font-mono">disabled</span>
        )}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>
        {provider.maskedPreview && (
          <span className="text-[10px] text-slate-600 font-mono hidden sm:block">{provider.maskedPreview}</span>
        )}
      </div>
    </div>
  )
}

// ── App Row ───────────────────────────────────────────────────────
function AppRow({ app }: { app: AppStat }) {
  const health = app.integration?.healthStatus ?? 'unknown'
  const cfg = APP_HEALTH_CONFIG[health] ?? APP_HEALTH_CONFIG.unknown
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <div className="min-w-0">
          <p className="text-sm text-white truncate">{app.name}</p>
          {app.integration?.lastHeartbeatAt && (
            <p className="text-[11px] text-slate-600">
              Last seen {formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">
        {app.integration ? (
          <span className={`text-[11px] font-medium ${cfg.color}`}>{health}</span>
        ) : (
          <span className="text-[11px] text-slate-600 font-mono">no integration</span>
        )}
      </div>
    </div>
  )
}

// ── Event Row ─────────────────────────────────────────────────────
function EventRow({ event }: { event: RecentEvent }) {
  const cfg = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info
  const Icon = cfg.icon
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border ${cfg.bg}`}>
        <Icon className={`w-3 h-3 ${cfg.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">{event.title}</p>
        <p className="text-[11px] text-slate-500">
          {event.product.name} · {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ControlPlanePage() {
  const [data, setData] = useState<ControlPlaneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [providersRes, dashboardRes] = await Promise.all([
        fetch('/api/admin/providers'),
        fetch('/api/admin/dashboard'),
      ])
      if (!providersRes.ok || !dashboardRes.ok) throw new Error('Failed to load data')
      const [providers, dashboard] = await Promise.all([
        providersRes.json(),
        dashboardRes.json(),
      ])
      setData({
        providers: Array.isArray(providers) ? providers : [],
        apps: Array.isArray(dashboard.productStats) ? dashboard.productStats : [],
        brainStats: dashboard.brainStats ?? null,
        recentEvents: Array.isArray(dashboard.recentEvents) ? dashboard.recentEvents.slice(0, 6) : [],
        loadedAt: new Date().toISOString(),
      })
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load control plane data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading control plane…</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-400">{error ?? 'No data'}</p>
          <button
            onClick={() => load()}
            className="px-4 py-2 text-sm text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/8 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { verdict, blockers } = computeVerdict(data)
  const healthyProviders = data.providers.filter(p => p.healthStatus === 'healthy')
  const enabledProviders = data.providers.filter(p => p.enabled)
  const connectedApps = data.apps.filter(a => a.integration !== null)
  const healthyApps = data.apps.filter(a => a.integration?.healthStatus === 'healthy')
  const successRate = data.brainStats && data.brainStats.totalRequests > 0
    ? Math.round((data.brainStats.successCount / data.brainStats.totalRequests) * 100)
    : null

  const verdictConfig = {
    READY:     { label: 'READY FOR CONTROLLED GO-LIVE', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
    PARTIAL:   { label: 'PARTIALLY READY',               color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   icon: AlertTriangle },
    NOT_READY: { label: 'NOT READY',                     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       icon: AlertCircle },
  }
  const vc = verdictConfig[verdict]
  const VerdictIcon = vc.icon

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-bold text-white font-heading">Execution Control Plane</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live readiness status for the <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span> intelligence layer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[11px] text-slate-600 font-mono hidden sm:block">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 border border-white/10 rounded-lg hover:border-white/20 hover:text-white bg-white/3 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Go-Live Verdict */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-2xl border p-5 ${vc.bg}`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${vc.bg}`}>
            <VerdictIcon className={`w-5 h-5 ${vc.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <p className={`text-sm font-bold font-mono tracking-wider ${vc.color}`}>
                {vc.label}
              </p>
              <span className="text-[10px] text-slate-500 font-mono uppercase">Go-Live Audit</span>
            </div>
            {blockers.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {blockers.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 mt-1.5">
                All critical systems are configured. Monitor providers and heartbeats before full public launch.
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Metrics Row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          {
            label: 'Healthy Providers',
            value: `${healthyProviders.length} / ${data.providers.length}`,
            icon: BrainCircuit,
            color: healthyProviders.length > 0 ? 'text-emerald-400' : 'text-red-400',
            href: '/admin/dashboard/ai-providers',
          },
          {
            label: 'Connected Apps',
            value: `${connectedApps.length} / ${data.apps.length}`,
            icon: Plug,
            color: connectedApps.length > 0 ? 'text-cyan-400' : 'text-amber-400',
            href: '/admin/dashboard/apps',
          },
          {
            label: 'Brain Requests',
            value: data.brainStats?.totalRequests?.toLocaleString() ?? '0',
            icon: Zap,
            color: 'text-violet-400',
            href: '/admin/dashboard/events',
          },
          {
            label: 'Success Rate',
            value: successRate !== null ? `${successRate}%` : '—',
            icon: Activity,
            color: successRate !== null && successRate >= 90 ? 'text-emerald-400' : successRate !== null ? 'text-amber-400' : 'text-slate-500',
            href: '/admin/dashboard/events',
          },
        ].map((m, i) => (
          <Link
            key={i}
            href={m.href}
            className="glass rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <m.icon className={`w-4 h-4 ${m.color}`} />
              <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{m.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Providers */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <SectionCard
            title={`AI Providers (${data.providers.length})`}
            action={{ label: 'Configure', href: '/admin/dashboard/ai-providers' }}
          >
            {data.providers.length === 0 ? (
              <div className="text-center py-6">
                <BrainCircuit className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No providers configured</p>
                <Link
                  href="/admin/dashboard/ai-providers"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                >
                  Add providers <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div>
                {data.providers.map(p => <ProviderRow key={p.id} provider={p} />)}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{enabledProviders.length} enabled · {healthyProviders.length} healthy</span>
                  <Link href="/admin/dashboard/ai-providers" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Run health checks <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* App Registry */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SectionCard
            title={`App Registry (${data.apps.length})`}
            action={{ label: 'Manage Apps', href: '/admin/dashboard/apps' }}
          >
            {data.apps.length === 0 ? (
              <div className="text-center py-6">
                <LayoutGrid className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No apps registered</p>
                <Link
                  href="/admin/dashboard/apps"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                >
                  Register an app <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div>
                {data.apps.slice(0, 6).map(a => <AppRow key={a.id} app={a} />)}
                {data.apps.length > 6 && (
                  <p className="text-[11px] text-slate-600 mt-2">
                    +{data.apps.length - 6} more apps
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-600">
                  <span>{connectedApps.length} with integration · {healthyApps.length} healthy</span>
                </div>
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Brain Gateway */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <SectionCard
            title="Brain Gateway"
            action={{ label: 'View Traces', href: '/admin/dashboard/events' }}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">POST /api/brain/request</p>
                  <p className="text-[11px] text-slate-500">App-facing gateway · auth via appId + appSecret</p>
                </div>
                <span className="ml-auto text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">LIVE</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Radio className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">POST /api/integrations/heartbeat</p>
                  <p className="text-[11px] text-slate-500">App health beacon · stores lastSeen + status</p>
                </div>
                <span className="ml-auto text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">LIVE</span>
              </div>
              {data.brainStats && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="p-2.5 rounded-lg bg-white/3 border border-white/5 text-center">
                    <p className="text-base font-bold text-white">{data.brainStats.totalRequests}</p>
                    <p className="text-[10px] text-slate-500">Total Req</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/3 border border-white/5 text-center">
                    <p className="text-base font-bold text-emerald-400">{data.brainStats.successCount}</p>
                    <p className="text-[10px] text-slate-500">Succeeded</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/3 border border-white/5 text-center">
                    <p className="text-base font-bold text-white">
                      {data.brainStats.avgLatencyMs != null ? `${data.brainStats.avgLatencyMs}ms` : '—'}
                    </p>
                    <p className="text-[10px] text-slate-500">Avg Latency</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </motion.div>

        {/* Recent Events */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <SectionCard
            title="Recent Events"
            action={{ label: 'All Events', href: '/admin/dashboard/events' }}
          >
            {data.recentEvents.length === 0 ? (
              <div className="text-center py-6">
                <Activity className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No events logged yet</p>
              </div>
            ) : (
              <div>
                {data.recentEvents.map(e => <EventRow key={e.id} event={e} />)}
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* Routing Readiness */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <SectionCard title="Routing & Architecture">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                label: 'App Registry',
                status: data.apps.length > 0 ? 'ready' : 'missing',
                detail: data.apps.length > 0 ? `${data.apps.length} apps registered` : 'No apps — create via App Registry',
                href: '/admin/dashboard/apps',
              },
              {
                label: 'Provider Config',
                status: enabledProviders.length > 0 ? (healthyProviders.length > 0 ? 'ready' : 'partial') : 'missing',
                detail: enabledProviders.length > 0
                  ? `${enabledProviders.length} enabled · ${healthyProviders.length} healthy`
                  : 'No providers enabled',
                href: '/admin/dashboard/ai-providers',
              },
              {
                label: 'Brain Gateway',
                status: 'ready',
                detail: 'POST /api/brain/request active',
                href: '/admin/dashboard/events',
              },
              {
                label: 'App Credentials',
                status: connectedApps.length > 0 ? 'ready' : 'missing',
                detail: connectedApps.length > 0 ? `${connectedApps.length} apps with integration tokens` : 'No apps connected — enable integrations',
                href: '/admin/dashboard/apps',
              },
              {
                label: 'Heartbeat Endpoint',
                status: 'ready',
                detail: 'POST /api/integrations/heartbeat active',
                href: '/admin/dashboard/integrations',
              },
              {
                label: 'Orchestration Engine',
                status: 'ready',
                detail: 'Multi-model routing via orchestrator.ts',
                href: '/admin/dashboard/brain-chat',
              },
            ].map((item, i) => {
              const statusColors = {
                ready:   { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Ready' },
                partial: { dot: 'bg-amber-400',   text: 'text-amber-400',   label: 'Partial' },
                missing: { dot: 'bg-red-400',      text: 'text-red-400',     label: 'Missing' },
              }
              const sc = statusColors[item.status as keyof typeof statusColors]
              return (
                <Link
                  key={i}
                  href={item.href}
                  className="p-4 rounded-xl border border-white/5 bg-white/3 hover:border-white/10 hover:bg-white/5 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                      <span className="text-sm font-medium text-white">{item.label}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${sc.text}`}>{sc.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.detail}</p>
                </Link>
              )
            })}
          </div>
        </SectionCard>
      </motion.div>

      {/* Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl border border-white/5 p-5"
      >
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">Connection Reference</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apps connect via: <code className="text-slate-400 font-mono text-[11px]">POST /api/brain/request</code> with{' '}
              <code className="text-slate-400 font-mono text-[11px]">appId</code> + <code className="text-slate-400 font-mono text-[11px]">appSecret</code> from the App Registry.
              Heartbeats via: <code className="text-slate-400 font-mono text-[11px]">POST /api/integrations/heartbeat</code>.
              Provider keys managed in{' '}
              <Link href="/admin/dashboard/ai-providers" className="text-violet-400 hover:text-violet-300">AI Providers</Link>.
              Apps managed in{' '}
              <Link href="/admin/dashboard/apps" className="text-cyan-400 hover:text-cyan-300">App Registry</Link>.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
