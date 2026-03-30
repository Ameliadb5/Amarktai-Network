'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Clock, WifiOff,
  LayoutDashboard, Brain, BarChart3, BookOpen, Target, FileText,
  Activity, Cpu, Users, Zap, Globe,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ───────────────────────────────────────────────── */
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

/* ── Config ──────────────────────────────────────────────── */
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

const TABS = ['Overview', 'AI Stack', 'Metrics', 'Learning', 'Strategy', 'Events'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS: Record<Tab, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Overview:  LayoutDashboard,
  'AI Stack': Brain,
  Metrics:   BarChart3,
  Learning:  BookOpen,
  Strategy:  Target,
  Events:    FileText,
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

/* ── Main Component ──────────────────────────────────────── */
export default function AppDetailPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const [app, setApp] = useState<AppRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/apps')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const apps: AppRecord[] = Array.isArray(data) ? data : data.apps ?? []
      const found = apps.find((a) => a.slug === slug)
      if (!found) throw new Error('App not found')
      setApp(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="ml-3 text-sm text-slate-400">Loading app…</span>
      </div>
    )
  }

  /* ── Error ── */
  if (error || !app) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-400">{error ?? 'App not found'}</p>
        <div className="flex gap-3">
          <Link href="/admin/dashboard/apps" className="btn-ghost text-sm">
            ← Back to Apps
          </Link>
          <button onClick={load} className="btn-primary text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const s = STATUS[app.status] ?? STATUS.offline
  const h = app.integration ? (HEALTH[app.integration.healthStatus] ?? HEALTH.unknown) : null
  const HIcon = h?.icon ?? WifiOff

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Back link */}
      <motion.div variants={fadeUp}>
        <Link
          href="/admin/dashboard/apps"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Apps
        </Link>
      </motion.div>

      {/* App header */}
      <motion.div
        variants={fadeUp}
        className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white font-heading">
                {app.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-mono">{app.slug}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {app.primaryUrl && (
              <a
                href={app.primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                <Globe className="w-3 h-3" />
                {app.primaryUrl}
              </a>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Category
            </p>
            <p className="text-sm text-white capitalize">{app.category}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Health
            </p>
            {h ? (
              <span className={`flex items-center gap-1 text-sm ${h.color}`}>
                <HIcon className="w-3.5 h-3.5" />
                {h.label}
              </span>
            ) : (
              <span className="text-sm text-slate-600">No integration</span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              AI Enabled
            </p>
            <p className={`text-sm ${app.aiEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>
              {app.aiEnabled ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Last Heartbeat
            </p>
            <p className="text-sm text-slate-400">
              {app.integration?.lastHeartbeatAt
                ? formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })
                : '—'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        variants={fadeUp}
        className="flex items-center gap-1 overflow-x-auto pb-1"
      >
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t]
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t
                  ? 'text-white bg-blue-500/10 border border-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t}
            </button>
          )
        })}
      </motion.div>

      {/* Tab content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {tab === 'Overview' && <OverviewTab app={app} />}
        {tab === 'AI Stack' && <AIStackTab app={app} />}
        {tab === 'Metrics' && <MetricsTab />}
        {tab === 'Learning' && <PlaceholderTab title="Learning" description="Learning insights and model optimization data will be available in Phase 2." icon={BookOpen} />}
        {tab === 'Strategy' && <PlaceholderTab title="Strategy" description="App strategy configuration and goal tracking will be available in Phase 2." icon={Target} />}
        {tab === 'Events' && <PlaceholderTab title="Events" description="App-specific event timeline and audit log will be available in Phase 2." icon={FileText} />}
      </motion.div>
    </motion.div>
  )
}

/* ── Tab: Overview ───────────────────────────────────────── */
function OverviewTab({ app }: { app: AppRecord }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Configuration */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Configuration</h3>
        <div className="space-y-3">
          {[
            { label: 'Connected to Brain', value: app.connectedToBrain },
            { label: 'Monitoring Enabled', value: app.monitoringEnabled },
            { label: 'Integration Enabled', value: app.integrationEnabled },
            { label: 'AI Enabled', value: app.aiEnabled },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{item.label}</span>
              <span
                className={`text-xs font-medium ${
                  item.value ? 'text-emerald-400' : 'text-slate-600'
                }`}
              >
                {item.value ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Integration */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Integration</h3>
        {app.integration ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Environment</span>
              <span className="text-xs text-white capitalize">
                {app.integration.environment}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Health</span>
              <span
                className={`text-xs font-medium ${
                  (HEALTH[app.integration.healthStatus] ?? HEALTH.unknown).color
                }`}
              >
                {(HEALTH[app.integration.healthStatus] ?? HEALTH.unknown).label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Onboarding</span>
              <span className="text-xs text-slate-300 capitalize">
                {app.onboardingStatus.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No integration configured.</p>
        )}
      </div>
    </div>
  )
}

/* ── Tab: AI Stack ───────────────────────────────────────── */
function AIStackTab({ app }: { app: AppRecord }) {
  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">AI Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/[0.02] rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                Brain Connection
              </p>
            </div>
            <p className={`text-sm font-medium ${app.connectedToBrain ? 'text-emerald-400' : 'text-slate-600'}`}>
              {app.connectedToBrain ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                AI Processing
              </p>
            </div>
            <p className={`text-sm font-medium ${app.aiEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>
              {app.aiEnabled ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                Monitoring
              </p>
            </div>
            <p className={`text-sm font-medium ${app.monitoringEnabled ? 'text-emerald-400' : 'text-slate-600'}`}>
              {app.monitoringEnabled ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
        <p className="text-xs text-slate-400">
          Detailed AI stack configuration — model routing, provider preferences,
          and capability mapping — will be available in Phase 2.
        </p>
      </div>
    </div>
  )
}

/* ── Tab: Metrics ────────────────────────────────────────── */
function MetricsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: '—', icon: Activity, color: 'text-blue-400' },
          { label: 'Active Users', value: '—', icon: Users, color: 'text-emerald-400' },
          { label: 'AI Calls', value: '—', icon: Cpu, color: 'text-violet-400' },
        ].map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.label}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${m.color}`} />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  {m.label}
                </p>
              </div>
              <p className="text-2xl font-bold text-white font-heading">{m.value}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
        <p className="text-xs text-slate-400">
          Per-app metrics and analytics will be connected in Phase 2.
        </p>
      </div>
    </div>
  )
}

/* ── Tab: Placeholder ────────────────────────────────────── */
function PlaceholderTab({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center">
        <Icon className="w-7 h-7 text-slate-600" />
      </div>
      <div className="text-center max-w-md">
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}
