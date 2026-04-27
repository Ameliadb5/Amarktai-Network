'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  Zap,
  GitBranch,
  AppWindow,
  AlertTriangle,
  Clock,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VpsSnapshot {
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  ramUsedMb: number
  ramTotalMb: number
  diskUsedGb: number
  diskTotalGb: number
  timestamp?: string
}

interface AppHealth {
  id: number
  name: string
  slug: string
  status: string
  integration: {
    healthStatus: string
    lastHeartbeatAt: string | null
  } | null
  vpsSnapshots: VpsSnapshot[]
}

interface MonitorData {
  products: AppHealth[]
}

interface AIEngineStatus {
  configured: boolean
  available: boolean
  apiUrl: string | null
  modelCount: number
  error?: string | null
}

interface DashboardData {
  metrics?: { totalProducts?: number }
  brainStats?: {
    totalRequests?: number
    successCount?: number
    avgLatencyMs?: number | null
    activeTaskCount?: number
  }
}

interface DbStats {
  alertCount: number
  brainEventCount: number
  artifactCount: number
}

interface Alert {
  level: 'warning' | 'critical' | 'ok'
  message: string
}

function computeAlerts(monitor: MonitorData | null, dbStats: DbStats | null): Alert[] {
  const alerts: Alert[] = []
  if (monitor) {
    for (const app of monitor.products) {
      const snap = app.vpsSnapshots?.[0]
      if (snap) {
        if (snap.cpuPercent > 85) alerts.push({ level: 'warning', message: `${app.name}: CPU at ${snap.cpuPercent.toFixed(0)}%` })
        if (snap.ramPercent > 85) alerts.push({ level: 'warning', message: `${app.name}: RAM at ${snap.ramPercent.toFixed(0)}%` })
        if (snap.diskPercent > 90) alerts.push({ level: 'critical', message: `${app.name}: Disk at ${snap.diskPercent.toFixed(0)}% — storage risk` })
      }
      if (app.integration?.healthStatus === 'error') {
        alerts.push({ level: 'critical', message: `${app.name}: app health error` })
      }
    }
  }
  if (dbStats && dbStats.alertCount > 0) {
    alerts.push({ level: 'warning', message: `${dbStats.alertCount} active platform alert${dbStats.alertCount !== 1 ? 's' : ''}` })
  }
  return alerts
}

function metricColor(pct: number) {
  if (pct >= 90) return 'text-red-400'
  if (pct >= 75) return 'text-amber-400'
  return 'text-emerald-400'
}

function metricBarColor(pct: number) {
  if (pct >= 90) return 'bg-red-400'
  if (pct >= 75) return 'bg-amber-400'
  return 'bg-emerald-400'
}

function MetricBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full ${metricBarColor(pct)}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [monitor, setMonitor] = useState<MonitorData | null>(null)
  const [aiEngine, setAiEngine] = useState<AIEngineStatus | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [monRes, aiRes, dashRes, dbRes] = await Promise.allSettled([
        fetch('/api/admin/vps'),
        fetch('/api/admin/genx/status'),
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/monitor/stats'),
      ])
      if (monRes.status === 'fulfilled' && monRes.value.ok) setMonitor(await monRes.value.json())
      if (aiRes.status === 'fulfilled' && aiRes.value.ok) setAiEngine(await aiRes.value.json())
      if (dashRes.status === 'fulfilled' && dashRes.value.ok) setDashboard(await dashRes.value.json())
      if (dbRes.status === 'fulfilled' && dbRes.value.ok) setDbStats(await dbRes.value.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const alerts = computeAlerts(monitor, dbStats)
  const topSnap = monitor?.products?.[0]?.vpsSnapshots?.[0] ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060d1b] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="mt-1 text-sm text-slate-400">Amarktai Network — system status, AI engine health, and connected apps.</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-3">Alerts</h2>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                a.level === 'critical' ? 'border-red-500/20 bg-red-500/5 text-red-300'
                  : 'border-amber-500/20 bg-amber-500/5 text-amber-300'
              }`}>
                {a.level === 'critical'
                  ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                {a.message}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VPS Status */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-3">VPS Status</h2>
        {topSnap ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <VpsCard icon={Cpu} label="CPU" value={`${topSnap.cpuPercent.toFixed(1)}%`} pct={topSnap.cpuPercent} />
            <VpsCard icon={MemoryStick} label="RAM" value={`${topSnap.ramPercent.toFixed(1)}%`} sub={`${topSnap.ramUsedMb.toFixed(0)} / ${topSnap.ramTotalMb.toFixed(0)} MB`} pct={topSnap.ramPercent} />
            <VpsCard icon={HardDrive} label="Disk" value={`${topSnap.diskPercent.toFixed(1)}%`} sub={`${topSnap.diskUsedGb.toFixed(1)} / ${topSnap.diskTotalGb.toFixed(1)} GB`} pct={topSnap.diskPercent} />
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[11px] text-slate-500">AI Requests</p>
              </div>
              <p className="text-sm font-semibold text-white">{(dbStats?.brainEventCount ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-slate-600">total processed</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Server className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No VPS data available.</p>
            <p className="text-slate-600 text-xs mt-1">Enable monitoring on apps to see VPS metrics.</p>
          </div>
        )}
      </section>

      {/* AmarktAI Status */}
      <section>
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-3">AmarktAI Status</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* AI Engine */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-cyan-400" />
              <p className="text-sm font-semibold text-white">AI Engine</p>
            </div>
            <div className="flex items-center gap-2">
              {aiEngine?.available
                ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                : <AlertCircle className="h-4 w-4 text-amber-400" />}
              <span className="text-sm text-slate-200">
                {aiEngine?.available ? 'Connected' : aiEngine?.configured ? 'Configured — unreachable' : 'Not configured'}
              </span>
            </div>
            {aiEngine?.modelCount != null && aiEngine.modelCount > 0 && (
              <p className="mt-2 text-xs text-slate-500">{aiEngine.modelCount} models available</p>
            )}
            {aiEngine?.error && (
              <p className="mt-2 text-xs text-red-400">{aiEngine.error}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
              <span>Requests: {dashboard?.brainStats?.totalRequests?.toLocaleString() ?? '—'}</span>
              <span>Artifacts: {dbStats?.artifactCount?.toLocaleString() ?? '—'}</span>
            </div>
          </div>

          {/* GitHub / Deploy */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-slate-300" />
              <p className="text-sm font-semibold text-white">Platform Stats</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Connected Apps" value={dashboard?.metrics?.totalProducts ?? 0} />
              <Stat label="Active Alerts" value={dbStats?.alertCount ?? 0} warn={(dbStats?.alertCount ?? 0) > 0} />
              <Stat label="Success Rate" value={(() => {
                const s = dashboard?.brainStats?.successCount ?? 0
                const t = dashboard?.brainStats?.totalRequests ?? 0
                return t > 0 ? `${Math.round((s / t) * 100)}%` : '—'
              })()} />
              <Stat label="Avg Latency" value={dashboard?.brainStats?.avgLatencyMs ? `${Math.round(dashboard.brainStats.avgLatencyMs)}ms` : '—'} />
            </div>
          </div>
        </div>
      </section>

      {/* Connected Apps */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Connected Apps</h2>
          <Link href="/admin/dashboard/apps" className="text-xs text-cyan-400 hover:text-cyan-300">View all →</Link>
        </div>
        {monitor?.products && monitor.products.length > 0 ? (
          <div className="space-y-3">
            {monitor.products.map(app => {
              const health = app.integration?.healthStatus ?? 'unknown'
              const snap = app.vpsSnapshots?.[0]
              return (
                <div key={app.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <AppWindow className="h-4 w-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{app.name}</p>
                      <p className="text-[10px] text-slate-600">{app.slug}</p>
                    </div>
                  </div>
                  <HealthBadge status={health} />
                  {snap && (
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span className={metricColor(snap.cpuPercent)}>CPU {snap.cpuPercent.toFixed(0)}%</span>
                      <span className={metricColor(snap.ramPercent)}>RAM {snap.ramPercent.toFixed(0)}%</span>
                      <span className={metricColor(snap.diskPercent)}>Disk {snap.diskPercent.toFixed(0)}%</span>
                    </div>
                  )}
                  {app.integration?.lastHeartbeatAt && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-600 ml-auto">
                      <Clock className="h-3 w-3" />
                      <span>Last ping: {new Date(app.integration.lastHeartbeatAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <AppWindow className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No apps monitored yet.</p>
            <Link href="/admin/dashboard/apps" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
              Go to Apps →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VpsCard({
  icon: Icon, label, value, sub, pct,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  sub?: string
  pct: number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${metricColor(pct)}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      <MetricBar pct={pct} />
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-600">{label}</p>
      <p className={`text-sm font-semibold ${warn ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function HealthBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; Icon: typeof CheckCircle; label: string }> = {
    healthy:      { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', Icon: CheckCircle, label: 'Healthy' },
    degraded:     { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',       Icon: AlertCircle, label: 'Degraded' },
    error:        { color: 'text-red-400 bg-red-400/10 border-red-400/20',             Icon: XCircle,     label: 'Error' },
    configured:   { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',          Icon: Clock,       label: 'Configured' },
    unconfigured: { color: 'text-slate-500 bg-slate-500/10 border-slate-500/20',       Icon: Clock,       label: 'Not Set' },
  }
  const c = cfg[status] ?? { color: 'text-slate-500 bg-slate-500/10 border-slate-500/20', Icon: Clock, label: 'Unknown' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${c.color}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}

