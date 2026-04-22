'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, Database, BookOpen, Bot, Layers,
  RefreshCw, AlertCircle, Loader2, Activity,
  Brain, Cpu, Zap,
} from 'lucide-react'

/* ── constants ─────────────────────────────────────────────── */

const CARD = 'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl'
const INNER = 'bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]'

const TABS = [
  { key: 'routing',      label: 'Routing',      icon: Route },
  { key: 'memory',       label: 'Memory',       icon: Database },
  { key: 'learning',     label: 'Learning',     icon: BookOpen },
  { key: 'agents',       label: 'Agents',       icon: Bot },
  { key: 'capabilities', label: 'Capabilities', icon: Layers },
] as const

type TabKey = (typeof TABS)[number]['key']

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15 } },
}

/* ── hook: cached fetch per tab ────────────────────────────── */

type TabState = { data: unknown; loading: boolean; error: string | null }

function useTabFetch(url: string | null, active: boolean) {
  const [state, setState] = useState<TabState>({ data: null, loading: false, error: null })

  const load = useCallback(async () => {
    if (!url) return
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      setState({ data: await res.json(), loading: false, error: null })
    } catch (e: unknown) {
      setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Failed to load intelligence data' })
    }
  }, [url])

  useEffect(() => { if (active && !state.data && !state.loading) load() }, [active, state.data, state.loading, load])

  return { ...state, reload: load }
}

/* ── sub-components ────────────────────────────────────────── */

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

function Placeholder({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className={`${CARD} p-10 text-center`}>
      <Icon className="mx-auto mb-4 h-10 w-10 text-white/20" />
      <p className="text-sm text-white/40">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-blue-400/60" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${CARD} p-8 text-center`}>
      <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400/70" />
      <p className="mb-4 text-sm text-red-300/80">{message}</p>
      <button onClick={onRetry} className="rounded-xl bg-white/[0.06] px-4 py-1.5 text-xs text-white/60 hover:bg-white/[0.1] transition">
        Retry
      </button>
    </div>
  )
}

/* ── routing tab ───────────────────────────────────────────── */

interface RouteRow { taskType?: string; model?: string; provider?: string; reasoning?: string; status?: string }

