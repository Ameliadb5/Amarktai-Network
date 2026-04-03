'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, AlertCircle, Brain, Layers, Bell, FileText, Shield,
  CheckCircle, XCircle, Clock, WifiOff, Key, Plus, Save, Activity,
  Eye, EyeOff, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/* ── Types ─────────────────────────────────────────────── */
interface Provider {
  id: number
  providerKey: string
  displayName: string
  enabled: boolean
  maskedPreview?: string
  healthStatus: string
  healthMessage: string
  lastCheckedAt: string | null
  notes?: string
}

interface ModelEntry {
  id: string
  displayName: string
  provider: string
  role: string
  capabilities: string[]
  enabled: boolean
  contextWindow?: number
}

interface AlertEntry {
  id: number
  severity: string
  title: string
  description: string
  affectedResource: string
  autoHealed: boolean
  createdAt: string
}

interface EventEntry {
  id: number
  eventType: string
  severity: string
  title: string
  message: string
  timestamp: string
  product: { name: string } | null
}

interface ReadinessData {
  score: number
  checks: Array<{ category: string; label: string; status: string; detail: string }>
  summary: { total: number; passed: number; failed: number; warnings: number; critical: number }
}

const HEALTH: Record<string, { color: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string }> = {
  healthy:      { color: 'text-emerald-400', icon: CheckCircle, label: 'Healthy' },
  configured:   { color: 'text-amber-400',   icon: Clock,       label: 'Key Set' },
  degraded:     { color: 'text-amber-400',   icon: AlertCircle, label: 'Degraded' },
  error:        { color: 'text-red-400',     icon: XCircle,     label: 'Error' },
  unconfigured: { color: 'text-slate-500',   icon: WifiOff,     label: 'Not Set' },
  disabled:     { color: 'text-slate-500',   icon: WifiOff,     label: 'Disabled' },
}

const SEV: Record<string, { color: string; bg: string }> = {
  critical: { color: 'text-red-400',   bg: 'bg-red-400/10' },
  error:    { color: 'text-red-400',   bg: 'bg-red-400/10' },
  warning:  { color: 'text-amber-400', bg: 'bg-amber-400/10' },
  info:     { color: 'text-blue-400',  bg: 'bg-blue-400/10' },
}

