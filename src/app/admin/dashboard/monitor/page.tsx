'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Activity, Cpu, MemoryStick, HardDrive, Wifi,
  CheckCircle, AlertCircle, XCircle, Clock, Server,
  Database, Zap, AlertTriangle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────────────────

interface AppHealth {
  id: number
  name: string
  slug: string
  status: string
  hostingScope: string
  integration: {
    healthStatus: string
    lastHeartbeatAt: string | null
    uptime: number | null
  } | null
  vpsSnapshots: VpsSnapshot[]
}

interface VpsSnapshot {
  cpuPercent: number
  ramPercent: number
  ramUsedMb: number
  ramTotalMb: number
  diskPercent: number
  diskUsedGb: number
  diskTotalGb: number
  netInKbps: number
  netOutKbps: number
  timestamp: string
}

interface TimeSeries {
  productId: number
  productName: string
  snapshots: VpsSnapshot[]
}

interface MonitorData {
  products: AppHealth[]
  timeSeries: TimeSeries[]
}

interface DbStats {
  artifactCount: number
  brainEventCount: number
  workspaceSessionCount: number
  alertCount: number
  aiUsage?: {
    totalRequestsThisMonth: number
    recentWorkspaceSessions: number
    byProvider: Record<string, number>
  }
  storage?: {
    driver: string
    configured: boolean
    basePath: string
    totalArtifacts: number
    totalStorageBytes: number
    totalStorageMb: number
  }
  providers?: {
    failures: Array<{ key: string; name: string; status: string }>
    failureCount: number
    allProviders: Array<{ key: string; name: string; status: string }>
  }
}

interface Recommendation {
  level: 'ok' | 'warning' | 'critical'
  message: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

function getHealthMeta(status: string) {
  switch (status) {
    case 'healthy':      return { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle, label: 'Healthy' }
    case 'degraded':     return { color: 'text-amber-400',   bg: 'bg-amber-400/10',   icon: AlertCircle, label: 'Degraded' }
    case 'error':        return { color: 'text-red-400',     bg: 'bg-red-400/10',     icon: XCircle,     label: 'Error' }
    case 'configured':   return { color: 'text-blue-400',    bg: 'bg-blue-400/10',    icon: Clock,       label: 'Configured' }
    case 'unconfigured': return { color: 'text-slate-500',   bg: 'bg-slate-500/10',   icon: Clock,       label: 'Not Set' }
    default:             return { color: 'text-slate-500',   bg: 'bg-slate-500/10',   icon: Clock,       label: 'Unknown' }
  }
}

function metricColor(pct: number): string {
  if (pct >= 90) return 'text-red-400'
  if (pct >= 75) return 'text-amber-400'
  return 'text-emerald-400'
}

function metricBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-400'
  if (pct >= 75) return 'bg-amber-400'
  return 'bg-emerald-400'
}

function MetricBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${metricBarColor(pct)}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function computeRecommendations(data: MonitorData): Recommendation[] {
  const recs: Recommendation[] = []
  for (const product of data.products) {
    const snap = product.vpsSnapshots?.[0]
    if (!snap) continue
    if (snap.cpuPercent > 85) {
      recs.push({ level: 'warning', message: `${product.name}: CPU at ${snap.cpuPercent.toFixed(0)}% — consider upgrading VPS soon` })
    }
    if (snap.ramPercent > 85) {
      recs.push({ level: 'warning', message: `${product.name}: RAM at ${snap.ramPercent.toFixed(0)}% — memory pressure detected` })
    }
    if (snap.diskPercent > 85) {
      recs.push({ level: 'critical', message: `${product.name}: Disk at ${snap.diskPercent.toFixed(0)}% — storage risk, clean up or expand` })
    }
    if (product.integration?.healthStatus === 'error') {
      recs.push({ level: 'critical', message: `${product.name}: App health error — investigate errors` })
    }
  }
  if (recs.length === 0) {
    recs.push({ level: 'ok', message: 'All monitored apps and resources look healthy.' })
  }
  return recs
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vpsRes, dbRes] = await Promise.allSettled([
        fetch('/api/admin/vps'),
        fetch('/api/admin/monitor/stats'),
      ])

      if (vpsRes.status === 'fulfilled' && vpsRes.value.ok) {
        setMonitorData(await vpsRes.value.json())
      } else if (vpsRes.status === 'fulfilled') {
        setError(`VPS endpoint error: HTTP ${vpsRes.value.status}`)
      }

      if (dbRes.status === 'fulfilled' && dbRes.value.ok) {
        setDbStats(await dbRes.value.json())
      }

      setLastRefreshed(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitor data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const recommendations = monitorData ? computeRecommendations(monitorData) : []
  const hasData = !!monitorData && monitorData.products.length > 0

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
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Monitor</h1>
              </div>
              <p className="text-sm text-slate-400">
                Real-time VPS metrics, app health, database stats, and scale recommendations.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-[11px] text-slate-500">
                  Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                </span>
              )}
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
        </div>
      </motion.div>

      {error && (
        <motion.div variants={fadeUp}>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Recommendations</h2>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                  rec.level === 'critical'
                    ? 'border-red-500/20 bg-red-500/5 text-red-300'
                    : rec.level === 'warning'
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-300'
                    : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                }`}
              >
                {rec.level === 'ok'
                  ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : rec.level === 'warning'
                  ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                {rec.message}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* DB Stats */}
      {dbStats && (
        <motion.div variants={fadeUp}>
          <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Platform Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Database} label="Artifacts" value={dbStats.artifactCount.toLocaleString()} />
            <StatCard icon={Zap} label="AI Requests (all)" value={dbStats.brainEventCount.toLocaleString()} />
            <StatCard icon={Activity} label="Workspace Sessions" value={dbStats.workspaceSessionCount.toLocaleString()} />
            <StatCard icon={AlertTriangle} label="Active Alerts" value={dbStats.alertCount.toLocaleString()} highlight={dbStats.alertCount > 0} />
          </div>
        </motion.div>
      )}

      {/* AI Usage (30 days) */}
      {dbStats?.aiUsage && (
        <motion.div variants={fadeUp}>
          <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">AI Usage — Last 30 Days</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">AI Requests</p>
                <p className="text-xl font-semibold text-cyan-300 mt-0.5">{dbStats.aiUsage.totalRequestsThisMonth.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Workspace Sessions</p>
                <p className="text-xl font-semibold text-white mt-0.5">{dbStats.aiUsage.recentWorkspaceSessions.toLocaleString()}</p>
              </div>
            </div>
            {Object.keys(dbStats.aiUsage.byProvider).length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 mb-2">By Provider</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dbStats.aiUsage.byProvider)
                    .sort((a, b) => b[1] - a[1])
                    .map(([provider, count]) => (
                      <span key={provider} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300">
                        {provider || 'unknown'} · {count.toLocaleString()}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Storage */}
      {dbStats?.storage && (
        <motion.div variants={fadeUp}>
          <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Storage</h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Driver</p>
                <p className="text-sm font-semibold text-white mt-0.5 capitalize">{dbStats.storage.driver.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Artifacts Stored</p>
                <p className="text-sm font-semibold text-white mt-0.5">{dbStats.storage.totalArtifacts.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Storage Used</p>
                <p className="text-sm font-semibold text-white mt-0.5">{dbStats.storage.totalStorageMb.toFixed(1)} MB</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-[0.1em]">Status</p>
                <p className={`text-sm font-semibold mt-0.5 ${dbStats.storage.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {dbStats.storage.configured ? 'Configured' : 'Not configured'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-3 truncate">{dbStats.storage.basePath}</p>
          </div>
        </motion.div>
      )}

      {/* Provider Failures */}
      {dbStats?.providers && dbStats.providers.failureCount > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Provider Failures</h2>
          <div className="space-y-2">
            {dbStats.providers.failures.map((p) => (
              <div key={p.key} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-300">{p.name || p.key}</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 capitalize">{p.status}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* VPS/App metrics */}
      {loading && !monitorData ? (
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2 py-12 text-slate-400 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading metrics…
          </div>
        </motion.div>
      ) : !hasData ? (
        <motion.div variants={fadeUp}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <Server className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-medium">No monitored apps</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Enable monitoring on apps to see VPS metrics and health data here.
            </p>
            <a
              href="/admin/dashboard/apps"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 text-sm transition-all"
            >
              Go to Apps
            </a>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">App Health</h2>
            <div className="space-y-4">
              {monitorData!.products.map(product => {
                const snap = product.vpsSnapshots?.[0]
                const health = getHealthMeta(product.integration?.healthStatus ?? 'unknown')
                const Icon = health.icon
                return (
                  <div key={product.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{product.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{product.slug} · {product.hostingScope}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${health.bg} ${health.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {health.label}
                      </span>
                    </div>

                    {product.integration?.lastHeartbeatAt && (
                      <p className="text-[11px] text-slate-500 mb-3">
                        Last heartbeat: {formatDistanceToNow(new Date(product.integration.lastHeartbeatAt), { addSuffix: true })}
                        {product.integration.uptime != null && ` · Uptime: ${product.integration.uptime.toFixed(1)}%`}
                      </p>
                    )}

                    {snap ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <VpsMetric
                          icon={Cpu}
                          label="CPU"
                          value={`${snap.cpuPercent.toFixed(1)}%`}
                          pct={snap.cpuPercent}
                        />
                        <VpsMetric
                          icon={MemoryStick}
                          label="RAM"
                          value={`${snap.ramPercent.toFixed(1)}%`}
                          sub={`${snap.ramUsedMb.toFixed(0)} / ${snap.ramTotalMb.toFixed(0)} MB`}
                          pct={snap.ramPercent}
                        />
                        <VpsMetric
                          icon={HardDrive}
                          label="Disk"
                          value={`${snap.diskPercent.toFixed(1)}%`}
                          sub={`${snap.diskUsedGb.toFixed(1)} / ${snap.diskTotalGb.toFixed(1)} GB`}
                          pct={snap.diskPercent}
                        />
                        <VpsMetric
                          icon={Wifi}
                          label="Network"
                          value={`↓${snap.netInKbps.toFixed(0)} ↑${snap.netOutKbps.toFixed(0)} kbps`}
                          pct={0}
                          noBar
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No VPS snapshot data yet.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Time series charts placeholder */}
          {monitorData!.timeSeries.some(ts => ts.snapshots.length > 0) && (
            <motion.div variants={fadeUp}>
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-3">Historical CPU (last 48 snapshots)</h2>
              <div className="space-y-4">
                {monitorData!.timeSeries
                  .filter(ts => ts.snapshots.length > 0)
                  .map(ts => (
                    <div key={ts.productId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-xs text-slate-400 mb-3">{ts.productName}</p>
                      <MiniChart data={ts.snapshots.map(s => s.cpuPercent)} color="#22d3ee" label="CPU %" />
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, highlight,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      </div>
      <p className={`text-lg font-semibold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function VpsMetric({
  icon: Icon, label, value, sub, pct, noBar,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  value: string
  sub?: string
  pct: number
  noBar?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${noBar ? 'text-slate-300' : metricColor(pct)}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      {!noBar && <MetricBar pct={pct} />}
    </div>
  )
}

function MiniChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const h = 40

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-600">{label}</span>
        <span className="text-[10px] text-slate-500">max {max.toFixed(0)}%</span>
      </div>
      <svg viewBox={`0 0 100 ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
