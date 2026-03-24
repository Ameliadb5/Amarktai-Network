'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Activity,
  Zap,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingUp,
  Layers,
  RefreshCw,
  AlertCircle,
  Shield,
  GitMerge,
} from 'lucide-react'
import { format } from 'date-fns'

interface BrainEventTrace {
  id: number
  traceId: string
  appSlug: string
  taskType: string
  executionMode: string
  routedProvider: string | null
  routedModel: string | null
  validationUsed: boolean
  consensusUsed: boolean
  confidenceScore: number | null
  success: boolean
  errorMessage: string | null
  warnings: string[]
  latencyMs: number | null
  timestamp: string
}

interface BrainStats {
  totalRequests: number
  successCount: number
  errorCount: number
  avgLatencyMs: number | null
  avgConfidenceScore: number | null
}

const MODE_COLOR: Record<string, string> = {
  direct:     'text-blue-400',
  specialist: 'text-violet-400',
  review:     'text-amber-400',
  consensus:  'text-emerald-400',
}

export default function AIUsagePage() {
  const [stats, setStats] = useState<BrainStats | null>(null)
  const [events, setEvents] = useState<BrainEventTrace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/brain/events')
      if (!res.ok) throw new Error('Failed to load AI usage data')
      const data = await res.json()
      setStats(data.stats ?? null)
      setEvents(data.events ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const successRate = stats && stats.totalRequests > 0
    ? Math.round((stats.successCount / stats.totalRequests) * 100)
    : null

  const metricCards = [
    {
      label: 'Total Requests',
      value: stats?.totalRequests ?? null,
      icon: Activity,
      color: 'text-blue-400',
      borderColor: 'border-blue-500/20',
    },
    {
      label: 'Success Rate',
      value: successRate !== null ? `${successRate}%` : null,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Avg Latency',
      value: stats?.avgLatencyMs != null ? `${stats.avgLatencyMs} ms` : null,
      icon: Clock,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Avg Confidence',
      value: stats?.avgConfidenceScore != null ? `${Math.round(stats.avgConfidenceScore * 100)}%` : null,
      icon: Zap,
      color: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            AI Usage
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Brain request traces, execution modes, confidence scores, and provider routing
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * (i + 1) }}
              className={`glass rounded-2xl p-5 border ${card.borderColor}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-widest">
                  {card.label}
                </p>
              </div>
              {loading ? (
                <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
              ) : card.value !== null ? (
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-600">—</p>
                  <p className="text-xs text-slate-600 mt-1">No data received yet</p>
                </>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Execution Mode Breakdown */}
      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white" style={{ fontFamily: 'Space Grotesk' }}>
              Execution Mode Distribution
            </h2>
            <BarChart3 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex flex-wrap gap-3">
            {(['direct', 'specialist', 'review', 'consensus'] as const).map(mode => {
              const count = events.filter(e => e.executionMode === mode).length
              if (count === 0) return null
              return (
                <div key={mode} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className={`text-xs font-semibold capitalize ${MODE_COLOR[mode]}`}>{mode}</span>
                  <span className="text-xs text-slate-500">{count}</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Request Trace Log */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white" style={{ fontFamily: 'Space Grotesk' }}>
            Request Trace Log
          </h2>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
            <TrendingUp className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Live Traces
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-8 h-8 text-red-400/60 mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4">
              <Activity className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-sm text-slate-400">No AI requests logged yet</p>
            <p className="text-xs text-slate-600 mt-1.5 max-w-sm">
              Connect providers and send requests through the Brain Gateway to see execution traces here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest">Mode</th>
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden md:table-cell">App / Task</th>
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden lg:table-cell">Provider</th>
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden xl:table-cell">Confidence</th>
                  <th className="px-4 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden xl:table-cell">Flags</th>
                  <th className="px-4 py-3 text-right text-[10px] text-slate-500 font-medium uppercase tracking-widest">Latency</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <motion.tr
                    key={ev.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${ev.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ev.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {ev.success ? 'OK' : 'Error'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold capitalize ${MODE_COLOR[ev.executionMode] ?? 'text-slate-400'}`}>
                        {ev.executionMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-slate-300 font-mono">{ev.appSlug}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{ev.taskType}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-400 font-mono">{ev.routedProvider ?? '—'}</p>
                      {ev.routedModel && <p className="text-[10px] text-slate-600 font-mono truncate max-w-[140px]">{ev.routedModel}</p>}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {ev.confidenceScore !== null ? (
                        <span className={`text-xs font-semibold ${ev.confidenceScore >= 0.80 ? 'text-emerald-400' : ev.confidenceScore >= 0.60 ? 'text-amber-400' : 'text-red-400'}`}>
                          {Math.round(ev.confidenceScore * 100)}%
                        </span>
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        {ev.validationUsed && <Shield className="w-3 h-3 text-amber-400" aria-label="Validation used" />}
                        {ev.consensusUsed && <GitMerge className="w-3 h-3 text-violet-400" aria-label="Consensus used" />}
                        {ev.warnings.length > 0 && <Layers className="w-3 h-3 text-slate-500" aria-label={`${ev.warnings.length} warning(s)`} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <span className="text-xs text-slate-400 font-mono">
                          {ev.latencyMs != null ? `${ev.latencyMs} ms` : '—'}
                        </span>
                        <p className="text-[10px] text-slate-600 font-mono">
                          {format(new Date(ev.timestamp), 'MMM d HH:mm:ss')}
                        </p>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}

