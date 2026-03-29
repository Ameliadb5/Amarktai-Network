'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, RefreshCw, AlertCircle, CheckCircle, Brain, Shield,
  Cpu, Activity, Sparkles, Megaphone, TrendingUp, Settings,
  BookOpen, Search, Mic, Plane, Code, HeartHandshake, Wrench,
  ChevronDown, X, Clock, Hash, Lock, ArrowRightLeft, Server,
  Database, CircleDot, Layers, Filter, Radio, BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AgentDefinition {
  type: string
  name: string
  description: string
  capabilities: string[]
  requiredPermissions: string[]
  canHandoff: string[]
  memoryEnabled: boolean
  defaultProvider?: string
  defaultModel?: string
}

interface AgentStatusSummary {
  configured: number
  running: number
  completed: number
  failed: number
  total: number
}

interface AgentsResponse {
  definitions: Record<string, AgentDefinition> | [string, AgentDefinition][]
  status: AgentStatusSummary
}

type AgentCategory = 'Core' | 'Memory' | 'Creative' | 'Operations' | 'Specialist'

/* ─── Configuration ──────────────────────────────────────────────────────── */

const CATEGORY_AGENTS: Record<AgentCategory, string[]> = {
  Core: ['router', 'planner', 'validator'],
  Memory: ['memory', 'retrieval', 'learning'],
  Creative: ['creative', 'campaign'],
  Operations: ['app_ops', 'security', 'healing'],
  Specialist: ['trading_analyst', 'voice', 'travel_planner', 'developer', 'support_community'],
}

const CATEGORY_META: Record<AgentCategory, { icon: LucideIcon; color: string; accent: string; bg: string; border: string; glow: string }> = {
  Core:       { icon: Cpu,       color: 'text-blue-400',    accent: '#60a5fa', bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    glow: 'shadow-blue-500/5' },
  Memory:     { icon: Database,  color: 'text-violet-400',  accent: '#a78bfa', bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  glow: 'shadow-violet-500/5' },
  Creative:   { icon: Sparkles,  color: 'text-amber-400',   accent: '#fbbf24', bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   glow: 'shadow-amber-500/5' },
  Operations: { icon: Settings,  color: 'text-emerald-400', accent: '#34d399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/5' },
  Specialist: { icon: CircleDot, color: 'text-cyan-400',    accent: '#22d3ee', bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    glow: 'shadow-cyan-500/5' },
}