const TABS = ['Providers', 'Models', 'Alerts', 'Events', 'Readiness'] as const
type Tab = typeof TABS[number]
const TAB_ICONS: Record<Tab, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Providers: Brain, Models: Layers, Alerts: Bell, Events: FileText, Readiness: Shield,
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('Providers')
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<ModelEntry[]>([])
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [events, setEvents] = useState<EventEntry[]>([])
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, mRes, aRes, eRes, rRes] = await Promise.allSettled([
        fetch('/api/admin/providers').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/models').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/healing').then(r => r.ok ? r.json() : { issues: [] }),
        fetch('/api/admin/events').then(r => r.ok ? r.json() : []),
        fetch('/api/admin/readiness').then(r => r.ok ? r.json() : null),
      ])
      if (pRes.status === 'fulfilled') setProviders(Array.isArray(pRes.value) ? pRes.value : [])
      if (mRes.status === 'fulfilled') setModels(Array.isArray(mRes.value) ? mRes.value : mRes.value?.models ?? [])
      if (aRes.status === 'fulfilled') setAlerts(Array.isArray(aRes.value?.issues) ? aRes.value.issues : [])
      if (eRes.status === 'fulfilled') setEvents(Array.isArray(eRes.value) ? eRes.value : [])
      if (rRes.status === 'fulfilled') setReadiness(rRes.value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Operations</h1>
        <p className="text-sm text-slate-400 mt-1">Providers, models, alerts, events, and system readiness</p>
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={fadeUp} className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t]
          return (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'text-white bg-blue-500/10 border border-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'}`}>
              <Icon className="w-4 h-4" />
              {t}
            </button>
          )
        })}
        <div className="flex-1" />
        <button onClick={load} disabled={loading} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Loading…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-slate-400">{error}</p>
          <button onClick={load} className="btn-primary text-sm">Retry</button>
        </div>
      ) : (
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'Providers' && <ProvidersView providers={providers} onRefresh={load} />}
          {tab === 'Models' && <ModelsView models={models} />}
          {tab === 'Alerts' && <AlertsView alerts={alerts} />}
          {tab === 'Events' && <EventsView events={events} />}
          {tab === 'Readiness' && <ReadinessView data={readiness} />}
        </motion.div>
      )}
    </motion.div>
  )
}

/* ── Sub-views ─────────────────────────────────────────── */

function ProvidersView({ providers, onRefresh }: { providers: Provider[]; onRefresh: () => void }) {
  const [keyInputs, setKeyInputs] = useState<Record<number, string>>({})
  const [showKey, setShowKey] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [testing, setTesting] = useState<Record<number, boolean>>({})
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({})
  const [localProviders, setLocalProviders] = useState<Provider[]>(providers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [catalogProviders, setCatalogProviders] = useState<Array<{ key: string; displayName: string }>>([])
  const [selectedCatalogKey, setSelectedCatalogKey] = useState('')
  const [newProviderApiKey, setNewProviderApiKey] = useState('')
  const [addingProvider, setAddingProvider] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => { setLocalProviders(providers) }, [providers])

  // Load catalog for dropdown when add form opens
  useEffect(() => {
    if (!showAddForm) return
    fetch('/api/admin/providers/catalog')
      .then(r => r.ok ? r.json() : [])
      .then((catalog: Array<{ key: string; displayName: string }>) => {
        // Filter out providers that already exist
        const existingKeys = new Set(localProviders.map(p => p.providerKey))
        setCatalogProviders(catalog.filter(c => !existingKeys.has(c.key)))
      })
      .catch(() => setCatalogProviders([]))
  }, [showAddForm, localProviders])

  const setCardError = (id: number, msg: string) => {
    setCardErrors(e => ({ ...e, [id]: msg }))
    setTimeout(() => setCardErrors(e => { const n = { ...e }; delete n[id]; return n }), 5000)
  }

  const handleSaveKey = async (p: Provider) => {
    const key = keyInputs[p.id] ?? ''
    setSaving(s => ({ ...s, [p.id]: true }))
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setLocalProviders(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x))
      // Clear key from state after save to minimize in-memory exposure
      setKeyInputs(k => { const n = { ...k }; delete n[p.id]; return n })
    } catch (e) {
      setCardError(p.id, e instanceof Error ? e.message : 'Failed to save key')
    } finally {
      setSaving(s => ({ ...s, [p.id]: false }))
    }
  }

  const handleTestConnection = async (p: Provider) => {
    setTesting(t => ({ ...t, [p.id]: true }))
    try {
      const res = await fetch(`/api/admin/providers/${p.id}/health-check`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setLocalProviders(prev => prev.map(x => x.id === p.id ? { ...x, ...result } : x))
    } catch (e) {
      setCardError(p.id, e instanceof Error ? e.message : 'Health check failed')
    } finally {
      setTesting(t => ({ ...t, [p.id]: false }))
    }
  }

  const handleToggleEnabled = async (p: Provider) => {
    setSaving(s => ({ ...s, [p.id]: true }))
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !p.enabled }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setLocalProviders(prev => prev.map(x => x.id === p.id ? { ...x, ...updated } : x))
    } catch (e) {
      setCardError(p.id, e instanceof Error ? e.message : 'Toggle failed')
    } finally {
      setSaving(s => ({ ...s, [p.id]: false }))
    }
  }

  const handleAddProvider = async () => {
    if (!selectedCatalogKey) {
      setAddError('Select a provider from the dropdown')
      return
    }
    const catalogEntry = catalogProviders.find(c => c.key === selectedCatalogKey)
    if (!catalogEntry) {
      setAddError('Invalid provider selection')
      return
    }
    setAddingProvider(true)
    setAddError(null)
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey: catalogEntry.key,
          displayName: catalogEntry.displayName,
          apiKey: newProviderApiKey,
          enabled: false,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const created = await res.json()
      setLocalProviders(prev => [...prev, created])
      setSelectedCatalogKey('')
      setNewProviderApiKey('')
      setShowAddForm(false)
      onRefresh()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add provider')
    } finally {
      setAddingProvider(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add new provider */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">API Key Management</h3>
          </div>
          <button
            onClick={() => { setShowAddForm(f => !f); setAddError(null) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Provider
          </button>
        </div>

        {showAddForm && (
          <div className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <p className="text-xs text-slate-400 font-medium">New Provider</p>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={selectedCatalogKey}
                onChange={e => setSelectedCatalogKey(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
              >
                <option value="" className="bg-[#0a0f1a]">Select provider…</option>
                {catalogProviders.map(c => (
                  <option key={c.key} value={c.key} className="bg-[#0a0f1a]">{c.displayName} ({c.key})</option>
                ))}
              </select>
              <input
                type="password"
                placeholder="API key (optional)"
                value={newProviderApiKey}
                onChange={e => setNewProviderApiKey(e.target.value)}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>
            {catalogProviders.length === 0 && (
              <p className="text-xs text-slate-500">All canonical providers are already added.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAddProvider}
                disabled={addingProvider || !selectedCatalogKey}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {addingProvider ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Create
              </button>
              <button onClick={() => setShowAddForm(false)} className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Provider cards */}
      {localProviders.length === 0 ? (
        <EmptyState message="No providers configured." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {localProviders.map((p) => {
            const h = HEALTH[p.healthStatus] ?? HEALTH.disabled
            const Icon = h.icon
            const keyDirty = keyInputs[p.id] !== undefined
            const isSaving = saving[p.id] ?? false
            const isTesting = testing[p.id] ?? false
            const isKeyVisible = showKey[p.id] ?? false
            const cardError = cardErrors[p.id]

            return (
              <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{p.displayName}</h3>
                    <p className="text-xs text-slate-500 font-mono">{p.providerKey}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Health badge */}
                    <span className={`flex items-center gap-1 text-xs ${h.color}`}>
                      <Icon className="w-3 h-3" />
                      {h.label}
                    </span>
                    {/* Enable toggle */}
                    <button
                      onClick={() => handleToggleEnabled(p)}
                      disabled={isSaving}
                      title={p.enabled ? 'Disable provider' : 'Enable provider'}
                      className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {p.enabled
                        ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Health detail */}
                {p.healthMessage && (
                  <p className="text-xs text-slate-500">{p.healthMessage}</p>
                )}
                {p.lastCheckedAt && (
                  <p className="text-[10px] text-slate-600">Checked {formatDistanceToNow(new Date(p.lastCheckedAt), { addSuffix: true })}</p>
                )}

                {/* API Key row */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">API Key</label>
                  {/* Show masked preview when no edit in progress */}
                  {!keyDirty && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2">
                      {p.maskedPreview ? (
                        <span className="flex-1 truncate">{p.maskedPreview}</span>
                      ) : (
                        <span className="flex-1 text-slate-600 italic">No key set</span>
                      )}
                    </div>
                  )}
                  {/* Key edit input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isKeyVisible ? 'text' : 'password'}
                        placeholder={p.maskedPreview ? 'Enter new key to replace…' : 'Enter API key…'}
                        value={keyInputs[p.id] ?? ''}
                        onChange={e => setKeyInputs(k => ({ ...k, [p.id]: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(s => ({ ...s, [p.id]: !s[p.id] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {keyDirty && (
                      <button
                        onClick={() => handleSaveKey(p)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* Test connection */}
                <button
                  onClick={() => handleTestConnection(p)}
                  disabled={isTesting}
                  title={p.maskedPreview ? 'Run a live health check' : 'Save an API key first to test'}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                  {isTesting ? 'Testing…' : 'Test Connection'}
                </button>

                {/* Inline error */}
                {cardError && (
                  <p className="text-xs text-red-400">{cardError}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelsView({ models }: { models: ModelEntry[] }) {
  if (models.length === 0) return <EmptyState message="No models registered." />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((m) => (
        <div key={m.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white truncate">{m.displayName}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-600/10 text-slate-500'}`}>{m.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p className="text-[10px] text-slate-600 font-mono truncate">{m.id}</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{m.provider}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{m.role}</span>
          </div>
          {m.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.capabilities.map((c) => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">{c}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AlertsView({ alerts }: { alerts: AlertEntry[] }) {
  if (alerts.length === 0) return <EmptyState message="No active alerts. All systems healthy." icon={<CheckCircle className="w-8 h-8 text-emerald-400" />} />
  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const sev = SEV[a.severity] ?? SEV.info
        return (
          <div key={a.id} className={`${sev.bg} border border-white/[0.06] rounded-xl p-4 space-y-1`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${sev.color}`}>{a.title}</span>
              {a.autoHealed && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Auto-healed</span>}
            </div>
            <p className="text-xs text-slate-400">{a.description}</p>
            <p className="text-[10px] text-slate-600">Resource: {a.affectedResource} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
          </div>
        )
      })}
    </div>
  )
}

function EventsView({ events }: { events: EventEntry[] }) {
  if (events.length === 0) return <EmptyState message="No events recorded." />
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-mono border-b border-white/[0.06]">
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">App</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {events.slice(0, 50).map((ev) => {
              const sev = SEV[ev.severity] ?? SEV.info
              return (
                <tr key={ev.id} className="hover:bg-white/[0.02]">
                  <td className={`px-4 py-3 ${sev.color} text-xs font-medium capitalize`}>{ev.severity}</td>
                  <td className="px-4 py-3 text-white">{ev.title}</td>
                  <td className="px-4 py-3 text-slate-400">{ev.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{ev.eventType}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReadinessView({ data }: { data: ReadinessData | null }) {
  if (!data) return <EmptyState message="Readiness data unavailable." />
  const scoreColor = data.score >= 80 ? 'text-emerald-400' : data.score >= 50 ? 'text-amber-400' : 'text-red-400'
  const CHECK_COLORS: Record<string, string> = { pass: 'text-emerald-400', fail: 'text-red-400', warn: 'text-amber-400' }

  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex items-center gap-6">
        <div className={`text-4xl font-bold font-heading ${scoreColor}`}>{data.score}%</div>
        <div>
          <p className="text-sm text-white font-medium">Readiness Score</p>
          <p className="text-xs text-slate-400 mt-0.5">{data.summary.passed} passed · {data.summary.failed} failed · {data.summary.warnings} warnings</p>
        </div>
      </div>
      <div className="space-y-2">
        {data.checks.map((c, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 flex items-center gap-4">
            <span className={`w-2 h-2 rounded-full ${c.status === 'pass' ? 'bg-emerald-400' : c.status === 'fail' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{c.label}</p>
              <p className="text-xs text-slate-500 truncate">{c.detail}</p>
            </div>
            <span className={`text-xs font-medium capitalize ${CHECK_COLORS[c.status] ?? 'text-slate-400'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon ?? <AlertCircle className="w-8 h-8 text-slate-600" />}
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}
