'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, RefreshCw, CheckCircle, AlertCircle, AlertTriangle, Info,
  Loader2, ArrowLeft, Shield, XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ───────────────────────────────────────────────── */
interface AlertItem {
  id: number
  alertType: string
  severity: string
  title: string
  message: string
  appSlug: string | null
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
}

interface AlertSummary {
  total: number
  unresolved: number
  critical: number
  warning: number
  info: number
}

interface AlertsResponse {
  alerts: AlertItem[]
  summary: AlertSummary
}

/* ── Severity UI ─────────────────────────────────────────── */
const SEVERITY_MAP: Record<string, { icon: typeof AlertCircle; color: string; bg: string }> = {
  critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
}

/* ── Page ────────────────────────────────────────────────── */
export default function AlertsDashboardPage() {
  const [data, setData] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved')
  const [resolving, setResolving] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter === 'unresolved') params.set('resolved', 'false')
      if (filter === 'resolved') params.set('resolved', 'true')
      const res = await fetch(`/api/admin/alerts?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { setLoading(true); fetchData() }, [fetchData])

  useEffect(() => {
    const iv = setInterval(fetchData, 15_000)
    return () => clearInterval(iv)
  }, [fetchData])

  async function handleResolve(id: number) {
    setResolving(id)
    try {
      await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId: id }),
      })
      await fetchData()
    } finally {
      setResolving(null)
    }
  }

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
                <Bell className="w-5 h-5 text-red-400" />
                System Alerts
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Provider failures, routing errors, cost spikes, and more</p>
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

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: data.summary.total, color: 'text-white' },
              { label: 'Unresolved', value: data.summary.unresolved, color: 'text-amber-400' },
              { label: 'Critical', value: data.summary.critical, color: 'text-red-400' },
              { label: 'Warning', value: data.summary.warning, color: 'text-yellow-400' },
              { label: 'Info', value: data.summary.info, color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${glass} p-4`}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'unresolved', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filter === f ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/[0.03] text-slate-500 hover:text-slate-300 border border-white/[0.06]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
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
        ) : data && data.alerts.length === 0 ? (
          <div className={`${glass} p-10 text-center`}>
            <Shield className="w-10 h-10 mx-auto text-green-400/50 mb-3" />
            <p className="text-sm text-slate-400">No alerts matching your filter.</p>
            <p className="text-xs text-slate-600 mt-1">System is running cleanly.</p>
          </div>
        ) : data && (
          <div className="space-y-2">
            {data.alerts.map(alert => {
              const sev = SEVERITY_MAP[alert.severity] ?? SEVERITY_MAP.info
              const Icon = sev.icon
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`${glass} ${sev.bg} p-4 flex items-start gap-3`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${sev.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${sev.color}`}>{alert.title}</span>
                      {alert.resolved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span className="uppercase">{alert.alertType.replace(/_/g, ' ')}</span>
                      {alert.appSlug && <span>App: {alert.appSlug}</span>}
                      <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving === alert.id}
                      className="shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      {resolving === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 inline mr-1" />}
                      Resolve
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
