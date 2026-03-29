'use client'

import { useEffect, useState, useCallback } from 'react'
import { Database, RefreshCw, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'

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

interface MemoryEntry {
  id: number
  appSlug: string
  memoryType: string
  key: string
  content: string
  importance: number
  createdAt: string
}

export default function MemoryPage() {
  const [memory, setMemory] = useState<MemoryStatus | null>(null)
  const [retrieval, setRetrieval] = useState<RetrievalStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memory entries browsing
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [entriesPage, setEntriesPage] = useState(1)
  const [entriesTotalPages, setEntriesTotalPages] = useState(1)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [filterApp, setFilterApp] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [memRes, retRes] = await Promise.all([
        fetch('/api/admin/memory'),
        fetch('/api/admin/retrieval'),
      ])
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

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true)
    try {
      const params = new URLSearchParams({ page: String(entriesPage), limit: '20' })
      if (filterType) params.set('type', filterType)
      // The learning endpoint queries the memoryEntry table which stores
      // all memory entries — this is shared between the Memory and Learning pages.
      const res = await fetch(`/api/admin/learning?${params}`)
      if (res.ok) {
        const body = await res.json()
        setEntries(body.entries ?? [])
        setEntriesTotalPages(body.totalPages ?? 1)
      }
    } catch {
      // Silently fail — entries are optional
    } finally {
      setEntriesLoading(false)
    }
  }, [entriesPage, filterType])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadEntries() }, [loadEntries])

  const STATUS_COLOR: Record<string, string> = {
    saving: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    empty: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    not_configured: 'text-red-400 bg-red-500/10 border-red-500/20',
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    limited: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    unavailable: 'text-red-400 bg-red-500/10 border-red-500/20',
  }

  const TYPE_COLORS: Record<string, string> = {
    event: 'text-blue-400 bg-blue-500/10',
    summary: 'text-violet-400 bg-violet-500/10',
    context: 'text-amber-400 bg-amber-500/10',
    learned: 'text-emerald-400 bg-emerald-500/10',
  }

  const filteredEntries = entries.filter(e => !filterApp || e.appSlug === filterApp)

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 text-transparent bg-clip-text">Memory &amp; Retrieval</h1>
          <p className="text-sm text-slate-500 mt-1">
            Memory layer status, retrieval engine, and stored entries.
          </p>
        </div>
        <button
          onClick={() => { load(); loadEntries() }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-slate-500">Total Entries</p>
              <p className="text-xl font-bold text-white mt-1">{memory?.totalEntries ?? 0}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-slate-500">App Namespaces</p>
              <p className="text-xl font-bold text-white mt-1">{memory?.appSlugs?.length ?? 0}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-slate-500">Indexed Entries</p>
              <p className="text-xl font-bold text-white mt-1">{retrieval?.totalIndexedEntries ?? 0}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-xs text-slate-500">Retrieval Namespaces</p>
              <p className="text-xl font-bold text-white mt-1">{retrieval?.appNamespaces?.length ?? 0}</p>
            </div>
          </div>

          {/* Memory section */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
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
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
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

          {/* Memory Growth Chart placeholder */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">Memory Usage Over Time</h2>
            <div className="h-32 flex items-end gap-1" aria-label="Memory growth visualization">
              {Array.from({ length: 30 }, (_, i) => {
                const height = Math.max(4, Math.min(100, 20 + Math.floor(Math.random() * 50) + i * 2))
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-emerald-500/40 to-emerald-400/20 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`Day ${i + 1}`}
                  />
                )
              })}
            </div>
            <p className="text-[10px] text-slate-600 mt-2">Last 30 days (simulated — connect to real metrics for live data)</p>
          </div>

          {/* Memory Entries Browser */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <Search className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-white">Browse Memory Entries</h2>
              <div className="flex-1" />
              <select
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setEntriesPage(1) }}
                className="text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-slate-400 focus:outline-none"
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                <option value="event">Event</option>
                <option value="summary">Summary</option>
                <option value="context">Context</option>
                <option value="learned">Learned</option>
              </select>
              {memory?.appSlugs && memory.appSlugs.length > 1 && (
                <select
                  value={filterApp}
                  onChange={e => setFilterApp(e.target.value)}
                  className="text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-slate-400 focus:outline-none"
                  aria-label="Filter by app"
                >
                  <option value="">All apps</option>
                  {memory.appSlugs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            {entriesLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading entries...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No memory entries found. The brain will store entries as it processes requests.
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/[0.04]">
                  {filteredEntries.map(entry => (
                    <div key={entry.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[entry.memoryType] ?? 'text-slate-400 bg-slate-500/10'}`}>
                          {entry.memoryType}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono">{entry.appSlug}</span>
                        <span className="text-[10px] text-slate-600 ml-auto">
                          importance: {entry.importance}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mb-0.5">{entry.key}</p>
                      <p className="text-xs text-slate-300 line-clamp-2">{entry.content}</p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => setEntriesPage(p => Math.max(1, p - 1))}
                    disabled={entriesPage <= 1}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" /> Previous
                  </button>
                  <span className="text-xs text-slate-500">Page {entriesPage} / {entriesTotalPages}</span>
                  <button
                    onClick={() => setEntriesPage(p => Math.min(entriesTotalPages, p + 1))}
                    disabled={entriesPage >= entriesTotalPages}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </>
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
