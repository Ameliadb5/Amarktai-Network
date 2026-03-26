'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Info,
  Zap, ArrowRight, Clock,
} from 'lucide-react'

interface HealingIssue {
  id: string
  category: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedResource: string
  detectedAt: string
  resolved: boolean
  actionTaken: string | null
  actionDetail: string | null
  autoHealed: boolean
}

interface HealingStatus {
  timestamp: string
  totalIssues: number
  criticalCount: number
  warningCount: number
  infoCount: number
  resolvedCount: number
  autoHealedCount: number
  recentIssues: HealingIssue[]
  healthScore: number
}

const SEV_CONFIG = {
  critical: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Critical' },
  warning:  { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   label: 'Warning'  },
  info:     { icon: Info,          color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     label: 'Info'     },
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBarColor(score: number) {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function HealingPage() {
  const [data, setData]       = useState<HealingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/healing')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
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
          <h1 className="text-2xl font-bold text-white">Self-Healing Engine</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time detection of provider failures, broken routes, missing credentials, and degraded components.
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

      {data && (
        <>
          {/* Health Score */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-white/3 border border-white/8"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-white">System Health Score</span>
              </div>
              <span className={`text-3xl font-bold ${scoreColor(data.healthScore)}`}>
                {data.healthScore}/100
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.healthScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${scoreBarColor(data.healthScore)}`}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Last checked: {new Date(data.timestamp).toLocaleString()}
            </p>
          </motion.div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Issues',   value: data.totalIssues,    color: 'text-white'         },
              { label: 'Critical',       value: data.criticalCount,  color: 'text-red-400'       },
              { label: 'Warnings',       value: data.warningCount,   color: 'text-amber-400'     },
              { label: 'Auto-Healed',    value: data.autoHealedCount, color: 'text-emerald-400'  },
            ].map((m) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-xl bg-white/3 border border-white/8 text-center"
              >
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-slate-500 mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Issues List */}
          {data.recentIssues.length === 0 ? (
            <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-emerald-400 font-bold text-lg">No Issues Detected</p>
              <p className="text-slate-500 text-sm mt-1">All systems are operating normally.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Detected Issues ({data.recentIssues.length})
              </h2>
              {data.recentIssues.map((issue, i) => {
                const cfg = SEV_CONFIG[issue.severity]
                const Icon = cfg.icon
                return (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`p-4 rounded-xl border ${cfg.bg}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{issue.title}</span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {issue.autoHealed && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> Auto-healed
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-1">{issue.description}</p>
                        {issue.actionDetail && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                            <ArrowRight className="w-3 h-3" />
                            <span>{issue.actionDetail}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-600">
                          <Clock className="w-3 h-3" />
                          <span>Detected {new Date(issue.detectedAt).toLocaleString()}</span>
                          <span>·</span>
                          <span className="font-mono">{issue.affectedResource}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}
    </div>
  )
}
