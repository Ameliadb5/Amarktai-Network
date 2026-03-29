'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Plus, ExternalLink, Brain, MonitorDot,
  CheckCircle, AlertCircle, Clock, WifiOff, X, Loader2,
  Eye, EyeOff, Copy, Check, Search, Activity, Users,
  DollarSign, Zap, Shield, TrendingDown, Cpu, Gauge,
  ChevronDown, ChevronUp, BarChart3, Layers,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────
interface AppRecord {
  id: number
  name: string
  slug: string
  category: string
  status: string
  primaryUrl: string
  aiEnabled: boolean
  connectedToBrain: boolean
  monitoringEnabled: boolean
  integrationEnabled: boolean
  appSecret: string
  onboardingStatus: string
  integration: {
    id: number
    integrationToken: string
    healthStatus: string
    lastHeartbeatAt: string | null
    environment: string
  } | null
}

// ── Status / Health config ───────────────────────────────────────
const STATUS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  live:            { label: 'Live',    dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ready_to_deploy: { label: 'Ready',   dot: 'bg-blue-400',    text: 'text-blue-400',    bg: 'bg-blue-400/10' },
  invite_only:     { label: 'Invite',  dot: 'bg-violet-400',  text: 'text-violet-400',  bg: 'bg-violet-400/10' },
  in_development:  { label: 'Dev',     dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/10' },
  coming_soon:     { label: 'Soon',    dot: 'bg-slate-400',   text: 'text-slate-400',   bg: 'bg-slate-400/10' },
  concept:         { label: 'Concept', dot: 'bg-purple-400',  text: 'text-purple-400',  bg: 'bg-purple-400/10' },
  offline:         { label: 'Offline', dot: 'bg-slate-600',   text: 'text-slate-500',   bg: 'bg-slate-600/10' },
}

const HEALTH: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  healthy:  { color: 'text-emerald-400', icon: CheckCircle, label: 'Healthy' },
  degraded: { color: 'text-amber-400',   icon: Clock,       label: 'Degraded' },
  error:    { color: 'text-red-400',     icon: AlertCircle, label: 'Error' },
  unknown:  { color: 'text-slate-500',   icon: WifiOff,     label: 'Unknown' },
  offline:  { color: 'text-slate-500',   icon: WifiOff,     label: 'Offline' },
}

const PENDING = 'Awaiting data'

// ── Helpers ──────────────────────────────────────────────────────
function Pending({ className = '' }: { className?: string }) {
  return <span className={`text-[11px] italic text-slate-600 ${className}`}>{PENDING}</span>
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.offline
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function HealthBadge({ app }: { app: AppRecord }) {
  if (!app.integration) return <span className="text-xs text-slate-600">No integration</span>
  const h = HEALTH[app.integration.healthStatus] ?? HEALTH.unknown
  const Icon = h.icon
  return (
    <span className={`flex items-center gap-1 text-xs ${h.color}`}>
      <Icon className="w-3 h-3" />
      {h.label}
    </span>
  )
}

// ── Secret management ────────────────────────────────────────────
function SecretField({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  if (!value) return <span className="text-xs text-amber-400/80">No {label.toLowerCase()} set</span>
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-slate-500 truncate max-w-[180px]">
        {show ? value : `${value.slice(0, 8)}${'•'.repeat(12)}`}
      </span>
      <button onClick={() => setShow(s => !s)} className="text-slate-600 hover:text-slate-400 flex-shrink-0" aria-label={show ? 'Hide' : 'Show'}>
        {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button onClick={copy} className={`flex-shrink-0 transition-colors ${copied ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`} aria-label="Copy">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  )
}

// ── Metric cell ──────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, color = 'text-slate-400' }: {
  icon: React.ElementType; label: string; value?: string | number | null; color?: string
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-600 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        {value != null ? (
          <p className="text-xs text-slate-300 truncate">{value}</p>
        ) : (
          <Pending />
        )}
      </div>
    </div>
  )
}

