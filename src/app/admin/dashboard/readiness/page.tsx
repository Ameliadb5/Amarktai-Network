'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle, RefreshCw, AlertCircle, XCircle,
  AlertTriangle, MinusCircle, ShieldCheck,
} from 'lucide-react'

interface AuditCheck {
  id: string
  category: string
  name: string
  description: string
  status: 'pass' | 'fail' | 'warning' | 'not_checked'
  details: string
  critical: boolean
}

interface ReadinessReport {
  timestamp: string
  overallReady: boolean
  score: number
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  criticalFailures: number
  checks: AuditCheck[]
  summary: string
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Fail' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Warning' },
  not_checked: { icon: MinusCircle, color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Not Checked' },
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-400'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function ReadinessPage() {
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/readiness')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReport(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load readiness report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Group checks by category
  const grouped: Record<string, AuditCheck[]> = {}
  report?.checks.forEach(check => {
    if (!grouped[check.category]) grouped[check.category] = []
    grouped[check.category].push(check)
  })

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Go-Live Readiness</h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive audit of all subsystems — the gate for production launch.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Run Audit
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : report ? (
        <>
          {/* Hero score */}
          <div className={`rounded-2xl p-6 border ${report.overallReady ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${report.overallReady ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <ShieldCheck className={`w-8 h-8 ${report.overallReady ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <span className={`text-4xl font-bold ${getScoreColor(report.score)}`}>{report.score}</span>
                  <span className="text-sm text-slate-500">/ 100</span>
                  <span className={`ml-2 text-sm font-bold ${report.overallReady ? 'text-emerald-400' : 'text-red-400'}`}>
                    {report.overallReady ? 'READY FOR LAUNCH' : 'NOT READY'}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(report.score)}`}
                    style={{ width: `${report.score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Checks', value: report.totalChecks, color: 'text-white' },
              { label: 'Passed', value: report.passed, color: 'text-emerald-400' },
              { label: 'Failed', value: report.failed, color: 'text-red-400' },
              { label: 'Warnings', value: report.warnings, color: 'text-amber-400' },
              { label: 'Critical Failures', value: report.criticalFailures, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Critical failures callout */}
          {report.criticalFailures > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold text-red-400">Critical Failures</span>
              </div>
              <div className="space-y-2">
                {report.checks.filter(c => c.critical && c.status === 'fail').map(check => (
                  <div key={check.id} className="flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">{check.name}</p>
                      <p className="text-xs text-red-400/70">{check.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checks by category */}
          {Object.entries(grouped).map(([category, checks]) => (
            <div key={category} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wide">{category}</span>
                <span className="text-[10px] text-slate-500">
                  {checks.filter(c => c.status === 'pass').length}/{checks.length} passed
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {checks.map(check => {
                  const cfg = STATUS_CONFIG[check.status]
                  const Icon = cfg.icon
                  return (
                    <div key={check.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg border ${cfg.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium">{check.name}</span>
                            {check.critical && (
                              <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded uppercase font-medium">
                                critical
                              </span>
                            )}
                            <span className={`ml-auto text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{check.description}</p>
                          {check.details && (
                            <p className="text-xs text-slate-400 mt-1 font-mono bg-white/[0.03] px-2 py-1 rounded">
                              {check.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Summary text */}
          {report.summary && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-2">Summary</h2>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{report.summary}</p>
            </div>
          )}
        </>
      ) : null}

      <p className="text-xs text-slate-600">
        This audit runs all readiness checks in real-time. No cached or placeholder data — every result is live.
      </p>
    </div>
  )
}
