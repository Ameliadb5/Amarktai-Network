'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Trash2, Plug, X, Loader2, CheckCircle, AlertCircle, Clock, Copy, RefreshCw,
  Server, Globe, Eye, EyeOff,
} from 'lucide-react'
import { format } from 'date-fns'

interface Integration {
  id: number
  productId: number
  integrationToken: string
  heartbeatEnabled: boolean
  metricsEnabled: boolean
  eventsEnabled: boolean
  vpsEnabled: boolean
  lastHeartbeatAt: string | null
  healthStatus: string
  uptime: number | null
  version: string
  environment: string
  createdAt: string
  product: {
    id: number
    name: string
    slug: string
    status: string
    hostedHere: boolean
    hostingScope: string
    subdomain: string
    customDomain: string
    primaryUrl: string
    monitoringEnabled: boolean
  }
}

interface Product {
  id: number
  name: string
  slug: string
  integration: null | { id: number }
}

const hostingScopeLabel: Record<string, string> = {
  same_vps: 'Same VPS',
  external_vps: 'External VPS',
  external_domain: 'External Domain',
  subdomain: 'Subdomain',
}

const healthIcon = (status: string) => {
  switch (status) {
    case 'healthy': return <CheckCircle className="w-4 h-4 text-emerald-400" />
    case 'unhealthy': return <AlertCircle className="w-4 h-4 text-red-400" />
    default: return <Clock className="w-4 h-4 text-slate-400" />
  }
}

