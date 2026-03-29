'use client'

import { useEffect, useState, useCallback } from 'react'
import { Layers, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react'

interface ModelEntry {
  provider: string
  model_id: string
  display_name: string
  cost_tier: string
  latency_tier: string
  roles: string[]
  capabilities: string[]
  enabled: boolean
  health: string
  context_window?: number
  fallback_priority?: number
  validator_eligible?: boolean
  specialist_domains?: string[]
}

interface ModelsResponse {
  models: ModelEntry[]
  total: number
  registrySize: number
}

const TIER_COLORS: Record<string, string> = {
  free: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  ultra_low: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  fast: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  moderate: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  slow: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10',
  configured: 'text-blue-400 bg-blue-500/10',
  degraded: 'text-amber-400 bg-amber-500/10',
  error: 'text-red-400 bg-red-500/10',
  unconfigured: 'text-slate-500 bg-slate-500/10',
  disabled: 'text-slate-600 bg-slate-500/10',
  down: 'text-red-400 bg-red-500/10',
  unknown: 'text-slate-400 bg-slate-500/10',
}

export default function ModelsPage() {
  const [data, setData] = useState<ModelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterProvider, setFilterProvider] = useState<string | null>(null)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const enabledCount = data?.models.filter(m => m.enabled).length ?? 0
  const providers = [...new Set(data?.models.map(m => m.provider) ?? [])]
  const filteredModels = (data?.models ?? []).filter(m => !filterProvider || m.provider === filterProvider)

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Model Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            All registered AI models — providers, costs, latency, and roles.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Models', value: String(data.registrySize) },
            { label: 'Enabled', value: String(enabledCount) },
            { label: 'Providers', value: String(providers.length) },
            { label: 'Shown', value: String(data.total) },
          ].map(stat => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      {data && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-500">Filter by provider:</span>
          <button
            onClick={() => setFilterProvider(null)}
            className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${!filterProvider ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-white'}`}
          >
            All
          </button>
          {providers.map(p => (
            <button
              key={p}
              onClick={() => setFilterProvider(p)}
              className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${filterProvider === p ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-white'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No models registered.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <span className="text-xs text-slate-500">{filteredModels.length} models{filterProvider ? ` from ${filterProvider}` : ' in registry'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredModels.map((model) => {
                  const modelKey = `${model.provider}:${model.model_id}`
                  const isExpanded = expandedModel === modelKey
                  return (
                    <>
                      <tr
                        key={modelKey}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setExpandedModel(isExpanded ? null : modelKey)}
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                            {model.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-white">{model.display_name || model.model_id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border ${TIER_COLORS[model.cost_tier] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                            {model.cost_tier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border ${TIER_COLORS[model.latency_tier] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                            {model.latency_tier}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {model.roles?.slice(0, 3).map(role => (
                              <span key={role} className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                {role}
                              </span>
                            ))}
                            {(model.roles?.length ?? 0) > 3 && (
                              <span className="text-[10px] text-slate-500">+{(model.roles?.length ?? 0) - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${HEALTH_COLORS[model.health] ?? HEALTH_COLORS.unknown}`}>
                            {model.health ?? 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${model.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${model.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                              {model.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${modelKey}-detail`}>
                          <td colSpan={7} className="px-4 py-4 bg-white/[0.01]">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                              <div>
                                <p className="text-slate-500 font-medium mb-1">Model ID</p>
                                <p className="text-slate-300 font-mono">{model.model_id}</p>
                              </div>
                              {model.context_window && (
                                <div>
                                  <p className="text-slate-500 font-medium mb-1">Context Window</p>
                                  <p className="text-slate-300">{model.context_window.toLocaleString()} tokens</p>
                                </div>
                              )}
                              {model.fallback_priority !== undefined && (
                                <div>
                                  <p className="text-slate-500 font-medium mb-1">Fallback Priority</p>
                                  <p className="text-slate-300">#{model.fallback_priority}</p>
                                </div>
                              )}
                              {model.validator_eligible !== undefined && (
                                <div>
                                  <p className="text-slate-500 font-medium mb-1">Validator Eligible</p>
                                  <p className={model.validator_eligible ? 'text-emerald-400' : 'text-slate-500'}>
                                    {model.validator_eligible ? 'Yes' : 'No'}
                                  </p>
                                </div>
                              )}
                              <div className="sm:col-span-2">
                                <p className="text-slate-500 font-medium mb-1">Capabilities</p>
                                <div className="flex gap-1 flex-wrap">
                                  {model.capabilities?.map(cap => (
                                    <span key={cap} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                      {cap}
                                    </span>
                                  ))}
                                  {(!model.capabilities || model.capabilities.length === 0) && (
                                    <span className="text-slate-600">None reported</span>
                                  )}
                                </div>
                              </div>
                              {model.specialist_domains && model.specialist_domains.length > 0 && (
                                <div className="sm:col-span-3">
                                  <p className="text-slate-500 font-medium mb-1">Specialist Domains</p>
                                  <div className="flex gap-1 flex-wrap">
                                    {model.specialist_domains.map(d => (
                                      <span key={d} className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600">
        Model registry is defined in code. Entries reflect the current build configuration.
      </p>
    </div>
  )
}
