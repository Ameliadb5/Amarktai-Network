'use client'

import { useEffect, useState, useCallback } from 'react'
import { Zap, RefreshCw, AlertCircle } from 'lucide-react'

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

interface AgentsResponse {
  definitions: Record<string, AgentDefinition> | [string, AgentDefinition][]
  status: AgentStatusSummary
}

export default function AgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Normalize definitions: could be an object, Map serialized as entries, or array
  const definitions: AgentDefinition[] = (() => {
    if (!data?.definitions) return []
    if (Array.isArray(data.definitions)) {
      return data.definitions.map(([, def]) => def)
    }
    return Object.values(data.definitions)
  })()

  const status = data?.status

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Activity</h1>
          <p className="text-sm text-slate-500 mt-1">
            Agent definitions, capabilities, and runtime status.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status counters */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Configured', value: status.configured, color: 'text-blue-400' },
            { label: 'Running', value: status.running, color: 'text-emerald-400' },
            { label: 'Completed', value: status.completed, color: 'text-cyan-400' },
            { label: 'Failed', value: status.failed, color: 'text-red-400' },
            { label: 'Total', value: status.total, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#0A1020] border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : definitions.length === 0 ? (
        <div className="bg-[#0A1020] border border-white/8 rounded-xl p-12 text-center">
          <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No agents configured.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {definitions.map((agent) => (
            <div key={agent.type} className="bg-[#0A1020] border border-white/8 rounded-xl p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Zap className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                    <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                      {agent.type}
                    </span>
                    {agent.memoryEnabled && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        memory
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{agent.description}</p>

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {agent.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Provider / Model */}
                  <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    {agent.defaultProvider && (
                      <span>Provider: <span className="text-slate-400 font-mono">{agent.defaultProvider}</span></span>
                    )}
                    {agent.defaultModel && (
                      <span>Model: <span className="text-slate-400 font-mono">{agent.defaultModel}</span></span>
                    )}
                    {agent.canHandoff && agent.canHandoff.length > 0 && (
                      <span>Handoff: <span className="text-slate-400">{agent.canHandoff.join(', ')}</span></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Agent definitions are built-in to the runtime. Status reflects in-process task tracking.
      </p>
    </div>
  )
}
