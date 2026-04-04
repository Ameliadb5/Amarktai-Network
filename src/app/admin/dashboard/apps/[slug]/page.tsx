'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Clock, WifiOff,
  LayoutDashboard, Brain, BarChart3, BookOpen, Target, FileText,
  Activity, Cpu, Users, Zap, Globe, Shield,
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

const TABS = ['Overview', 'AI Stack', 'Metrics', 'Learning', 'Strategy', 'Events', 'Safety'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS: Record<Tab, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Overview:  LayoutDashboard,
  'AI Stack': Brain,
  Metrics:   BarChart3,
  Learning:  BookOpen,
  Strategy:  Target,
  Events:    FileText,
  Safety:    Shield,
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
        {tab === 'Learning' && <AppLearningTab appSlug={app.slug} />}
        {tab === 'Strategy' && <StrategyTab appSlug={app.slug} appName={app.name} appCategory={app.category} />}
        {tab === 'Events' && <AppEventsTab appSlug={app.slug} />}
        {tab === 'Safety' && <SafetyTab appSlug={app.slug} />}
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
        <p className="text-xs text-slate-400">AI stack shows current routing, provider, and monitoring configuration for this app.</p>
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
        <p className="text-xs text-slate-400">Metrics are collected from brain events for this app. No events logged yet.</p>
      </div>
    </div>
  )
}

/* ── Tab: Strategy ────────────────────────────────────────── */
interface StrategyData {
  appSlug: string
  strategyState: string
  goals: Array<{ id: string; label: string; metric: string; targetValue: number; currentValue: number | null; direction: string; priority: string }>
  kpis: Array<{ metric: string; label: string; targetValue: number; currentValue: number | null; unit: string; status: string }>
  recommendations: Array<{ id: string; type: string; title: string; description: string; impact: string }>
}

