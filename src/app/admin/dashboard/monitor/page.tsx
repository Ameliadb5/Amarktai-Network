'use client'

/**
 * Monitor Page — Phase 3F
 *
 * Shows real server/app/AI metrics:
 *   - Webdock server CPU/RAM/disk (if configured)
 *   - App health and heartbeat status
 *   - AI Brain request volume + success rate
 *   - Artifact storage usage
 *   - DB health
 *   - Recent deploy logs
 *   - System recommendation
 */

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Server, CheckCircle, AlertCircle, XCircle, Clock,
  WifiOff, Activity, Database, Archive, Rocket, Cpu, HardDrive,
  Zap, TrendingUp, AlertTriangle, Info,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppHealth {
  slug: string
  name: string
  status: string
  health: string
  uptime: number | null
  lastHeartbeatAt: string | null
  stale: boolean
}

interface BrainStats {
  requests7d: number
  successRate7d: number | null
  errorCount7d: number
}

interface WebdockServerInfo {
  slug: string | null
  configured: boolean
  cpuPercent: number | null
  ramPercent: number | null
  diskPercent: number | null
  metricsAvailable: boolean
  error: string | null
  message?: string
}

interface RecentDeploy {
  id: string
  appSlug: string
  status: string
  deployMethod: string
  branch: string
  startedAt: string
  completedAt: string | null
  durationMs: number | null
}

interface MonitorData {
  timestamp: string
  webdockServer: WebdockServerInfo
  apps: AppHealth[]
  brain: BrainStats
  artifacts: { total: number; byType: Record<string, number> }
  db: { healthy: boolean }
  recentDeploys: RecentDeploy[]
  recommendation: string
  recommendationText: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  healthy:  { icon: CheckCircle, color: 'text-emerald-400', label: 'Healthy' },
  degraded: { icon: AlertCircle, color: 'text-amber-400',   label: 'Degraded' },
  error:    { icon: XCircle,     color: 'text-red-400',     label: 'Error' },
  unknown:  { icon: WifiOff,     color: 'text-slate-500',   label: 'Unknown' },
  offline:  { icon: WifiOff,     color: 'text-slate-500',   label: 'Offline' },
}

const RECO_CONFIG: Record<string, { icon: typeof Info; color: string }> = {
  ok:                 { icon: CheckCircle,  color: 'text-emerald-400' },
  upgrade_vps:        { icon: AlertTriangle, color: 'text-amber-400' },
  investigate_errors: { icon: AlertCircle,  color: 'text-red-400' },
  storage_risk:       { icon: HardDrive,    color: 'text-amber-400' },
  move_app:           { icon: TrendingUp,   color: 'text-blue-400' },
}

const DEPLOY_STATUS: Record<string, { label: string; color: string }> = {
  success: { label: 'Success', color: 'text-emerald-400' },
  failed:  { label: 'Failed',  color: 'text-red-400' },
  running: { label: 'Running', color: 'text-amber-400' },
  planned: { label: 'Planned', color: 'text-slate-400' },
  pending: { label: 'Pending', color: 'text-slate-400' },
}

