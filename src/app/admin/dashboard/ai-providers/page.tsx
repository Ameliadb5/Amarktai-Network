'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit, Sparkles, Bot, Cpu, Cloud, Box,
  ShieldCheck, CheckCircle, AlertCircle, Clock, WifiOff,
  X, Loader2, Eye, EyeOff, RefreshCw, Settings2, Plus,
  Zap, Info,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ────────────────────────────────────────────────
interface AiProvider {
  id: number
  providerKey: string
  displayName: string
  enabled: boolean
  maskedPreview: string
  baseUrl: string
  defaultModel: string
  fallbackModel: string
  healthStatus: string
  healthMessage: string
  lastCheckedAt: string | null
  notes: string
  sortOrder: number
  updatedAt: string
}

// ── Static provider metadata ─────────────────────────────
const PROVIDER_META: Record<string, {
  icon: typeof BrainCircuit
  color: string
  border: string
  glow: string
  defaultBaseUrl: string
  modelPlaceholder: string
}> = {
  openai:      { icon: BrainCircuit, color: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'bg-emerald-500/5',  defaultBaseUrl: 'https://api.openai.com',             modelPlaceholder: 'gpt-4o' },
  gemini:      { icon: Sparkles,     color: 'text-blue-400',    border: 'border-blue-500/20',    glow: 'bg-blue-500/5',     defaultBaseUrl: '',                                   modelPlaceholder: 'gemini-1.5-pro' },
  grok:        { icon: Bot,          color: 'text-purple-400',  border: 'border-purple-500/20',  glow: 'bg-purple-500/5',   defaultBaseUrl: 'https://api.x.ai',                   modelPlaceholder: 'grok-2-latest' },
  qwen:        { icon: Cloud,        color: 'text-cyan-400',    border: 'border-cyan-500/20',    glow: 'bg-cyan-500/5',     defaultBaseUrl: 'https://dashscope.aliyuncs.com/api', modelPlaceholder: 'qwen-max' },
  huggingface: { icon: Box,          color: 'text-amber-400',   border: 'border-amber-500/20',   glow: 'bg-amber-500/5',    defaultBaseUrl: 'https://api-inference.huggingface.co', modelPlaceholder: 'meta-llama/Llama-3-8b-chat-hf' },
  nvidia:      { icon: Cpu,          color: 'text-green-400',   border: 'border-green-500/20',   glow: 'bg-green-500/5',    defaultBaseUrl: 'https://integrate.api.nvidia.com',   modelPlaceholder: 'nvidia/llama-3.1-nemotron-70b-instruct' },
}

