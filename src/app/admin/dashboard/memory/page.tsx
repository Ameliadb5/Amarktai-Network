'use client'

import { useEffect, useState, useCallback } from 'react'
import { Database, RefreshCw, AlertCircle } from 'lucide-react'

interface MemoryStatus {
  available: boolean
  totalEntries: number
  appSlugs: string[]
  statusLabel: string
  error?: string
}

interface RetrievalStatus {
  available: boolean
  embeddingsEnabled: boolean
  rerankEnabled: boolean
  totalIndexedEntries: number
  appNamespaces: string[]
  statusLabel: string
}

export default function MemoryPage() {
  const [memory, setMemory] = useState<MemoryStatus | null>(null)
  const [retrieval, setRetrieval] = useState<RetrievalStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [memRes, retRes] = await Promise.all([
        fetch('/api/admin/memory'),
        fetch('/api/admin/retrieval'),
      ])
      // Try to get body even on errors for better messages
      const memBody = await memRes.json().catch(() => ({}))
      const retBody = await retRes.json().catch(() => ({}))
      if (!memRes.ok) {
        const msg = memBody.error ?? `Memory API: HTTP ${memRes.status}`
        const hint = memRes.status === 503 ? ' Configure DATABASE_URL to enable memory.' : ''
        throw new Error(msg + hint)
      }
      if (!retRes.ok) {
        const msg = retBody.error ?? `Retrieval API: HTTP ${retRes.status}`
        const hint = retRes.status === 503 ? ' Configure DATABASE_URL to enable retrieval.' : ''
        throw new Error(msg + hint)
      }
      setMemory(memBody)
      setRetrieval(retBody)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const STATUS_COLOR: Record<string, string> = {
    saving: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    empty: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    not_configured: 'text-red-400 bg-red-500/10 border-red-500/20',
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    limited: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    unavailable: 'text-red-400 bg-red-500/10 border-red-500/20',
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Memory &amp; Retrieval</h1>
          <p className="text-sm text-slate-500 mt-1">
            Memory layer status and retrieval engine configuration.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#0A1020] border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Entries</p>
              <p className="text-xl font-bold text-white mt-1">{memory?.totalEntries ?? 0}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">App Namespaces</p>
              <p className="text-xl font-bold text-white mt-1">{memory?.appSlugs?.length ?? 0}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Indexed Entries</p>
              <p className="text-xl font-bold text-white mt-1">{retrieval?.totalIndexedEntries ?? 0}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Retrieval Namespaces</p>
              <p className="text-xl font-bold text-white mt-1">{retrieval?.appNamespaces?.length ?? 0}</p>
            </div>
          </div>

          {/* Memory section */}
          <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-green-400" />
              <h2 className="text-sm font-bold text-white">Memory Layer</h2>
              <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[memory?.statusLabel ?? ''] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                {memory?.statusLabel ?? 'unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Available</p>
                <p className={`text-sm font-medium ${memory?.available ? 'text-emerald-400' : 'text-red-400'}`}>
                  {memory?.available ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Total Entries</p>
                <p className="text-sm text-white">{memory?.totalEntries ?? 0}</p>
              </div>
            </div>
            {memory?.appSlugs && memory.appSlugs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 uppercase mb-2">App Slugs</p>
                <div className="flex gap-1 flex-wrap">
                  {memory.appSlugs.map(slug => (
                    <span key={slug} className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">
                      {slug}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {memory?.error && (
              <p className="text-xs text-red-400 mt-2">{memory.error}</p>
            )}
          </div>

          {/* Retrieval section */}
          <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Retrieval Engine</h2>
              <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[retrieval?.statusLabel ?? ''] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                {retrieval?.statusLabel ?? 'unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Available</p>
                <p className={`text-sm font-medium ${retrieval?.available ? 'text-emerald-400' : 'text-red-400'}`}>
                  {retrieval?.available ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Embeddings</p>
                <p className={`text-sm font-medium ${retrieval?.embeddingsEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {retrieval?.embeddingsEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Rerank</p>
                <p className={`text-sm font-medium ${retrieval?.rerankEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {retrieval?.rerankEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Indexed</p>
                <p className="text-sm text-white">{retrieval?.totalIndexedEntries ?? 0}</p>
              </div>
            </div>
            {retrieval?.appNamespaces && retrieval.appNamespaces.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 uppercase mb-2">Retrieval Namespaces</p>
                <div className="flex gap-1 flex-wrap">
                  {retrieval.appNamespaces.map(ns => (
                    <span key={ns} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono">
                      {ns}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-slate-600">
        Memory entries are persisted in the database. Retrieval engine indexes entries for semantic search.
      </p>
    </div>
  )
}
