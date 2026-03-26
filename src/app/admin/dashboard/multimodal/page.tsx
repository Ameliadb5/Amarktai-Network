'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'

interface MultimodalStatus {
  available: boolean
  supportedContentTypes: string[]
  textGenerationReady: boolean
  imagePromptReady: boolean
  videoConceptReady: boolean
  campaignPlanReady: boolean
  statusLabel: string
}

const READINESS_ITEMS: { key: keyof MultimodalStatus; label: string; color: string }[] = [
  { key: 'textGenerationReady', label: 'Text Generation', color: 'text-blue-400' },
  { key: 'imagePromptReady', label: 'Image Prompts', color: 'text-violet-400' },
  { key: 'videoConceptReady', label: 'Video Concepts', color: 'text-rose-400' },
  { key: 'campaignPlanReady', label: 'Campaign Plans', color: 'text-amber-400' },
]

export default function MultimodalPage() {
  const [data, setData] = useState<MultimodalStatus | null>(null)
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

  const readyCount = data ? READINESS_ITEMS.filter(r => data[r.key] === true).length : 0

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Multimodal Services</h1>
          <p className="text-sm text-slate-500 mt-1">
            Content generation capabilities — text, image, video, and campaigns.
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
      ) : data ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Content Types</p>
              <p className="text-xl font-bold text-white mt-1">{data.supportedContentTypes?.length ?? 0}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Ready Channels</p>
              <p className="text-xl font-bold text-white mt-1">{readyCount} / {READINESS_ITEMS.length}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Status</p>
              <p className={`text-xl font-bold mt-1 ${data.available ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.statusLabel ?? (data.available ? 'Active' : 'Unavailable')}
              </p>
            </div>
          </div>

          {/* Readiness grid */}
          <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4">Channel Readiness</h2>
            <div className="grid grid-cols-2 gap-3">
              {READINESS_ITEMS.map(item => {
                const ready = data[item.key] === true
                return (
                  <div
                    key={item.key}
                    className={`rounded-lg p-4 border ${ready ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/10'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${ready ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span className={`text-sm font-medium ${ready ? 'text-white' : 'text-slate-500'}`}>{item.label}</span>
                    </div>
                    <p className={`text-xs ${ready ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {ready ? 'Ready' : 'Not configured'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content types */}
          {data.supportedContentTypes && data.supportedContentTypes.length > 0 && (
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-3">Supported Content Types</h2>
              <div className="flex gap-2 flex-wrap">
                {data.supportedContentTypes.map(ct => (
                  <span key={ct} className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg font-mono">
                    {ct}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <p className="text-xs text-slate-600">
        Multimodal status depends on configured AI providers. Enable more providers to unlock additional content types.
      </p>
    </div>
  )
}