function StrategyTab({ appSlug, appName, appCategory }: { appSlug: string; appName: string; appCategory: string }) {
  const [strategy, setStrategy] = useState<StrategyData | null>(null)
  const [stratLoading, setStratLoading] = useState(true)
  const [stratError, setStratError] = useState<string | null>(null)

  const loadStrategy = useCallback(async () => {
    setStratLoading(true)
    setStratError(null)
    try {
      const res = await fetch(`/api/admin/strategy?app=${appSlug}`)
      if (res.status === 404) {
        setStrategy(null)
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStrategy(await res.json())
    } catch (e) {
      setStratError(e instanceof Error ? e.message : 'Failed to load strategy')
    } finally {
      setStratLoading(false)
    }
  }, [appSlug])

  useEffect(() => { loadStrategy() }, [loadStrategy])

  const initStrategy = async () => {
    try {
      const res = await fetch('/api/admin/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize', appSlug, appName, appType: appCategory || 'general' }),
      })
      if (res.ok) {
        await loadStrategy()
      } else {
        setStratError('Failed to initialize strategy')
      }
    } catch (e) {
      console.error('[strategy] init error:', e)
      setStratError('Failed to initialize strategy')
    }
  }

  if (stratLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="ml-2 text-xs text-slate-400">Loading strategy…</span>
      </div>
    )
  }

  if (stratError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-xs text-slate-400">{stratError}</p>
        <button onClick={loadStrategy} className="text-xs text-blue-400 hover:text-blue-300">Retry</button>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <Target className="w-7 h-7 text-slate-600" />
        </div>
        <div className="text-center max-w-md">
          <h3 className="text-sm font-semibold text-white mb-1">No Strategy Configured</h3>
          <p className="text-xs text-slate-500 mb-4">Initialize a strategy to set goals, KPI targets, and get AI-driven recommendations for this app.</p>
          <button
            onClick={initStrategy}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Initialize Strategy
          </button>
        </div>
      </div>
    )
  }

  const KPI_STATUS_COLORS: Record<string, string> = {
    achieved: 'text-emerald-400',
    on_track: 'text-blue-400',
    at_risk: 'text-amber-400',
    behind: 'text-red-400',
    unknown: 'text-slate-500',
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">KPI Targets</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${strategy.strategyState === 'active' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-600/10 text-slate-400'}`}>
            {strategy.strategyState}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(strategy.kpis ?? []).map((kpi) => (
            <div key={kpi.metric} className="bg-white/[0.02] rounded-lg p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{kpi.label}</p>
              <p className="text-lg font-bold text-white">{kpi.currentValue ?? '—'} <span className="text-xs text-slate-500">{kpi.unit}</span></p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Target: {kpi.targetValue} {kpi.unit}</span>
                <span className={`text-[10px] font-medium ${KPI_STATUS_COLORS[kpi.status] ?? 'text-slate-500'}`}>
                  {kpi.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Goals</h3>
        <div className="space-y-3">
          {(strategy.goals ?? []).map((goal) => (
            <div key={goal.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg p-3">
              <div className="space-y-0.5">
                <p className="text-sm text-white">{goal.label}</p>
                <p className="text-[10px] text-slate-500">
                  {goal.direction} {goal.metric} → {goal.targetValue}
                  {goal.currentValue !== null ? ` (current: ${goal.currentValue})` : ''}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                goal.priority === 'critical' ? 'bg-red-400/10 text-red-400' :
                goal.priority === 'high' ? 'bg-amber-400/10 text-amber-400' :
                'bg-slate-600/10 text-slate-400'
              }`}>
                {goal.priority}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {(strategy.recommendations ?? []).length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Recommendations</h3>
          <div className="space-y-3">
            {(strategy.recommendations ?? []).map((rec) => (
              <div key={rec.id} className="bg-white/[0.02] rounded-lg p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    rec.impact === 'high' ? 'bg-red-400/10 text-red-400' :
                    rec.impact === 'medium' ? 'bg-amber-400/10 text-amber-400' :
                    'bg-slate-600/10 text-slate-400'
                  }`}>
                    {rec.impact} impact
                  </span>
                  <span className="text-[10px] text-slate-500">{rec.type}</span>
                </div>
                <p className="text-sm font-medium text-white">{rec.title}</p>
                <p className="text-xs text-slate-400">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Learning ───────────────────────────────────────── */
interface LearningData {
  status: string
  outcomeCount: number
  insights: Array<{ id: string; title: string; description: string; metric?: string; value?: number }>
}

function AppLearningTab({ appSlug }: { appSlug: string }) {
  const [data, setData] = useState<LearningData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/learning?view=dashboard&app=${encodeURIComponent(appSlug)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load learning data')
    } finally {
      setLoading(false)
    }
  }, [appSlug])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="ml-2 text-xs text-slate-400">Loading learning data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-xs text-slate-400">{error}</p>
        <button onClick={load} className="text-xs text-blue-400 hover:text-blue-300">Retry</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-slate-600" />
        </div>
        <p className="text-xs text-slate-500">No learning data available for this app.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Status</p>
          <p className="text-lg font-bold text-white">{data.status}</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Outcomes</p>
          </div>
          <p className="text-2xl font-bold text-white font-heading">{data.outcomeCount}</p>
        </div>
      </div>

      {/* Insights */}
      {(data?.insights ?? []).length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Insights</h3>
          <div className="space-y-3">
            {(data?.insights ?? []).map((insight) => (
              <div key={insight.id} className="bg-white/[0.02] rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-white">{insight.title}</p>
                <p className="text-xs text-slate-400">{insight.description}</p>
                {insight.metric && (
                  <p className="text-[10px] text-slate-500">
                    {insight.metric}: {insight.value ?? '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Events ────────────────────────────────────────── */
const EVENT_SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
  debug: 'text-slate-500',
}

interface EventRecord {
  id: string
  eventType: string
  severity: string
  title: string
  timestamp: string
}

function AppEventsTab({ appSlug }: { appSlug: string }) {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events?app=${encodeURIComponent(appSlug)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setEvents(Array.isArray(json) ? json : json.events ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [appSlug])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="ml-2 text-xs text-slate-400">Loading events…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-6 h-6 text-red-400" />
        <p className="text-xs text-slate-400">{error}</p>
        <button onClick={load} className="text-xs text-blue-400 hover:text-blue-300">Retry</button>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <FileText className="w-7 h-7 text-slate-600" />
        </div>
        <p className="text-xs text-slate-500">No events recorded for this app yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-mono font-medium">Type</th>
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-mono font-medium">Severity</th>
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-mono font-medium">Title</th>
            <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-mono font-medium text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt) => (
            <tr key={evt.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3 text-xs text-slate-400 font-mono">{evt.eventType}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${EVENT_SEVERITY_COLORS[evt.severity] ?? 'text-slate-400'}`}>
                  {evt.severity}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-white">{evt.title}</td>
              <td className="px-4 py-3 text-xs text-slate-500 text-right">
                {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Tab: Safety ────────────────────────────────────────── */

interface SafetyConfig {
  appSlug: string
  safeMode: boolean
  adultMode: boolean
  suggestiveMode: boolean
  note: string
}

function SafetyTab({ appSlug }: { appSlug: string }) {
  const [config, setConfig] = useState<SafetyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/app-safety?appSlug=${encodeURIComponent(appSlug)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load safety config')
    } finally {
      setLoading(false)
    }
  }, [appSlug])

  useEffect(() => { load() }, [load])

  const updateConfig = async (updates: { safeMode?: boolean; adultMode?: boolean; suggestiveMode?: boolean }) => {
    setSaving(true)
    setSaveMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/admin/app-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, ...updates }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to update')
        return
      }
      setConfig(json)
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="ml-2 text-xs text-slate-400">Loading safety config…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Safety Policy */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Content Safety Policy</h3>
          {saveMsg && <span className="text-[10px] text-emerald-400 ml-auto">{saveMsg}</span>}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-lg px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Safe Mode Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-sm text-white">Safe Mode</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              When enabled, all content passes through strict safety filters.
            </p>
          </div>
          <button
            onClick={() => updateConfig({ safeMode: !config?.safeMode })}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.safeMode ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config?.safeMode ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Adult Mode Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-sm text-white">Adult Mode (18+)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Allows lawful adult 18+ content. Requires Safe Mode OFF.
            </p>
            <p className="text-[10px] text-red-400/60 mt-0.5">
              CSAM, violence, and self-harm are ALWAYS blocked.
            </p>
          </div>
          <button
            onClick={() => {
              if (config?.safeMode && !config?.adultMode) {
                setError('Disable Safe Mode first before enabling Adult Mode.')
                return
              }
              updateConfig({ adultMode: !config?.adultMode })
            }}
            disabled={saving || (config?.safeMode ?? false)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.adultMode ? 'bg-amber-500' : 'bg-slate-600'
            } ${config?.safeMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config?.adultMode ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Suggestive Mode Toggle */}
        <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-sm text-white">Suggestive Mode</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Allows lingerie, swimwear, fashion poses, topless nudity. Requires Safe Mode OFF.
            </p>
            <p className="text-[10px] text-purple-400/60 mt-0.5">
              Explicit sex, pornography, genitalia, and minors are ALWAYS blocked.
            </p>
          </div>
          <button
            onClick={() => {
              if (config?.safeMode && !config?.suggestiveMode) {
                setError('Disable Safe Mode first before enabling Suggestive Mode.')
                return
              }
              updateConfig({ suggestiveMode: !config?.suggestiveMode })
            }}
            disabled={saving || (config?.safeMode ?? false)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.suggestiveMode ? 'bg-purple-500' : 'bg-slate-600'
            } ${config?.safeMode ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config?.suggestiveMode ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Current Status */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${config?.safeMode ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-xs text-slate-300">
              Safe Mode: <strong>{config?.safeMode ? 'ON' : 'OFF'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${config?.adultMode ? 'bg-amber-400' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-300">
              Adult Mode: <strong>{config?.adultMode ? 'ENABLED' : 'DISABLED'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${config?.suggestiveMode ? 'bg-purple-400' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-300">
              Suggestive Mode: <strong>{config?.suggestiveMode ? 'ENABLED' : 'DISABLED'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Always-blocked content notice */}
      <div className="bg-red-500/5 border border-red-400/10 rounded-xl p-6">
        <h4 className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-3">Always Blocked Content</h4>
        <ul className="space-y-1.5 text-xs text-red-300/80">
          <li>• CSAM (child sexual abuse material) — zero tolerance</li>
          <li>• Non-consensual intimate imagery</li>
          <li>• Violence/gore promotion or instructions</li>
          <li>• Self-harm/suicide encouragement</li>
          <li>• Terrorism/extremism content</li>
          <li>• Any illegal content under applicable law</li>
        </ul>
        <p className="mt-3 text-[10px] text-slate-500">
          These categories are blocked regardless of Safe Mode or Adult Mode settings. No exceptions.
        </p>
      </div>

      {/* Suggestive Capability status */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Suggestive Image Capability</h4>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${config?.suggestiveMode ? 'bg-purple-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-300">
            {config?.suggestiveMode
              ? 'AVAILABLE — Suggestive mode is enabled. Lingerie, swimwear, fashion, and topless imagery can be generated.'
              : 'BLOCKED BY SETTINGS — Enable suggestive mode (requires Safe Mode OFF) to unlock this capability.'}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Routes: /api/brain/suggestive-image (DALL-E → SDXL), /api/brain/suggestive-video (planning only).
          Prompts are validated before generation — explicit sex, pornography, genitalia, and minors are always blocked.
        </p>
      </div>

      {/* Capability status */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Adult 18+ Image Capability</h4>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-xs text-slate-300">UNAVAILABLE — No reliable provider supports unrestricted adult content generation.</span>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Even with Adult Mode enabled, image generation for adult content requires a provider that supports it.
          Currently no registered provider meets this requirement. This is truthful — we do not fake availability.
        </p>
      </div>
    </div>
  )
}
