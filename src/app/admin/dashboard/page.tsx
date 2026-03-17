'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import MetricCard from '@/components/ui/MetricCard'
import {
  Package, Mail, Users, Plug, Activity, AlertCircle, CheckCircle, Clock,
  Cpu, MemoryStick, HardDrive, Server
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

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

const severityColor: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  critical: 'text-red-500',
}

const healthIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle className="w-4 h-4 text-emerald-400" />
    case 'unhealthy': return <AlertCircle className="w-4 h-4 text-red-400" />
    default: return <Clock className="w-4 h-4 text-slate-400" />
  }
}

const mockChartData = Array.from({ length: 14 }, (_, i) => ({
  day: format(new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000), 'MMM d'),
  contacts: Math.floor(Math.random() * 8) + 1,
  waitlist: Math.floor(Math.random() * 15) + 2,
}))

function VpsGauge({
  label, value, icon, color,
}: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  const pct = Math.min(Math.max(value, 0), 100)
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : color
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-400">{icon}{label}</span>
        <span className="font-mono text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [vpsProducts, setVpsProducts] = useState<VpsProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard').then((r) => r.json()),
      fetch('/api/admin/vps').then((r) => r.json()),
    ]).then(([dash, vps]) => {
      setData(dash)
      setVpsProducts(Array.isArray(vps.products) ? vps.products : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  const monitoredApps = vpsProducts.filter((p) => p.vpsSnapshots.length > 0)
  const avgCpu = monitoredApps.length
    ? monitoredApps.reduce((s, p) => s + (p.vpsSnapshots[0]?.cpuPercent ?? 0), 0) / monitoredApps.length
    : 0
  const avgRam = monitoredApps.length
    ? monitoredApps.reduce((s, p) => s + (p.vpsSnapshots[0]?.ramPercent ?? 0), 0) / monitoredApps.length
    : 0
  const avgDisk = monitoredApps.length
    ? monitoredApps.reduce((s, p) => s + (p.vpsSnapshots[0]?.diskPercent ?? 0), 0) / monitoredApps.length
    : 0

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Control Center</h1>
          <p className="text-sm text-slate-400 mt-1 font-mono">amarktai.network / admin — real-time overview</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-xs text-emerald-400 font-mono">LIVE</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <MetricCard label="Total Products" value={data?.metrics.totalProducts ?? 0} icon={<Package className="w-4 h-4" />} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <MetricCard label="Contacts" value={data?.metrics.totalContacts ?? 0} icon={<Mail className="w-4 h-4" />} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <MetricCard label="Waitlist" value={data?.metrics.totalWaitlist ?? 0} icon={<Users className="w-4 h-4" />} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <MetricCard label="Integrations" value={data?.metrics.totalIntegrations ?? 0} icon={<Plug className="w-4 h-4" />} />
        </motion.div>
      </div>

      {/* VPS Resource Summary */}
      {monitoredApps.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                VPS Resource Usage
              </h2>
              <span className="text-xs text-slate-500">({monitoredApps.length} monitored)</span>
            </div>
            <Link href="/admin/dashboard/vps" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View full VPS monitor →
            </Link>
          </div>

          {/* Aggregate gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Avg CPU', value: avgCpu, icon: <Cpu className="w-3.5 h-3.5 text-blue-400" />, color: 'bg-blue-500' },
              { label: 'Avg RAM', value: avgRam, icon: <MemoryStick className="w-3.5 h-3.5 text-cyan-400" />, color: 'bg-cyan-500' },
              { label: 'Avg Disk', value: avgDisk, icon: <HardDrive className="w-3.5 h-3.5 text-violet-400" />, color: 'bg-violet-500' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="glass rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
                  {icon}
                </div>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                  {value.toFixed(1)}<span className="text-sm text-slate-400 ml-1">%</span>
                </p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${value >= 90 ? 'bg-red-500' : value >= 75 ? 'bg-amber-500' : color}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Per-app mini gauges */}
          <div className="glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {monitoredApps.slice(0, 8).map((app) => {
              const snap = app.vpsSnapshots[0]
              if (!snap) return null
              return (
                <div key={app.id} className="space-y-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    {healthIcon(app.integration?.healthStatus ?? 'unknown')}
                    <span className="text-xs font-semibold text-white truncate">{app.name}</span>
                  </div>
                  <VpsGauge label="CPU" value={snap.cpuPercent} icon={<Cpu className="w-3 h-3" />} color="bg-blue-500" />
                  <VpsGauge label="RAM" value={snap.ramPercent} icon={<MemoryStick className="w-3 h-3" />} color="bg-cyan-500" />
                  <VpsGauge label="Disk" value={snap.diskPercent} icon={<HardDrive className="w-3 h-3" />} color="bg-violet-500" />
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>↓ {snap.netInKbps.toFixed(0)} Kbps</span>
                    <span>↑ {snap.netOutKbps.toFixed(0)} Kbps</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
            Contacts & Waitlist (14 days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0B1020', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="contacts" stroke="#3B82F6" fill="rgba(59,130,246,0.1)" strokeWidth={2} />
              <Area type="monotone" dataKey="waitlist" stroke="#06B6D4" fill="rgba(6,182,212,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Contacts
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />Waitlist
            </div>
          </div>
        </motion.div>

        {/* Product Health */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>Product Health</h3>
          {data?.productStats && data.productStats.length > 0 ? (
            <div className="space-y-3">
              {data.productStats.slice(0, 6).map((product) => (
                <div key={product.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    {healthIcon(product.integration?.healthStatus ?? 'unknown')}
                    <span className="text-sm text-white">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 capitalize">{product.status.replace(/_/g, ' ')}</span>
                    {product.integration?.lastHeartbeatAt && (
                      <span className="text-xs text-slate-600">
                        {format(new Date(product.integration.lastHeartbeatAt), 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No products yet</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>Recent Contacts</h3>
          {data?.recentContacts && data.recentContacts.length > 0 ? (
            <div className="space-y-3">
              {data.recentContacts.map((contact) => (
                <div key={contact.id} className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white font-medium">{contact.name}</p>
                    <p className="text-xs text-slate-400">{contact.email}</p>
                    {contact.companyOrProject && (
                      <p className="text-xs text-slate-500">{contact.companyOrProject}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {format(new Date(contact.createdAt), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No contacts yet</p>
            </div>
          )}
        </motion.div>

        {/* Recent Events */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>Recent Events</h3>
          {data?.recentEvents && data.recentEvents.length > 0 ? (
            <div className="space-y-3">
              {data.recentEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <Activity className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${severityColor[event.severity] ?? 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{event.title}</p>
                    <p className="text-xs text-slate-500">{event.product.name} · {event.eventType}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {format(new Date(event.timestamp), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No events yet</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
