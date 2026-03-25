'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, Plus, ExternalLink, Brain, MonitorDot,
  CheckCircle, AlertCircle, Clock, WifiOff, X, Loader2,
  Eye, EyeOff, Copy, Check,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────
interface AppRecord {
  id: number
  name: string
  slug: string
  category: string
  status: string
  primaryUrl: string
  aiEnabled: boolean
  connectedToBrain: boolean
  monitoringEnabled: boolean
  integrationEnabled: boolean
  appSecret: string
  onboardingStatus: string
  integration: {
    id: number
    integrationToken: string
    healthStatus: string
    lastHeartbeatAt: string | null
    environment: string
  } | null
}

// ── Status config ────────────────────────────────────────────────
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  live:            { label: 'Live',         dot: 'bg-emerald-400', text: 'text-emerald-400' },
  ready_to_deploy: { label: 'Ready',        dot: 'bg-blue-400',    text: 'text-blue-400' },
  invite_only:     { label: 'Invite Only',  dot: 'bg-violet-400',  text: 'text-violet-400' },
  in_development:  { label: 'Dev',          dot: 'bg-amber-400',   text: 'text-amber-400' },
  coming_soon:     { label: 'Soon',         dot: 'bg-slate-400',   text: 'text-slate-400' },
  concept:         { label: 'Concept',      dot: 'bg-purple-400',  text: 'text-purple-400' },
  offline:         { label: 'Offline',      dot: 'bg-slate-600',   text: 'text-slate-500' },
}

const HEALTH: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  healthy:  { color: 'text-emerald-400', icon: CheckCircle, label: 'Healthy' },
  degraded: { color: 'text-amber-400',   icon: Clock,       label: 'Degraded' },
  error:    { color: 'text-red-400',     icon: AlertCircle, label: 'Error' },
  unknown:  { color: 'text-slate-500',   icon: WifiOff,     label: 'Unknown' },
  offline:  { color: 'text-slate-500',   icon: WifiOff,     label: 'Offline' },
}

// ── Token copy helper ────────────────────────────────────────────
function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-slate-500">
        {show ? token : `${token.slice(0, 8)}…`}
      </span>
      <button onClick={() => setShow(s => !s)} className="text-slate-600 hover:text-slate-400">
        {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button onClick={handle} className={`transition-colors ${copied ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  )
}

// ── App detail drawer ────────────────────────────────────────────
function AppDrawer({ app, onClose }: { app: AppRecord; onClose: () => void }) {
  const health = app.integration ? (HEALTH[app.integration.healthStatus] ?? HEALTH.unknown) : null
  const status = STATUS[app.status] ?? STATUS.offline
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-sm bg-[#080E1C] border-l border-white/8 h-full overflow-y-auto"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{app.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{app.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              <span className={status.text}>{status.label}</span>
            </span>
            {app.aiEnabled && (
              <span className="flex items-center gap-1 text-xs text-violet-400">
                <Brain className="w-3 h-3" /> AI
              </span>
            )}
            {app.monitoringEnabled && (
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <MonitorDot className="w-3 h-3" /> Monitored
              </span>
            )}
          </div>

          {/* Connection status */}
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Connection Status</p>
            {app.integration ? (
              <div className="bg-white/[0.03] border border-white/8 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Health</span>
                  {health && (
                    <span className={`flex items-center gap-1 text-xs ${health.color}`}>
                      <health.icon className="w-3 h-3" />
                      {health.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Environment</span>
                  <span className="text-xs text-white font-mono">{app.integration.environment}</span>
                </div>
                {app.integration.lastHeartbeatAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Last heartbeat</span>
                    <span className="text-xs text-slate-300">
                      {formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 mb-1">Integration token</p>
                  <CopyToken token={app.integration.integrationToken} />
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/8 rounded-lg p-3 text-sm text-slate-500">
                No integration configured.{' '}
                <a href="/admin/dashboard/integrations" className="text-blue-400 hover:text-blue-300">
                  Set up integration →
                </a>
              </div>
            )}
          </div>

          {/* App details */}
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Details</p>
            <div className="space-y-2 bg-white/[0.03] border border-white/8 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Category</span>
                <span className="text-xs text-white">{app.category || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Onboarding</span>
                <span className="text-xs text-white capitalize">{app.onboardingStatus}</span>
              </div>
              {app.primaryUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Public URL</span>
                  <a href={app.primaryUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Add App drawer ────────────────────────────────────────────────
function AddAppDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) { setError('Name and slug are required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          category: category.trim() || 'General',
          status: 'in_development',
          shortDescription: '',
          longDescription: '',
        }),
      })
      if (res.ok) { onCreated(); onClose() }
      else { const d = await res.json(); setError(d.error ?? 'Failed to create app') }
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-sm bg-[#080E1C] border-l border-white/8 h-full overflow-y-auto"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Register App</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">App Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amarktai Marketing"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Slug *</label>
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="e.g. amarktai-marketing"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 font-mono" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Marketing, Travel"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Register App
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function AppsRegistryPage() {
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AppRecord | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products')
      if (res.ok) setApps(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">App Registry</h1>
          <p className="text-sm text-slate-500 mt-1">Connected apps and their integration status.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Register App
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0A1020] border border-white/8 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin mx-auto" />
          </div>
        ) : apps.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500 mb-3">No apps registered yet.</p>
            <button onClick={() => setShowAdd(true)} className="text-xs text-blue-400 hover:text-blue-300">
              Register your first app →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide">App</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide hidden md:table-cell">AI</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide">Connection</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide hidden lg:table-cell">Last Seen</th>
                  <th className="text-right px-4 py-3 text-[10px] text-slate-500 font-medium uppercase tracking-wide">URL</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app, i) => {
                  const status = STATUS[app.status] ?? STATUS.offline
                  const health = app.integration
                    ? (HEALTH[app.integration.healthStatus] ?? HEALTH.unknown)
                    : null
                  const HealthIcon = health?.icon ?? WifiOff
                  return (
                    <motion.tr
                      key={app.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelected(app)}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white font-medium">{app.name}</p>
                          <p className="text-[11px] text-slate-600 font-mono">{app.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                          <span className={status.text}>{status.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {app.aiEnabled ? (
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {app.integration ? (
                          <span className={`flex items-center gap-1 text-xs ${health?.color ?? 'text-slate-500'}`}>
                            <HealthIcon className="w-3 h-3" />
                            {health?.label ?? 'Unknown'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">No integration</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-slate-500">
                          {app.integration?.lastHeartbeatAt
                            ? formatDistanceToNow(new Date(app.integration.lastHeartbeatAt), { addSuffix: true })
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {app.primaryUrl ? (
                          <a href={app.primaryUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-xs">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawers */}
      {selected && <AppDrawer app={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddAppDrawer onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  )
}
