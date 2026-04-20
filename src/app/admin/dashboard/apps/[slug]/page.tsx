'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Clock, WifiOff,
  LayoutDashboard, Brain, BarChart3, BookOpen, Target, FileText,
  Activity, Zap, Globe, Shield, Bot, Copy, Check, Loader2,
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

const TABS = ['Overview', 'AI Stack', 'Agents', 'Metrics', 'Learning', 'Strategy', 'Events', 'Safety'] as const
type Tab = (typeof TABS)[number]
const TAB_ICONS: Record<Tab, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Overview:  LayoutDashboard,
  'AI Stack': Brain,
  Agents:    Bot,
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
        {tab === 'Agents' && <AgentsTab appSlug={app.slug} appId={app.slug} appSecret={app.appSecret} productId={app.id} onSecretRotated={(newSecret) => setApp(prev => prev ? { ...prev, appSecret: newSecret } : prev)} />}
        {tab === 'Metrics' && <MetricsTab appSlug={app.slug} />}
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

/* ── Tab: Agents ─────────────────────────────────────────── */
interface AgentEntry {
  id: string
  name: string
  type: string
  description: string
  capabilities: string[]
  defaultProvider: string
  defaultModel: string
  readiness: string
  enabledForApp: boolean
}

const CONSUMER_AGENT_TYPES = new Set(['chatbot', 'marketing_agent'])

/** Map a consumer agent type to the taskType used in Brain Gateway requests. */
const AGENT_TASK_TYPE: Record<string, string> = {
  chatbot:          'chat',
  marketing_agent:  'campaign',
}
const READINESS_COLOR: Record<string, string> = {
  CONNECTED:     'text-emerald-400',
  PARTIAL:       'text-amber-400',
  NOT_CONNECTED: 'text-slate-500',
}

