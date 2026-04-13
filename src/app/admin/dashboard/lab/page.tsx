'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, Copy, Check, Gauge, CheckCircle, XCircle,
  Zap, Info, RefreshCw, Route, AlertCircle, ShieldAlert, Radio, Mic, Upload,
  BookOpen,
} from 'lucide-react'

const CAPABILITIES = [
  'chat', 'code', 'reasoning', 'image', 'image_editing', 'video', 'video_planning',
  'tts', 'stt', 'vision', 'embeddings', 'reranking', 'research', 'suggestive',
  'adult_image', 'app_builder',
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

interface ProviderOption {
  key: string
  label: string
  healthStatus: string
}

interface CapabilityEntry {
  capability: string
  available: boolean
  reason: string | null
  routeExists: boolean
}

interface ModelOption {
  id: string
  name: string
  provider: string
  category: string
}

interface TestResult {
  success: boolean
  executed: boolean
  output: string | null
  capability: string[]
  capabilityRoutes?: Array<{ capability: string; available: boolean; reason: string | null }>
  routedProvider: string | null
  routedModel: string | null
  executionMode: string | null
  confidenceScore: number | null
  validationUsed: boolean
  consensusUsed: boolean
  fallbackUsed: boolean
  fallback_used: boolean
  routingReason?: string
  warnings: string[]
  error: string | null
  latencyMs: number
  imageUrl?: string | null
  audioUrl?: string | null
  videoStatus?: string | null
  sources?: Array<{ title: string; url: string; snippet?: string }> | null
}

export default function LabPage() {
  const [prompt, setPrompt] = useState('')
  const [capability, setCapability] = useState('chat')
  const [forceProvider, setForceProvider] = useState<string>('auto')
  const [forceModel, setForceModel] = useState<string>('auto')
  const [appProfile, setAppProfile] = useState<string>('__admin_test__')
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [capabilityStatus, setCapabilityStatus] = useState<CapabilityEntry[]>([])
  const [loadingCaps, setLoadingCaps] = useState(true)
  const [result, setResult] = useState<TestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // TTS-specific voice options
  const [ttsGender, setTtsGender] = useState<'male' | 'female' | ''>('')
  const [ttsVoiceId, setTtsVoiceId] = useState<string>('')
  const [ttsAccent, setTtsAccent] = useState<string>('')
  const [ttsProvider, setTtsProvider] = useState<string>('auto')
  // Streaming preview
  const [streamMode, setStreamMode] = useState(false)
  const [streamOutput, setStreamOutput] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  // STT file upload
  const sttFileRef = useRef<HTMLInputElement>(null)
  const [sttFile, setSttFile] = useState<File | null>(null)
  // Video job polling
  const [_videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const [provRes, modRes] = await Promise.all([
        fetch('/api/admin/providers'),
        fetch('/api/admin/models'),
      ])
      if (provRes.ok) {
        const data = await provRes.json()
        const list: ProviderOption[] = Array.isArray(data)
          ? data
              .filter((p: { enabled: boolean }) => p.enabled)
              .map((p: { providerKey: string; displayName: string; healthStatus: string }) => ({
                key: p.providerKey,
                label: p.displayName,
                healthStatus: p.healthStatus,
              }))
          : []
        setProviders(list)
      }
      if (modRes.ok) {
        const modData = await modRes.json()
        const raw = Array.isArray(modData) ? modData : (modData?.models ?? [])
        setModels(raw.map((m: { model_id?: string; id?: string; model_name?: string; display_name?: string; provider?: string; category?: string }) => ({
          id: m.model_id ?? m.id ?? '',
          name: m.model_name ?? m.display_name ?? m.model_id ?? m.id ?? '',
          provider: m.provider ?? '',
          category: m.category ?? 'text',
        })))
      }
    } catch {
      // best-effort
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  const loadCapabilities = useCallback(async () => {
    setLoadingCaps(true)
    try {
      const res = await fetch('/api/admin/routing')
      if (res.ok) {
        const data = await res.json()
        setCapabilityStatus(data.capabilities ?? [])
      }
    } catch {
      // best-effort
    } finally {
      setLoadingCaps(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
    loadCapabilities()
  }, [loadProviders, loadCapabilities])

  // Cleanup video polling on unmount
  useEffect(() => {
    return () => {
      if (videoPollingRef.current) clearInterval(videoPollingRef.current)
    }
  }, [])

  const handleRun = async () => {
    if (!prompt.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const body: Record<string, unknown> = {
        message: prompt.trim(),
        taskType: capability,
      }
      if (forceProvider !== 'auto') {
        body.providerKey = forceProvider
      }
      if (forceModel !== 'auto') {
        body.modelId = forceModel
      }
      body.appSlug = appProfile
      // TTS-specific voice options
      if (['tts', 'voice', 'voice_output'].includes(capability)) {
        if (ttsGender) body.gender = ttsGender
        if (ttsVoiceId) body.voiceId = ttsVoiceId
        if (ttsAccent) body.accent = ttsAccent
        if (ttsProvider !== 'auto') body.ttsProvider = ttsProvider
      }
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      // Throw for network-level errors that have no usable routing metadata.
      // When the response contains routedProvider or capability data (even on 4xx/5xx),
      // we still render the routing decision panel rather than just showing a generic error.
      if (!res.ok && data.routedProvider == null && !(Array.isArray(data.capability) && data.capability.length > 0)) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      // Image-class guard: if the capability is image-related but the backend
      // returned text output without an imageUrl, treat it as an execution failure
      // rather than a success. This prevents a chat-model text response from
      // appearing as a successful image generation.
      const IMAGE_CLASS_CAPABILITIES = new Set([
        'image_generation', 'image_editing', 'adult_18plus_image', 'suggestive_image_generation',
      ])
      const resolvedCapabilities: string[] = Array.isArray(data.capability) ? data.capability : []
      const resolvedImageUrl: string | null = data.imageUrl ?? data.image_url ?? null
      const isImageClassResponse = resolvedCapabilities.some((c: string) => IMAGE_CLASS_CAPABILITIES.has(c))
      const imageClassWithoutImage = isImageClassResponse && !resolvedImageUrl && !!data.output && typeof data.output === 'string'

      setResult({
        success: imageClassWithoutImage ? false : (data.success ?? res.ok),
        executed: imageClassWithoutImage ? false : (data.executed ?? (data.success ?? false)),
        output: imageClassWithoutImage ? null : (data.output ?? null),
        capability: resolvedCapabilities,
        capabilityRoutes: data.capabilityRoutes,
        routedProvider: data.routedProvider ?? null,
        routedModel: data.routedModel ?? null,
        executionMode: data.executionMode ?? null,
        confidenceScore: data.confidenceScore ?? null,
        validationUsed: data.validationUsed ?? false,
        consensusUsed: data.consensusUsed ?? false,
        fallbackUsed: data.fallbackUsed ?? false,
        fallback_used: data.fallback_used ?? false,
        routingReason: data.routingReason,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        error: imageClassWithoutImage
          ? `Image generation executed through a chat model (${data.routedModel ?? 'unknown'}) — text output is not a valid image. Check provider/model dispatch.`
          : (data.error ?? null),
        latencyMs: data.latencyMs ?? 0,
        imageUrl: resolvedImageUrl,
        audioUrl: data.audioUrl ?? data.audio_url ?? null,
        videoStatus: data.videoStatus ?? data.video_status ?? null,
        sources: Array.isArray(data.sources)
          ? data.sources.map((s: unknown) =>
              typeof s === 'string'
                ? { title: s, url: s }
                : s as { title: string; url: string; snippet?: string }
            )
          : null,
      })

      // Start video job polling if result includes a jobId
      const jobId = data.jobId ?? data.job_id
      if (jobId && (capability === 'video' || capability === 'video_planning')) {
        setVideoJobId(jobId)
        setVideoUrl(null)
        if (videoPollingRef.current) clearInterval(videoPollingRef.current)
        videoPollingRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/brain/video-generate/${encodeURIComponent(jobId)}`)
            if (!pollRes.ok) return
            const pollData = await pollRes.json()
            setResult(prev => prev ? { ...prev, videoStatus: pollData.status } : prev)
            if (pollData.status === 'succeeded' && pollData.resultUrl) {
              setVideoUrl(pollData.resultUrl)
              if (videoPollingRef.current) clearInterval(videoPollingRef.current)
              videoPollingRef.current = null
            } else if (pollData.status === 'failed') {
              setResult(prev => prev ? { ...prev, videoStatus: `failed: ${pollData.errorMessage ?? 'unknown error'}` } : prev)
              if (videoPollingRef.current) clearInterval(videoPollingRef.current)
              videoPollingRef.current = null
            }
          } catch { /* polling retry on next interval */ }
        }, 3000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  const handleCopy = () => {
    if (!result?.output) return
    navigator.clipboard.writeText(result.output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /** Download a generated image by its URL (data: or https:). */
  const handleImageDownload = async (url: string) => {
    const filename = `generated-image-${Date.now()}.png`
    if (url.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 500)
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
  }

  /** Stream a chat/code/reasoning request via SSE from /api/brain/stream */
  const handleStream = async () => {
    if (!prompt.trim()) return
    setStreaming(true)
    setStreamOutput('')
    setError(null)
    try {
      const body: Record<string, unknown> = {
        message: prompt.trim(),
        taskType: capability,
      }
      if (forceProvider !== 'auto') body.providerKey = forceProvider
      if (forceModel !== 'auto') body.modelId = forceModel
      body.appSlug = appProfile

      const res = await fetch('/api/brain/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') break
            try {
              const parsed = JSON.parse(payload)
              const delta = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? ''
              if (delta) setStreamOutput(prev => prev + delta)
            } catch { /* ignore non-JSON events */ }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stream failed')
    } finally {
      setStreaming(false)
    }
  }

  /** Handle STT audio file upload */
  const handleSttFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSttFile(file)
    if (file) setPrompt(`[Audio file: ${file.name}]`)
  }

  const handleSttRun = async () => {
    if (!sttFile) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('audio', sttFile)
      if (forceProvider !== 'auto') formData.append('providerKey', forceProvider)
      if (appProfile) formData.append('appSlug', appProfile)
      const res = await fetch('/api/brain/stt', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult({
        success: true,
        executed: true,
        output: data.transcript ?? data.text ?? data.output ?? null,
        capability: ['stt'],
        routedProvider: data.provider ?? null,
        routedModel: data.model ?? null,
        executionMode: null,
        confidenceScore: null,
        validationUsed: false,
        consensusUsed: false,
        fallbackUsed: false,
        fallback_used: false,
        warnings: [],
        error: null,
        latencyMs: data.latencyMs ?? 0,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'STT failed')
    } finally {
      setRunning(false)
    }
  }


  const availableCount = capabilityStatus.filter(c => c.available).length
  const unavailableCount = capabilityStatus.filter(c => !c.available).length

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Lab</h1>
        <p className="text-sm text-slate-400 mt-1">Real execution system — capability-first routing through the capability engine</p>
      </motion.div>

      {/* Capability Status Panel */}
      <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Capability Map</h2>
            <span className="text-[10px] text-slate-500 font-mono ml-2">
              {availableCount} available · {unavailableCount} unavailable
            </span>
          </div>
          <button onClick={loadCapabilities} disabled={loadingCaps} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
            <RefreshCw className={`w-2.5 h-2.5 ${loadingCaps ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loadingCaps ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading capabilities…
          </div>
        ) : capabilityStatus.length === 0 ? (
          <p className="text-xs text-slate-500">No capability data available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {capabilityStatus.map((cap) => (
              <div
                key={cap.capability}
                className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                  cap.available
                    ? 'bg-emerald-500/5 border-emerald-500/10'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                {cap.available ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`font-mono font-medium ${cap.available ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {cap.capability}
                  </p>
                  {!cap.available && cap.reason && (
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{cap.reason}</p>
                  )}
                  {!cap.routeExists && (
                    <p className="text-[10px] text-amber-400 mt-0.5">No backend route</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Test Request</h2>
          </div>

          {/* Provider Override */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Provider</label>
              <button onClick={loadProviders} disabled={loadingProviders} className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                <RefreshCw className={`w-2.5 h-2.5 ${loadingProviders ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <select
              value={forceProvider}
              onChange={(e) => setForceProvider(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="auto" className="bg-[#0a0f1a] text-white">⚡ Auto-Route (capability engine)</option>
              {providers.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#0a0f1a] text-white">
                  {p.label} ({p.healthStatus})
                </option>
              ))}
            </select>
            {forceProvider === 'auto' && (
              <p className="text-[10px] text-slate-500">Routes through the capability engine: classify → resolve → execute.</p>
            )}
            {providers.length === 0 && !loadingProviders && (
              <p className="text-[10px] text-amber-400">No enabled providers found. Configure keys in Operations → Providers.</p>
            )}
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Model</label>
            <select
              value={forceModel}
              onChange={(e) => setForceModel(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="auto" className="bg-[#0a0f1a] text-white">🤖 Auto-Select (best for task)</option>
              {(forceProvider === 'auto'
                ? models
                : models.filter(m => m.provider === forceProvider)
              ).map((m) => (
                <option key={`${m.provider}:${m.id}`} value={m.id} className="bg-[#0a0f1a] text-white">
                  {m.name} ({m.provider}) [{m.category}]
                </option>
              ))}
            </select>
          </div>

          {/* App Profile Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">App Profile</label>
            <select
              value={appProfile}
              onChange={(e) => setAppProfile(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              <option value="__admin_test__" className="bg-[#0a0f1a] text-white">Admin Test (default)</option>
              <option value="__dashboard__" className="bg-[#0a0f1a] text-white">Dashboard</option>
              <option value="__admin__" className="bg-[#0a0f1a] text-white">Admin</option>
              <option value="amarktai-network" className="bg-[#0a0f1a] text-white">Amarktai Network</option>
              <option value="amarktai-crypto" className="bg-[#0a0f1a] text-white">Amarktai Crypto</option>
              <option value="amarktai-marketing" className="bg-[#0a0f1a] text-white">Amarktai Marketing</option>
              <option value="amarktai-travel" className="bg-[#0a0f1a] text-white">Amarktai Travel</option>
              <option value="equiprofile" className="bg-[#0a0f1a] text-white">EquiProfile</option>
              <option value="amarktai-online" className="bg-[#0a0f1a] text-white">Amarktai Online</option>
            </select>
          </div>

          {/* Capability Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Task / Capability</label>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCapability(c)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    capability === c
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* TTS Voice Options */}
          {['tts', 'voice', 'voice_output'].includes(capability) && (
            <div className="space-y-3 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-purple-400 font-mono">TTS Voice Configuration</p>

              {/* Gender selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Gender</label>
                <div className="flex gap-2">
                  {(['', 'female', 'male'] as const).map((g) => (
                    <button
                      key={g || 'auto'}
                      onClick={() => setTtsGender(g)}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                        ttsGender === g
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          : 'bg-white/[0.04] text-slate-400 border-transparent hover:bg-white/[0.06]'
                      }`}
                    >
                      {g === '' ? 'Auto' : g === 'female' ? '♀ Female' : '♂ Male'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Voice ID (optional)</label>
                <input
                  type="text"
                  value={ttsVoiceId}
                  onChange={(e) => setTtsVoiceId(e.target.value)}
                  placeholder="e.g. nova, Arista-PlayAI, onyx…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>

              {/* Accent / Language */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Accent / Language</label>
                <select
                  value={ttsAccent}
                  onChange={(e) => setTtsAccent(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
                >
                  <option value="" className="bg-[#0a0f1a]">Auto (default)</option>
                  <option value="en-US" className="bg-[#0a0f1a]">English (US)</option>
                  <option value="en-GB" className="bg-[#0a0f1a]">English (UK)</option>
                  <option value="en-AU" className="bg-[#0a0f1a]">English (AU)</option>
                  <option value="arabic" className="bg-[#0a0f1a]">Arabic</option>
                  <option value="fr-FR" className="bg-[#0a0f1a]">French</option>
                  <option value="es-ES" className="bg-[#0a0f1a]">Spanish</option>
                  <option value="de-DE" className="bg-[#0a0f1a]">German</option>
                  <option value="zh-CN" className="bg-[#0a0f1a]">Chinese (Mandarin)</option>
                  <option value="ja-JP" className="bg-[#0a0f1a]">Japanese</option>
                </select>
              </div>

              {/* TTS Provider */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">TTS Provider</label>
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/40 transition-colors"
                >
                  <option value="auto" className="bg-[#0a0f1a]">Auto (fastest available)</option>
                  <option value="groq" className="bg-[#0a0f1a]">Groq (low-cost, fast)</option>
                  <option value="openai" className="bg-[#0a0f1a]">OpenAI (premium)</option>
                  <option value="gemini" className="bg-[#0a0f1a]">Gemini (multimodal)</option>
                  <option value="huggingface" className="bg-[#0a0f1a]">HuggingFace (free)</option>
                </select>
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Prompt</label>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
                    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition: new () => {
                      continuous: boolean; interimResults: boolean; lang: string;
                      onresult: (event: { results?: Array<Array<{ transcript?: string }>> }) => void;
                      start: () => void;
                    } }).webkitSpeechRecognition
                    const recognition = new SpeechRecognition()
                    recognition.continuous = false
                    recognition.interimResults = false
                    recognition.lang = 'en-US'
                    recognition.onresult = (event) => {
                      const transcript = event.results?.[0]?.[0]?.transcript ?? ''
                      if (transcript) setPrompt(prev => prev ? `${prev} ${transcript}` : transcript)
                    }
                    recognition.start()
                  }
                }}
                className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                title="Voice input (Chrome only)"
              >
                🎤 Voice
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your test prompt..."
              rows={6}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* Run Button */}
          {capability === 'stt' ? (
            <div className="space-y-2">
              {/* STT file upload */}
              <input
                ref={sttFileRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.webm"
                className="hidden"
                onChange={handleSttFile}
              />
              <button
                onClick={() => sttFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-white/[0.06] border border-white/[0.1] text-slate-300 hover:text-white hover:border-white/[0.2]"
              >
                <Upload className="w-4 h-4" />
                {sttFile ? `File: ${sttFile.name}` : 'Upload Audio File'}
              </button>
              <button
                onClick={handleSttRun}
                disabled={running || !sttFile}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {running ? 'Transcribing…' : 'Transcribe Audio'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Streaming toggle (for text capabilities) */}
              {['chat', 'code', 'reasoning'].includes(capability) && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStreamMode(m => !m)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${streamMode ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] text-slate-500 hover:text-slate-300'}`}
                  >
                    <Radio className="w-3 h-3" />
                    {streamMode ? 'Stream: ON' : 'Stream: OFF'}
                  </button>
                  <span className="text-[10px] text-slate-600">Toggle to preview SSE streaming output</span>
                </div>
              )}
              <button
                onClick={streamMode ? handleStream : handleRun}
                disabled={running || streaming || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {(running || streaming) ? <Loader2 className="w-4 h-4 animate-spin" /> : streamMode ? <Radio className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running || streaming ? (streamMode ? 'Streaming…' : 'Running…') : streamMode ? 'Stream via SSE' : forceProvider === 'auto' ? 'Auto-Route & Run' : `Run via ${forceProvider}`}
              </button>
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Output</h2>
            {result?.output && (
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>

          {/* Audio player for TTS results */}
          {result?.audioUrl && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-purple-400 font-mono">Audio Output</p>
              <audio
                controls
                src={result.audioUrl}
                className="w-full rounded-lg"
                style={{ filter: 'invert(0.8) hue-rotate(180deg)' }}
              />
              <a
                href={result.audioUrl}
                download="tts-output.mp3"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                ↓ Download audio
              </a>
            </div>
          )}

          {/* Image output */}
          {result?.imageUrl && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-blue-400 font-mono">Image Output</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt="Generated image"
                className="w-full rounded-lg border border-white/[0.08]"
              />
              <button
                onClick={() => handleImageDownload(result.imageUrl!)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                ↓ Download image
              </button>
            </div>
          )}

          {/* Structured Execution Response */}
          {result && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Route className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Execution Result</span>
                {result.executed
                  ? <CheckCircle className="w-3 h-3 text-emerald-400 ml-auto" />
                  : <XCircle className="w-3 h-3 text-red-400 ml-auto" />}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-slate-500">Executed</span>
                <span className={`font-mono ${result.executed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.executed ? 'true' : 'false'}
                </span>
                {result.capability.length > 0 && (
                  <>
                    <span className="text-slate-500">Capability</span>
                    <span className="text-blue-400 font-mono truncate">{result.capability.join(', ')}</span>
                  </>
                )}
                <span className="text-slate-500">Provider</span>
                <span className={`font-mono truncate ${result.routedProvider ? 'text-white' : 'text-slate-600'}`}>
                  {result.routedProvider ?? '—'}
                </span>
                <span className="text-slate-500">Model</span>
                <span className={`font-mono truncate ${result.routedModel ? 'text-white' : 'text-slate-600'}`}>
                  {result.routedModel ?? '—'}
                </span>
                <span className="text-slate-500">Mode</span>
                <span className="text-slate-300 font-mono">{result.executionMode ?? '—'}</span>
                <span className="text-slate-500">Latency</span>
                <span className="text-slate-300 font-mono">{result.latencyMs}ms</span>
                <span className="text-slate-500">Fallback</span>
                <span className={`font-mono ${result.fallback_used ? 'text-amber-400' : 'text-slate-500'}`}>
                  {result.fallback_used ? 'true' : 'false'}
                </span>
                {result.confidenceScore !== null && (
                  <>
                    <span className="text-slate-500">Confidence</span>
                    <span className="text-slate-300 font-mono">{Math.round(result.confidenceScore * 100)}%</span>
                  </>
                )}
              </div>

              {/* Capability route details when unavailable */}
              {result.capabilityRoutes && result.capabilityRoutes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Capability Routes</p>
                  {result.capabilityRoutes.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {r.available
                        ? <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                        : <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />}
                      <div>
                        <span className="text-[11px] text-white font-mono">{r.capability}</span>
                        {r.reason && <p className="text-[10px] text-red-400/80">{r.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.routingReason && (
                <div className="mt-2 pt-2 border-t border-white/[0.04]">
                  <div className="flex items-start gap-1.5">
                    <Info className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-400 leading-relaxed">{result.routingReason}</p>
                  </div>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-400">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-[200px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 overflow-auto">
            {running ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Processing…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-start gap-2 p-1">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : result?.error && !result.output && !result.imageUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{result.error}</p>
                {!result.executed && (
                  <p className="text-xs text-slate-500">The capability engine could not execute this request. Check the capability map above for available capabilities.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image Preview */}
                {result?.imageUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Generated Image</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt="Generated"
                      className="max-w-full rounded-lg border border-white/[0.06]"
                    />
                    <button
                      onClick={() => handleImageDownload(result.imageUrl!)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      ↓ Download image
                    </button>
                  </div>
                )}

                {/* Audio Playback */}
                {result?.audioUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Audio Output</p>
                    <audio controls className="w-full">
                      <source src={result.audioUrl} />
                    </audio>
                  </div>
                )}

                {/* Video Status + Polling */}
                {result?.videoStatus && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Video Status</p>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                      <span className="text-xs text-violet-400 font-mono">{result.videoStatus}</span>
                      {result.videoStatus === 'processing' && (
                        <span className="text-[10px] text-slate-500 animate-pulse">polling every 3s…</span>
                      )}
                    </div>
                    {videoUrl && (
                      <div className="space-y-1">
                        <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 underline hover:text-blue-300 break-all">
                          {videoUrl}
                        </a>
                        <video src={videoUrl} controls className="w-full max-h-[300px] rounded-lg border border-white/10 mt-2" />
                      </div>
                    )}
                  </div>
                )}

                {/* Text Output */}
                {streaming ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
                      <span className="text-[10px] uppercase tracking-wider text-blue-400 font-mono">Streaming</span>
                    </div>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed min-h-[80px]">{streamOutput || <span className="text-slate-600">Waiting for tokens…</span>}</pre>
                  </div>
                ) : streamOutput && !running ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono">Stream Complete</span>
                    </div>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{streamOutput}</pre>
                  </div>
                ) : result?.output ? (
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{result.output}</pre>
                ) : !result?.imageUrl && !result?.audioUrl && !result?.videoStatus ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <FlaskConical className="w-8 h-8 text-slate-700" />
                    <p className="text-sm text-slate-600">Run a test to see output</p>
                  </div>
                ) : null}

                {/* Research Citations Panel */}
                {result?.sources && result.sources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] uppercase tracking-wider text-amber-400 font-mono">Sources ({result.sources.length})</span>
                    </div>
                    <div className="space-y-2">
                      {result.sources.map((source, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 space-y-0.5">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium truncate block"
                          >
                            {source.title || source.url}
                          </a>
                          {source.snippet && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{source.snippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result && (
                  <details className="mt-3">
                    <summary className="text-[10px] uppercase tracking-wider text-slate-500 font-mono cursor-pointer hover:text-slate-400 transition-colors">
                      Diagnostics
                    </summary>
                    <div className="mt-2 bg-white/[0.01] border border-white/[0.04] rounded-lg p-3 space-y-1 text-[11px] font-mono text-slate-500">
                      <p>Success: <span className={result.success ? 'text-emerald-400' : 'text-red-400'}>{String(result.success)}</span></p>
                      <p>Executed: <span className={result.executed ? 'text-emerald-400' : 'text-red-400'}>{String(result.executed)}</span></p>
                      <p>Provider: {result.routedProvider ?? 'none'}</p>
                      <p>Model: {result.routedModel ?? 'none'}</p>
                      <p>Mode: {result.executionMode ?? 'none'}</p>
                      <p>Latency: {result.latencyMs}ms</p>
                      <p>Validation: {String(result.validationUsed)}</p>
                      <p>Consensus: {String(result.consensusUsed)}</p>
                      <p>Fallback: {String(result.fallback_used)}</p>
                      {result.confidenceScore !== null && <p>Confidence: {Math.round(result.confidenceScore * 100)}%</p>}
                      {result.error && <p className="text-red-400">Error: {result.error}</p>}
                      {result.warnings.length > 0 && <p className="text-amber-400">Warnings: {result.warnings.join(', ')}</p>}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Benchmark Panel */}
      <BenchmarkPanel />
    </motion.div>
  )
}

/* ── Benchmark ──────────────────────────────────────────── */

/** Max providers pre-selected on load — keeps the default comparison focused. */
const BENCHMARK_DEFAULT_SELECTION = 3

interface BenchmarkResult {
  providerKey: string
  model: string
  output: string | null
  /** For streaming mode — partial output accumulated from SSE tokens */
  streamOutput?: string
  /** For streaming mode — whether streaming is still active for this provider */
  streaming?: boolean
  success: boolean
  error: string | null
  latencyMs: number
}

function BenchmarkPanel() {
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [benchPrompt, setBenchPrompt] = useState('')
  const [benchTask, setBenchTask] = useState('chat')
  const [benchStreamMode, setBenchStreamMode] = useState(false)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchResults, setBenchResults] = useState<BenchmarkResult[] | null>(null)
  const [benchError, setBenchError] = useState<string | null>(null)

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await fetch('/api/admin/providers')
      if (res.ok) {
        const data = await res.json()
        const list: ProviderOption[] = Array.isArray(data)
          ? data
              .filter((p: { enabled: boolean }) => p.enabled)
              .map((p: { providerKey: string; displayName: string; healthStatus: string }) => ({
                key: p.providerKey,
                label: p.displayName,
                healthStatus: p.healthStatus,
              }))
          : []
        setProviders(list)
        const usable = list
          .filter(p => p.healthStatus === 'healthy' || p.healthStatus === 'configured')
          .slice(0, BENCHMARK_DEFAULT_SELECTION)
          .map(p => p.key)
        setSelectedProviders(usable)
      }
    } catch {
      // best-effort
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

  const healthColor = (s: string) =>
    s === 'healthy' ? 'text-emerald-400' :
    s === 'configured' ? 'text-amber-400' :
    s === 'degraded' ? 'text-amber-500' :
    'text-slate-500'

  const toggleProvider = (key: string) => {
    setSelectedProviders(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleBenchmark = async () => {
    if (!benchPrompt.trim() || selectedProviders.length === 0) return
    setBenchRunning(true)
    setBenchError(null)
    setBenchResults(null)
    try {
      const res = await fetch('/api/admin/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: benchPrompt.trim(),
          taskType: benchTask,
          providerKeys: selectedProviders,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setBenchResults(data.results ?? [])
    } catch (e) {
      setBenchError(e instanceof Error ? e.message : 'Benchmark failed')
    } finally {
      setBenchRunning(false)
    }
  }

  /** Stream benchmark: run each provider through SSE /api/brain/stream sequentially,
   *  accumulating live tokens into per-provider results. */
  const handleBenchmarkStream = async () => {
    if (!benchPrompt.trim() || selectedProviders.length === 0) return
    setBenchRunning(true)
    setBenchError(null)
    // Pre-populate result cards so they appear immediately
    setBenchResults(selectedProviders.map(key => ({
      providerKey: key,
      model: key,
      output: null,
      streamOutput: '',
      streaming: true,
      success: false,
      error: null,
      latencyMs: 0,
    })))

    for (const providerKey of selectedProviders) {
      const start = Date.now()
      try {
        const res = await fetch('/api/brain/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: benchPrompt.trim(),
            taskType: benchTask,
            providerKey,
          }),
        })
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
          setBenchResults(prev => (prev ?? []).map(r =>
            r.providerKey === providerKey
              ? { ...r, streaming: false, success: false, error: err.error ?? `HTTP ${res.status}`, latencyMs: Date.now() - start }
              : r
          ))
          continue
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') break
              try {
                const parsed = JSON.parse(payload)
                const delta = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? ''
                if (delta) {
                  accumulated += delta
                  setBenchResults(prev => (prev ?? []).map(r =>
                    r.providerKey === providerKey ? { ...r, streamOutput: accumulated } : r
                  ))
                }
              } catch { /* ignore non-JSON */ }
            }
          }
        }
        setBenchResults(prev => (prev ?? []).map(r =>
          r.providerKey === providerKey
            ? { ...r, streaming: false, success: true, output: accumulated, latencyMs: Date.now() - start }
            : r
        ))
      } catch (e) {
        setBenchResults(prev => (prev ?? []).map(r =>
          r.providerKey === providerKey
            ? { ...r, streaming: false, success: false, error: e instanceof Error ? e.message : 'Stream failed', latencyMs: Date.now() - start }
            : r
        ))
      }
    }

    setBenchRunning(false)
  }

  return (
    <motion.div variants={fadeUp} className="space-y-5">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-white">Benchmark</h2>
        <span className="text-xs text-slate-500">Run the same prompt across multiple configured providers</span>
        <button onClick={loadProviders} disabled={loadingProviders} className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
          <RefreshCw className={`w-2.5 h-2.5 ${loadingProviders ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
            Configured providers
            {loadingProviders && <Loader2 className="inline w-2.5 h-2.5 animate-spin ml-1.5" />}
          </label>
          {providers.length === 0 && !loadingProviders ? (
            <p className="text-xs text-amber-400">No enabled providers found. Add provider keys in Operations → Providers.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {providers.map(({ key, label, healthStatus }) => (
                <button
                  key={key}
                  onClick={() => toggleProvider(key)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors border ${
                    selectedProviders.includes(key)
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-white/[0.04] text-slate-400 border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  {label}
                  <span className={`ml-1 text-[9px] ${healthColor(healthStatus)}`}>●</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Task type */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Task type</label>
          <div className="flex flex-wrap gap-1.5">
            {CAPABILITIES.map(c => (
              <button
                key={c}
                onClick={() => setBenchTask(c)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  benchTask === c
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Prompt</label>
          <textarea
            value={benchPrompt}
            onChange={e => setBenchPrompt(e.target.value)}
            placeholder="Enter a prompt to send to all selected providers…"
            rows={4}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/40 transition-colors"
          />
        </div>

        {/* Stream mode toggle + Run */}
        <div className="space-y-2">
          {['chat', 'code', 'reasoning'].includes(benchTask) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBenchStreamMode(m => !m)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${benchStreamMode ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-white/[0.08] text-slate-500 hover:text-slate-300'}`}
              >
                <Radio className="w-3 h-3" />
                {benchStreamMode ? 'Stream: ON' : 'Stream: OFF'}
              </button>
              <span className="text-[10px] text-slate-600">Streams SSE tokens live per provider (sequential)</span>
            </div>
          )}
          <button
            onClick={benchStreamMode ? handleBenchmarkStream : handleBenchmark}
            disabled={benchRunning || !benchPrompt.trim() || selectedProviders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {benchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : benchStreamMode ? <Radio className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {benchRunning
              ? `${benchStreamMode ? 'Streaming' : 'Running'} across ${selectedProviders.length} provider${selectedProviders.length !== 1 ? 's' : ''}…`
              : benchStreamMode
                ? `Stream ${selectedProviders.length} provider${selectedProviders.length !== 1 ? 's' : ''}`
                : `Benchmark ${selectedProviders.length} provider${selectedProviders.length !== 1 ? 's' : ''}`}
          </button>
        </div>

        {benchError && <p className="text-sm text-red-400">{benchError}</p>}
      </div>

      {/* Results grid */}
      {benchResults && benchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {benchResults.map((r, i) => (
            <div
              key={i}
              className={`bg-white/[0.03] border rounded-xl p-5 space-y-3 ${
                r.streaming ? 'border-blue-500/20' : r.success ? 'border-white/[0.06]' : 'border-red-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{r.providerKey}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.model}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.streaming
                    ? <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
                    : r.success
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-xs text-slate-500">{r.latencyMs > 0 ? `${r.latencyMs}ms` : r.streaming ? '…' : '0ms'}</span>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 min-h-[80px] max-h-[200px] overflow-auto">
                {r.streaming && (r.streamOutput !== undefined) ? (
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {r.streamOutput || <span className="text-slate-600">Waiting for tokens…</span>}
                  </pre>
                ) : r.success && (r.output ?? r.streamOutput) ? (
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{r.output ?? r.streamOutput}</pre>
                ) : (
                  <p className="text-xs text-red-400">{r.error ?? 'No output'}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
