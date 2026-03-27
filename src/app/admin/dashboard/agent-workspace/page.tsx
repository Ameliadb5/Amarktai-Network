'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bot, RefreshCw, ChevronDown, ChevronUp, Shield, Database,
  Zap, Brain, Users, TrendingUp, Code, Globe,
} from 'lucide-react'

interface AgentDefinition {
  type: string
  name: string
  description: string
  capabilities: string[]
  requiredPermissions: string[]
  canHandoff: string[]
  memoryEnabled: boolean
  defaultProvider: string
  defaultModel: string
}

interface AgentStatusSummary {
  configured: number
  running: number
  completed: number
  failed: number
  total: number
}

const AGENT_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  planner:          Brain,
  router:           Zap,
  validator:        Shield,
  memory:           Database,
  retrieval:        Database,
  creative:         Zap,
  campaign:         TrendingUp,
  trading_analyst:  TrendingUp,
  app_ops:          Globe,
  learning:         Brain,
  security:         Shield,
  voice:            Users,
  travel_planner:   Globe,
  developer:        Code,
  support_community: Users,
  healing:          Shield,
}

const AGENT_COLORS: Record<string, string> = {
  planner:          'text-blue-400',
  router:           'text-cyan-400',
  validator:        'text-emerald-400',
  memory:           'text-purple-400',
  retrieval:        'text-violet-400',
  creative:         'text-pink-400',
  campaign:         'text-orange-400',
  trading_analyst:  'text-yellow-400',
  app_ops:          'text-sky-400',
  learning:         'text-indigo-400',
  security:         'text-red-400',
  voice:            'text-emerald-400',
  travel_planner:   'text-sky-400',
  developer:        'text-teal-400',
  support_community: 'text-rose-400',
  healing:          'text-lime-400',
}

export default function AgentWorkspacePage() {
  const [defs, setDefs]         = useState<[string, AgentDefinition][]>([])
  const [status, setStatus]     = useState<AgentStatusSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/agents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const defMap = data.definitions instanceof Map
        ? Array.from(data.definitions.entries())
        : Array.isArray(data.definitions)
        ? data.definitions
        : Object.entries(data.definitions ?? {})
      setDefs(defMap as [string, AgentDefinition][])
      setStatus(data.status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-yellow-400" />
            Agent Workspace
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View, inspect, and understand all configured agents in the AmarktAI Network.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Status summary */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Configured', value: status.configured, color: 'text-white'        },
            { label: 'Total',      value: status.total,       color: 'text-slate-300'    },
            { label: 'Running',    value: status.running,     color: 'text-blue-400'     },
            { label: 'Completed',  value: status.completed,   color: 'text-emerald-400'  },
            { label: 'Failed',     value: status.failed,      color: 'text-red-400'      },
          ].map(m => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-xl bg-white/3 border border-white/8 text-center"
            >
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Agent cards */}
      {loading && !defs.length ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-7 h-7 text-yellow-400 animate-spin" />
        </div>
      ) : defs.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white/3 border border-white/8 text-center text-slate-500">
          No agent definitions loaded.
        </div>
      ) : (
        <div className="space-y-3">
          {defs.map(([key, def], i) => {
            const Icon = AGENT_ICONS[key] ?? Bot
            const color = AGENT_COLORS[key] ?? 'text-slate-400'
            const isOpen = expanded === key
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl bg-white/3 border border-white/8 overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/3 transition-colors"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{def.name}</span>
                      <span className="text-xs font-mono text-slate-600 px-1.5 py-0.5 rounded bg-white/5">{key}</span>
                      {def.memoryEnabled && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">memory</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5 text-left">{def.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span>{def.capabilities.length} capabilities</span>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-white/8 p-4 grid sm:grid-cols-2 gap-4"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Capabilities</p>
                      <ul className="space-y-1">
                        {def.capabilities.map(c => (
                          <li key={c} className="text-xs text-slate-300 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-current flex-shrink-0 opacity-50" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Can Hand Off To</p>
                        <div className="flex flex-wrap gap-1">
                          {def.canHandoff.map(h => (
                            <span key={h} className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono">{h}</span>
                          ))}
                          {def.canHandoff.length === 0 && <span className="text-xs text-slate-600">None</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Default Model</p>
                        <span className="text-xs font-mono text-violet-400">{def.defaultProvider ?? 'auto'} / {def.defaultModel ?? 'auto'}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Required Permissions</p>
                        <div className="flex flex-wrap gap-1">
                          {def.requiredPermissions.map(p => (
                            <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
