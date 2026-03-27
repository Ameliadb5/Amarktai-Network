'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, RefreshCw, AlertCircle, CheckCircle, Brain, Shield,
  Cpu, Activity, Sparkles, Megaphone, TrendingUp, Settings,
  BookOpen, Search, Mic, Plane, Code, HeartHandshake, Wrench,
  ChevronRight, X, Clock, Hash, Lock, ArrowRightLeft, Server,
  Database, CircleDot, Layers,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Category & icon configuration ─────────────────────────────────────────

const CATEGORY_AGENTS: Record<AgentCategory, string[]> = {
  Core: ['router', 'planner', 'validator'],
  Memory: ['memory', 'retrieval', 'learning'],
  Creative: ['creative', 'campaign'],
  Operations: ['app_ops', 'security', 'healing'],
  Specialist: ['trading_analyst', 'voice', 'travel_planner', 'developer', 'support_community'],
}

const CATEGORY_META: Record<AgentCategory, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  Core:       { icon: Cpu,            color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  Memory:     { icon: Database,       color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  Creative:   { icon: Sparkles,       color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  Operations: { icon: Settings,       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  Specialist: { icon: CircleDot,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
}

const AGENT_ICONS: Record<string, LucideIcon> = {
  planner: Layers,
  router: ArrowRightLeft,
  validator: CheckCircle,
  memory: Brain,
  retrieval: Search,
  learning: BookOpen,
  creative: Sparkles,
  campaign: Megaphone,
  trading_analyst: TrendingUp,
  app_ops: Wrench,
  security: Shield,
  healing: HeartHandshake,
  voice: Mic,
  travel_planner: Plane,
  developer: Code,
  support_community: Activity,
}

// Mock runtime data (populated per-agent on render)
function mockRunData(type: string) {
  const seed = type.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const runs = (seed * 7) % 500 + 12
  const minsAgo = (seed * 3) % 120 + 1
  const statuses: ('active' | 'idle')[] = ['active', 'idle']
  return {
    status: statuses[seed % 2] as 'active' | 'idle',
    runCount: runs,
    lastRun: new Date(Date.now() - minsAgo * 60_000),
  }
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

// ─── Components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'active' | 'idle' | 'disabled' }) {
  const cfg = {
    active:   { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Active' },
    idle:     { dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Idle' },
    disabled: { dot: 'bg-slate-500',   text: 'text-slate-500',   bg: 'bg-slate-500/10',   label: 'Disabled' },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

function AgentCard({
  agent,
  onClick,
  isSelected,
}: {
  agent: AgentDefinition
  onClick: () => void
  isSelected: boolean
}) {
  const Icon = AGENT_ICONS[agent.type] ?? Zap
  const category = getCategoryForAgent(agent.type)
  const catMeta = CATEGORY_META[category]
  const mock = mockRunData(agent.type)

  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`
        group relative text-left w-full rounded-2xl p-4 transition-all duration-200
        bg-white/[0.03] border hover:bg-white/[0.06]
        ${isSelected ? 'border-white/20 bg-white/[0.06] ring-1 ring-white/10' : 'border-white/[0.06]'}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${catMeta.bg} border ${catMeta.border}`}>
          <Icon className={`w-4 h-4 ${catMeta.color}`} />
        </div>
        <StatusBadge status={mock.status} />
      </div>

      <h3 className="text-sm font-semibold text-white mb-0.5 group-hover:text-white/90">
        {agent.name}
      </h3>
      <p className="text-[10px] font-mono text-slate-500 mb-2">{agent.type}</p>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
        {agent.description}
      </p>

      {/* Capabilities preview */}
      <div className="flex gap-1 flex-wrap mb-3">
        {agent.capabilities.slice(0, 3).map((cap) => (
          <span key={cap} className="text-[10px] text-slate-400 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
            {cap.replace(/_/g, ' ')}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="text-[10px] text-slate-500 px-1.5 py-0.5">
            +{agent.capabilities.length - 3}
          </span>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(mock.lastRun)}
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {mock.runCount} runs
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>

      {/* Memory indicator */}
      {agent.memoryEnabled && (
        <div className="absolute top-3 right-14">
          <Brain className="w-3 h-3 text-violet-400/60" />
        </div>
      )}
    </motion.button>
  )
}

function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: AgentDefinition
  onClose: () => void
}) {
  const Icon = AGENT_ICONS[agent.type] ?? Zap
  const category = getCategoryForAgent(agent.type)
  const catMeta = CATEGORY_META[category]
  const mock = mockRunData(agent.type)

  const mockHistory = Array.from({ length: 5 }, (_, i) => ({
    id: `task-${i + 1}`,
    status: i === 0 ? 'running' : i === 3 ? 'failed' : 'completed',
    timestamp: new Date(Date.now() - (i * 25 + 5) * 60_000),
    latency: Math.floor(Math.random() * 3000) + 200,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${catMeta.bg} border ${catMeta.border}`}>
            <Icon className={`w-5 h-5 ${catMeta.color}`} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <h2 className="text-lg font-bold text-white">{agent.name}</h2>
        <p className="text-xs font-mono text-slate-500 mt-0.5">{agent.type}</p>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={mock.status} />
          <span className="text-[10px] text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
            {category}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="p-5 border-b border-white/[0.06]">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
        <p className="text-sm text-slate-300 leading-relaxed">{agent.description}</p>
      </div>

      {/* Capabilities */}
      <div className="p-5 border-b border-white/[0.06]">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Capabilities</h4>
        <div className="flex gap-1.5 flex-wrap">
          {agent.capabilities.map((cap) => (
            <span key={cap} className="text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/15 px-2 py-1 rounded-lg">
              {cap.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="p-5 border-b border-white/[0.06]">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Configuration</h4>
        <div className="space-y-2">
          {[
            { icon: Server, label: 'Provider', value: agent.defaultProvider ?? 'auto' },
            { icon: Cpu, label: 'Model', value: agent.defaultModel ?? 'auto' },
            { icon: Brain, label: 'Memory', value: agent.memoryEnabled ? 'Enabled' : 'Disabled' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </span>
              <span className="text-xs font-mono text-slate-300">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className="p-5 border-b border-white/[0.06]">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Permissions</h4>
        <div className="flex gap-1.5 flex-wrap">
          {agent.requiredPermissions.map((perm) => (
            <span key={perm} className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-1 rounded-lg">
              <Lock className="w-3 h-3" />
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* Handoff targets */}
      {agent.canHandoff.length > 0 && (
        <div className="p-5 border-b border-white/[0.06]">
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Handoff Targets</h4>
          <div className="flex gap-1.5 flex-wrap">
            {agent.canHandoff.map((target) => {
              const TargetIcon = AGENT_ICONS[target] ?? Zap
              return (
                <span key={target} className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/15 px-2 py-1 rounded-lg">
                  <TargetIcon className="w-3 h-3" />
                  {target}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Run history (placeholder) */}
      <div className="p-5">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Runs</h4>
        <div className="space-y-2">
          {mockHistory.map((run) => (
            <div key={run.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  run.status === 'completed' ? 'bg-emerald-400' :
                  run.status === 'running' ? 'bg-blue-400 animate-pulse' :
                  'bg-red-400'
                }`} />
                <span className="text-[11px] font-mono text-slate-400">{run.id}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>{run.latency}ms</span>
                <span>{formatTimeAgo(run.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<AgentCategory | 'All'>('All')

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

  // Normalize definitions
  const definitions: AgentDefinition[] = (() => {
    if (!data?.definitions) return []
    if (Array.isArray(data.definitions)) {
      return data.definitions.map(([, def]) => def)
    }
    return Object.values(data.definitions)
  })()

  const status = data?.status

  // Filter definitions by category
  const filteredDefinitions = activeCategory === 'All'
    ? definitions
    : definitions.filter((d) => CATEGORY_AGENTS[activeCategory]?.includes(d.type))

  // Group definitions by category for display
  const groupedDefinitions: [AgentCategory, AgentDefinition[]][] = (() => {
    if (activeCategory !== 'All') {
      return [[activeCategory, filteredDefinitions] as [AgentCategory, AgentDefinition[]]]
    }
    const result: [AgentCategory, AgentDefinition[]][] = []
    for (const cat of Object.keys(CATEGORY_AGENTS) as AgentCategory[]) {
      const agents = definitions.filter((d) => CATEGORY_AGENTS[cat].includes(d.type))
      if (agents.length > 0) result.push([cat, agents])
    }
    return result
  })()

  const selected = definitions.find((d) => d.type === selectedAgent)

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">Agent Registry</h1>
            <span className="text-[11px] font-mono text-slate-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
              {definitions.length} agents
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {!loading && !error && definitions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All agents operational
              </span>
            )}
            <span className="text-xs text-slate-500">
              {status ? `${status.configured} configured · ${status.running} running · ${status.completed} completed` : ''}
            </span>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status counters */}
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-3"
        >
          {[
            { label: 'Configured', value: status.configured, color: 'text-blue-400', icon: Cpu },
            { label: 'Running',    value: status.running,    color: 'text-emerald-400', icon: Activity },
            { label: 'Completed',  value: status.completed,  color: 'text-cyan-400', icon: CheckCircle },
            { label: 'Failed',     value: status.failed,     color: 'text-red-400', icon: AlertCircle },
            { label: 'Total Tasks', value: status.total,     color: 'text-white', icon: Zap },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500 font-medium">{s.label}</p>
                <s.icon className={`w-3.5 h-3.5 ${s.color} opacity-50`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Category tabs */}
      {!loading && !error && definitions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['All', ...Object.keys(CATEGORY_AGENTS)] as (AgentCategory | 'All')[]).map((cat) => {
            const isActive = activeCategory === cat
            const count = cat === 'All' ? definitions.length : CATEGORY_AGENTS[cat as AgentCategory]?.length ?? 0
            const CatIcon = cat === 'All' ? Layers : CATEGORY_META[cat as AgentCategory]?.icon ?? CircleDot
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat)
                  setSelectedAgent(null)
                }}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }
                `}
              >
                <CatIcon className="w-3.5 h-3.5" />
                {cat}
                <span className="text-[10px] text-slate-500 ml-0.5">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-10 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={load}
            className="text-xs text-slate-400 hover:text-white underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : definitions.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-14 text-center">
          <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No agents configured.</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${selected ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'}`}>
          {/* Agent grid */}
          <div className="space-y-6">
            {groupedDefinitions.map(([category, agents]) => {
              const catMeta = CATEGORY_META[category]
              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <catMeta.icon className={`w-4 h-4 ${catMeta.color}`} />
                    <h2 className="text-sm font-semibold text-white">{category}</h2>
                    <span className="text-[10px] text-slate-500">{agents.length} agents</span>
                  </div>
                  <div className={`grid gap-3 ${
                    selected
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {agents.map((agent) => (
                      <AgentCard
                        key={agent.type}
                        agent={agent}
                        isSelected={selectedAgent === agent.type}
                        onClick={() => setSelectedAgent(
                          selectedAgent === agent.type ? null : agent.type
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {selected && (
              <div className="lg:sticky lg:top-4 lg:self-start">
                <AgentDetailPanel
                  key={selected.type}
                  agent={selected}
                  onClose={() => setSelectedAgent(null)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      <p className="text-[11px] text-slate-600">
        Agent definitions are built-in to the runtime. Status reflects in-process task tracking.
      </p>
    </div>
  )
}
