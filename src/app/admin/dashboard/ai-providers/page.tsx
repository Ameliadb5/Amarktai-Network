'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, AlertCircle, Clock, WifiOff, AlertTriangle,
  Eye, EyeOff, Loader2, RefreshCw, Save,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────
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

// ── Static provider catalogue ────────────────────────────────────
// Defines the canonical set of eligible execution layers.
// All providers here are pay-as-you-go or have a real free/dev tier.
// Qwen excluded: Alibaba DashScope requires account verification that is not universally accessible.
const PROVIDER_CATALOGUE: {
  key: string
  name: string
  purpose: string
  defaultBaseUrl: string
  modelHint: string
  tier: 'primary' | 'aggregator'
  docsUrl: string
}[] = [
  // ── PRIMARY / DIRECT ────────────────────────────────────────────────────────
  {
    key: 'openai',
    name: 'OpenAI',
    purpose: 'Primary LLM layer — GPT-4o, o1, and GPT-4o-mini. Pay-as-you-go via platform.openai.com.',
    defaultBaseUrl: 'https://api.openai.com',
    modelHint: 'gpt-4o-mini',
    tier: 'primary',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    key: 'groq',
    name: 'Groq',
    purpose: 'Ultra-fast LLaMA 3 inference — free tier + PAYG. Best for low-latency tasks. api.groq.com.',
    defaultBaseUrl: 'https://api.groq.com/openai',
    modelHint: 'llama-3.3-70b-versatile',
    tier: 'primary',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    purpose: 'DeepSeek V3 / R1 — very cheap PAYG. Strong at reasoning and coding. api.deepseek.com.',
    defaultBaseUrl: 'https://api.deepseek.com',
    modelHint: 'deepseek-chat',
    tier: 'primary',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    key: 'gemini',
    name: 'Gemini',
    purpose: 'Google Gemini 1.5 — free via AI Studio + PAYG. Multimodal-capable. aistudio.google.com.',
    defaultBaseUrl: '',
    modelHint: 'gemini-1.5-flash',
    tier: 'primary',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    key: 'grok',
    name: 'xAI / Grok',
    purpose: 'Grok-2 from xAI — PAYG via api.x.ai. Strong at real-time reasoning.',
    defaultBaseUrl: 'https://api.x.ai',
    modelHint: 'grok-2-latest',
    tier: 'primary',
    docsUrl: 'https://console.x.ai/',
  },
  {
    key: 'huggingface',
    name: 'Hugging Face',
    purpose: 'Open-source model inference (LLaMA, Mistral, etc.) — free tier + PAYG. api-inference.huggingface.co.',
    defaultBaseUrl: 'https://api-inference.huggingface.co',
    modelHint: 'meta-llama/Llama-3-8b-chat-hf',
    tier: 'primary',
    docsUrl: 'https://huggingface.co/settings/tokens',
  },
  {
    key: 'nvidia',
    name: 'NVIDIA NIM',
    purpose: 'NVIDIA-hosted LLaMA 3 Nemotron — free credits + PAYG via build.nvidia.com.',
    defaultBaseUrl: 'https://integrate.api.nvidia.com',
    modelHint: 'nvidia/llama-3.1-nemotron-70b-instruct',
    tier: 'primary',
    docsUrl: 'https://build.nvidia.com/nim',
  },
  // ── AGGREGATORS ─────────────────────────────────────────────────────────────
  {
    key: 'openrouter',
    name: 'OpenRouter',
    purpose: 'Multi-model aggregator — 100+ models via one key. Free tier models + PAYG. openrouter.ai.',
    defaultBaseUrl: 'https://openrouter.ai/api',
    modelHint: 'openai/gpt-4o-mini',
    tier: 'aggregator',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    key: 'together',
    name: 'Together AI',
    purpose: 'Open model inference aggregator — LLaMA, Mistral, Qwen, etc. Free trial + PAYG. api.together.xyz.',
    defaultBaseUrl: 'https://api.together.xyz',
    modelHint: 'meta-llama/Llama-3-70b-chat-hf',
    tier: 'aggregator',
    docsUrl: 'https://api.together.ai/settings/api-keys',
  },
]

