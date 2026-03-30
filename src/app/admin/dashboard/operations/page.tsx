'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, AlertCircle, Brain, Layers, Bell, FileText, Shield,
  CheckCircle, XCircle, Clock, WifiOff,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ─────────────────────────────────────────────── */
interface Provider {
  id: number
  providerKey: string
  displayName: string
  enabled: boolean
  healthStatus: string
  healthMessage: string
  lastCheckedAt: string | null
}

interface ModelEntry {
  id: string
  displayName: string
  provider: string
  role: string
  capabilities: string[]
  enabled: boolean
  contextWindow?: number
}

interface AlertEntry {
  id: number
  severity: string
  title: string
  description: string
  affectedResource: string
  autoHealed: boolean
  createdAt: string
}

interface EventEntry {
  id: number
  eventType: string
  severity: string
  title: string
  message: string
  timestamp: string
  product: { name: string } | null
}

interface ReadinessData {
  score: number
  checks: Array<{ category: string; label: string; status: string; detail: string }>
  summary: { total: number; passed: number; failed: number; warnings: number; critical: number }
}

const HEALTH: Record<string, { color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string }> = {
  healthy:      { color: 'text-emerald-400', icon: CheckCircle, label: 'Healthy' },
  configured:   { color: 'text-amber-400',   icon: Clock,       label: 'Key Set' },
  degraded:     { color: 'text-amber-400',   icon: AlertCircle, label: 'Degraded' },
  error:        { color: 'text-red-400',     icon: XCircle,     label: 'Error' },
  unconfigured: { color: 'text-slate-500',   icon: WifiOff,     label: 'Not Set' },
  disabled:     { color: 'text-slate-500',   icon: WifiOff,     label: 'Disabled' },
}

const SEV: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400',   bg: 'bg-red-400/10' },
  error:    { color: 'text-red-400',   bg: 'bg-red-400/10' },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-400/10' },
  info:     { color: 'text-blue-400',  bg: 'bg-blue-400/10' },
}

