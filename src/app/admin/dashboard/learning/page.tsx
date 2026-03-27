'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, RefreshCw, Brain, FileText, Lightbulb, Clock,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────
interface MemoryEntry {
  id: number
  appSlug: string
  memoryType: string
  key: string
  content: string
  importance: number
  createdAt: string
  expiresAt: string | null
}

interface LearningResponse {
  entries: MemoryEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
  error?: string
}

// ── Memory type config ─────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof BookOpen }> = {
  event:    { label: 'Event',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: FileText },
  summary:  { label: 'Summary',  color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: Brain },
  context:  { label: 'Context',  color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  icon: Lightbulb },
  learned:  { label: 'Learned',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: BookOpen },
}

function importanceBar(score: number) {
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? 'bg-emerald-400' : score >= 0.5 ? 'bg-blue-400' : 'bg-slate-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-600">{pct}%</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function LearningPage() {
  const [data, setData] = useState<LearningResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const load = useCallback(async (p = 1, type = 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (type !== 'all') params.set('type', type)
      const res = await fetch(`/api/admin/learning?${params}`)
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page, typeFilter) }, [load, page, typeFilter])

  const handleTypeFilter = (t: string) => {
    setTypeFilter(t)
    setPage(1)
  }

  const noMigration = data?.error?.includes('migration')
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 text-transparent bg-clip-text">
            What AmarktAI Learned
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real stored memory from brain executions — events, summaries, and context.
          </p>
        </div>
        <button
          onClick={() => load(page, typeFilter)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {!noMigration && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Memories', value: String(total), icon: BookOpen },
            { label: 'Event Memories', value: String(data?.entries.filter(e => e.memoryType === 'event').length ?? 0), icon: FileText },
            { label: 'Summaries', value: String(data?.entries.filter(e => e.memoryType === 'summary').length ?? 0), icon: Brain },
            { label: 'Learning Items', value: String(data?.entries.filter(e => e.memoryType === 'learned').length ?? 0), icon: Lightbulb },
          ].map(stat => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Type filters */}
      {!noMigration && (
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'event', 'summary', 'context', 'learned'].map(t => (
            <button
              key={t}
              onClick={() => handleTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                typeFilter === t
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              {t === 'all' ? 'All Types' : (TYPE_CONFIG[t]?.label ?? t)}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : noMigration ? (
        <div className="bg-white/[0.03] border border-amber-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-amber-400 font-medium mb-1">Memory table not yet migrated</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            The <span className="font-mono text-slate-400">memory_entries</span> table does not exist yet.
            Run <span className="font-mono text-slate-400">prisma db push</span> or <span className="font-mono text-slate-400">prisma migrate dev</span> to create it.
            Once migrated, AmarktAI will start storing memories automatically after each successful brain execution.
          </p>
        </div>
      ) : total === 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">No memories stored yet</p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            AmarktAI will store a memory entry automatically after each successful brain execution.
            {typeFilter !== 'all' && ' Try switching to "All Types".'}
          </p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-500">{total} {total === 1 ? 'entry' : 'entries'} total</span>
            <span className="text-xs text-slate-600 font-mono">Page {page} of {totalPages}</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {data?.entries.map((entry, i) => {
              const cfg = TYPE_CONFIG[entry.memoryType] ?? TYPE_CONFIG.event
              const Icon = cfg.icon
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg border ${cfg.bg}`}>
                      <Icon className={`w-3 h-3 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium uppercase tracking-wide ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {entry.appSlug && (
                          <span className="text-[10px] text-slate-600 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                            {entry.appSlug}
                          </span>
                        )}
                        {entry.key && (
                          <span className="text-[10px] text-slate-600 font-mono">
                            {entry.key}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed line-clamp-2">{entry.content}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-600">
                          <Clock className="w-2.5 h-2.5" />
                          <span title={format(new Date(entry.createdAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {importanceBar(entry.importance)}
                        {entry.expiresAt && (
                          <span className="text-[10px] text-slate-600">
                            Expires {formatDistanceToNow(new Date(entry.expiresAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="text-xs text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Memory entries are stored automatically after each successful brain execution. Entries expire after 90 days by default.
        Only real stored data is shown here — no fabricated entries.
      </p>
    </div>
  )
}
