'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, MessageSquare, Image as ImageIcon, Mic, Video, Layers,
  CheckCircle, XCircle, AlertCircle,
} from 'lucide-react'

interface ModalityCapability {
  modality: string
  providers: string[]
  models: string[]
  status: 'active' | 'degraded' | 'offline'
}

interface MultimodalData {
  capabilities: ModalityCapability[]
  routes: Array<{ id: string; source: string; target: string; provider: string; model: string; latencyMs: number }>
  stats: { availableModalities: number; activeRoutes: number; supportedProviders: number; requestVolume: number }
  adultMode?: { available: boolean; enabled: boolean; safeMode: boolean; note: string }
  statusLabel?: string
}

const MODALITY_META: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; label: string }> = {
  text:       { icon: MessageSquare, color: 'text-blue-400',    label: 'Text' },
  image:      { icon: ImageIcon,     color: 'text-violet-400',  label: 'Image' },
  voice:      { icon: Mic,           color: 'text-emerald-400', label: 'Voice' },
  video:      { icon: Video,         color: 'text-rose-400',    label: 'Video' },
  embeddings: { icon: Layers,        color: 'text-amber-400',   label: 'Embeddings' },
}

const STATUS_STYLE: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; bg: string; label: string }> = {
  active:   { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Active' },
  degraded: { icon: AlertCircle, color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Degraded' },
  offline:  { icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Offline' },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function MediaPage() {
  const [data, setData] = useState<MultimodalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/multimodal')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="ml-3 text-sm text-slate-400">Loading media capabilities…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-400">{error}</p>
        <button onClick={load} className="btn-primary text-sm">Retry</button>
      </div>
    )
  }

  const caps = data?.capabilities ?? []
  const modalities = ['image', 'video', 'voice', 'text']

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Media</h1>
        <p className="text-sm text-slate-400 mt-1">Image, video, voice, and multimodal capability status</p>
      </motion.div>

      {/* Stats strip */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Modalities', value: data?.stats?.availableModalities ?? 0 },
          { label: 'Active Routes', value: data?.stats?.activeRoutes ?? 0 },
          { label: 'Providers', value: data?.stats?.supportedProviders ?? 0 },
          { label: 'Requests', value: data?.stats?.requestVolume ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{s.label}</p>
            <p className="text-xl font-bold text-white font-heading mt-1">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Modality Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modalities.map((mod) => {
          const cap = caps.find((c) => c.modality === mod)
          const meta = MODALITY_META[mod] ?? MODALITY_META.text
          const Icon = meta.icon
          const status = cap ? STATUS_STYLE[cap.status] ?? STATUS_STYLE.offline : STATUS_STYLE.offline
          const StatusIcon = status.icon

          return (
            <div key={mod} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                    <p className="text-xs text-slate-500">{mod} processing</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-white/[0.06] ${status.bg} ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>

              {cap ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1">Providers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(cap.providers ?? []).length > 0 ? (cap.providers ?? []).map((p) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{p}</span>
                      )) : <span className="text-xs text-slate-600">None connected</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1">Models</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(cap.models ?? []).length > 0 ? (cap.models ?? []).map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-300 border border-white/[0.06]">{m}</span>
                      )) : <span className="text-xs text-slate-600">No models</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-500">Capability not available</p>
                  <p className="text-[10px] text-slate-600 mt-1">No provider connected for this modality</p>
                </div>
              )}
            </div>
          )
        })}
      </motion.div>

      {/* Adult 18+ Capability */}
      <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Adult 18+ Content Mode</h2>
        {data?.adultMode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-white/[0.06] ${
                data.adultMode.enabled
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-white/[0.04] text-slate-400'
              }`}>
                {data.adultMode.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className={`text-xs ${data.adultMode.safeMode ? 'text-emerald-400' : 'text-amber-400'}`}>
                Safe Mode: {data.adultMode.safeMode ? 'On' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-slate-500">{data.adultMode.note}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Adult mode configuration not available.</p>
        )}
      </motion.div>

      {/* Multimodal Status */}
      <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Multimodal Status</h2>
        {caps.length === 0 ? (
          <p className="text-sm text-slate-500">No multimodal capabilities detected.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  <th className="pb-3 pr-4">Modality</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Providers</th>
                  <th className="pb-3">Models</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {caps.map((c) => {
                  const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.offline
                  return (
                    <tr key={c.modality}>
                      <td className="py-3 pr-4 text-white font-medium capitalize">{c.modality}</td>
                      <td className={`py-3 pr-4 ${st.color}`}>{st.label}</td>
                      <td className="py-3 pr-4 text-slate-400">{(c.providers ?? []).join(', ') || '—'}</td>
                      <td className="py-3 text-slate-400">{(c.models ?? []).length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