function AgentsTab({ appSlug, appId, appSecret, productId, onSecretRotated }: {
  appSlug: string
  appId: string
  appSecret: string
  productId: number
  onSecretRotated?: (newSecret: string) => void
}) {
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [secretRevealed, setSecretRevealed] = useState(false)
  const [rotatingSecret, setRotatingSecret] = useState(false)
  const [localSecret, setLocalSecret] = useState(appSecret)

  const maskedSecret = localSecret.length > 8
    ? `${localSecret.slice(0, 4)}${'•'.repeat(Math.max(0, localSecret.length - 8))}${localSecret.slice(-4)}`
    : (localSecret.length > 0 ? '••••••••' : '(no secret — generate one below)')
  const displaySecret = secretRevealed ? localSecret : maskedSecret

  const rotateSecret = async () => {
    if (!confirm('Generate a new app secret? Any app using the old secret will need to be updated.')) return
    setRotatingSecret(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // regenerateSecret: true causes the server to generate a cryptographically-secure
        // 64-char hex secret server-side — never trust client-supplied entropy
        body: JSON.stringify({ regenerateSecret: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const updated = await res.json() as { appSecret?: string }
      const newSecret = updated.appSecret ?? ''
      setLocalSecret(newSecret)
      setSecretRevealed(true)
      onSecretRotated?.(newSecret)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate secret')
    } finally {
      setRotatingSecret(false)
    }
  }

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/agents?appSlug=${encodeURIComponent(appSlug)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAgents(data.agents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [appSlug])

  useEffect(() => { loadAgents() }, [loadAgents])

  const toggle = (type: string) => {
    setAgents(prev => prev.map(a => a.type === type ? { ...a, enabledForApp: !a.enabledForApp } : a))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const enabled = agents.filter(a => a.enabledForApp).map(a => a.type)
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug, agentTypes: enabled }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const enabledAgents = agents.filter(a => a.enabledForApp)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-6">
      {/* App Credentials — always visible */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">App Credentials</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={rotateSecret}
              disabled={rotatingSecret}
              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-mono disabled:opacity-50"
              title="Generate or rotate the app secret"
            >
              {rotatingSecret ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔑'}
              {rotatingSecret ? 'Generating…' : (localSecret ? 'Rotate Secret' : 'Generate Secret')}
            </button>
            <button
              onClick={() => setSecretRevealed(r => !r)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
            >
              {secretRevealed ? '🙈 Hide' : '👁 Reveal'}
            </button>
          </div>
        </div>
        {!localSecret && (
          <p className="text-xs text-amber-400">⚠ No app secret — click <strong>Generate Secret</strong> to create one before connecting apps to the Brain.</p>
        )}
        <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 font-mono">
          <span className="text-[10px] text-slate-500 shrink-0">App ID</span>
          <span className="text-xs text-blue-300 flex-1 truncate">{appId}</span>
          <button onClick={() => { navigator.clipboard.writeText(appId); setCopiedKey('appId') }} className="text-slate-500 hover:text-white">
            {copiedKey === 'appId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 font-mono">
          <span className="text-[10px] text-slate-500 shrink-0">Secret</span>
          <span className="text-xs text-amber-200/80 flex-1 truncate">{displaySecret}</span>
          {localSecret && (
            <button onClick={() => { navigator.clipboard.writeText(localSecret); setCopiedKey('secret') }} className="text-slate-500 hover:text-white">
              {copiedKey === 'secret' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Agent Assignment</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign AI agents to this app. Consumer-facing agents (Chatbot, Marketing Agent) generate live endpoint URLs.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3 text-emerald-300" /> : null}
          {saved ? 'Saved!' : 'Save Assignment'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading agents…
        </div>
      ) : (
        <>
          {/* Consumer-facing agents (highlighted) */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-blue-400 font-mono">Consumer-Facing Agents</p>
            {agents.filter(a => CONSUMER_AGENT_TYPES.has(a.type)).map(agent => (
              <div
                key={agent.type}
                onClick={() => toggle(agent.type)}
                className={`cursor-pointer rounded-xl p-5 border transition-all ${
                  agent.enabledForApp
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${agent.enabledForApp ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                    {agent.enabledForApp && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <span className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{agent.type}</span>
                      <span className={`text-[10px] ${READINESS_COLOR[agent.readiness] ?? 'text-slate-500'}`}>● {agent.readiness.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{agent.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.capabilities.slice(0, 5).map(c => (
                        <span key={c} className="text-[10px] font-mono text-slate-500 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1.5">Default: {agent.defaultProvider} / {agent.defaultModel || '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Other agents */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Internal Agents</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agents.filter(a => !CONSUMER_AGENT_TYPES.has(a.type)).map(agent => (
                <div
                  key={agent.type}
                  onClick={() => toggle(agent.type)}
                  className={`cursor-pointer rounded-lg p-3.5 border transition-all ${
                    agent.enabledForApp
                      ? 'bg-violet-500/10 border-violet-500/20'
                      : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${agent.enabledForApp ? 'bg-violet-500 border-violet-500' : 'border-white/20'}`}>
                      {agent.enabledForApp && <Check className="w-2 h-2 text-white" />}
                    </div>
                    <p className="text-xs font-medium text-white flex-1">{agent.name}</p>
                    <span className={`text-[9px] ${READINESS_COLOR[agent.readiness] ?? 'text-slate-600'}`}>●</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 ml-5 line-clamp-2">{agent.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Endpoint URL panel — only shown when consumer agents are enabled */}
          {enabledAgents.some(a => CONSUMER_AGENT_TYPES.has(a.type)) && (
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">Live Endpoint URLs</h4>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">SAVE to activate</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={rotateSecret}
                    disabled={rotatingSecret}
                    className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors font-mono disabled:opacity-50"
                    title="Generate a new app secret"
                  >
                    {rotatingSecret ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔑'}
                    {rotatingSecret ? 'Generating…' : (localSecret ? 'Rotate Secret' : 'Generate Secret')}
                  </button>
                  <button
                    onClick={() => setSecretRevealed(r => !r)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors font-mono"
                  >
                    {secretRevealed ? '🙈 Hide secret' : '👁 Reveal secret'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400">Use these URLs in your app to send requests through the Brain Gateway. All requests are authenticated with your App ID and Secret.</p>

              {enabledAgents.filter(a => CONSUMER_AGENT_TYPES.has(a.type)).map(agent => {
                const endpointUrl = `${baseUrl}/api/brain/execute`
                const agentTaskType = AGENT_TASK_TYPE[agent.type] ?? 'chat'
                const snippet = JSON.stringify({
                  appId: appId,
                  appSecret: displaySecret,
                  taskType: agentTaskType,
                  message: '<user message here>',
                }, null, 2)
                const realSnippet = JSON.stringify({
                  appId: appId,
                  appSecret: localSecret,
                  taskType: agentTaskType,
                  message: '<user message here>',
                }, null, 2)
                const curlCmd = `curl -X POST ${endpointUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"appId":"${appId}","appSecret":"${displaySecret}","taskType":"${agentTaskType}","message":"Hello"}'`
                const realCurlCmd = `curl -X POST ${endpointUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"appId":"${appId}","appSecret":"${localSecret}","taskType":"${agentTaskType}","message":"Hello"}'`
                return (
                  <div key={agent.type} className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{agent.name} — {agent.type}</p>

                    {/* Endpoint */}
                    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                      <span className="text-xs text-emerald-400 font-mono font-medium shrink-0">POST</span>
                      <span className="text-xs text-slate-300 font-mono flex-1 truncate">{endpointUrl}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(endpointUrl, `${agent.type}-url`) }}
                        className="shrink-0 text-slate-500 hover:text-white transition-colors"
                      >
                        {copiedKey === `${agent.type}-url` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* JSON snippet */}
                    <div className="relative">
                      <pre className="text-[11px] text-slate-400 font-mono bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 overflow-x-auto leading-relaxed">{snippet}</pre>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(realSnippet, `${agent.type}-json`) }}
                        className="absolute top-2 right-2 text-slate-600 hover:text-slate-300 transition-colors"
                      >
                        {copiedKey === `${agent.type}-json` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* cURL */}
                    <details>
                      <summary className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer transition-colors font-mono uppercase tracking-wider">
                        cURL example
                      </summary>
                      <div className="relative mt-1">
                        <pre className="text-[11px] text-slate-400 font-mono bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 overflow-x-auto leading-relaxed mt-1">{curlCmd}</pre>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(realCurlCmd, `${agent.type}-curl`) }}
                          className="absolute top-2 right-2 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          {copiedKey === `${agent.type}-curl` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </details>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Tab: AI Stack ───────────────────────────────────────── */
function AIStackTab({ app }: { app: AppRecord }) {
  const [profile, setProfile] = useState<{
    routingStrategy: string
    basePersonality: string
    emotionContextWindow: number
    allowedProviders: string[]
    preferredModels: string[]
    costMode: string
    budgetSensitivity: string
    latencySensitivity: string
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Load current AI profile
  useEffect(() => {
    fetch(`/api/admin/app-profiles?appSlug=${encodeURIComponent(app.slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.profile) {
          const p = data.profile
          const safeParse = (val: unknown): string[] => {
            if (Array.isArray(val)) return val
            if (typeof val !== 'string') return []
            try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
          }
          setProfile({
            routingStrategy: p.routingStrategy ?? 'balanced',
            basePersonality: p.basePersonality ?? '',
            emotionContextWindow: p.emotionContextWindow ?? 0,
            allowedProviders: safeParse(p.allowedProviders),
            preferredModels: safeParse(p.preferredModels),
            costMode: p.costMode ?? 'balanced',
            budgetSensitivity: p.budgetSensitivity ?? 'medium',
            latencySensitivity: p.latencySensitivity ?? 'medium',
          })
        } else {
          setProfile({
            routingStrategy: 'balanced',
            basePersonality: '',
            emotionContextWindow: 0,
            allowedProviders: [],
            preferredModels: [],
            costMode: 'balanced',
            budgetSensitivity: 'medium',
            latencySensitivity: 'medium',
          })
        }
      })
      .catch(() => setProfile(null))
  }, [app.slug])

  const ALL_PROVIDERS = [
    'openai', 'groq', 'grok', 'deepseek', 'gemini', 'huggingface', 'nvidia',
    'openrouter', 'together', 'qwen', 'replicate', 'anthropic', 'cohere', 'mistral',
  ]
  const PERSONALITIES: Array<{ value: string; label: string }> = [
    { value: '', label: 'Auto (from category)' },
    { value: 'professional', label: 'Professional' },
    { value: 'analytical', label: 'Analytical' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'empathetic', label: 'Empathetic' },
    { value: 'assertive', label: 'Assertive' },
    { value: 'calm', label: 'Calm' },
    { value: 'flirty', label: 'Flirty' },
    { value: 'upbeat', label: 'Upbeat' },
  ]

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/app-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          appSlug: app.slug,
          appName: app.name,
          routingStrategy: profile.routingStrategy,
          basePersonality: profile.basePersonality,
          emotionContextWindow: profile.emotionContextWindow,
          allowedProviders: JSON.stringify(profile.allowedProviders),
          preferredModels: JSON.stringify(profile.preferredModels),
          costMode: profile.costMode,
          budgetSensitivity: profile.budgetSensitivity,
          latencySensitivity: profile.latencySensitivity,
        }),
      })
      setMsg(res.ok ? '✅ Saved' : `⚠ ${(await res.json()).error ?? 'Error'}`)
    } catch {
      setMsg('⚠ Network error')
    } finally {
      setSaving(false)
    }
  }

  const toggleProvider = (p: string) => {
    if (!profile) return
    setProfile(prev => {
      if (!prev) return prev
      const list = prev.allowedProviders.includes(p)
        ? prev.allowedProviders.filter(x => x !== p)
        : [...prev.allowedProviders, p]
      return { ...prev, allowedProviders: list }
    })
  }

  return (
    <div className="space-y-6">
      {/* Status cards */}
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

      {/* App AI Profile editor */}
      {profile && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">App AI Profile</h3>
            <button onClick={saveProfile} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
          {msg && <p className="text-xs text-slate-400">{msg}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Routing Strategy */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Routing Strategy</label>
              <select value={profile.routingStrategy}
                onChange={e => setProfile({ ...profile, routingStrategy: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                <option value="balanced">Balanced</option>
                <option value="cheapest">Cheapest</option>
                <option value="fastest">Fastest</option>
                <option value="quality">Quality</option>
              </select>
            </div>

            {/* Base Personality */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Base Personality</label>
              <select value={profile.basePersonality}
                onChange={e => setProfile({ ...profile, basePersonality: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                {PERSONALITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Emotion Context Window */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Emotion Context Window</label>
              <select value={profile.emotionContextWindow}
                onChange={e => setProfile({ ...profile, emotionContextWindow: parseInt(e.target.value) })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                <option value={0}>Default (5)</option>
                <option value={5}>5 (Simple Chat)</option>
                <option value={10}>10 (Standard)</option>
                <option value={20}>20 (Companion)</option>
                <option value={50}>50 (Deep Context)</option>
              </select>
            </div>

            {/* Cost Mode */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Cost Mode</label>
              <select value={profile.costMode}
                onChange={e => setProfile({ ...profile, costMode: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                <option value="cheap">Cheap</option>
                <option value="balanced">Balanced</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            {/* Budget Sensitivity */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Budget Sensitivity</label>
              <select value={profile.budgetSensitivity}
                onChange={e => setProfile({ ...profile, budgetSensitivity: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Latency Sensitivity */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Latency Sensitivity</label>
              <select value={profile.latencySensitivity}
                onChange={e => setProfile({ ...profile, latencySensitivity: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Allowed Providers */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              Allowed Providers {profile.allowedProviders.length === 0 ? '(all)' : `(${profile.allowedProviders.length})`}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PROVIDERS.map(p => (
                <button key={p} onClick={() => toggleProvider(p)}
                  className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors ${
                    profile.allowedProviders.includes(p)
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-600 hover:text-slate-400'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-600">Empty = all providers allowed. Click to toggle.</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab: Metrics ────────────────────────────────────────── */
interface AppMetrics {
  totalRequests: number
  successfulAiCalls: number
  failedCalls: number
  avgLatencyMs: number | null
  taskBreakdown: Record<string, number>
}

function MetricsTab({ appSlug }: { appSlug: string }) {
  const [metrics, setMetrics] = useState<AppMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events?appSlug=${encodeURIComponent(appSlug)}&limit=200`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const events: Array<{ success: boolean; latencyMs: number | null; taskType: string }> = data.events ?? []
      const totalRequests = data.total ?? events.length
      const successfulAiCalls = events.filter((e) => e.success).length
      const failedCalls = events.filter((e) => !e.success).length
      const latencies = events.map((e) => e.latencyMs).filter((l): l is number => l !== null)
      const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null
      const taskBreakdown: Record<string, number> = {}
      for (const e of events) {
        if (e.taskType) taskBreakdown[e.taskType] = (taskBreakdown[e.taskType] ?? 0) + 1
      }
      setMetrics({ totalRequests, successfulAiCalls, failedCalls, avgLatencyMs, taskBreakdown })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [appSlug])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  const cards = metrics
    ? [
        { label: 'Total AI Requests', value: fmtNum(metrics.totalRequests), icon: Activity, color: 'text-blue-400' },
        { label: 'Successful Calls', value: fmtNum(metrics.successfulAiCalls), icon: CheckCircle, color: 'text-emerald-400' },
        { label: 'Failed Calls', value: fmtNum(metrics.failedCalls), icon: AlertCircle, color: 'text-red-400' },
        { label: 'Avg Latency', value: metrics.avgLatencyMs !== null ? `${metrics.avgLatencyMs}ms` : '—', icon: Clock, color: 'text-amber-400' },
      ]
    : [
        { label: 'Total AI Requests', value: '—', icon: Activity, color: 'text-blue-400' },
        { label: 'Successful Calls', value: '—', icon: CheckCircle, color: 'text-emerald-400' },
        { label: 'Failed Calls', value: '—', icon: AlertCircle, color: 'text-red-400' },
        { label: 'Avg Latency', value: '—', icon: Clock, color: 'text-amber-400' },
      ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Brain Request Metrics</h3>
        <button
          onClick={loadMetrics}
          disabled={loading}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${m.color}`} />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{m.label}</p>
              </div>
              <p className="text-2xl font-bold text-white font-heading">
                {loading ? <span className="text-slate-600">…</span> : m.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Task breakdown */}
      {metrics && Object.keys(metrics.taskBreakdown).length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">By Task Type</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.taskBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([task, count]) => (
                <span key={task} className="text-xs font-mono text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded">
                  {task} <span className="text-white font-semibold">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {metrics && metrics.totalRequests === 0 && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
          <p className="text-xs text-slate-400">
            No brain requests recorded for this app yet. Requests appear here once the app sends messages through the Brain Gateway.
          </p>
        </div>
      )}
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
          <span className={`h-2 w-2 rounded-full ${config?.adultMode && !config?.safeMode ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-300">
            {config?.adultMode && !config?.safeMode
              ? 'ACTIVE — Adult mode enabled. Route: /api/brain/adult-image (HuggingFace SDXL → Together FLUX fallback).'
              : config?.safeMode
                ? 'BLOCKED — Safe Mode is ON. Disable Safe Mode and enable Adult Mode to unlock.'
                : 'INACTIVE — Enable Adult Mode (Safe Mode OFF) to unlock adult image generation.'}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Uses HuggingFace diffusion models (RealVisXL, DreamShaper, SDXL Base) with Together FLUX fallback.
          All prompts are scanned before generation. CSAM, violence, self-harm, and hate speech are always blocked.
        </p>
      </div>
    </div>
  )
}