const TABS = ['Providers', 'Models', 'Alerts', 'Events', 'Readiness'] as const
type Tab = typeof TABS[number]
const TAB_ICONS: Record<Tab, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Providers: Brain, Models: Layers, Alerts: Bell, Events: FileText, Readiness: Shield,
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('Providers')
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<ModelEntry[]>([])
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [events, setEvents] = useState<EventEntry[]>([])
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, mRes, aRes, eRes, rRes] = await Promise.allSettled([
        fetch('/api/admin/providers').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/models').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/healing').then(r => r.ok ? r.json() : { issues: [] }),
        fetch('/api/admin/events').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/readiness').then(r => r.ok ? r.json() : null),
      ])
      if (pRes.status === 'fulfilled') setProviders(Array.isArray(pRes.value) ? pRes.value : [])
      if (mRes.status === 'fulfilled') setModels(Array.isArray(mRes.value) ? mRes.value : mRes.value?.models ?? [])
      if (aRes.status === 'fulfilled') setAlerts(Array.isArray(aRes.value?.issues) ? aRes.value.issues : [])
      if (eRes.status === 'fulfilled') setEvents(Array.isArray(eRes.value) ? eRes.value : [])
      if (rRes.status === 'fulfilled') setReadiness(rRes.value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Operations</h1>
        <p className="text-sm text-slate-400 mt-1">Providers, models, alerts, events, and system readiness</p>
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={fadeUp} className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t]
          return (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'text-white bg-blue-500/10 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'}`}>
              <Icon className="w-4 h-4" />
              {t}
            </button>
          )
        })}
        <div className="flex-1" />
        <button onClick={load} disabled={loading} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Loading…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={load} className="btn-primary text-sm">Retry</button>
        </div>
      ) : (
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'Providers' && <ProvidersView providers={providers} />}
          {tab === 'Models' && <ModelsView models={models} />}
          {tab === 'Alerts' && <AlertsView alerts={alerts} />}
          {tab === 'Events' && <EventsView events={events} />}
          {tab === 'Readiness' && <ReadinessView data={readiness} />}
        </motion.div>
      )}
    </motion.div>
  )
}

/* ── Sub-views ─────────────────────────────────────────── */

function ProvidersView({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) return <EmptyState message="No providers configured." />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((p) => {
        const h = HEALTH[p.healthStatus] ?? HEALTH.disabled
        const Icon = h.icon
        return (
          <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{p.displayName}</h3>
              <span className={`flex items-center gap-1 text-xs ${h.color}`}><Icon className="w-3 h-3" />{h.label}</span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{p.providerKey}</p>
            {p.healthMessage && <p className="text-xs text-slate-400">{p.healthMessage}</p>}
            {p.lastCheckedAt && <p className="text-[10px] text-slate-600">Checked {formatDistanceToNow(new Date(p.lastCheckedAt), { addSuffix: true })}</p>}
          </div>
        )
      })}
    </div>
  )
}

function ModelsView({ models }: { models: ModelEntry[] }) {
  if (models.length === 0) return <EmptyState message="No models registered." />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((m) => (
        <div key={m.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white truncate">{m.displayName}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-600/10 text-slate-500'}`}>{m.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p className="text-[10px] text-slate-600 font-mono truncate">{m.id}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{m.provider}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{m.role}</span>
          </div>
          {m.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.capabilities.map((c) => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{c}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AlertsView({ alerts }: { alerts: AlertEntry[] }) {
  if (alerts.length === 0) return <EmptyState message="No active alerts. All systems healthy." icon={<CheckCircle className="w-8 h-8 text-emerald-400" />} />
  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const sev = SEV[a.severity] ?? SEV.info
        return (
          <div key={a.id} className={`${sev.bg} border border-white/[0.06] rounded-xl p-4 space-y-1`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${sev.color}`}>{a.title}</span>
              {a.autoHealed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Auto-healed</span>}
            </div>
            <p className="text-xs text-slate-400">{a.description}</p>
            <p className="text-[10px] text-slate-600">Resource: {a.affectedResource} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
          </div>
        )
      })}
    </div>
  )
}

function EventsView({ events }: { events: EventEntry[] }) {
  if (events.length === 0) return <EmptyState message="No events recorded." />
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-mono border-b border-white/[0.06]">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">App</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {events.slice(0, 50).map((ev) => {
              const sev = SEV[ev.severity] ?? SEV.info
              return (
                <tr key={ev.id} className="hover:bg-white/[0.02]">
                  <td className={`px-4 py-3 ${sev.color} text-xs font-medium capitalize`}>{ev.severity}</td>
                  <td className="px-4 py-3 text-white">{ev.title}</td>
                  <td className="px-4 py-3 text-slate-400">{ev.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{ev.eventType}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReadinessView({ data }: { data: ReadinessData | null }) {
  if (!data) return <EmptyState message="Readiness data unavailable." />
  const scoreColor = data.score >= 80 ? 'text-emerald-400' : data.score >= 50 ? 'text-amber-400' : 'text-red-400'
  const CHECK_COLORS: Record<string, string> = { pass: 'text-emerald-400', fail: 'text-red-400', warn: 'text-amber-400' }

  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex items-center gap-6">
        <div className={`text-4xl font-bold font-heading ${scoreColor}`}>{data.score}%</div>
        <div>
          <p className="text-sm text-white font-medium">Readiness Score</p>
          <p className="text-xs text-slate-400 mt-0.5">{data.summary.passed} passed · {data.summary.failed} failed · {data.summary.warnings} warnings</p>
        </div>
      </div>
      <div className="space-y-2">
        {data.checks.map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 flex items-center gap-4">
            <span className={`w-2 h-2 rounded-full ${c.status === 'pass' ? 'bg-emerald-400' : c.status === 'fail' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{c.label}</p>
              <p className="text-xs text-slate-500 truncate">{c.detail}</p>
            </div>
            <span className={`text-xs font-medium capitalize ${CHECK_COLORS[c.status] ?? 'text-slate-400'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon ?? <AlertCircle className="w-8 h-8 text-slate-600" />}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
