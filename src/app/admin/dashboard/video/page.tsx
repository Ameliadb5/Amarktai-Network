'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Film, RefreshCw, AlertCircle, Loader2, Clock,
  CheckCircle, XCircle, Zap, DollarSign, Play, Sparkles,
  Download,
} from 'lucide-react'

/* ── Types ───────────────────────────────────────────────── */
interface VideoModel {
  model_id: string
  display_name: string
  provider: string
  cost_tier: string
  specialist_domains: string[]
}

interface VideoData {
  models: VideoModel[]
  stats: { total: number; pending: number; processing: number; completed: number; failed: number }
}

const glass = 'bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl'

/* ── Page ────────────────────────────────────────────────── */
export default function VideoDashboardPage() {
  const [data, setData] = useState<VideoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── Creation state ── */
  const [prompt, setPrompt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [modelsRes, jobsRes] = await Promise.all([
        fetch('/api/admin/models'),
        fetch('/api/admin/jobs'),
      ])

      let videoModels: VideoModel[] = []
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json()
        const allModels = modelsData.models ?? modelsData ?? []
        videoModels = allModels.filter((m: { supports_video_generation?: boolean }) => m.supports_video_generation)
      }

      let stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        stats = jobsData.video ?? stats
      }

      setData({ models: videoModels, stats })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* Clear polling on unmount */
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  const generateVideo = useCallback(async () => {
    if (!prompt.trim()) return
    setCreating(true)
    setCreateError(null)
    setVideoUrl(null)
    setVideoJobId(null)
    setVideoStatus('submitting')

    try {
      const res = await fetch('/api/brain/video-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: '__admin_test__', appSecret: 'admin-test-secret', prompt }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Video generation request failed')
      }

      if (data.videoJobId) {
        setVideoJobId(data.videoJobId)
        setVideoStatus('queued')
        // Poll for completion
        const poll = setInterval(async () => {
          try {
            const pr = await fetch(`/api/brain/video-generate/${data.videoJobId}`)
            const pj = await pr.json()
            setVideoStatus(pj.status ?? 'processing')
            if (pj.status === 'completed' && pj.videoUrl) {
              setVideoUrl(pj.videoUrl)
              clearInterval(poll)
              pollingRef.current = null
              setCreating(false)
              fetchData() // Refresh stats
            } else if (pj.status === 'failed') {
              setCreateError(pj.error ?? 'Video generation failed')
              clearInterval(poll)
              pollingRef.current = null
              setCreating(false)
            }
          } catch { /* retry next tick */ }
        }, 5000)
        pollingRef.current = poll
      } else if (data.videoUrl) {
        setVideoUrl(data.videoUrl)
        setVideoStatus('completed')
        setCreating(false)
      } else {
        setVideoStatus('queued')
        setCreating(false)
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to submit video generation')
      setVideoStatus(null)
      setCreating(false)
    }
  }, [prompt, fetchData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Film className="w-5 h-5 text-pink-400" />
            Video Generation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create videos via multi-provider queue-backed execution</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className={`${glass} p-4 border-red-500/20`}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      {/* ── Video Creation Form ── */}
      <div className={`${glass} p-6 space-y-4`}>
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-400" />
          Create Video
        </h2>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate…"
          rows={3}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/40 resize-none"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={generateVideo}
            disabled={creating || !prompt.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {creating ? 'Generating…' : 'Generate Video'}
          </button>
          {videoStatus && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              {videoStatus === 'completed' ? <CheckCircle className="w-3 h-3 text-emerald-400" /> :
               videoStatus === 'failed' ? <XCircle className="w-3 h-3 text-red-400" /> :
               <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
              {videoStatus === 'completed' ? 'Complete' : videoStatus === 'failed' ? 'Failed' : `Status: ${videoStatus}`}
              {videoJobId && <span className="text-slate-600 ml-1">({videoJobId.slice(0, 8)}…)</span>}
            </span>
          )}
        </div>

        {createError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {createError}
          </div>
        )}

        {videoUrl && (
          <div className="space-y-3">
            <video controls src={videoUrl} className="max-w-full rounded-lg border border-white/[0.06]" />
            <a href={videoUrl} download className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300">
              <Download className="w-3 h-3" /> Download video
            </a>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : data && (
        <>
          {/* Job Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Jobs', value: data.stats.total, icon: Film, color: 'text-white' },
              { label: 'Pending', value: data.stats.pending, icon: Clock, color: 'text-amber-400' },
              { label: 'Processing', value: data.stats.processing, icon: Loader2, color: 'text-blue-400' },
              { label: 'Completed', value: data.stats.completed, icon: CheckCircle, color: 'text-green-400' },
              { label: 'Failed', value: data.stats.failed, icon: XCircle, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={`${glass} p-4`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                </div>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Available Video Models */}
          <div className={`${glass} p-6`}>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-violet-400" />
              Available Video Models ({data.models.length})
            </h2>
            {data.models.length === 0 ? (
              <p className="text-xs text-slate-500">No video models configured. Enable providers with video generation support in Operations.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.models.map(m => (
                  <div key={m.model_id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-sm font-medium text-white truncate">{m.display_name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.model_id}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {m.provider}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 flex items-center gap-1">
                        <DollarSign className="w-2.5 h-2.5" /> {m.cost_tier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline Info — collapsed into a small note */}
          <div className="text-[10px] text-slate-600 px-1 space-y-0.5">
            <p>Pipeline: POST /api/brain/video-generate → Brain Routing → BullMQ Queue → Provider → Webhook</p>
            <p>Supported providers: Runway, Pika, Luma, Replicate, OpenAI (when enabled). Budget mode respected.</p>
          </div>
        </>
      )}
    </motion.div>
  )
}
