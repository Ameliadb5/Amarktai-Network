'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, AlertCircle, BrainCircuit, MessageSquare,
  MonitorDot, ArrowRight, Brain, Shield, WifiOff,
  CheckCircle2, XCircle, Clock, Zap,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────
interface DashboardData {
  metrics: {
    totalProducts: number
    totalContacts: number
    totalWaitlist: number
    totalIntegrations: number
  }
  recentContacts: Array<{
    id: number
    name: string
    email: string
    createdAt: string
    companyOrProject: string
  }>
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
    integration: {
      healthStatus: string
      lastHeartbeatAt: string | null
    } | null
  }>
  brainStats: {
    totalRequests: number
    successCount: number
    errorCount: number
    avgLatencyMs: number | null
  } | null
}

interface VpsSnapshot {
  cpuPercent: number
  ramPercent: number
  diskPercent: number
  netInKbps: number
  netOutKbps: number
  timestamp: string
}

interface VpsProduct {
  id: number
  name: string
  slug: string
  status: string
  hostingScope: string
  hostedHere: boolean
  integration: { healthStatus: string; lastHeartbeatAt: string | null; uptime: number | null } | null
  vpsSnapshots: VpsSnapshot[]
}

// ── Derived types ────────────────────────────────────────────────
type SystemStatus = 'Active' | 'Ready' | 'Standby'

// ── Helpers ──────────────────────────────────────────────────────
function HealthDot({ status }: { status: string }) {
  if (status === 'healthy') {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
    )
  }
  if (status === 'unhealthy') return <span className="inline-flex h-2 w-2 rounded-full bg-red-400" />
  return <span className="inline-flex h-2 w-2 rounded-full bg-slate-600" />
}

function SeverityDot({ severity }: { severity: string }) {
  const cls =
    severity === 'critical' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]' :
    severity === 'error'    ? 'bg-red-400' :
    severity === 'warning'  ? 'bg-amber-400' : 'bg-blue-400'
  return <span className={`inline-flex h-1.5 w-1.5 rounded-full flex-shrink-0 ${cls}`} />
}

function deriveSystemStatus(data: DashboardData | null): SystemStatus {
  if (!data) return 'Standby'
  if ((data.brainStats?.totalRequests ?? 0) > 0) return 'Active'
  if (data.productStats.some(p => p.integration?.healthStatus === 'healthy')) return 'Ready'
  return 'Standby'
}