const healthBadge = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'unhealthy': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    productId: 0,
    heartbeatEnabled: true,
    metricsEnabled: true,
    eventsEnabled: true,
    vpsEnabled: false,
    environment: 'production',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [regenId, setRegenId] = useState<number | null>(null)
  const [revealedTokens, setRevealedTokens] = useState<Record<number, string>>({})
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const reload = async () => {
    const [ints, prods] = await Promise.all([
      fetch('/api/admin/integrations').then((r) => r.json()),
      fetch('/api/admin/products').then((r) => r.json()),
    ])
    setIntegrations(Array.isArray(ints) ? ints : [])
    setProducts(Array.isArray(prods) ? prods : [])
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const availableProducts = products.filter((p) => !p.integration)

  const copyToken = (id: number, token: string) => {
    navigator.clipboard.writeText(token)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.productId) { setError('Select a product'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const created = await res.json()
        // Store revealed token for this new integration
        setRevealedTokens((prev) => ({ ...prev, [created.id]: created.integrationToken }))
        await reload()
        setModalOpen(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this integration? The token will stop working.')) return
    await fetch(`/api/admin/integrations/${id}`, { method: 'DELETE' })
    setIntegrations((prev) => prev.filter((i) => i.id !== id))
  }

  const handleRegen = async (id: number) => {
    if (!confirm('Regenerate token? The old token will immediately stop working.')) return
    setRegenId(id)
    try {
      const res = await fetch(`/api/admin/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateToken: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setRevealedTokens((prev) => ({ ...prev, [id]: data.integrationToken }))
        await reload()
      }
    } finally {
      setRegenId(null)
    }
  }

  const handleToggle = async (
    id: number,
    field: 'heartbeatEnabled' | 'metricsEnabled' | 'eventsEnabled' | 'vpsEnabled',
    current: boolean
  ) => {
    setTogglingId(id)
    try {
      await fetch(`/api/admin/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !current }),
      })
      setIntegrations((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: !current } : i))
      )
    } finally {
      setTogglingId(null)
    }
  }

  const displayToken = (integration: Integration) => {
    const revealed = revealedTokens[integration.id]
    return revealed ?? integration.integrationToken
  }

  const isRevealed = (id: number) => !!revealedTokens[id]

  const hideToken = (id: number) => {
    setRevealedTokens((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">App Integrations</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage how connected apps authenticate with and report to AmarktAI Network. Each integration generates a unique token the app uses to send heartbeats, metrics, and events.
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ productId: 0, heartbeatEnabled: true, metricsEnabled: true, eventsEnabled: true, vpsEnabled: false, environment: 'production' })
            setError('')
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Integration
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : integrations.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Plug className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No integrations yet. Connect an app to start monitoring.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration, i) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-xl p-5 space-y-4"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {healthIcon(integration.healthStatus)}
                  <div>
                    <p className="font-semibold text-white font-heading">
                      {integration.product.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {integration.lastHeartbeatAt
                        ? `Last heartbeat: ${format(new Date(integration.lastHeartbeatAt), 'MMM d, HH:mm')}`
                        : 'No heartbeat received yet'}
                      {integration.uptime !== null && integration.uptime !== undefined && (
                        <> · {integration.uptime.toFixed(1)}% uptime</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${healthBadge(integration.healthStatus)}`}>
                    {integration.healthStatus}
                  </span>
                  <button
                    onClick={() => handleDelete(integration.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete integration"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hosting info row */}
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Server className="w-3 h-3" />
                  {hostingScopeLabel[integration.product.hostingScope] ?? integration.product.hostingScope}
                </div>
                {integration.product.primaryUrl && (
                  <a
                    href={integration.product.primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    {integration.product.primaryUrl.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className="text-slate-600 capitalize">{integration.environment}</span>
                {integration.version && (
                  <span className="text-slate-600">v{integration.version}</span>
                )}
              </div>

              {/* Token row */}
              <div className="p-3 bg-black/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-slate-500">Integration Token</p>
                  <span className="text-xs text-slate-600">(per-app, unique)</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-cyan-400 font-mono flex-1 truncate">
                    {displayToken(integration)}
                  </code>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Show/hide full token */}
                    <button
                      onClick={() => isRevealed(integration.id) ? hideToken(integration.id) : undefined}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title={isRevealed(integration.id) ? 'Hide token' : 'Token masked'}
                    >
                      {isRevealed(integration.id) ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </button>
                    {/* Copy */}
                    <button
                      onClick={() => copyToken(integration.id, displayToken(integration))}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                      title="Copy token"
                    >
                      {copiedId === integration.id ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {/* Regen */}
                    <button
                      onClick={() => handleRegen(integration.id)}
                      disabled={regenId === integration.id}
                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                      title="Regenerate token"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regenId === integration.id ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed toggles */}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'heartbeatEnabled' as const, label: 'Heartbeat' },
                    { key: 'metricsEnabled' as const, label: 'Metrics' },
                    { key: 'eventsEnabled' as const, label: 'Events' },
                    { key: 'vpsEnabled' as const, label: 'VPS' },
                  ] as const
                ).map(({ key, label }) => {
                  const enabled = integration[key]
                  return (
                    <button
                      key={key}
                      onClick={() => handleToggle(integration.id, key, enabled)}
                      disabled={togglingId === integration.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                      } disabled:opacity-50`}
                      title={`Click to ${enabled ? 'disable' : 'enable'} ${label}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* New Integration Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-[#0B1020] border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white font-heading">New App Integration</h2>
                <p className="text-xs text-slate-500 mt-1">Select an app from the registry to generate its integration token.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Product *</label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm((p) => ({ ...p, productId: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value={0}>Select a product…</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Environment</label>
                <select
                  value={form.environment}
                  onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Enable feeds</p>
                {[
                  { key: 'heartbeatEnabled', label: 'Heartbeat — app sends pings to confirm it is alive' },
                  { key: 'metricsEnabled', label: 'Metrics — app sends usage/performance metrics' },
                  { key: 'eventsEnabled', label: 'Events — app sends audit/activity events' },
                  { key: 'vpsEnabled', label: 'VPS Resources — app sends CPU, RAM, disk data' },
                ].map((toggle) => (
                  <label key={toggle.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[toggle.key as keyof typeof form] as boolean}
                      onChange={(e) => setForm((p) => ({ ...p, [toggle.key]: e.target.checked }))}
                      className="w-4 h-4 rounded mt-0.5"
                    />
                    <span className="text-sm text-slate-300">{toggle.label}</span>
                  </label>
                ))}
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 glass text-slate-400 text-sm rounded-xl hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Get Token'}
                </button>
              </div>
              <p className="text-xs text-slate-600 text-center">
                Full token shown once on creation. Copy it immediately.
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
