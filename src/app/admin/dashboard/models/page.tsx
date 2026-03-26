'use client'

import { useEffect, useState, useCallback } from 'react'
import { Layers, RefreshCw, AlertCircle } from 'lucide-react'

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
  degraded: 'text-amber-400 bg-amber-500/10',
  down: 'text-red-400 bg-red-500/10',
  unknown: 'text-slate-400 bg-slate-500/10',
}

export default function ModelsPage() {
  const [data, setData] = useState<ModelsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="max-w-5xl space-y-5">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
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
            <div key={stat.label} className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#0A1020] border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : !data || data.total === 0 ? (
        <div className="bg-[#0A1020] border border-white/8 rounded-xl p-12 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No models registered.</p>
        </div>
      ) : (
        <div className="bg-[#0A1020] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <span className="text-xs text-slate-500">{data.total} models in registry</span>
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
                {data.models.map((model) => (
                  <tr key={`${model.provider}:${model.model_id}`} className="hover:bg-white/[0.02] transition-colors">
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
                        {model.roles?.map(role => (
                          <span key={role} className="text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${HEALTH_COLORS[model.health] ?? HEALTH_COLORS.unknown}`}>
                        {model.health ?? 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${model.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${model.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        {model.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
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
