'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Cable, RefreshCw, AlertCircle, Loader2, ArrowLeft,
  CheckCircle, XCircle, Eye, EyeOff, Save, Trash2,
  ExternalLink, Info,
} from 'lucide-react'
import Link from 'next/link'

/* ── Types ───────────────────────────────────────────────── */
interface Integration {
  key: string
  displayName: string
  description: string
  maskedKey: string
  apiUrl: string
  enabled: boolean
  notes: string
  source: 'database' | 'env' | 'none'
  configured: boolean
  keyEnvVar: string
  urlEnvVar: string | null
  updatedAt: string | null
}

/* ── Page ────────────────────────────────────────────────── */
export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [formKey, setFormKey] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/integration-keys')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setIntegrations(data.integrations ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function startEdit(intg: Integration) {
    setEditing(intg.key)
    setFormKey('')
    setFormUrl(intg.apiUrl)
    setFormNotes(intg.notes)
    setShowKey(false)
    setSaveSuccess(null)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditing(null)
    setFormKey('')
    setFormUrl('')
    setFormNotes('')
  }

  async function handleSave(key: string) {
    setSaving(true)
    setSaveSuccess(null)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/integration-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, apiKey: formKey, apiUrl: formUrl, notes: formNotes }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      setSaveSuccess(key)
      setEditing(null)
      await fetchData()
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(key: string) {
    setDeleting(key)
    try {
      await fetch(`/api/admin/integration-keys?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      await fetchData()
    } finally {
      setDeleting(null)
    }
  }

  const glass = 'bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <Cable className="w-5 h-5 text-violet-400" />
                Integration Keys
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage API keys for Firecrawl, Mem0, Qdrant, and other external services
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Info banner */}
        <div className={`${glass} p-4 border-blue-500/20 bg-blue-500/5`}>
          <p className="text-xs text-blue-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Keys saved here are encrypted at rest and override environment variables at runtime.
            The original key value is never shown after saving — only a masked preview.
            Keys set via environment variables are shown as <span className="font-mono text-blue-200">ENV</span> and cannot be overridden through this UI without saving a new value.
          </p>
        </div>

        {saveSuccess && (
          <div className={`${glass} p-4 border-green-500/20 bg-green-500/5`}>
            <p className="text-sm text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Integration key saved successfully.
            </p>
          </div>
        )}

        {error && (
          <div className={`${glass} p-4 border-red-500/20`}>
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map(intg => (
              <motion.div
                key={intg.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glass} p-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{intg.displayName}</span>
                      <StatusBadge source={intg.source} configured={intg.configured} />
                      {saveSuccess === intg.key && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Saved</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{intg.description}</p>

                    {/* Current key display */}
                    {intg.configured && editing !== intg.key && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 bg-white/[0.04] px-2 py-1 rounded">
                          {intg.maskedKey || '•••••••••'}
                        </span>
                        {intg.apiUrl && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {intg.apiUrl.length > 40 ? intg.apiUrl.slice(0, 40) + '…' : intg.apiUrl}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Env var hint when not configured */}
                    {!intg.configured && editing !== intg.key && (
                      <p className="text-[10px] text-slate-600 mt-1.5">
                        Set via env: <span className="font-mono text-slate-500">{intg.keyEnvVar}</span>
                        {intg.urlEnvVar && <span className="ml-2 font-mono text-slate-500">{intg.urlEnvVar}</span>}
                      </p>
                    )}
                  </div>

                  {/* Right: actions */}
                  {editing !== intg.key && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(intg)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                      >
                        {intg.configured ? 'Update' : 'Configure'}
                      </button>
                      {intg.source === 'database' && (
                        <button
                          onClick={() => handleDelete(intg.key)}
                          disabled={deleting === intg.key}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove saved key (will fall back to env var)"
                        >
                          {deleting === intg.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit form */}
                {editing === intg.key && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 space-y-3 pt-4 border-t border-white/[0.06]"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={formKey}
                          onChange={e => setFormKey(e.target.value)}
                          placeholder={intg.configured ? 'Leave blank to keep existing key' : 'Enter API key…'}
                          className="w-full px-3 py-2 pr-10 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {intg.urlEnvVar && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500">
                          API URL
                        </label>
                        <input
                          type="text"
                          value={formUrl}
                          onChange={e => setFormUrl(e.target.value)}
                          placeholder={intg.apiUrl ? intg.apiUrl : 'https://...'}
                          className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500">Notes (optional)</label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={e => setFormNotes(e.target.value)}
                        placeholder="Any notes about this integration…"
                        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>

                    {saveError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> {saveError}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(intg.key)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Status badge ────────────────────────────────────────── */
function StatusBadge({ source, configured }: { source: Integration['source']; configured: boolean }) {
  if (!configured) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/20">
        Not configured
      </span>
    )
  }
  if (source === 'env') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
        ENV
      </span>
    )
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
      <CheckCircle className="w-2.5 h-2.5" /> Configured
    </span>
  )
}

/* end */