function RoutingTab({ data }: { data: unknown }) {
  const d = data as { routes?: RouteRow[]; decisions?: RouteRow[]; stats?: Record<string, number> } | null
  const rows: RouteRow[] = d?.routes ?? d?.decisions ?? []

  if (!rows.length) return <Placeholder icon={Route} message="No routing decisions recorded yet." />

  return (
    <div className="space-y-4">
      {d?.stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(d.stats).slice(0, 4).map(([k, v], i) => (
            <motion.div key={k} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <p className="text-[11px] uppercase tracking-wider text-white/30">{k.replace(/_/g, ' ')}</p>
              <p className="mt-1 text-xl font-semibold text-white/90">{v}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/30">
                <th className="px-4 py-3">Task Type</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <motion.tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                  <td className="px-4 py-3 text-white/70">{r.taskType ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-300/80">{r.model ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50">{r.provider ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusDot color={r.status === 'active' ? 'bg-emerald-400' : r.status === 'error' ? 'bg-red-400' : 'bg-white/20'} />
                    <span className="ml-2 text-white/50">{r.status ?? 'idle'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-white/30 max-w-xs truncate">{r.reasoning ?? '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── memory tab ────────────────────────────────────────────── */

function MemoryTab({ data }: { data: unknown }) {
  const d = data as {
    statusLabel?: string
    totalEntries?: number
    appSlugs?: string[]
    status?: string; stats?: { total?: number; namespaces?: string[]; appSlugs?: string[] }
    entries?: unknown[]; total?: number
  } | null

  const status = d?.statusLabel ?? d?.status ?? 'unknown'
  const total = d?.totalEntries ?? d?.stats?.total ?? d?.total ?? d?.entries?.length ?? 0
  const namespaces = d?.appSlugs ?? d?.stats?.namespaces ?? d?.stats?.appSlugs ?? []

  const statusColor = status === 'saving' ? 'bg-emerald-400' : status === 'not_configured' ? 'bg-amber-400' : 'bg-white/20'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Status', value: status.replace(/_/g, ' '), extra: <StatusDot color={statusColor} /> },
          { label: 'Total Entries', value: total },
          { label: 'Namespaces', value: namespaces.length },
        ].map((c, i) => (
          <motion.div key={i} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-[11px] uppercase tracking-wider text-white/30">{c.label}</p>
            <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-white/90">
              {c.extra}{String(c.value)}
            </div>
          </motion.div>
        ))}
      </div>

      {namespaces.length > 0 && (
        <div className={`${CARD} p-5`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Namespaces / App Slugs</p>
          <div className="flex flex-wrap gap-2">
            {namespaces.map((ns: string) => (
              <span key={ns} className="rounded-lg bg-blue-500/10 border border-blue-400/20 px-3 py-1 text-xs text-blue-300/80">
                {ns}
              </span>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className={`${CARD} p-6 text-center`}>
          <Database className="mx-auto mb-3 h-7 w-7 text-white/20" />
          <p className="text-sm text-white/50 mb-1">No memory entries yet</p>
          <p className="text-xs text-white/30 max-w-sm mx-auto">
            Memory is populated automatically after successful brain requests.
            Run a test in <span className="text-blue-300/70">Workspace → Test AI</span> or send a message via an app agent, then return here.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── learning tab ──────────────────────────────────────────── */

interface LearningInsight { type?: string; title?: string; description?: string; impact?: string }
interface ProviderPerf { providerKey?: string; totalRequests?: number; successRate?: number; avgLatencyMs?: number; failureCount?: number }

function LearningTab({ data }: { data: unknown }) {
  const d = data as {
    status?: string; statusLabel?: string; available?: boolean
    totalOutcomesLogged?: number; totalInsights?: number; providerCount?: number
    appCount?: number; lastLearningRun?: string | null
    insights?: LearningInsight[]; performance?: ProviderPerf[]
  } | null

  const statusLabel = d?.statusLabel ?? d?.status ?? 'unknown'
  const statusColor = statusLabel === 'active' ? 'bg-emerald-400' : statusLabel === 'collecting' ? 'bg-amber-400' : 'bg-white/20'

  const stats = [
    { label: 'Status', value: statusLabel.replace(/_/g, ' '), extra: <StatusDot color={statusColor} /> },
    { label: 'Outcomes Logged', value: d?.totalOutcomesLogged ?? 0 },
    { label: 'Insights', value: d?.totalInsights ?? 0 },
    { label: 'Providers Tracked', value: d?.providerCount ?? 0 },
  ]

  const insights = d?.insights ?? []
  const performance = d?.performance ?? []
  const isEmpty = !insights.length && !performance.length && (d?.totalOutcomesLogged ?? 0) === 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((c, i) => (
          <motion.div key={i} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-[11px] uppercase tracking-wider text-white/30">{c.label}</p>
            <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-white/90">
              {c.extra}{String(c.value)}
            </div>
          </motion.div>
        ))}
      </div>

      {performance.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/30">Provider Performance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-white/30">
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Requests</th>
                  <th className="px-4 py-3">Success Rate</th>
                  <th className="px-4 py-3">Avg Latency</th>
                  <th className="px-4 py-3">Failures</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p, i) => (
                  <motion.tr key={p.providerKey ?? i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-300/80">{p.providerKey ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{p.totalRequests ?? 0}</td>
                    <td className="px-4 py-3 text-white/70">{p.successRate != null ? `${(p.successRate * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-4 py-3 text-white/50">{p.avgLatencyMs != null ? `${Math.round(p.avgLatencyMs)}ms` : '—'}</td>
                    <td className="px-4 py-3 text-white/50">{p.failureCount ?? 0}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div className={`${CARD} p-5`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Insights</p>
          <ul className="space-y-2">
            {insights.slice(0, 20).map((item, i) => (
              <motion.li key={i} className={`${INNER} text-sm`}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white/70 font-medium">{item.title ?? item.type ?? 'Insight'}</p>
                    {item.description && <p className="mt-1 text-xs text-white/40">{item.description}</p>}
                  </div>
                  {item.impact && (
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      item.impact === 'high' ? 'bg-red-500/10 text-red-300/80' :
                      item.impact === 'medium' ? 'bg-amber-500/10 text-amber-300/80' :
                      'bg-blue-500/10 text-blue-300/80'
                    }`}>{item.impact}</span>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {isEmpty && (
        <div className={`${CARD} p-6 text-center`}>
          <Brain className="mx-auto mb-3 h-7 w-7 text-white/20" />
          <p className="text-sm text-white/50 mb-1">No learning insights yet</p>
          <p className="text-xs text-white/30 max-w-sm mx-auto">
            Learning data builds from real request outcomes. Make some requests via <span className="text-blue-300/70">Workspace → Test AI</span> or through your connected apps to build the learning record.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── agents tab ────────────────────────────────────────────── */

interface AgentEntry {
  id?: string; name?: string; type?: string; description?: string; capabilities?: string[];
  readiness?: 'READY' | 'PARTIAL' | 'NOT_CONNECTED'; auditReasons?: string[];
  defaultProvider?: string; defaultModel?: string; providerHealth?: string;
  providerCallable?: boolean; providerRegistered?: boolean; modelExists?: boolean;
  canHandoff?: string[]; memoryEnabled?: boolean;
}
interface AgentStatus { configuredAgents?: number; runningTasks?: number; completedTasks?: number; failedTasks?: number; totalTasks?: number }
interface AuditSummary { total?: number; ready?: number; partial?: number; notConnected?: number; auditedAt?: string }

const READINESS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  READY:         { dot: 'bg-emerald-400', label: 'Ready',         text: 'text-emerald-400' },
  PARTIAL:       { dot: 'bg-amber-400',   label: 'Partial',       text: 'text-amber-400' },
  NOT_CONNECTED: { dot: 'bg-red-400',     label: 'Not Connected', text: 'text-red-400' },
}

function AgentsTab({ data }: { data: unknown }) {
  const d = data as { agents?: AgentEntry[]; status?: AgentStatus; audit?: AuditSummary } | null
  const agents = d?.agents ?? []
  const status = d?.status
  const audit = d?.audit

  if (!agents.length) {
    return <Placeholder icon={Cpu} message="No agents configured." />
  }

  const auditStats = audit ? [
    { label: 'Total', value: audit.total ?? agents.length },
    { label: 'Ready', value: audit.ready ?? 0, color: 'text-emerald-400' },
    { label: 'Partial', value: audit.partial ?? 0, color: 'text-amber-400' },
    { label: 'Not Connected', value: audit.notConnected ?? 0, color: 'text-red-400' },
  ] : null

  const runtimeStats = status ? [
    { label: 'Running', value: status.runningTasks ?? 0 },
    { label: 'Completed', value: status.completedTasks ?? 0 },
    { label: 'Failed', value: status.failedTasks ?? 0 },
    { label: 'Total Tasks', value: status.totalTasks ?? 0 },
  ] : null

  return (
    <div className="space-y-4">
      {/* Audit summary */}
      {auditStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {auditStats.map((s, i) => (
            <motion.div key={s.label} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <p className="text-[11px] uppercase tracking-wider text-white/30">{s.label}</p>
              <p className={`mt-1 text-xl font-semibold ${'color' in s ? s.color : 'text-white/90'}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Runtime stats */}
      {runtimeStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {runtimeStats.map((s, i) => (
            <motion.div key={s.label} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <p className="text-[11px] uppercase tracking-wider text-white/30">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-white/90">{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Agent cards with real readiness status */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a, i) => {
          const style = READINESS_STYLE[a.readiness ?? 'NOT_CONNECTED'] ?? READINESS_STYLE.NOT_CONNECTED
          return (
            <motion.div key={a.id ?? i} className={`${CARD} p-5`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-blue-400/60" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white/80 truncate">{a.name ?? `Agent ${i + 1}`}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.text} bg-white/[0.04]`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {style.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/30">{a.type ?? 'general'}</p>

                  {/* Provider / model info */}
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/30">
                    {a.defaultProvider && (
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" /> {a.defaultProvider}
                        {a.providerCallable === false && <span className="text-red-400">(no call impl)</span>}
                      </span>
                    )}
                    {a.defaultModel && (
                      <span>{a.defaultModel}{a.modelExists === false ? ' ⚠' : ''}</span>
                    )}
                  </div>

                  {a.description && <p className="mt-2 text-xs text-white/40 line-clamp-2">{a.description}</p>}

                  {/* Audit reasons (shown for non-READY) */}
                  {a.readiness !== 'READY' && a.auditReasons && a.auditReasons.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {a.auditReasons.map((r, ri) => (
                        <p key={ri} className="text-[10px] text-amber-300/60">⚠ {r}</p>
                      ))}
                    </div>
                  )}

                  {a.capabilities && a.capabilities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.capabilities.map(cap => (
                        <span key={cap} className="rounded-md bg-blue-500/10 border border-blue-400/20 px-2 py-0.5 text-[10px] text-blue-300/80">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ── capabilities tab ──────────────────────────────────────── */

interface CapabilityEntry {
  capability?: string
  available?: boolean
  state?: 'AVAILABLE_NOW' | 'BLOCKED_BY_SETTINGS' | 'UNAVAILABLE_WITH_CURRENT_CONFIG' | 'NOT_IMPLEMENTED'
  reason?: string
  routeExists?: boolean
  blockedBySettings?: boolean
  hasCapableModel?: boolean
  hasActiveProvider?: boolean
}

function CapabilitiesTab({ routingData }: { routingData: unknown }) {
  const d = routingData as { capabilities?: CapabilityEntry[] } | null
  const capabilities = d?.capabilities ?? []

  if (!capabilities.length) {
    return <Placeholder icon={Zap} message="Capability status unavailable." />
  }

  const available = capabilities.filter(c => c.available || c.state === 'AVAILABLE_NOW').length
  const blocked = capabilities.filter(c => c.state === 'BLOCKED_BY_SETTINGS').length
  const unavailable = capabilities.filter(c => c.state === 'UNAVAILABLE_WITH_CURRENT_CONFIG').length
  const notImpl = capabilities.filter(c => c.state === 'NOT_IMPLEMENTED').length
  const otherUnavailable = capabilities.length - available - blocked - unavailable - notImpl

  const stats = [
    { label: 'Total', value: capabilities.length },
    { label: 'Available Now', value: available, color: 'text-emerald-400' },
    { label: 'Blocked by Settings', value: blocked, color: 'text-amber-400' },
    { label: 'Unavailable', value: unavailable + otherUnavailable, color: 'text-red-400' },
    { label: 'Not Implemented', value: notImpl, color: 'text-slate-400' },
  ]

  const stateStyle = (cap: CapabilityEntry) => {
    const s = cap.state
    if (s === 'AVAILABLE_NOW' || cap.available) return { dot: 'bg-emerald-400', label: 'Available Now', text: 'text-emerald-400/70' }
    if (s === 'BLOCKED_BY_SETTINGS') return { dot: 'bg-amber-400', label: 'Blocked by Settings', text: 'text-amber-400/70' }
    if (s === 'NOT_IMPLEMENTED') return { dot: 'bg-slate-500', label: 'Not Implemented', text: 'text-slate-400/70' }
    return { dot: 'bg-red-400', label: 'Unavailable', text: 'text-red-400/70' }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s, i) => (
          <motion.div key={s.label} className={INNER} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-[11px] uppercase tracking-wider text-white/30">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold ${'color' in s && s.color ? s.color : 'text-white/90'}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className={`${CARD} p-5`}>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Capability Map</p>
        <div className="space-y-2">
          {capabilities.map((cap, i) => {
            const style = stateStyle(cap)
            return (
              <motion.div key={cap.capability ?? i}
                className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <StatusDot color={style.dot} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white/60">{(cap.capability ?? 'unknown').replace(/_/g, ' ')}</span>
                  {cap.reason && (
                    <p className="text-[10px] text-white/30 mt-0.5">{cap.reason}</p>
                  )}
                </div>
                <span className={`ml-auto text-[10px] font-medium whitespace-nowrap ${style.text}`}>
                  {style.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── page ──────────────────────────────────────────────────── */

const API_MAP: Record<TabKey, string | null> = {
  routing:      '/api/admin/routing',
  memory:       '/api/admin/memory',
  learning:     '/api/admin/learning?view=dashboard',
  agents:       '/api/admin/agents',
  capabilities: '/api/admin/truth?section=capabilities',
}

export default function IntelligencePage() {
  const [tab, setTab] = useState<TabKey>('routing')

  const routing  = useTabFetch(API_MAP.routing,  tab === 'routing' || tab === 'capabilities')
  const memory   = useTabFetch(API_MAP.memory,   tab === 'memory')
  const learning = useTabFetch(API_MAP.learning,  tab === 'learning')
  const agents   = useTabFetch(API_MAP.agents,    tab === 'agents')
  const capabilities = useTabFetch(API_MAP.capabilities, tab === 'capabilities')

  const current = { routing, memory, learning, agents, capabilities }[tab]

  return (
    <div className="space-y-8">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-400/20">
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Intelligence</h1>
            <p className="text-sm text-slate-500">AI routing, memory, learning, and agent management</p>
          </div>
        </div>
      </motion.div>

      {/* tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
              tab === key
                ? 'bg-blue-500/15 text-blue-300 border border-blue-400/20'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
            }`}>
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* refresh */}
      {(API_MAP[tab] || tab === 'capabilities') && (
        <div className="flex justify-end">
          <button onClick={current.reload}
            className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-1.5 text-xs text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition">
            <RefreshCw className={`h-3.5 w-3.5 ${current.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...fadeIn}>
          {current.loading ? (
            <LoadingState />
          ) : current.error ? (
            <ErrorState message={current.error} onRetry={current.reload} />
          ) : (
            <>
              {tab === 'routing'      && <RoutingTab data={routing.data} />}
              {tab === 'memory'       && <MemoryTab data={memory.data} />}
              {tab === 'learning'     && <LearningTab data={learning.data} />}
              {tab === 'agents'       && <AgentsTab data={agents.data} />}
              {tab === 'capabilities' && <CapabilitiesTab routingData={capabilities.data} />}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