const STATUS_STYLES: Record<SystemStatus, { pill: string; dot: string }> = {
  Active:  { pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  Ready:   { pill: 'border-blue-500/30 bg-blue-500/10 text-blue-300',          dot: 'bg-blue-400' },
  Standby: { pill: 'border-slate-500/30 bg-slate-500/10 text-slate-400',       dot: 'bg-slate-500' },
} as const

// ── Skeleton ─────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-5 max-w-7xl">
      <div className="h-20 bg-white/[0.04] rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-72 bg-white/[0.04] rounded-2xl animate-pulse lg:col-span-2" />
        <div className="h-72 bg-white/[0.04] rounded-2xl animate-pulse" />
      </div>
      <div className="h-48 bg-white/[0.04] rounded-2xl animate-pulse" />
      <div className="h-10 bg-white/[0.04] rounded-xl animate-pulse" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard').then((r) => r.json()),
      // TODO: surface VPS snapshot data in a dedicated infrastructure page
    fetch('/api/admin/vps').then((r) => r.json()),
    ]).then(([dash]: [DashboardData, unknown]) => {
      setData(dash)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Tick every minute for timestamp display
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingSkeleton />

  const systemStatus = deriveSystemStatus(data)
  const statusStyle = STATUS_STYLES[systemStatus]

  const totalRequests = data?.brainStats?.totalRequests ?? 0
  const successCount  = data?.brainStats?.successCount  ?? 0
  const errorCount    = data?.brainStats?.errorCount    ?? 0
  const avgLatencyMs  = data?.brainStats?.avgLatencyMs  ?? null
  const successRate   = totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : '—'
  const errorRate     = totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(1)   : '—'

  const recentEvents  = data?.recentEvents ?? []
  const productStats  = data?.productStats ?? []
  const flowEvents    = recentEvents.slice(0, 5)

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── HEADER: AmarktAI Status ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold font-heading gradient-text tracking-tight">AmarktAI Status</h1>
            {/* System status pill */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold font-mono ${statusStyle.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
              {systemStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Live system interface
            <span className="mx-1.5 text-slate-700">·</span>
            {format(now, 'MMM d, HH:mm')}
            <span className="mx-1.5 text-slate-700">·</span>
            {totalRequests.toLocaleString()} executions
          </p>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 self-start sm:self-auto">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[10px] text-emerald-400 font-mono tracking-widest">LIVE</span>
        </div>
      </motion.div>

      {/* ── MAIN ROW: Live Activity + System State ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Panel 1 — Live Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass rounded-2xl overflow-hidden lg:col-span-2"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white font-heading">Live Activity</h2>
            </div>
            <Link href="/admin/dashboard/ai-usage" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Full trace →
            </Link>
          </div>

          <div className="p-5 space-y-5">
            {/* 2×2 metric tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Total Executions',
                  value: totalRequests > 0 ? totalRequests.toLocaleString() : '—',
                  icon: <Brain className="w-4 h-4 text-violet-400" />,
                  color: 'text-white',
                },
                {
                  label: 'Success Rate',
                  value: successRate !== '—' ? `${successRate}%` : '—',
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
                  color: 'text-emerald-400',
                },
                {
                  label: 'Error Rate',
                  value: errorRate !== '—' ? `${errorRate}%` : '—',
                  icon: <XCircle className="w-4 h-4 text-red-400" />,
                  color: errorCount > 0 ? 'text-red-400' : 'text-slate-500',
                },
                {
                  label: 'Avg Latency',
                  value: avgLatencyMs !== null ? `${avgLatencyMs.toFixed(0)}ms` : '—',
                  icon: <Clock className="w-4 h-4 text-cyan-400" />,
                  color: 'text-cyan-400',
                },
              ].map((tile) => (
                <div key={tile.label} className="glass-card rounded-xl p-4 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-white/[0.04] mt-0.5">{tile.icon}</div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">{tile.label}</p>
                    <p className={`text-xl font-bold font-heading ${tile.color}`}>{tile.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Executions list */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-3">Recent Executions</p>
              {recentEvents.length > 0 ? (
                <div className="space-y-0">
                  {recentEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
                    >
                      <SeverityDot severity={event.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate leading-tight">{event.title}</p>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                          {event.product.name}
                          <span className="mx-1 text-slate-700">·</span>
                          {event.eventType}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                        {format(new Date(event.timestamp), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <Activity className="w-7 h-7 text-slate-700 mb-2" />
                  <p className="text-xs text-slate-500">No executions yet</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Activity appears once AI requests are made.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Panel 2 — System State */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <MonitorDot className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white font-heading">System State</h2>
            </div>
            <Link href="/admin/dashboard/apps" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Manage →
            </Link>
          </div>

          <div className="p-5">
            {productStats.length > 0 ? (
              <div className="space-y-1">
                {productStats.map((product) => {
                  const health = product.integration?.healthStatus ?? 'unknown'
                  const heartbeat = product.integration?.lastHeartbeatAt
                  const healthLabel =
                    health === 'healthy'   ? 'Healthy' :
                    health === 'unhealthy' ? 'Unhealthy' : 'Unknown'
                  const healthColor =
                    health === 'healthy'   ? 'text-emerald-400' :
                    health === 'unhealthy' ? 'text-red-400' : 'text-slate-500'

                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                    >
                      <HealthDot status={health} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate leading-tight">{product.name}</p>
                        {heartbeat ? (
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                            {formatDistanceToNow(new Date(heartbeat), { addSuffix: true })}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-700 font-mono mt-0.5">no heartbeat</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono font-semibold ${healthColor}`}>{healthLabel}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <WifiOff className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-sm text-slate-500 font-medium">No systems connected</p>
                <Link href="/admin/dashboard/apps" className="text-xs text-blue-400 mt-2 hover:text-blue-300 transition-colors">
                  Connect a system →
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── EXECUTION FLOW ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="terminal rounded-2xl overflow-hidden"
      >
        <div className="terminal-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white font-heading">Execution Flow</span>
          </div>
          <Link href="/admin/dashboard/events" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            All events →
          </Link>
        </div>

        <div className="p-5">
          {flowEvents.length > 0 ? (
            <div className="flex items-start gap-0 overflow-x-auto pb-2">
              {flowEvents.map((event, idx) => {
                const severityRing =
                  event.severity === 'critical' ? 'border-red-500/60 bg-red-500/10' :
                  event.severity === 'error'    ? 'border-red-400/40 bg-red-400/5' :
                  event.severity === 'warning'  ? 'border-amber-400/40 bg-amber-400/5' :
                                                  'border-blue-400/30 bg-blue-400/5'
                const severityText =
                  event.severity === 'critical' ? 'text-red-400' :
                  event.severity === 'error'    ? 'text-red-300' :
                  event.severity === 'warning'  ? 'text-amber-300' : 'text-blue-300'

                return (
                  <div key={event.id} className="flex items-center flex-shrink-0">
                    {/* Step node */}
                    <div className="flex flex-col items-center w-36">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 ${severityRing}`}>
                        <span className="text-[10px] font-bold font-mono text-slate-400">{idx + 1}</span>
                      </div>
                      <p className={`text-[10px] font-mono font-semibold text-center truncate w-full px-1 ${severityText}`}>
                        {event.eventType}
                      </p>
                      <p className="text-[10px] text-slate-500 text-center truncate w-full px-1 mt-0.5">
                        {event.product.name}
                      </p>
                      <p className="text-[10px] text-slate-700 font-mono text-center mt-1">
                        {format(new Date(event.timestamp), 'HH:mm')}
                      </p>
                    </div>

                    {/* Connector line */}
                    {idx < flowEvents.length - 1 && (
                      <div className="w-8 flex-shrink-0 flex items-center justify-center mb-6">
                        <div className="h-px w-full bg-gradient-to-r from-white/10 to-white/5" />
                        <ArrowRight className="w-3 h-3 text-slate-700 -ml-1.5 flex-shrink-0" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <Zap className="w-7 h-7 text-slate-700 mb-2" />
              <p className="text-xs text-slate-500">No execution data yet</p>
              <p className="text-[10px] text-slate-600 mt-0.5">The flow will visualize as events come in.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── QUICK LINKS STRIP ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { href: '/admin/dashboard/brain-chat',   label: 'Brain Chat',   icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />, sub: 'Test the AI' },
          { href: '/admin/dashboard/ai-providers', label: 'AI Providers', icon: <BrainCircuit   className="w-3.5 h-3.5 text-violet-400" />, sub: 'Configure models' },
          { href: '/admin/dashboard/config',       label: 'Setup',        icon: <Shield         className="w-3.5 h-3.5 text-amber-400"  />, sub: 'Execution config' },
          { href: '/admin/dashboard/events',       label: 'All Events',   icon: <Activity       className="w-3.5 h-3.5 text-blue-400"   />, sub: 'Full event log' },
          { href: '/admin/dashboard/alerts',       label: 'Alerts',       icon: <AlertCircle    className="w-3.5 h-3.5 text-red-400"    />, sub: 'Active alerts' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-4 py-2.5 glass rounded-xl hover:bg-white/5 transition-colors group"
          >
            <div className="p-1 rounded-lg bg-white/[0.04]">{item.icon}</div>
            <div>
              <p className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors leading-tight">{item.label}</p>
              <p className="text-[10px] text-slate-600">{item.sub}</p>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors ml-1" />
          </Link>
        ))}
      </motion.div>

    </div>
  )
}
