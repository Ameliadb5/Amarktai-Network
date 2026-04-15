'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Layers, RefreshCw, CheckCircle, AlertCircle, Play, XCircle,
  Loader2, ArrowLeft, Activity, Database, Server, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ───────────────────────────────────────────────── */
interface JobData {
  queue: {
    healthy: boolean
    backendAvailable: boolean
    counts: Record<string, number>
  }
  batch: { total: number; pending: number; processing: number; completed: number; failed: number }
  video: { total: number; pending: number; processing: number; completed: number; failed: number }
  learning: { totalCycles: number; recentCycles: number; lastCycleAt: string | null }
  timestamp: string
}

/* ── Page ────────────────────────────────────────────────── */
export default function JobsDashboardPage() {
  const [data, setData] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10s
  useEffect(() => {
    const iv = setInterval(fetchData, 10_000)
    return () => clearInterval(iv)
  }, [fetchData])

  const glass = 'bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Jobs &amp; Queue Status
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Background processing overview</p>
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className={`${glass} p-4 border-red-500/20`}>
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : data && (
          <>
            {/* Queue Health */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${glass} p-6`}>
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-400" /> Queue Health
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Backend</p>
                  <p className={`text-sm font-medium flex items-center gap-1 ${data.queue.backendAvailable ? 'text-green-400' : 'text-red-400'}`}>
                    {data.queue.backendAvailable ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {data.queue.backendAvailable ? 'Redis Connected' : 'Unavailable'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={`text-sm font-medium ${data.queue.healthy ? 'text-green-400' : 'text-amber-400'}`}>
                    {data.queue.healthy ? '● Healthy' : '● Degraded'}
                  </p>
                </div>
                {Object.entries(data.queue.counts).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-slate-500 capitalize">{key}</p>
                    <p className="text-sm font-medium text-white">{val}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Job Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Batch Jobs */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${glass} p-5`}>
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-violet-400" /> Batch Jobs
                </h3>
                <div className="space-y-2">
                  <StatRow label="Total" value={data.batch.total} />
                  <StatRow label="Pending" value={data.batch.pending} color="text-amber-400" />
                  <StatRow label="Processing" value={data.batch.processing} color="text-blue-400" />
                  <StatRow label="Completed" value={data.batch.completed} color="text-green-400" />
                  <StatRow label="Failed" value={data.batch.failed} color="text-red-400" />
                </div>
              </motion.div>

              {/* Video Jobs */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${glass} p-5`}>
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                  <Play className="w-4 h-4 text-pink-400" /> Video Generation
                </h3>
                <div className="space-y-2">
                  <StatRow label="Total" value={data.video.total} />
                  <StatRow label="Pending" value={data.video.pending} color="text-amber-400" />
                  <StatRow label="Processing" value={data.video.processing} color="text-blue-400" />
                  <StatRow label="Completed" value={data.video.completed} color="text-green-400" />
                  <StatRow label="Failed" value={data.video.failed} color="text-red-400" />
                </div>
              </motion.div>

              {/* Learning Jobs */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${glass} p-5`}>
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-cyan-400" /> Learning Cycles
                </h3>
                <div className="space-y-2">
                  <StatRow label="Total Cycles" value={data.learning.totalCycles} />
                  <StatRow label="Last 24h" value={data.learning.recentCycles} color="text-blue-400" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Last Run</span>
                    <span className="text-slate-300">
                      {data.learning.lastCycleAt
                        ? formatDistanceToNow(new Date(data.learning.lastCycleAt), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Worker Info */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={`${glass} p-5`}>
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-emerald-400" /> Worker &amp; System
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">Concurrency</p>
                  <p className="text-white font-medium">5 workers</p>
                </div>
                <div>
                  <p className="text-slate-500">Queue Backend</p>
                  <p className="text-white font-medium">BullMQ / Redis</p>
                </div>
                <div>
                  <p className="text-slate-500">Retry Policy</p>
                  <p className="text-white font-medium">Exponential backoff</p>
                </div>
                <div>
                  <p className="text-slate-500">Updated</p>
                  <p className="text-white font-medium">
                    {data.timestamp
                      ? formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })
                      : '—'}
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Reusable stat row ───────────────────────────────────── */
function StatRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${color ?? 'text-white'}`}>{value}</span>
    </div>
  )
}
