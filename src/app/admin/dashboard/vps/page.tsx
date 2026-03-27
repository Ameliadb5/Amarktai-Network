'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Server, Cpu, MemoryStick, HardDrive, Activity, CheckCircle, AlertCircle, Clock,
  RefreshCw, ArrowUpDown, Wifi,
} from 'lucide-react'
import { format } from 'date-fns'

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
  integration: {
    healthStatus: string
    lastHeartbeatAt: string | null
    uptime: number | null
  } | null
  vpsSnapshots: VpsSnapshot[]
}

interface VpsSeries {
  productId: number
  productName: string
  snapshots: VpsSnapshot[]
}

interface VpsApiResponse {
  products: VpsProduct[]
  timeSeries: VpsSeries[]
}

const hostingScopeLabel: Record<string, string> = {
  same_vps: 'Same VPS',
  external_vps: 'External VPS',
  external_domain: 'External Domain',
  subdomain: 'Subdomain',
}

const healthIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle className="w-4 h-4 text-emerald-400" />
    case 'unhealthy': return <AlertCircle className="w-4 h-4 text-red-400" />
    default: return <Clock className="w-4 h-4 text-slate-400" />
  }
}

const metricColor = (pct: number) =>
  pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400'

const barColor = (pct: number) =>
  pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'

function UsageBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${metricColor(pct)}`}>{value.toFixed(1)}%</span>
    </div>
  )
}

function AppCard({ product, series }: { product: VpsProduct; series: VpsSeries | undefined }) {
  const snap = product.vpsSnapshots[0]
  const chartData = series?.snapshots.map((s) => ({
    time: format(new Date(s.timestamp), 'HH:mm'),
    cpu: +s.cpuPercent.toFixed(1),
    ram: +s.ramPercent.toFixed(1),
    disk: +s.diskPercent.toFixed(1),
  })) ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {healthIcon(product.integration?.healthStatus ?? 'unknown')}
          <div>
            <p className="font-semibold text-white text-sm font-heading">{product.name}</p>
            <p className="text-xs text-slate-500">
              {hostingScopeLabel[product.hostingScope] ?? product.hostingScope}
              {product.integration?.uptime !== null && product.integration?.uptime !== undefined && (
                <> · {product.integration.uptime.toFixed(1)}% uptime</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-400">
          <Server className="w-3 h-3" />
          {product.hostedHere ? 'This VPS' : 'Remote'}
        </div>
      </div>

      {/* Current metrics */}
      {snap ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Cpu className="w-3 h-3" /> CPU
            </div>
            <UsageBar value={snap.cpuPercent} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MemoryStick className="w-3 h-3" /> RAM
            </div>
            <UsageBar value={snap.ramPercent} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <HardDrive className="w-3 h-3" /> Disk
            </div>
            <UsageBar value={snap.diskPercent} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Wifi className="w-3 h-3" /> Network
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <ArrowUpDown className="w-3 h-3" />
              <span>↓{snap.netInKbps.toFixed(0)}</span>
              <span className="text-slate-600">/</span>
              <span>↑{snap.netOutKbps.toFixed(0)} Kbps</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Activity className="w-3.5 h-3.5" />
          No VPS data received yet
        </div>
      )}

      {/* Time-series chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">48-point history</p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#0B1020',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="cpu" stroke="#3B82F6" fill="rgba(59,130,246,0.08)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="ram" stroke="#06B6D4" fill="rgba(6,182,212,0.08)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="disk" stroke="#8B5CF6" fill="rgba(139,92,246,0.08)" strokeWidth={1.5} dot={false} />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                formatter={(value) => <span style={{ color: '#94a3b8' }}>{value.toUpperCase()}</span>}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Last update */}
      {snap && (
        <p className="text-xs text-slate-600">
          Updated {format(new Date(snap.timestamp), 'MMM d, HH:mm:ss')}
        </p>
      )}
    </motion.div>
  )
}

export default function VpsMonitorPage() {
  const [data, setData] = useState<VpsApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/admin/vps')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      // ignore
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Poll every 30 s for near-realtime feel
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [load])

  const products = data?.products ?? []
  const timeSeries = data?.timeSeries ?? []

  const sameVps = products.filter((p) => p.hostingScope === 'same_vps')
  const externalVps = products.filter((p) => p.hostingScope === 'external_vps')
  const others = products.filter((p) => p.hostingScope !== 'same_vps' && p.hostingScope !== 'external_vps')

  const getSeriesFor = (id: number) => timeSeries.find((s) => s.productId === id)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-5 h-5 text-blue-400" />
            <h1 className="text-2xl font-bold text-white font-heading">VPS Monitor</h1>
          </div>
          <p className="text-sm text-slate-400">
            Real-time resource usage across all connected applications
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : `Refresh · ${format(lastRefresh, 'HH:mm:ss')}`}
        </button>
      </div>

      {/* Summary strip */}
      {products.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: 'Monitored Apps', value: products.length, icon: <Activity className="w-4 h-4 text-blue-400" /> },
            {
              label: 'Healthy',
              value: products.filter((p) => p.integration?.healthStatus === 'healthy').length,
              icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
            },
            {
              label: 'Same VPS',
              value: sameVps.length,
              icon: <Server className="w-4 h-4 text-cyan-400" />,
            },
            {
              label: 'Remote',
              value: products.length - sameVps.length,
              icon: <Wifi className="w-4 h-4 text-violet-400" />,
            },
          ].map(({ label, value, icon }) => (
            <div key={label} className="glass rounded-2xl p-4 flex items-center gap-3">
              {icon}
              <div>
                <p className="text-xl font-bold text-white font-heading">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Same-VPS Apps */}
      {sameVps.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" /> Same-VPS Apps ({sameVps.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sameVps.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <AppCard product={p} series={getSeriesFor(p.id)} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* External-VPS Apps */}
      {externalVps.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5" /> External-VPS Apps ({externalVps.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {externalVps.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <AppCard product={p} series={getSeriesFor(p.id)} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Other (subdomain / external domain) */}
      {others.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Other Connected Apps ({others.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {others.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <AppCard product={p} series={getSeriesFor(p.id)} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {products.length === 0 && (
        <div className="glass rounded-2xl p-16 text-center">
          <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">No apps have VPS monitoring enabled yet.</p>
          <p className="text-sm text-slate-600">
            Enable monitoring on an app integration and push your first VPS snapshot via{' '}
            <code className="text-cyan-400">POST /api/integrations/vps-resources</code>
          </p>
        </div>
      )}
    </div>
  )
}