const AGENT_ICONS: Record<string, LucideIcon> = {
  planner: Layers, router: ArrowRightLeft, validator: CheckCircle,
  memory: Brain, retrieval: Search, learning: BookOpen,
  creative: Sparkles, campaign: Megaphone, trading_analyst: TrendingUp,
  app_ops: Wrench, security: Shield, healing: HeartHandshake,
  voice: Mic, travel_planner: Plane, developer: Code, support_community: Activity,
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function mockRunData(type: string) {
  const seed = type.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const statuses: ('running' | 'idle' | 'error')[] = ['running', 'idle', 'error']
  return {
    status: statuses[seed % 3] as 'running' | 'idle' | 'error',
    runCount: (seed * 7) % 500 + 12,
    lastRun: new Date(Date.now() - ((seed * 3) % 120 + 1) * 60_000),
  }
}

function mockActivityFeed(definitions: AgentDefinition[]) {
  return definitions.slice(0, 8).map((d, i) => {
    const seed = d.type.charCodeAt(0) + i
    const actions = ['Processed request', 'Completed handoff', 'Validated output', 'Generated response', 'Ran analysis', 'Queried memory', 'Dispatched task', 'Resolved ticket']
    return {
      id: `evt-${seed}-${i}`,
      agentType: d.type,
      agentName: d.name,
      action: actions[seed % actions.length],
      timestamp: new Date(Date.now() - (i * 12 + 3) * 60_000),
      status: i === 2 ? 'error' as const : i === 0 ? 'running' as const : 'completed' as const,
      latencyMs: Math.floor((seed * 17) % 2800) + 120,
    }
  })
}

function formatTimeAgo(date: Date): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getCategoryForAgent(type: string): AgentCategory {
  for (const [cat, types] of Object.entries(CATEGORY_AGENTS)) {
    if (types.includes(type)) return cat as AgentCategory
  }
  return 'Specialist'
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: 'running' | 'idle' | 'error' }) {
  const cfg = {
    running: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Running' },
    idle:    { dot: 'bg-slate-400',   text: 'text-slate-400',   bg: 'bg-slate-500/10',   label: 'Idle' },
    error:   { dot: 'bg-red-400',     text: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Error' },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, color, icon: Icon, delay }: { label: string; value: number; color: string; icon: LucideIcon; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">{label}</p>
        <div className={`p-1.5 rounded-lg bg-white/[0.04] ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`text-3xl font-extrabold tracking-tight ${color}`}>{value}</p>
    </motion.div>
  )
}

function AgentCard({ agent, onClick, isExpanded }: { agent: AgentDefinition; onClick: () => void; isExpanded: boolean }) {
  const Icon = AGENT_ICONS[agent.type] ?? Zap
  const category = getCategoryForAgent(agent.type)
  const meta = CATEGORY_META[category]
  const run = mockRunData(agent.type)

  return (
    <motion.div layout className="flex flex-col">
      <motion.button
        layout="position"
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.99 }}
        className={`group relative text-left w-full rounded-2xl p-4 transition-all duration-200
          bg-white/[0.03] backdrop-blur-xl border hover:bg-white/[0.05] hover:shadow-lg ${meta.glow}
          ${isExpanded ? 'border-white/[0.15] bg-white/[0.05] ring-1 ring-white/[0.08]' : 'border-white/[0.06]'}`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl ${meta.bg} border ${meta.border}`}>
            <Icon className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div className="flex items-center gap-1.5">
            {agent.memoryEnabled && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/15 px-1.5 py-0.5 rounded-full">
                <Brain className="w-2.5 h-2.5" /> Memory
              </span>
            )}
            {agent.canHandoff.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 px-1.5 py-0.5 rounded-full">
                <ArrowRightLeft className="w-2.5 h-2.5" /> Handoff
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-bold text-white mb-0.5">{agent.name}</h3>
        <p className="text-[10px] font-mono text-slate-500 mb-1.5">{agent.type}</p>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{agent.description}</p>

        {/* Capability pills */}
        <div className="flex gap-1 flex-wrap mb-3">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span key={cap} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${meta.bg} ${meta.border} ${meta.color}`}>
              {cap.replace(/_/g, ' ')}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] text-slate-500 px-1 py-0.5">+{agent.capabilities.length - 3}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.05]">
          <StatusDot status={run.status} />
          <div className="flex items-center gap-2.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{run.runCount}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(run.lastRun)}</span>
          </div>
        </div>
      </motion.button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] divide-y divide-white/[0.04]">
              {/* Description */}
              <div className="p-4">
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Description</h4>
                <p className="text-[13px] text-slate-300 leading-relaxed">{agent.description}</p>
              </div>

              {/* All capabilities */}
              <div className="p-4">
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Capabilities</h4>
                <div className="flex gap-1.5 flex-wrap">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="text-[11px] text-violet-300 bg-violet-500/10 border border-violet-500/15 px-2 py-1 rounded-lg">
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Configuration row */}
              <div className="p-4 grid grid-cols-3 gap-3">
                {[
                  { icon: Server, label: 'Provider', value: agent.defaultProvider ?? 'auto' },
                  { icon: Cpu, label: 'Model', value: agent.defaultModel ?? 'auto' },
                  { icon: Brain, label: 'Memory', value: agent.memoryEnabled ? 'Enabled' : 'Off' },
                ].map((c) => (
                  <div key={c.label} className="space-y-1">
                    <p className="text-[10px] text-slate-500 flex items-center gap-1"><c.icon className="w-3 h-3" />{c.label}</p>
                    <p className="text-xs font-mono text-slate-300">{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Permissions */}
              <div className="p-4">
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Permissions</h4>
                <div className="flex gap-1.5 flex-wrap">
                  {agent.requiredPermissions.map((perm) => (
                    <span key={perm} className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-1 rounded-lg">
                      <Lock className="w-3 h-3" />{perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Handoff targets */}
              {agent.canHandoff.length > 0 && (
                <div className="p-4">
                  <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Handoff Targets</h4>
                  <div className="flex gap-1.5 flex-wrap">
                    {agent.canHandoff.map((t) => {
                      const TIcon = AGENT_ICONS[t] ?? Zap
                      return (
                        <span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 px-2 py-1 rounded-lg">
                          <TIcon className="w-3 h-3" />{t}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function AgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<AgentCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/agents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const definitions: AgentDefinition[] = useMemo(() => {
    if (!data?.definitions) return []
    if (Array.isArray(data.definitions)) return data.definitions.map(([, def]) => def)
    return Object.values(data.definitions)
  }, [data])

  const status = data?.status
  const query = searchQuery.toLowerCase().trim()

  const filteredDefinitions = useMemo(() => {
    let list = definitions
    if (activeCategory !== 'All') {
      list = list.filter((d) => CATEGORY_AGENTS[activeCategory]?.includes(d.type))
    }
    if (query) {
      list = list.filter((d) => d.name.toLowerCase().includes(query) || d.type.toLowerCase().includes(query))
    }
    return list
  }, [definitions, activeCategory, query])

  const groupedDefinitions = useMemo<[AgentCategory, AgentDefinition[]][]>(() => {
    if (activeCategory !== 'All') {
      return filteredDefinitions.length > 0 ? [[activeCategory, filteredDefinitions]] : []
    }
    const result: [AgentCategory, AgentDefinition[]][] = []
    for (const cat of Object.keys(CATEGORY_AGENTS) as AgentCategory[]) {
      const agents = filteredDefinitions.filter((d) => CATEGORY_AGENTS[cat].includes(d.type))
      if (agents.length > 0) result.push([cat, agents])
    }
    return result
  }, [filteredDefinitions, activeCategory])

  const activityFeed = useMemo(() => mockActivityFeed(definitions), [definitions])

  return (
    <div className="max-w-[1440px] space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Agent Registry</h1>
            <span className="text-[11px] font-mono text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5 rounded-full">
              {definitions.length} agents
            </span>
          </div>
          {!loading && !error && definitions.length > 0 && (
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                System nominal
              </span>
              <span className="text-slate-600">·</span>
              Runtime monitoring active
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Statistics ──────────────────────────────────────────────────── */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Configured" value={status.configured} color="text-blue-400" icon={Cpu} delay={0} />
          <StatCard label="Running" value={status.running} color="text-emerald-400" icon={Activity} delay={0.05} />
          <StatCard label="Completed" value={status.completed} color="text-cyan-400" icon={CheckCircle} delay={0.1} />
          <StatCard label="Failed" value={status.failed} color="text-red-400" icon={AlertCircle} delay={0.15} />
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      {!loading && !error && definitions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-slate-500 hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <Filter className="w-3.5 h-3.5 text-slate-600 mr-1 flex-shrink-0" />
            {(['All', ...Object.keys(CATEGORY_AGENTS)] as (AgentCategory | 'All')[]).map((cat) => {
              const isActive = activeCategory === cat
              const CatIcon = cat === 'All' ? Layers : CATEGORY_META[cat as AgentCategory]?.icon ?? CircleDot
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setExpandedAgent(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap
                    ${isActive
                      ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                      : 'text-slate-500 hover:text-white hover:bg-white/[0.04] border border-transparent'}`}
                >
                  <CatIcon className="w-3 h-3" />
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-12 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={load} className="text-xs text-slate-400 hover:text-white underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : filteredDefinitions.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-14 text-center">
          <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{query ? 'No agents match your search.' : 'No agents configured.'}</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_340px]">
          {/* Agent grid */}
          <div className="space-y-8">
            {groupedDefinitions.map(([category, agents], gi) => {
              const catMeta = CATEGORY_META[category]
              return (
                <motion.section
                  key={category}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06, duration: 0.35 }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`p-1.5 rounded-lg ${catMeta.bg} border ${catMeta.border}`}>
                      <catMeta.icon className={`w-3.5 h-3.5 ${catMeta.color}`} />
                    </div>
                    <h2 className="text-sm font-bold text-white">{category}</h2>
                    <span className="text-[10px] text-slate-600 font-mono">{agents.length}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent ml-2" />
                  </div>
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {agents.map((agent) => (
                      <AgentCard
                        key={agent.type}
                        agent={agent}
                        isExpanded={expandedAgent === agent.type}
                        onClick={() => setExpandedAgent(expandedAgent === agent.type ? null : agent.type)}
                      />
                    ))}
                  </div>
                </motion.section>
              )
            })}
          </div>

          {/* Activity feed sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden"
            >
              <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white tracking-wide">Activity Feed</h3>
                <span className="ml-auto text-[10px] text-slate-600 font-mono">live</span>
              </div>
              <div className="divide-y divide-white/[0.03] max-h-[420px] overflow-y-auto">
                {activityFeed.map((evt) => {
                  const EvtIcon = AGENT_ICONS[evt.agentType] ?? Zap
                  const cat = getCategoryForAgent(evt.agentType)
                  const catColor = CATEGORY_META[cat].color
                  return (
                    <div key={evt.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-2.5">
                        <EvtIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${catColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white truncate">{evt.agentName}</span>
                            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${
                              evt.status === 'completed' ? 'bg-emerald-400' :
                              evt.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-red-400'
                            }`} />
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{evt.action}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-mono text-slate-600">{evt.latencyMs}ms</p>
                          <p className="text-[10px] text-slate-600">{formatTimeAgo(evt.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Quick summary */}
            {status && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide">Task Summary</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Total tasks', value: status.total, bar: 100, color: 'bg-white/20' },
                    { label: 'Completed', value: status.completed, bar: status.total ? (status.completed / status.total) * 100 : 0, color: 'bg-emerald-500' },
                    { label: 'Failed', value: status.failed, bar: status.total ? (status.failed / status.total) * 100 : 0, color: 'bg-red-500' },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="font-mono text-slate-300">{row.value}</span>
                      </div>
                      <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full transition-all`} style={{ width: `${row.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </aside>
        </div>
      )}

      <p className="text-[11px] text-slate-600 pt-2">
        Agent definitions are built-in to the runtime. Status reflects in-process task tracking.
      </p>
    </div>
  )
}
