'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  Flame,
  Filter,
  RefreshCw,
  Package,
  Clock,
} from 'lucide-react'

interface AppEvent {
  id: number
  eventType: string
  severity: string
  title: string
  message?: string | null
  timestamp: string
  product: { name: string }
}

const severityConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof Info }
> = {
  info: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Info,
  },
  warning: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle,
  },
  error: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: AlertCircle,
  },
  critical: {
    color: 'text-red-500',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    icon: Flame,
  },
}

const filters = ['all', 'info', 'warning', 'error', 'critical'] as const
type SeverityFilter = (typeof filters)[number]

export default function EventsPage() {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>('all')

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) throw new Error('Failed to load events')
      const data = await res.json()
      setEvents(data.recentEvents ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const filtered =
    activeFilter === 'all'
      ? events
      : events.filter((e) => e.severity === activeFilter)

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
            className="text-2xl font-bold text-white font-heading"
          >
            Events & Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Application events from connected integrations
          </p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <Filter className="w-4 h-4 text-slate-500 mr-1" />
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              activeFilter === f
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {f}
          </button>
        ))}
        {events.length > 0 && (
          <span className="ml-auto text-xs text-slate-600">
            {filtered.length} of {events.length} events
          </span>
        )}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 text-center"
        >
          <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={fetchEvents}
            className="mt-3 px-4 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:bg-white/[0.06] transition-colors"
          >
            Try again
          </button>
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-16 text-center"
        >
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">
            {events.length === 0
              ? 'No events logged yet'
              : `No ${activeFilter} events found`}
          </p>
          {events.length === 0 && (
            <p className="text-sm text-slate-600">
              Events will appear here when connected apps push data through the
              integration API.
            </p>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                    Severity
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                    Event
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden md:table-cell">
                    Product
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] text-slate-500 font-medium uppercase tracking-widest hidden lg:table-cell">
                    Type
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, i) => {
                  const sev =
                    severityConfig[event.severity] ?? severityConfig.info
                  const SevIcon = sev.icon
                  return (
                    <motion.tr
                      key={event.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-md ${sev.bg} flex items-center justify-center`}
                          >
                            <SevIcon className={`w-3.5 h-3.5 ${sev.color}`} />
                          </div>
                          <span
                            className={`text-xs font-medium capitalize ${sev.color}`}
                          >
                            {event.severity}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-white font-medium truncate max-w-[260px]">
                          {event.title}
                        </p>
                        {event.message && (
                          <p className="text-xs text-slate-500 truncate max-w-[260px] mt-0.5">
                            {event.message}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-slate-600" />
                          <span className="text-xs text-slate-400">
                            {event.product?.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <span className="text-xs text-slate-500 font-mono">
                          {event.eventType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span className="text-xs text-slate-500 font-mono">
                            {format(
                              new Date(event.timestamp),
                              'MMM d, HH:mm:ss'
                            )}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
