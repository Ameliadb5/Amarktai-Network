'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Brain, CheckCircle, AlertCircle, Clock,
  WifiOff, Loader2, Search, Layers, AlertTriangle,
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
  healthy:  { color: 'text-emerald-400', icon: CheckCircle,    label: 'Healthy' },
  degraded: { color: 'text-amber-400',   icon: Clock,          label: 'Degraded' },
  error:    { color: 'text-red-400',     icon: AlertCircle,    label: 'Error' },
  unknown:  { color: 'text-slate-500',   icon: WifiOff,        label: 'Unknown' },
  offline:  { color: 'text-slate-500',   icon: WifiOff,        label: 'Offline' },
}

// ── Helpers ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.offline
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
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
    <span className={`inline-flex items-center gap-1 text-xs ${h.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {h.label}
    </span>
  )
}

// ── Stagger variants ─────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

// ── App Card ─────────────────────────────────────────────────────
function AppCard({ app }: { app: AppRecord }) {
  const healthStatus = app.integration?.healthStatus
  const isErrorState = healthStatus === 'error' || healthStatus === 'degraded'

  return (
    <motion.div variants={fadeUp}>
      <Link
        href={`/admin/dashboard/apps/${app.slug}`}
        className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200"
      >
        {/* Name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-white truncate">{app.name}</h3>
          <StatusBadge status={app.status} />
        </div>

        {/* Category */}
        <p className="text-xs text-slate-500 mb-4">{app.category || 'Uncategorized'}</p>

        {/* Info rows */}
        <div className="space-y-2.5">
          {/* Integration health */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 uppercase tracking-wide">Health</span>
            <HealthBadge app={app} />
          </div>

          {/* AI enabled */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 uppercase tracking-wide">AI</span>
            {app.aiEnabled ? (
              <span className="inline-flex items-center gap-1 text-xs text-violet-400">
                <Brain className="w-3.5 h-3.5" /> Enabled
              </span>
            ) : (
              <span className="text-xs text-slate-600">Off</span>
            )}
          </div>

          {/* Last heartbeat */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600 uppercase tracking-wide">Heartbeat</span>
            {app.integration?.lastHeartbeatAt ? (
              <span className="text-xs text-slate-400">
                {formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}
              </span>
            ) : (
              <span className="text-xs text-slate-600">—</span>
            )}
          </div>
        </div>

        {/* Error state indicator */}
        {isErrorState && (
          <div className={`mt-4 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${
            healthStatus === 'error'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {healthStatus === 'error' ? 'Integration error — needs attention' : 'Degraded performance detected'}
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function AppsPage() {
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/products')
      if (!res.ok) throw new Error(`Failed to load apps (${res.status})`)
      const data = await res.json()
      setApps(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = apps.filter(app => {
    if (!search) return true
    const q = search.toLowerCase()
    return app.name.toLowerCase().includes(q) || app.slug.toLowerCase().includes(q)
  })

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Apps</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and monitor your connected applications.</p>
        </div>
        <Link
          href="/admin/dashboard/apps/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add App
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={load}
            className="text-xs text-red-300 hover:text-white transition-colors underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && apps.length === 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-16 text-center">
          <Layers className="w-10 h-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm text-slate-500 mb-4">No apps registered yet.</p>
          <Link
            href="/admin/dashboard/apps/new"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Add your first app →
          </Link>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && apps.length > 0 && filtered.length === 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-16 text-center">
          <Search className="w-10 h-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No apps match &ldquo;{search}&rdquo;</p>
        </div>
      )}

      {/* Card grid */}
      {!loading && !error && filtered.length > 0 && (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map(app => (
            <AppCard key={app.id} app={app} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
