'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Image as ImageIcon, FileAudio, Video, Code2, FileText, Download,
  RefreshCw, AlertCircle, Eye, Trash2, Filter,
} from 'lucide-react'

interface Artifact {
  id: string
  appSlug: string
  type: string
  subType: string
  title: string
  description: string
  provider: string
  model: string
  storageUrl: string
  mimeType: string
  fileSizeBytes: number
  previewable: boolean
  downloadable: boolean
  status: string
  costUsdCents: number
  metadata: Record<string, unknown>
  createdAt: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const TYPE_META: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; label: string }> = {
  image:      { icon: ImageIcon, color: 'text-violet-400',  label: 'Image' },
  audio:      { icon: FileAudio, color: 'text-emerald-400', label: 'Audio' },
  music:      { icon: FileAudio, color: 'text-pink-400',    label: 'Music' },
  video:      { icon: Video,     color: 'text-rose-400',    label: 'Video' },
  code:       { icon: Code2,     color: 'text-blue-400',    label: 'Code' },
  document:   { icon: FileText,  color: 'text-amber-400',   label: 'Document' },
  report:     { icon: FileText,  color: 'text-cyan-400',    label: 'Report' },
  transcript: { icon: FileText,  color: 'text-slate-400',   label: 'Transcript' },
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [appFilter, setAppFilter] = useState<string>('')
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (appFilter) params.set('appSlug', appFilter)
      params.set('limit', '50')

      const [listRes, countsRes, storageRes] = await Promise.all([
        fetch(`/api/admin/artifacts?${params}`),
        fetch('/api/admin/artifacts?counts=true'),
        fetch('/api/admin/artifacts?storage-info=true'),
      ])

      if (listRes.ok) {
        const data = await listRes.json()
        setArtifacts(data.artifacts ?? [])
        setTotal(data.total ?? 0)
      }
      if (countsRes.ok) {
        const data = await countsRes.json()
        setCounts(data.counts ?? {})
      }
      if (storageRes.ok) {
        interface StorageInfoResponse { ephemeral?: boolean; warning?: string | null }
        const storageInfo = await storageRes.json() as StorageInfoResponse
        const isEphemeral = typeof storageInfo?.ephemeral === 'boolean' ? storageInfo.ephemeral : false
        const warningText = typeof storageInfo?.warning === 'string' ? storageInfo.warning : null
        setStorageWarning(isEphemeral ? warningText : null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, appFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this artifact?')) return
    try {
      await fetch('/api/admin/artifacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch {
      // Ignore
    }
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  if (loading && artifacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="ml-3 text-sm text-slate-400">Loading artifacts…</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-400" />
              Artifact Library
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {totalCount} total artifacts across all apps
            </p>
          </div>
          <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Storage persistence warning — shown when local file storage is active */}
      {storageWarning && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">Ephemeral Storage — Files Will Be Lost on Redeploy</p>
              <p className="text-xs text-slate-400 mt-1">{storageWarning}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Type Counts */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const count = counts[type] ?? 0
            const Icon = meta.icon
            const active = typeFilter === type
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(active ? '' : type)}
                className={`rounded-xl border p-3 text-center transition-colors ${
                  active
                    ? 'border-blue-500/30 bg-blue-500/10'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'
                }`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${meta.color}`} />
                <div className="text-lg font-bold text-white">{count}</div>
                <div className="text-xs text-slate-400">{meta.label}</div>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          Filters:
        </div>
        <input
          type="text"
          placeholder="Filter by app slug…"
          value={appFilter}
          onChange={e => setAppFilter(e.target.value)}
          className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 w-48"
        />
        {(typeFilter || appFilter) && (
          <button
            onClick={() => { setTypeFilter(''); setAppFilter('') }}
            className="text-xs text-slate-400 hover:text-white"
          >
            Clear filters
          </button>
        )}
      </motion.div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 inline mr-2" />{error}
        </div>
      )}

      {/* Artifact Grid */}
      {artifacts.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No artifacts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artifacts.map(a => (
            <ArtifactCard key={a.id} artifact={a} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {total > artifacts.length && (
        <p className="text-sm text-slate-500 text-center">
          Showing {artifacts.length} of {total} artifacts
        </p>
      )}
    </div>
  )
}

function ArtifactCard({ artifact: a, onDelete }: { artifact: Artifact; onDelete: (id: string) => void }) {
  const meta = TYPE_META[a.type] ?? TYPE_META['document']
  const Icon = meta.icon

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
      {/* Preview */}
      {a.previewable && a.storageUrl && (
        <div className="mb-3">
          {a.type === 'image' && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={a.storageUrl} alt={a.title} className="w-full h-40 object-cover rounded-xl" />
          )}
          {(a.type === 'audio' || a.type === 'music') && (
            <audio controls className="w-full h-8" preload="none">
              <source src={a.storageUrl} type={a.mimeType || 'audio/mpeg'} />
            </audio>
          )}
          {a.type === 'video' && (
            <video controls className="w-full h-40 rounded-xl" preload="none">
              <source src={a.storageUrl} type={a.mimeType || 'video/mp4'} />
            </video>
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate">
            {a.title || `${a.type} artifact`}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{a.appSlug} • {a.provider}/{a.model}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
              a.status === 'failed' ? 'bg-red-500/10 text-red-400' :
              'bg-amber-500/10 text-amber-400'
            }`}>
              {a.status}
            </span>
            {a.costUsdCents > 0 && (
              <span className="text-xs text-slate-500">${(a.costUsdCents / 100).toFixed(2)}</span>
            )}
            {a.fileSizeBytes > 0 && (
              <span className="text-xs text-slate-500">
                {a.fileSizeBytes > 1_000_000
                  ? `${(a.fileSizeBytes / 1_000_000).toFixed(1)}MB`
                  : `${(a.fileSizeBytes / 1_000).toFixed(0)}KB`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05]">
        {a.storageUrl && a.previewable && (
          <a href={a.storageUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <Eye className="w-3 h-3" /> View
          </a>
        )}
        {a.storageUrl && a.downloadable && (
          <a href={a.storageUrl} download
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <Download className="w-3 h-3" /> Download
          </a>
        )}
        <button
          onClick={() => onDelete(a.id)}
          className="text-xs text-red-400/60 hover:text-red-400 flex items-center gap-1 ml-auto"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  )
}