// ── Health Status Config ──────────────────────────────────
const HEALTH_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string; dot: string }> = {
  healthy:      { label: 'Connected',     icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  configured:   { label: 'Key Set',       icon: Clock,       color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400' },
  degraded:     { label: 'Degraded',      icon: AlertCircle, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400' },
  error:        { label: 'Error',         icon: AlertCircle, color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',       dot: 'bg-red-400' },
  unconfigured: { label: 'No Key',        icon: WifiOff,     color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/30',   dot: 'bg-slate-500' },
  disabled:     { label: 'Disabled',      icon: WifiOff,     color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/30',   dot: 'bg-slate-500' },
}

// ── Input styles ──────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-600 font-mono'
const labelCls = 'text-xs text-slate-400 mb-1.5 block'

// ── Configure Modal ───────────────────────────────────────
interface ConfigModalProps {
  provider: AiProvider
  onClose: () => void
  onSaved: (updated: AiProvider) => void
}

function ConfigModal({ provider, onClose, onSaved }: ConfigModalProps) {
  const meta = PROVIDER_META[provider.providerKey] ?? PROVIDER_META.openai
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || meta.defaultBaseUrl)
  const [defaultModel, setDefaultModel] = useState(provider.defaultModel)
  const [fallbackModel, setFallbackModel] = useState(provider.fallbackModel)
  const [notes, setNotes] = useState(provider.notes)
  const [enabled, setEnabled] = useState(provider.enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const keyHint = provider.maskedPreview ? `Current: ${provider.maskedPreview}` : 'No key stored yet'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // Build payload — only include apiKey if admin typed something new
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        enabled,
        baseUrl: baseUrl.trim(),
        defaultModel: defaultModel.trim(),
        fallbackModel: fallbackModel.trim(),
        notes: notes.trim(),
      }
      if (apiKey.trim()) payload.apiKey = apiKey.trim()

      const res = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        onSaved(updated)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="relative bg-[#080E1C] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}>
              {(() => { const Icon = meta.icon; return <Icon className={`w-4.5 h-4.5 ${meta.color}`} /> })()}
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Configure {provider.displayName}
              </h2>
              <p className="text-xs text-slate-500">{provider.providerKey}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <div>
              <p className="text-sm text-white font-medium">Provider Enabled</p>
              <p className="text-xs text-slate-500">Allow this provider to be used by the Amarktai Brain</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${enabled ? 'bg-blue-500' : 'bg-white/10'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* API Key */}
          <div>
            <label className={labelCls}>
              API Key{' '}
              <span className="text-slate-600 font-normal font-sans">(leave blank to keep existing)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={keyHint}
                className={`${inputCls} pr-10`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {provider.maskedPreview && (
              <p className="text-[11px] text-slate-600 mt-1 font-mono">Stored: {provider.maskedPreview}</p>
            )}
          </div>

          {/* Base URL Override */}
          <div>
            <label className={labelCls}>Base URL Override <span className="text-slate-600">(optional)</span></label>
            <input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={meta.defaultBaseUrl || 'https://api.provider.com'}
              className={inputCls}
            />
          </div>

          {/* Models */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Default Model</label>
              <input
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                placeholder={meta.modelPlaceholder}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fallback Model</label>
              <input
                value={fallbackModel}
                onChange={e => setFallbackModel(e.target.value)}
                placeholder="(optional)"
                className={inputCls}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes <span className="text-slate-600">(optional)</span></label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Organisation-level key, rate limit 60 rpm"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 glass text-slate-400 text-sm rounded-xl hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Configuration'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Provider Card ─────────────────────────────────────────
interface ProviderCardProps {
  provider: AiProvider
  index: number
  onConfigure: () => void
  onHealthCheck: () => void
  checking: boolean
}

function ProviderCard({ provider, index, onConfigure, onHealthCheck, checking }: ProviderCardProps) {
  const meta = PROVIDER_META[provider.providerKey] ?? PROVIDER_META.openai
  const health = HEALTH_CONFIG[provider.healthStatus] ?? HEALTH_CONFIG.unconfigured
  const Icon = meta.icon
  const _HealthIcon = health.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className={`glass rounded-2xl p-5 border ${meta.border} relative overflow-hidden`}
    >
      {/* Background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${meta.glow} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none`} />

      <div className="relative space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-heading">
                {provider.displayName}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">{provider.providerKey}</p>
            </div>
          </div>

          {/* Health badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${health.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.dot} ${provider.healthStatus === 'healthy' ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] font-semibold tracking-wider ${health.color}`}>{health.label}</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {/* Enabled state */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <span className={`text-xs font-medium ${provider.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
              {provider.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Masked key */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">API Key</span>
            <span className={`text-xs font-mono ${provider.maskedPreview ? 'text-slate-400' : 'text-slate-600'}`}>
              {provider.maskedPreview || 'No key stored'}
            </span>
          </div>

          {/* Default model if set */}
          {provider.defaultModel && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Default Model</span>
              <span className="text-xs text-slate-400 font-mono">{provider.defaultModel}</span>
            </div>
          )}

          {/* Health message */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-slate-500 flex-shrink-0">Health</span>
            <span className={`text-xs text-right leading-tight ${health.color}`}>{provider.healthMessage || '—'}</span>
          </div>

          {/* Last checked */}
          {provider.lastCheckedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Last check</span>
              <span className="text-[11px] text-slate-600">
                {formatDistanceToNow(new Date(provider.lastCheckedAt), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onHealthCheck}
            disabled={checking}
            title="Run health check"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-50 transition-all"
          >
            {checking
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            {checking ? 'Checking…' : 'Test'}
          </button>
          <button
            onClick={onConfigure}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              provider.maskedPreview
                ? 'bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90'
            }`}
          >
            {provider.maskedPreview ? (
              <><Settings2 className="w-3.5 h-3.5" />Edit</>
            ) : (
              <><Plus className="w-3.5 h-3.5" />Set Key</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────
export default function AIProvidersPage() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [configuring, setConfiguring] = useState<AiProvider | null>(null)
  const [checking, setChecking] = useState<number | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/providers')
      const data = await res.json()
      setProviders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[ai-providers] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const handleSaved = (updated: AiProvider) => {
    setProviders(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setConfiguring(null)
  }

  const handleHealthCheck = async (provider: AiProvider) => {
    setChecking(provider.id)
    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/health-check`, { method: 'POST' })
      if (res.ok) {
        const result = await res.json()
        setProviders(prev => prev.map(p =>
          p.id === provider.id
            ? { ...p, healthStatus: result.healthStatus, healthMessage: result.healthMessage, lastCheckedAt: result.lastCheckedAt }
            : p
        ))
      }
    } catch (err) {
      console.error('[health-check] error:', err)
    } finally {
      setChecking(null)
    }
  }

  const configuredCount = providers.filter(p => p.maskedPreview).length
  const healthyCount = providers.filter(p => p.healthStatus === 'healthy').length
  const enabledCount = providers.filter(p => p.enabled).length

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">
            AI Provider Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Central AI provider configuration for the Amarktai CNS
          </p>
        </div>
        <button
          onClick={fetchProviders}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors flex-shrink-0"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Configured', value: configuredCount, icon: Zap,          color: 'text-blue-400' },
            { label: 'Enabled',    value: enabledCount,    icon: CheckCircle,   color: 'text-emerald-400' },
            { label: 'Connected',  value: healthyCount,    icon: BrainCircuit,  color: 'text-violet-400' },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-4 border border-white/5">
              <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Provider Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : providers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/5">
          <BrainCircuit className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No providers found. Run a database migration and re-seed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {providers.map((provider, i) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              index={i}
              onConfigure={() => setConfiguring(provider)}
              onHealthCheck={() => handleHealthCheck(provider)}
              checking={checking === provider.id}
            />
          ))}
        </div>
      )}

      {/* Security note */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-5 border border-blue-500/10"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-white font-heading">
              Security — Server-Side Key Storage
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              API keys are stored server-side in the database only. The frontend never receives raw keys after saving —
              only masked previews (e.g. <span className="font-mono text-slate-500">sk-proj-••••••••abcd</span>) are returned.
              All provider config is managed through this single vault.
            </p>
          </div>
          <Info className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
        </div>
      </motion.div>

      {/* Configure modal */}
      <AnimatePresence>
        {configuring && (
          <ConfigModal
            provider={configuring}
            onClose={() => setConfiguring(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