function GaugeBar({ value, label, color }: { value: number | null; label: string; color: string }) {
  const pct = value ?? 0
  const barColor =
    pct > 85 ? 'bg-red-400' :
    pct > 70 ? 'bg-amber-400' :
    'bg-emerald-400'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className={`text-[11px] font-medium ${color}`}>
          {value === null ? '—' : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: value === null ? '0%' : `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/monitor')
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? 'Failed to load metrics')
        return
      }
      setData(await res.json() as MonitorData)
      setLastRefreshed(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const recoConfig = data ? (RECO_CONFIG[data.recommendation] ?? RECO_CONFIG.ok) : null
  const RecoIcon = recoConfig?.icon ?? Info

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1226] to-[#050a17] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-5 w-5 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Monitor</h1>
              </div>
              <p className="text-sm text-slate-400">
                Real-time server, app, AI, and storage metrics.
                {lastRefreshed && (
                  <span className="ml-2 text-slate-500">
                    Last refreshed {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                  </span>
                )}
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

      {error && (
        <motion.div variants={fadeUp}>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            <AlertCircle className="inline h-4 w-4 mr-1.5" />
            {error}
          </div>
        </motion.div>
      )}

      {data && (
        <>
          {/* Recommendation banner */}
          <motion.div variants={fadeUp}>
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              data.recommendation === 'ok'
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              <RecoIcon className={`h-5 w-5 shrink-0 ${recoConfig?.color}`} />
              <div>
                <p className="text-sm font-medium text-white">{data.recommendationText}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 capitalize">System recommendation: {data.recommendation.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </motion.div>

          {/* Top metrics row */}
          <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Database}
              label="Database"
              value={data.db.healthy ? 'Healthy' : 'Unreachable'}
              color={data.db.healthy ? 'text-emerald-400' : 'text-red-400'}
            />
            <MetricCard
              icon={Zap}
              label="AI Requests (7d)"
              value={data.brain.requests7d.toLocaleString()}
              sub={data.brain.successRate7d !== null ? `${data.brain.successRate7d}% success` : undefined}
            />
            <MetricCard
              icon={Archive}
              label="Artifacts"
              value={data.artifacts.total.toLocaleString()}
              sub={Object.entries(data.artifacts.byType).map(([t, c]) => `${t}: ${c}`).join(' · ').slice(0, 50) || undefined}
            />
            <MetricCard
              icon={Cpu}
              label="Apps Monitored"
              value={data.apps.length.toString()}
              sub={data.apps.filter(a => a.health === 'error').length > 0
                ? `${data.apps.filter(a => a.health === 'error').length} error(s)`
                : 'All checked'}
              color={data.apps.filter(a => a.health === 'error').length > 0 ? 'text-red-300' : 'text-white'}
            />
          </motion.div>

          {/* Webdock server panel */}
          <motion.div variants={fadeUp}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Server className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">VPS / Webdock Server</h2>
                {data.webdockServer.slug && (
                  <span className="text-[11px] text-slate-500 font-mono">·{data.webdockServer.slug}</span>
                )}
              </div>

              {!data.webdockServer.slug ? (
                <p className="text-sm text-slate-400">
                  {data.webdockServer.message ?? 'No Webdock server configured.'}
                  {' '}
                  <a href="/admin/dashboard/settings" className="text-cyan-400 hover:underline">Configure in Settings</a>.
                </p>
              ) : !data.webdockServer.configured ? (
                <p className="text-sm text-amber-400">
                  Webdock token not configured. <a href="/admin/dashboard/settings" className="underline">Add token in Settings</a>.
                </p>
              ) : !data.webdockServer.metricsAvailable ? (
                <div>
                  <p className="text-sm text-slate-400 mb-3">
                    Metrics unavailable: {data.webdockServer.error ?? 'Unknown error'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <GaugeBar value={null} label="CPU" color="text-slate-500" />
                    <GaugeBar value={null} label="RAM" color="text-slate-500" />
                    <GaugeBar value={null} label="Disk" color="text-slate-500" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <GaugeBar
                    value={data.webdockServer.cpuPercent}
                    label="CPU"
                    color={(data.webdockServer.cpuPercent ?? 0) > 80 ? 'text-red-300' : 'text-slate-200'}
                  />
                  <GaugeBar
                    value={data.webdockServer.ramPercent}
                    label="RAM"
                    color={(data.webdockServer.ramPercent ?? 0) > 80 ? 'text-red-300' : 'text-slate-200'}
                  />
                  <GaugeBar
                    value={data.webdockServer.diskPercent}
                    label="Disk"
                    color={(data.webdockServer.diskPercent ?? 0) > 80 ? 'text-red-300' : 'text-slate-200'}
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* Apps health */}
          <motion.div variants={fadeUp}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-white mb-4">App Health</h2>
              {data.apps.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No monitored apps. Enable monitoring for apps in Apps &amp; Agents.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.apps.map(app => {
                    const hc = HEALTH_CONFIG[app.health] ?? HEALTH_CONFIG.unknown
                    const Icon = hc.icon
                    return (
                      <div key={app.slug} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <Icon className={`h-4 w-4 shrink-0 ${hc.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{app.name}</p>
                          <p className="text-[11px] text-slate-500">{app.slug}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-medium ${hc.color}`}>{hc.label}</p>
                          {app.lastHeartbeatAt && (
                            <p className="text-[11px] text-slate-500">
                              {formatDistanceToNow(new Date(app.lastHeartbeatAt), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        {app.stale && (
                          <span className="ml-1 text-[10px] text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">stale</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent deploys */}
          {data.recentDeploys.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Rocket className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Recent Deploys</h2>
                </div>
                <div className="space-y-2">
                  {data.recentDeploys.map(d => {
                    const ds = DEPLOY_STATUS[d.status] ?? { label: d.status, color: 'text-slate-400' }
                    return (
                      <div key={d.id} className="flex items-center gap-3 text-sm">
                        <span className={`font-medium ${ds.color} w-16 shrink-0`}>{ds.label}</span>
                        <span className="text-white truncate flex-1">{d.appSlug}</span>
                        <span className="text-slate-500 text-xs">{d.branch}</span>
                        <span className="text-slate-500 text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(d.startedAt), { addSuffix: true })}
                        </span>
                        {d.durationMs && (
                          <span className="text-slate-600 text-xs whitespace-nowrap">
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            {(d.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {loading && !data && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading metrics…</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function MetricCard({
  icon: Icon, label, value, sub, color = 'text-white',
}: {
  icon: typeof Activity
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
