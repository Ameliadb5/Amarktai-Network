'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route, Database, BookOpen, Bot, Layers,
  RefreshCw, AlertCircle, Loader2, Activity,
  Brain, Cpu, Zap,
} from 'lucide-react'

/* ── constants ─────────────────────────────────────────────── */

const CARD = 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl'
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
      <button onClick={onRetry} className="rounded-lg bg-white/[0.06] px-4 py-1.5 text-xs text-white/60 hover:bg-white/[0.1] transition">
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
    status?: string; stats?: { total?: number; namespaces?: string[]; appSlugs?: string[] }
    entries?: unknown[]; total?: number
  } | null

  const status = d?.status ?? 'unknown'
  const total = d?.stats?.total ?? d?.total ?? d?.entries?.length ?? 0
  const namespaces = d?.stats?.namespaces ?? d?.stats?.appSlugs ?? []

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

      {total === 0 && <Placeholder icon={Database} message="No memory entries stored yet." />}
    </div>
  )
}

/* ── learning tab ──────────────────────────────────────────── */

function LearningTab({ data }: { data: unknown }) {
  const d = data as { insights?: unknown[]; status?: string } | null
  const hasData = d?.insights && d.insights.length > 0

  return (
    <div className="space-y-4">
      {hasData ? (
        <div className={`${CARD} p-5`}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Insights</p>
          <ul className="space-y-2">
            {(d!.insights as Array<{ label?: string; value?: string }>).slice(0, 10).map((item, i) => (
              <li key={i} className={`${INNER} text-sm text-white/60`}>
                {item.label ?? item.value ?? JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={`${CARD} p-10 text-center space-y-4`}>
          <Brain className="mx-auto h-10 w-10 text-white/15" />
          <p className="text-sm text-white/40">Learning insights will be available in Phase 2</p>
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 pt-2">
            {['Pattern Detection', 'Cost Optimization', 'Model Ranking'].map(l => (
              <div key={l} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                <div className="mb-2 h-6 w-6 rounded-lg bg-white/[0.04] mx-auto" />
                <p className="text-[10px] text-white/25">{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── agents tab ────────────────────────────────────────────── */

function AgentsTab({ data }: { data: unknown }) {
  const d = data as { agents?: Array<{ name?: string; status?: string; type?: string; id?: string }> } | null
  const agents = d?.agents ?? []

  if (!agents.length) {
    return (
      <div className={`${CARD} p-10 text-center space-y-4`}>
        <Cpu className="mx-auto h-10 w-10 text-white/15" />
        <p className="text-sm text-white/40">Agent management coming in Phase 2</p>
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3 pt-2">
          {['Task Agents', 'Router Agents', 'Memory Agents', 'Healing Agents'].map(a => (
            <div key={a} className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06] p-4 text-left">
              <div className="mb-2 h-3 w-16 rounded bg-white/[0.04]" />
              <p className="text-[11px] text-white/20">{a}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((a, i) => (
        <motion.div key={a.id ?? i} className={`${CARD} p-5`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-blue-400/60" />
            <div>
              <p className="text-sm font-medium text-white/80">{a.name ?? `Agent ${i + 1}`}</p>
              <p className="text-xs text-white/30">{a.type ?? 'general'}</p>
            </div>
            <StatusDot color={a.status === 'active' ? 'bg-emerald-400' : 'bg-white/20'} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ── capabilities tab ──────────────────────────────────────── */

function CapabilitiesTab() {
  return (
    <div className={`${CARD} p-10 text-center space-y-6`}>
      <Zap className="mx-auto h-10 w-10 text-white/15" />
      <p className="text-sm text-white/40">Capability mapping will be available in Phase 2</p>
      <div className="mx-auto max-w-lg space-y-3 pt-2">
        {['Text Generation', 'Image Analysis', 'Code Execution', 'Web Search', 'Data Retrieval'].map(cap => (
          <div key={cap} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-white/[0.06]" />
            <span className="text-xs text-white/25">{cap}</span>
            <div className="ml-auto h-2 w-24 rounded-full bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── page ──────────────────────────────────────────────────── */

const API_MAP: Record<TabKey, string | null> = {
  routing:      '/api/admin/routing',
  memory:       '/api/admin/memory',
  learning:     '/api/admin/learning',
  agents:       '/api/admin/agents',
  capabilities: null,
}

export default function IntelligencePage() {
  const [tab, setTab] = useState<TabKey>('routing')

  const routing  = useTabFetch(API_MAP.routing,  tab === 'routing')
  const memory   = useTabFetch(API_MAP.memory,   tab === 'memory')
  const learning = useTabFetch(API_MAP.learning,  tab === 'learning')
  const agents   = useTabFetch(API_MAP.agents,    tab === 'agents')

  const current = { routing, memory, learning, agents, capabilities: { data: null, loading: false, error: null, reload: () => {} } }[tab]

  return (
    <div className="space-y-8">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-400/20">
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white/90">Intelligence</h1>
            <p className="text-sm text-white/40">AI routing, memory, learning, and agent management</p>
          </div>
        </div>
      </motion.div>

      {/* tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
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
      {API_MAP[tab] && (
        <div className="flex justify-end">
          <button onClick={current.reload}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition">
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
              {tab === 'capabilities' && <CapabilitiesTab />}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
