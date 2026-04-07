'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Clock, Filter, Brain,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface BrainEvent {
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

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const CARD = 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl'

export default function EventsPage() {
  const [events, setEvents] = useState<BrainEvent[]>([])
  const [appEvents, setAppEvents] = useState<Array<{ id: number; eventSource: string; appSlug: string; appName?: string; eventType: string; severity: string; title: string; message: string; timestamp: string; success: boolean }>>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterApp, setFilterApp] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [showUnified, setShowUnified] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterApp) params.set('appSlug', filterApp)
      if (filterMode) params.set('executionMode', filterMode)
      if (showUnified) params.set('includeAppEvents', 'true')
      const res = await fetch(`/api/admin/events?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEvents(data.events ?? [])
      setAppEvents(data.appEvents ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [filterApp, filterMode, showUnified])

  useEffect(() => { load() }, [load])

  const apps = ['', ...Array.from(new Set(events.map(e => e.appSlug).filter(Boolean))).sort()]
  const modes = ['', ...Array.from(new Set(events.map(e => e.executionMode).filter(Boolean))).sort()]

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            AI Execution Events
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {total.toLocaleString()} total brain execution traces
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors mt-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs">Filter:</span>
        </div>
        <select
          value={filterApp}
          onChange={e => setFilterApp(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
        >
          {apps.map(a => (
            <option key={a} value={a} className="bg-[#0a0f1a] text-white">
              {a === '' ? 'All apps' : a}
            </option>
          ))}
        </select>
        <select
          value={filterMode}
          onChange={e => setFilterMode(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
        >
          {modes.map(m => (
            <option key={m} value={m} className="bg-[#0a0f1a] text-white">
              {m === '' ? 'All modes' : m}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowUnified(!showUnified)}
          className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
            showUnified
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white'
          }`}
        >
          {showUnified ? '✓ Unified View' : 'Show App Events'}
        </button>
      </motion.div>

      {/* App Events Section (unified view) */}
      {showUnified && appEvents.length > 0 && (
        <motion.div variants={fadeUp} className={`${CARD} p-4 space-y-2`}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">App Events ({appEvents.length})</h3>
          <div className="divide-y divide-white/[0.04]">
            {appEvents.map(e => (
              <div key={`app-${e.id}`} className="flex items-center gap-3 py-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${
                  e.severity === 'error' || e.severity === 'critical' ? 'bg-red-400' :
                  e.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                <span className="text-slate-500 font-mono w-24 flex-shrink-0">{e.appSlug}</span>
                <span className="text-slate-300 flex-1 truncate">{e.title}</span>
                <span className="text-slate-600 font-mono">{e.eventType}</span>
                <span className="text-slate-600 font-mono">{formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Loading events…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-slate-400">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Brain className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-500">No AI execution events recorded yet.</p>
        </div>
      ) : (
        <motion.div variants={fadeUp} className={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-mono border-b border-white/[0.06]">
                  <th className="px-4 py-3 w-6">Status</th>
                  <th className="px-4 py-3">App</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 text-right">Latency</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {events.map(ev => (
                  <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      {ev.success ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs font-mono">{ev.appSlug || '—'}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{ev.taskType || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {ev.executionMode || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{ev.routedProvider || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-[10px] font-mono truncate max-w-[120px]">
                      {ev.routedModel || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ev.latencyMs != null ? (
                        <span className="text-[10px] font-mono text-slate-400 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {ev.latencyMs < 1000
                            ? `${ev.latencyMs}ms`
                            : `${(ev.latencyMs / 1000).toFixed(1)}s`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[10px] text-slate-600 font-mono whitespace-nowrap">
                      {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > events.length && (
            <div className="px-4 py-3 border-t border-white/[0.06] text-center text-xs text-slate-500">
              Showing {events.length} of {total.toLocaleString()} total events
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
