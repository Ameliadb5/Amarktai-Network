'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, RefreshCw, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Pencil, X, Save } from 'lucide-react'

interface BudgetEntry {
  providerKey: string
  displayName: string
  monthlyBudgetUsd: number | null
  currentSpendUsd: number
  estimatedSpendUsd: number
  usagePercent: number
  status: 'ok' | 'warning' | 'critical' | 'unknown'
  warningThresholdPct: number
  criticalThresholdPct: number
  lastUpdated: string
}

interface BudgetSummary {
  entries: BudgetEntry[]
  totalEstimatedSpendUsd: number
  totalBudgetUsd: number | null
  providersAtWarning: number
  providersAtCritical: number
}

const STATUS_CONFIG = {
  ok:       { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'OK'       },
  warning:  { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   label: 'Warning'  },
  critical: { icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Critical' },
  unknown:  { icon: AlertCircle,   color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',   label: 'No budget'},
}

function barColor(status: BudgetEntry['status']) {
  if (status === 'critical') return 'bg-red-400'
  if (status === 'warning')  return 'bg-amber-400'
  if (status === 'ok')       return 'bg-emerald-400'
  return 'bg-slate-600'
}

export default function BudgetsPage() {
  const [data, setData]       = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ monthlyBudgetUsd: '', warningThresholdPct: '75', criticalThresholdPct: '90' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/budgets')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Show a meaningful error — 503 means DB not configured
        const msg = body.error ?? `HTTP ${res.status}`
        const hint = res.status === 503
          ? ' Configure DATABASE_URL in your environment to enable budget tracking.'
          : ''
        throw new Error(msg + hint)
      }
      setData(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load budgets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (entry: BudgetEntry) => {
    setEditing(entry.providerKey)
    setEditForm({
      monthlyBudgetUsd: entry.monthlyBudgetUsd?.toString() ?? '',
      warningThresholdPct: entry.warningThresholdPct.toString(),
      criticalThresholdPct: entry.criticalThresholdPct.toString(),
    })
  }

  const saveBudget = async (providerKey: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey,
          monthlyBudgetUsd: editForm.monthlyBudgetUsd ? parseFloat(editForm.monthlyBudgetUsd) : null,
          warningThresholdPct: parseFloat(editForm.warningThresholdPct),
          criticalThresholdPct: parseFloat(editForm.criticalThresholdPct),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Budgets</h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor estimated spend per provider and configure monthly budget limits.
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
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Est. MTD Spend',    value: `$${data.totalEstimatedSpendUsd.toFixed(4)}`, color: 'text-white'        },
              { label: 'Monthly Budget',    value: data.totalBudgetUsd ? `$${data.totalBudgetUsd.toFixed(2)}` : 'None set', color: 'text-slate-300'  },
              { label: 'At Warning',        value: data.providersAtWarning,    color: 'text-amber-400' },
              { label: 'At Critical',       value: data.providersAtCritical,   color: 'text-red-400'   },
            ].map((m) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 rounded-xl bg-white/3 border border-white/8 text-center"
              >
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-slate-500 mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Provider Budget Rows */}
          <div className="space-y-3">
            {data.entries.length === 0 ? (
              <div className="p-8 rounded-xl bg-white/3 border border-white/8 text-center text-slate-500">
                No providers configured. Add providers in AI Providers first.
              </div>
            ) : data.entries.map((entry, i) => {
              const cfg = STATUS_CONFIG[entry.status]
              const Icon = cfg.icon
              const isEdit = editing === entry.providerKey
              return (
                <motion.div
                  key={entry.providerKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4 rounded-xl bg-white/3 border border-white/8"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <div className="flex-1">
                      <span className="font-bold text-white">{entry.displayName}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">{entry.providerKey}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    {!isEdit && (
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, entry.usagePercent)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${barColor(entry.status)}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Est. spend: <span className="text-slate-300">${entry.estimatedSpendUsd.toFixed(4)}</span>
                      {entry.monthlyBudgetUsd && (
                        <> / <span className="text-slate-300">${entry.monthlyBudgetUsd.toFixed(2)}</span> budget ({entry.usagePercent.toFixed(1)}%)</>
                      )}
                    </span>
                    {!entry.monthlyBudgetUsd && (
                      <span className="text-slate-600">No budget set — click edit to configure</span>
                    )}
                  </div>

                  {isEdit && (
                    <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Monthly Budget (USD)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 50"
                            value={editForm.monthlyBudgetUsd}
                            onChange={e => setEditForm(f => ({ ...f, monthlyBudgetUsd: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Warning % (default 75)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editForm.warningThresholdPct}
                            onChange={e => setEditForm(f => ({ ...f, warningThresholdPct: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Critical % (default 90)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editForm.criticalThresholdPct}
                            onChange={e => setEditForm(f => ({ ...f, criticalThresholdPct: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveBudget(entry.providerKey)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center h-48">
          <DollarSign className="w-8 h-8 text-blue-400 animate-pulse" />
        </div>
      )}
    </div>
  )
}