// ── Health badge config ──────────────────────────────────────────
const HEALTH: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  healthy:      { label: 'Connected',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/25', icon: CheckCircle },
  configured:   { label: 'Key Set',      color: 'text-amber-400',   bg: 'bg-amber-500/10 border border-amber-500/25',    icon: Clock },
  degraded:     { label: 'Degraded',     color: 'text-amber-400',   bg: 'bg-amber-500/10 border border-amber-500/25',    icon: AlertTriangle },
  error:        { label: 'Error',        color: 'text-red-400',     bg: 'bg-red-500/10 border border-red-500/25',        icon: AlertCircle },
  unconfigured: { label: 'Not Set',      color: 'text-slate-500',   bg: 'bg-white/[0.03] border border-white/[0.06]',             icon: WifiOff },
  disabled:     { label: 'Disabled',     color: 'text-slate-500',   bg: 'bg-white/[0.03] border border-white/[0.06]',             icon: WifiOff },
}

// ── Provider Card ────────────────────────────────────────────────
function ProviderCard({ catalogue, record, onSaved, onTested }: {
  catalogue: typeof PROVIDER_CATALOGUE[number]
  record: AiProvider | null
  onSaved: (p: AiProvider) => void
  onTested: (p: AiProvider) => void
}) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [enabled, setEnabled] = useState(record?.enabled ?? false)

  // Sync enabled state when record changes
  useEffect(() => { setEnabled(record?.enabled ?? false) }, [record])

  const health = record ? (HEALTH[record.healthStatus] ?? HEALTH.unconfigured) : HEALTH.unconfigured
  const HealthIcon = health.icon

  const handleSave = async () => {
    if (!record && !apiKey.trim()) { setSaveError('Enter an API key to configure this provider.'); return }
    setSaving(true)
    setSaveError('')
    try {
      if (record) {
        // PATCH existing
        const payload: Record<string, unknown> = { enabled }
        if (apiKey.trim()) payload.apiKey = apiKey.trim()
        const res = await fetch(`/api/admin/providers/${record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) { onSaved(await res.json()); setApiKey('') }
        else { const d = await res.json(); setSaveError(d.error ?? 'Save failed') }
      } else {
        // POST new
        const payload = {
          providerKey: catalogue.key,
          displayName: catalogue.name,
          enabled,
          apiKey: apiKey.trim(),
          baseUrl: catalogue.defaultBaseUrl,
          defaultModel: catalogue.modelHint,
          fallbackModel: '',
          notes: '',
          sortOrder: 99,
        }
        const res = await fetch('/api/admin/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) { onSaved(await res.json()); setApiKey('') }
        else { const d = await res.json(); setSaveError(d.error ?? 'Save failed') }
      }
    } catch { setSaveError('Network error') }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!record) { setSaveError('Save the API key first before testing.'); return }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/admin/providers/${record.id}/health-check`, { method: 'POST' })
      const d = await res.json()
      const updated = { ...record, ...d }
      onTested(updated as AiProvider)
      setTestResult({ ok: d.healthStatus === 'healthy', msg: d.healthMessage ?? (d.healthStatus === 'healthy' ? 'Connection successful' : 'Test failed') })
    } catch { setTestResult({ ok: false, msg: 'Network error during test' }) }
    finally { setTesting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white">{catalogue.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide ${
              catalogue.tier === 'aggregator'
                ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
            }`}>
              {catalogue.tier === 'aggregator' ? 'Aggregator' : 'Direct'}
            </span>
            {record && (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${health.bg} ${health.color}`}>
                <HealthIcon className="w-3 h-3" />
                {health.label}
              </span>
            )}
            {!record && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-slate-500">
                <WifiOff className="w-3 h-3" />
                Not configured
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{catalogue.purpose}</p>
          <a href={catalogue.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-500 hover:text-blue-400 mt-1 inline-block">
            Get API key →
          </a>
        </div>
        {record && (
          <button
            onClick={() => { setEnabled(e => !e); }}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              enabled
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-white/[0.03] border-white/10 text-slate-500 hover:bg-white/[0.06]'
            }`}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* API Key Input */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">API Key</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={record?.maskedPreview ? `Current: ${record.maskedPreview}` : 'Enter API key…'}
                className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {record?.maskedPreview && (
            <p className="text-[11px] text-slate-600 mt-1 font-mono">Stored: {record.maskedPreview}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {record ? 'Update' : 'Save'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !record}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-40 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          {record && (
            <span className="text-xs text-slate-600">
              {record.lastCheckedAt
                ? `Tested ${formatDistanceToNow(new Date(record.lastCheckedAt), { addSuffix: true })}`
                : 'Not yet tested'}
            </span>
          )}
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {saveError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {saveError}
            </motion.p>
          )}
          {testResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${testResult.ok ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
              {testResult.ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              {testResult.msg}
            </motion.div>
          )}
          {record?.healthMessage && !testResult && (
            <p className="text-xs text-slate-600">{record.healthMessage}</p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function AiProvidersPage() {
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/providers')
      if (res.ok) {
        setProviders(await res.json())
      } else {
        const d = await res.json().catch(() => ({}))
        setLoadError(d.error ?? `Failed to load providers (HTTP ${res.status})`)
      }
    } catch {
      setLoadError('Network error — could not reach the backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Build lookup: providerKey → record
  const byKey = Object.fromEntries(providers.map(p => [p.providerKey, p]))

  const handleSaved = (updated: AiProvider) => {
    setProviders(prev => {
      const idx = prev.findIndex(p => p.id === updated.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated]
    })
  }

  const handleTested = (updated: AiProvider) => {
    setProviders(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  }

  const healthyCount = providers.filter(p => p.healthStatus === 'healthy').length
  const configuredCount = providers.filter(p => p.maskedPreview).length

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AI Provider Setup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure the AI execution layers AmarktAI uses to process requests.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{configuredCount}/{PROVIDER_CATALOGUE.length} configured</span>
          <span className="text-emerald-400">{healthyCount} healthy</span>
        </div>
      </div>

      {/* Backend error banner */}
      {loadError && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">Provider data unavailable</p>
            <p className="text-xs text-red-400/80 mt-0.5">{loadError}</p>
            <p className="text-xs text-slate-500 mt-1">Ensure the database is configured and reachable before saving provider changes.</p>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {!loading && !loadError && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-3 flex items-center gap-4 flex-wrap text-xs text-slate-500">
          <span className="font-medium text-white">Execution layers:</span>
          {PROVIDER_CATALOGUE.map(cat => {
            const rec = byKey[cat.key]
            const status = rec?.healthStatus ?? 'unconfigured'
            const dot =
              status === 'healthy'      ? 'bg-emerald-400' :
              status === 'configured'   ? 'bg-amber-400' :
              status === 'error'        ? 'bg-red-400' :
              status === 'degraded'     ? 'bg-amber-400' : 'bg-slate-600'
            return (
              <span key={cat.key} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {cat.name}
              </span>
            )
          })}
        </div>
      )}

      {/* Provider cards — grouped by tier */}
      {loading ? (
        <div className="space-y-4">
          {PROVIDER_CATALOGUE.map(c => (
            <div key={c.key} className="h-48 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Primary / Direct */}
          <div>
            <p className="text-xs text-slate-600 font-mono uppercase tracking-widest mb-3">Direct Providers</p>
            <div className="space-y-4">
              {PROVIDER_CATALOGUE.filter(c => c.tier === 'primary').map((cat, i) => (
                <motion.div
                  key={cat.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProviderCard
                    catalogue={cat}
                    record={byKey[cat.key] ?? null}
                    onSaved={handleSaved}
                    onTested={handleTested}
                  />
                </motion.div>
              ))}
            </div>
          </div>
          {/* Aggregators */}
          <div>
            <p className="text-xs text-slate-600 font-mono uppercase tracking-widest mb-3">Aggregators (multi-model access via one key)</p>
            <div className="space-y-4">
              {PROVIDER_CATALOGUE.filter(c => c.tier === 'aggregator').map((cat, i) => (
                <motion.div
                  key={cat.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProviderCard
                    catalogue={cat}
                    record={byKey[cat.key] ?? null}
                    onSaved={handleSaved}
                    onTested={handleTested}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600">
        API keys are stored server-side only. Only masked previews are shown. Test connections to verify keys are valid before enabling.
      </p>
    </div>
  )
}