// ── Aggregate metrics row ────────────────────────────────────────
function AggregateBar({ apps }: { apps: AppRecord[] }) {
  const total = apps.length
  const healthy = apps.filter(a => a.integration?.healthStatus === 'healthy').length
  const degraded = apps.filter(a => a.integration?.healthStatus === 'degraded').length
  const offline = apps.filter(a => !a.integration || a.integration.healthStatus === 'offline' || a.integration.healthStatus === 'error').length

  const cards = [
    { label: 'Total Apps', value: total,    icon: Layers,      color: 'text-blue-400',    border: 'border-blue-500/20' },
    { label: 'Healthy',    value: healthy,  icon: CheckCircle,  color: 'text-emerald-400', border: 'border-emerald-500/20' },
    { label: 'Degraded',   value: degraded, icon: AlertCircle,  color: 'text-amber-400',   border: 'border-amber-500/20' },
    { label: 'Offline',    value: offline,  icon: WifiOff,      color: 'text-red-400',     border: 'border-red-500/20' },
    { label: 'AI Requests', value: null,    icon: Brain,        color: 'text-violet-400',  border: 'border-violet-500/20' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white/[0.03] backdrop-blur-xl border ${c.border} border-white/[0.06] rounded-xl p-4`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{c.label}</span>
            </div>
            {c.value != null ? (
              <p className="text-2xl font-bold text-white">{c.value}</p>
            ) : (
              <Pending className="text-xs" />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// ── App detail drawer ────────────────────────────────────────────
function AppDetailDrawer({ app, onClose }: { app: AppRecord; onClose: () => void }) {
  const health = app.integration ? (HEALTH[app.integration.healthStatus] ?? HEALTH.unknown) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md bg-[#080E1C] border-l border-white/[0.06] h-full overflow-y-auto"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#080E1C]/95 backdrop-blur-lg z-10">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{app.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{app.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status & badges */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            {app.aiEnabled && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-400/10 text-violet-400">
                <Brain className="w-3 h-3" /> AI Enabled
              </span>
            )}
            {app.monitoringEnabled && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                <MonitorDot className="w-3 h-3" /> Monitored
              </span>
            )}
            {app.connectedToBrain && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400">
                <Zap className="w-3 h-3" /> Brain
              </span>
            )}
          </div>

          {/* Connection health */}
          <Section title="Connection Health">
            {app.integration ? (
              <div className="space-y-2">
                <Row label="Health">{health && <span className={`flex items-center gap-1 text-xs ${health.color}`}><health.icon className="w-3 h-3" />{health.label}</span>}</Row>
                <Row label="Environment"><span className="text-xs text-white font-mono">{app.integration.environment}</span></Row>
                {app.integration.lastHeartbeatAt && (
                  <Row label="Last Heartbeat">
                    <span className="text-xs text-slate-300">{formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}</span>
                  </Row>
                )}
                <div className="pt-1">
                  <p className="text-xs text-slate-500 mb-1">Integration Token</p>
                  <SecretField value={app.integration.integrationToken} label="Token" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No integration configured.{' '}
                <Link href="/admin/dashboard/integrations" className="text-blue-400 hover:text-blue-300">Set up →</Link>
              </p>
            )}
          </Section>

          {/* App credentials */}
          <Section title="App Credentials">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">App ID (slug)</p>
                <SecretField value={app.slug} label="Slug" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">App Secret</p>
                <SecretField value={app.appSecret} label="App Secret" />
                {app.appSecret && (
                  <p className="text-[11px] text-slate-600 mt-1">Keep secret. Used as <span className="font-mono">appSecret</span> in brain requests.</p>
                )}
              </div>
            </div>
          </Section>

          {/* Business metrics (awaiting connector data) */}
          <Section title="Business Metrics">
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={Users} label="Active Users" color="text-blue-400" />
              <Metric icon={Users} label="New Users" color="text-cyan-400" />
              <Metric icon={DollarSign} label="Revenue" color="text-emerald-400" />
              <Metric icon={TrendingDown} label="Churn" color="text-red-400" />
            </div>
          </Section>

          {/* AI metrics */}
          <Section title="AI Usage">
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={Zap} label="AI Requests" color="text-violet-400" />
              <Metric icon={Cpu} label="Provider / Model" color="text-orange-400" />
              <Metric icon={DollarSign} label="Cost Burn" color="text-amber-400" />
              <Metric icon={AlertCircle} label="Error Rate" color="text-red-400" />
              <Metric icon={Shield} label="Fallback Rate" color="text-yellow-400" />
              <Metric icon={BarChart3} label="Capability Usage" color="text-indigo-400" />
              <Metric icon={Gauge} label="Avg Latency" color="text-teal-400" />
              <Metric icon={Activity} label="Health Score" color="text-emerald-400" />
            </div>
          </Section>

          {/* Details */}
          <Section title="Details">
            <div className="space-y-2">
              <Row label="Category"><span className="text-xs text-white">{app.category || '—'}</span></Row>
              <Row label="Onboarding"><span className="text-xs text-white capitalize">{app.onboardingStatus}</span></Row>
              {app.primaryUrl && (
                <Row label="URL">
                  <a href={app.primaryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                </Row>
              )}
            </div>
          </Section>
        </div>
      </motion.div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">{title}</p>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </div>
  )
}

// ── Per-app card ─────────────────────────────────────────────────
function AppCard({ app, index, onSelect }: { app: AppRecord; index: number; onSelect: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-colors"
    >
      {/* Card header – always visible */}
      <div className="p-4 flex items-start gap-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">{app.name}</h3>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-[11px] text-slate-600 font-mono">{app.slug}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <HealthBadge app={app} />
            {app.integration?.lastHeartbeatAt && (
              <span className="text-[11px] text-slate-500">
                {formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}
              </span>
            )}
            {app.aiEnabled && <span className="flex items-center gap-1 text-[11px] text-violet-400"><Brain className="w-3 h-3" />AI</span>}
            {app.connectedToBrain && <span className="flex items-center gap-1 text-[11px] text-cyan-400"><Zap className="w-3 h-3" />Brain</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {app.primaryUrl && (
            <a href={app.primaryUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-slate-500 hover:text-blue-400 p-1">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button className="text-slate-500 hover:text-white p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] pt-4">
              {/* Business metrics row */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 font-medium">Business Metrics</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Metric icon={Users} label="Active Users" color="text-blue-400" />
                  <Metric icon={Users} label="New Users" color="text-cyan-400" />
                  <Metric icon={DollarSign} label="Revenue" color="text-emerald-400" />
                  <Metric icon={TrendingDown} label="Churn" color="text-red-400" />
                </div>
              </div>

              {/* AI metrics row */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 font-medium">AI & Performance</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Metric icon={Zap} label="AI Requests" color="text-violet-400" />
                  <Metric icon={Cpu} label="Provider / Model" color="text-orange-400" />
                  <Metric icon={DollarSign} label="Cost Burn" color="text-amber-400" />
                  <Metric icon={AlertCircle} label="Error Rate" color="text-red-400" />
                  <Metric icon={Shield} label="Fallback Rate" color="text-yellow-400" />
                  <Metric icon={BarChart3} label="Capability Usage" color="text-indigo-400" />
                  <Metric icon={Gauge} label="Avg Latency" color="text-teal-400" />
                  <Metric icon={Activity} label="Health Score" color="text-emerald-400" />
                </div>
              </div>

              {/* App secret */}
              {app.appSecret && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-medium">App Secret</p>
                  <SecretField value={app.appSecret} label="App Secret" />
                </div>
              )}

              {/* Full detail button */}
              <button
                onClick={(e) => { e.stopPropagation(); onSelect() }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Open full detail panel →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function AppsRegistryPage() {
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AppRecord | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/admin/products')
      if (res.ok) {
        const data = await res.json()
        setApps(Array.isArray(data) ? data : [])
      }
    } catch {
      /* network error – keep existing data */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derive unique categories
  const categories = Array.from(new Set(apps.map(a => a.category).filter(Boolean))).sort()

  // Filter apps
  const filtered = apps.filter(app => {
    const q = search.toLowerCase()
    const matchesSearch = !q || app.name.toLowerCase().includes(q) || app.slug.toLowerCase().includes(q) || app.category.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || app.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">App Registry</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor all connected apps with per-app business metrics.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/admin/dashboard/apps/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Onboard App
          </Link>
        </div>
      </div>

      {/* Aggregate metrics */}
      {!loading && <AggregateBar apps={apps} />}

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, slug, or category…"
            className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS).map(([key, s]) => (
            <option key={key} value={key}>{s.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* App cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-12 text-center">
          {apps.length === 0 ? (
            <>
              <Layers className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">No apps registered yet.</p>
              <Link href="/admin/dashboard/apps/new" className="text-xs text-blue-400 hover:text-blue-300">
                Onboard your first app →
              </Link>
            </>
          ) : (
            <>
              <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No apps match your filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((app, i) => (
            <AppCard key={app.id} app={app} index={i} onSelect={() => setSelected(app)} />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && <AppDetailDrawer app={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}
