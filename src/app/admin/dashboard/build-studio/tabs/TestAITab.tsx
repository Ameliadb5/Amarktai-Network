'use client'

/**
 * TestAITab — re-exports the existing Lab page as a tab component.
 * The full Test AI interface is already implemented in the Lab page;
 * this wrapper makes it usable inside Build Studio without duplication.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  Play, Loader2, Copy, Check, Gauge, CheckCircle, XCircle,
  Zap, Route, AlertCircle, ShieldAlert, Radio, BookOpen, Download,
} from 'lucide-react'

const CAPABILITIES = [
  'chat', 'code', 'reasoning', 'image', 'image_editing', 'video', 'video_planning',
  'tts', 'stt', 'vision', 'embeddings', 'reranking', 'research', 'suggestive',
  'adult_image', 'app_builder',
]

/**
 * Maps UI capability names to the model capability flag that must be present
 * for a model to appear in the dropdown for that capability.
 * When a capability maps to null, all models are shown (no capability filter).
 */
const CAPABILITY_TO_MODEL_FLAG: Record<string, string | null> = {
  chat:          'chat',
  code:          'code',
  reasoning:     'reasoning',
  image:         'image_generation',
  image_editing: 'image_generation',
  video:         'video_generation',
  video_planning:'video_planning',
  tts:           'tts',
  stt:           'stt',
  vision:        'vision',
  embeddings:    'embeddings',
  reranking:     'reranking',
  research:      'chat',
  suggestive:    'image_generation',
  adult_image:   'image_generation',
  app_builder:   'chat',
}

/** Rough estimate: average English word is ~4 characters, ~1 token */
const CHARS_PER_TOKEN_ESTIMATE = 4
/** Conservative blended rate in USD per token across cheap→medium models */
const COST_PER_TOKEN_USD = 0.000002

interface ProviderOption { key: string; label: string; healthStatus: string }
interface CapabilityEntry { capability: string; available: boolean; reason: string | null; routeExists: boolean }
interface ModelOption {
  id: string
  name: string
  provider: string
  category: string
  shortDescription?: string
  estimatedCostTier?: 'cheap' | 'medium' | 'expensive'
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
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
  costUsdCents?: number
  imageUrl?: string | null
  audioUrl?: string | null
  videoStatus?: string | null
  sources?: Array<{ title: string; url: string; snippet?: string }> | null
}

export default function TestAITab() {
  const [prompt, setPrompt] = useState('')
  const [capability, setCapability] = useState('chat')
  const [forceProvider, setForceProvider] = useState<string>('auto')
  const [forceModel, setForceModel] = useState<string>('auto')
  const [appProfile] = useState<string>('__admin_test__')
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [capabilityStatus, setCapabilityStatus] = useState<CapabilityEntry[]>([])
  const [loadingCaps, setLoadingCaps] = useState(true)
  const [result, setResult] = useState<TestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [ttsGender, setTtsGender] = useState<'male' | 'female' | ''>('')
  const [ttsVoiceId] = useState<string>('')
  const [ttsAccent] = useState<string>('')
  const [ttsProvider] = useState<string>('auto')
  const [streamMode, setStreamMode] = useState(false)
  const [streamOutput, setStreamOutput] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [streamMeta, setStreamMeta] = useState<{ provider: string | null; tokensPerSec: number | null; elapsedMs: number | null } | null>(null)
  const [costMode, setCostMode] = useState<'free_first' | 'balanced' | 'quality_first'>('balanced')
  const sttFileRef = useRef<HTMLInputElement>(null)
  const [sttFile, setSttFile] = useState<File | null>(null)
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [savingArtifact, setSavingArtifact] = useState(false)
  const [artifactSaved, setArtifactSaved] = useState(false)
  const [selectedModelMeta, setSelectedModelMeta] = useState<ModelOption | null>(null)
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const res = await fetch('/api/admin/providers')
      if (res.ok) {
        const data = await res.json().catch(() => [])
        const list: Record<string, string>[] = Array.isArray(data)
          ? data
          : Array.isArray(data.providers)
            ? data.providers
            : []
        setProviders(list.map((p) => ({
          key: p.providerKey, label: p.displayName, healthStatus: p.healthStatus,
        })))
      }
    } catch { /* best-effort */ } finally { setLoadingProviders(false) }
  }, [])

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/models?enabled=true')
      if (res.ok) {
        const data = await res.json().catch(() => ({ models: [] }))
        setModels(data.models ?? [])
      }
    } catch { /* best-effort */ }
  }, [])

  const loadCapabilities = useCallback(async () => {
    setLoadingCaps(true)
    try {
      const res = await fetch('/api/admin/brain/test')
      if (res.ok) {
        const data = await res.json().catch(() => ({ capabilities: [] }))
        setCapabilityStatus(data.capabilities ?? [])
      }
    } catch { /* best-effort */ } finally { setLoadingCaps(false) }
  }, [])

  useEffect(() => { loadProviders(); loadModels(); loadCapabilities() }, [loadProviders, loadModels, loadCapabilities])

  const visibleModels = useMemo(() => {
    const capFlag = CAPABILITY_TO_MODEL_FLAG[capability] ?? null
    return models.filter((m) => {
      const providerMatch = forceProvider === 'auto' || m.provider === forceProvider
      const capMatch = capFlag === null || (m.capabilities ?? []).includes(capFlag)
      return providerMatch && capMatch
    })
  }, [models, forceProvider, capability])
  const visibleModelKeys = useMemo(() => new Set(visibleModels.map((m) => `${m.provider}:${m.id}`)), [visibleModels])

  /** Pre-computed cost estimate for the current prompt, shown in the result panel. */
  const estimatedRequestCost = useMemo(() => {
    if (!prompt.trim()) return null
    const tokens = Math.max(1, Math.ceil(prompt.trim().length / CHARS_PER_TOKEN_ESTIMATE))
    return (tokens * COST_PER_TOKEN_USD).toFixed(5)
  }, [prompt])

  const runTest = useCallback(async () => {
    if (!prompt.trim()) return
    setRunning(true); setError(null); setResult(null); setStreamOutput(''); setVideoUrl(null); setArtifactSaved(false)

    if (streamMode && capability === 'chat') {
      setStreaming(true)
      setStreamMeta(null)
      const streamStart = Date.now()
      let charCount = 0
      try {
        const res = await fetch('/api/brain/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: appProfile, appSecret: 'admin-test-secret', taskType: capability, message: prompt, costMode }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `Stream failed: HTTP ${res.status}` }))
          setError(errData.error ?? `Stream request failed: HTTP ${res.status}`)
          setStreaming(false); setRunning(false)
          return
        }
        const streamProvider = res.headers.get('X-Stream-Provider') ?? null
        const streamModel = res.headers.get('X-Stream-Model') ?? null
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let full = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
              try {
                const j = JSON.parse(line.slice(6))
                const delta = j.delta ?? j.content ?? ''
                full += delta
                charCount += delta.length
                setStreamOutput(full)
                const elapsed = Date.now() - streamStart
                const approxTokens = Math.ceil(charCount / CHARS_PER_TOKEN_ESTIMATE)
                const tokensPerSec = elapsed > 0 ? Math.round((approxTokens / elapsed) * 1000) : null
                setStreamMeta({ provider: streamProvider, tokensPerSec, elapsedMs: elapsed })
              } catch { /* skip */ }
            }
          }
        }
        const finalElapsed = Date.now() - streamStart
        setStreamMeta({ provider: streamProvider, tokensPerSec: charCount > 0 ? Math.round((Math.ceil(charCount / CHARS_PER_TOKEN_ESTIMATE) / finalElapsed) * 1000) : null, elapsedMs: finalElapsed })
        setResult({ success: true, executed: true, output: full, capability: [capability], routedProvider: streamProvider, routedModel: streamModel, executionMode: 'stream', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: null, latencyMs: finalElapsed })
      } catch (e) { setError(e instanceof Error ? e.message : 'Stream error') } finally { setStreaming(false); setRunning(false) }
      return
    }

    // STT file upload
    if (capability === 'stt' && sttFile) {
      try {
        const form = new FormData()
        form.append('file', sttFile)
        form.append('appId', appProfile)
        form.append('appSecret', 'admin-test-secret')
        const res = await fetch('/api/brain/stt', { method: 'POST', body: form })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `STT failed: HTTP ${res.status}` }))
          setResult({ success: false, executed: false, output: null, capability: ['stt'], routedProvider: null, routedModel: null, executionMode: 'direct', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: errData.error ?? `STT failed: HTTP ${res.status}`, latencyMs: 0 })
        } else {
          const data = await res.json()
          setResult({ success: data.success ?? true, executed: true, output: data.text ?? data.output ?? JSON.stringify(data), capability: ['stt'], routedProvider: data.provider ?? null, routedModel: data.model ?? null, executionMode: 'direct', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: data.error ?? null, latencyMs: data.latencyMs ?? 0 })
        }
      } catch (e) { setError(e instanceof Error ? e.message : 'STT error') } finally { setRunning(false) }
      return
    }

    // TTS — /api/brain/tts returns audio/mpeg on success, JSON on error
    if (capability === 'tts') {
      try {
        const res = await fetch('/api/brain/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: appProfile, appSecret: 'admin-test-secret',
            text: prompt,
            gender: ttsGender || undefined, voiceId: ttsVoiceId || undefined,
            accent: ttsAccent || undefined, provider: ttsProvider !== 'auto' ? ttsProvider : undefined,
            // Pass appSlug so the TTS route can meter cost back to Workspace
            appSlug: 'workspace',
          }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `TTS failed: HTTP ${res.status}` }))
          setResult({ success: false, executed: false, output: null, capability: ['tts'], routedProvider: null, routedModel: null, executionMode: 'direct', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: errData.error ?? `TTS failed: HTTP ${res.status}`, latencyMs: 0 })
        } else {
          const contentType = res.headers.get('Content-Type') ?? ''
          if (contentType.includes('audio')) {
            const buffer = await res.arrayBuffer()
            const bytes = new Uint8Array(buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            const audioUrl = `data:audio/mpeg;base64,${base64}`
            setResult({ success: true, executed: true, output: '[TTS audio generated]', capability: ['tts'], routedProvider: res.headers.get('X-Provider') ?? null, routedModel: res.headers.get('X-Model') ?? null, executionMode: 'direct', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: null, latencyMs: 0, audioUrl })
          } else {
            const data = await res.json().catch(() => ({ error: 'Unexpected TTS response format' }))
            setResult({ success: data.success ?? false, executed: true, output: data.text ?? null, capability: ['tts'], routedProvider: data.provider ?? null, routedModel: data.model ?? null, executionMode: 'direct', confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], error: data.error ?? null, latencyMs: data.latencyMs ?? 0, audioUrl: data.audioUrl ?? null })
          }
        }
      } catch (e) { setError(e instanceof Error ? e.message : 'TTS error') } finally { setRunning(false) }
      return
    }

    // General brain test
    try {
      const body: Record<string, unknown> = { appId: appProfile, appSecret: 'admin-test-secret', taskType: capability, message: prompt }
      const modelParts = forceModel !== 'auto' ? forceModel.split(':', 2) : []
      const forcedModelProvider = modelParts.length === 2 ? modelParts[0] : null
      const forcedModelId = modelParts.length === 2 ? modelParts[1] : (forceModel !== 'auto' ? forceModel : null)
      if (forceProvider !== 'auto') body.providerKey = forceProvider
      if (forceModel !== 'auto' && forcedModelId) body.modelId = forcedModelId
      if (forceProvider === 'auto' && forcedModelProvider) body.providerKey = forcedModelProvider
      const res = await fetch('/api/admin/brain/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({ success: false, error: `Unexpected response from server (HTTP ${res.status})`, executed: false, output: null, capability: [capability], routedProvider: null, routedModel: null, executionMode: null, confidenceScore: null, validationUsed: false, consensusUsed: false, fallbackUsed: false, fallback_used: false, warnings: [], latencyMs: 0 }))
      if (!res.ok && !data.error) {
        data.error = `Request failed: HTTP ${res.status}`
        data.success = false
      }
      setResult(data)
      if (data.imageUrl) { /* image result */ }
      if (capability === 'video' || capability === 'video_planning') {
        // Backend returns jobId (not videoJobId) and uses status 'succeeded'/'failed' with resultUrl
        const jobId = data.jobId ?? data.videoJobId ?? null
        if (jobId) {
          setVideoJobId(jobId)
          const poll = setInterval(async () => {
            try {
              const pr = await fetch(`/api/brain/video-generate/${jobId}`)
              if (!pr.ok) return // retry on next tick
              const pj = await pr.json().catch(() => null)
              if (!pj) return // retry on next tick
              if (pj.status === 'succeeded' && pj.resultUrl) { setVideoUrl(pj.resultUrl); clearInterval(poll) }
              else if (pj.status === 'completed' && pj.videoUrl) { setVideoUrl(pj.videoUrl); clearInterval(poll) }
              else if (pj.status === 'failed') { clearInterval(poll) }
            } catch { /* retry next tick */ }
          }, 5000)
          videoPollingRef.current = poll
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Test failed') } finally { setRunning(false) }
  }, [prompt, capability, forceProvider, forceModel, appProfile, streamMode, costMode, ttsGender, ttsVoiceId, ttsAccent, ttsProvider, sttFile])

  useEffect(() => { return () => { if (videoPollingRef.current) clearInterval(videoPollingRef.current) } }, [])

  useEffect(() => {
    if (forceProvider !== 'auto' && forceModel !== 'auto') {
      const stillAvailable = visibleModelKeys.has(forceModel)
      if (!stillAvailable) setForceModel('auto')
    }
  }, [forceProvider, forceModel, visibleModelKeys])

  useEffect(() => {
    if (forceModel === 'auto') {
      setSelectedModelMeta(null)
      return
    }
    setSelectedModelMeta(models.find((m) => `${m.provider}:${m.id}` === forceModel) ?? null)
  }, [forceModel, models])

  const saveArtifact = useCallback(async () => {
    if (!result) return
    const contentUrl = result.imageUrl ?? result.audioUrl ?? videoUrl ?? null
    const textOutput = !contentUrl && result.output ? result.output : null
    if (!contentUrl && !textOutput) return
    const type = contentUrl
      ? (result.imageUrl ? 'image' : result.audioUrl ? 'audio' : 'video')
      : 'code'
    setSavingArtifact(true)
    setArtifactSaved(false)
    try {
      const res = await fetch('/api/admin/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSlug: 'workspace',
          type,
          subType: capability,
          title: `${capability} test output`,
          description: prompt,
          provider: result.routedProvider ?? '',
          model: result.routedModel ?? '',
          contentUrl,
          contentBase64: textOutput ? encodeBase64Utf8(textOutput) : undefined,
          mimeType: textOutput ? 'text/plain; charset=utf-8' : undefined,
          metadata: { capability, prompt },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Save failed: HTTP ${res.status}`)
      setArtifactSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save artifact')
    } finally {
      setSavingArtifact(false)
    }
  }, [result, videoUrl, capability, prompt])

  const capEntry = capabilityStatus.find(c => c.capability === capability)

  return (
    <div className="space-y-6">
      {/* Loading indicator */}
      {(loadingProviders || loadingCaps) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading capabilities…
        </div>
      )}

      {/* Capability selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {CAPABILITIES.map(cap => {
          const entry = capabilityStatus.find(c => c.capability === cap)
          const active = capability === cap
          return (
            <button key={cap} onClick={() => setCapability(cap)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all
                ${active ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
              {entry?.available ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-slate-600" />}
              <span className="truncate">{cap.replace(/_/g, ' ')}</span>
            </button>
          )
        })}
      </div>

      {/* Status bar */}
      {capEntry && !capEntry.available && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{capEntry.reason || 'This capability is not currently available'}</span>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {capability === 'stt' ? (
            <div className="flex items-center gap-3">
              <input ref={sttFileRef} type="file" accept="audio/*" onChange={e => setSttFile(e.target.files?.[0] ?? null)}
                className="flex-1 text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-500/10 file:text-blue-400 file:cursor-pointer" />
              {sttFile && <span className="text-xs text-slate-500">{sttFile.name}</span>}
            </div>
          ) : (
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={capability === 'tts' ? 'Enter text to convert to speech…' : 'Enter your prompt…'}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 resize-none"
              rows={3} />
          )}
        </div>
        <div className="space-y-2">
          <select value={forceProvider} onChange={e => setForceProvider(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
            <option value="auto">Auto-route provider</option>
            {providers.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={forceModel} onChange={e => setForceModel(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
            <option value="auto">Auto-select model</option>
            {visibleModels.map((m) => (
              <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                {m.name} · {m.id} [{m.estimatedCostTier ?? 'medium'}]
              </option>
            ))}
          </select>
          {forceProvider !== 'auto' && visibleModels.length === 0 && (
            <p className="text-[11px] text-amber-300">No models available for this provider.</p>
          )}
          {selectedModelMeta && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-300">
              <div className="font-medium text-white">{selectedModelMeta.name}</div>
              <div className="font-mono text-blue-300 text-[10px] mt-0.5">{selectedModelMeta.id}</div>
              <div className="text-slate-400 mt-0.5">{selectedModelMeta.shortDescription ?? 'No description available'}</div>
              <div className="mt-1 text-slate-400">Cost tier: <span className="text-white">{selectedModelMeta.estimatedCostTier ?? 'medium'}</span></div>
            </div>
          )}
          {capability === 'chat' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={streamMode} onChange={e => setStreamMode(e.target.checked)}
                  className="rounded border-slate-600 bg-transparent" />
                <Radio className="w-3 h-3" /> Stream mode
              </label>
              {/* Cost routing mode selector */}
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cost Mode</p>
                <div className="flex gap-1">
                  {([
                    { key: 'free_first', label: 'Free First', title: 'Prefers free/cheap providers: groq → deepseek → huggingface' },
                    { key: 'balanced', label: 'Balanced', title: 'Balances quality and cost: openai → groq → anthropic' },
                    { key: 'quality_first', label: 'Quality', title: 'Prefers highest-quality: openai → anthropic → gemini' },
                  ] as const).map(m => (
                    <button
                      key={m.key}
                      title={m.title}
                      onClick={() => setCostMode(m.key)}
                      className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                        costMode === m.key
                          ? m.key === 'free_first' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : m.key === 'quality_first' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-white/[0.02] text-slate-500 border border-white/[0.06] hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {capability === 'tts' && (
            <div className="space-y-1">
              <select value={ttsGender} onChange={e => setTtsGender(e.target.value as 'male' | 'female' | '')}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white">
                <option value="">Any gender</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Run button */}
      <button onClick={runTest} disabled={running || (!prompt.trim() && capability !== 'stt')}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {running ? 'Running…' : 'Run Test'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Streaming output */}
      {streaming && streamOutput && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-blue-400 flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> Streaming…</div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              {streamMeta?.provider && <span className="font-mono">{streamMeta.provider}</span>}
              {streamMeta?.tokensPerSec != null && <span>~{streamMeta.tokensPerSec} tok/s</span>}
              {streamMeta?.elapsedMs != null && <span>{(streamMeta.elapsedMs / 1000).toFixed(1)}s</span>}
              <span className="capitalize">{costMode.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="text-sm text-slate-300 whitespace-pre-wrap">{streamOutput}</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center gap-2">
              {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span className="text-sm font-medium text-white">{result.success ? 'Success' : 'Failed'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {result.routedProvider && <span className="flex items-center gap-1"><Route className="w-3 h-3" />{result.routedProvider}</span>}
              {result.routedModel && <span>{result.routedModel}</span>}
              {result.latencyMs > 0 && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{result.latencyMs}ms</span>}
              {result.confidenceScore != null && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{(result.confidenceScore * 100).toFixed(0)}%</span>}
            </div>
          </div>

          {/* Image output — premium inline display */}
          {result.imageUrl && (
            <div className="image-result-container relative rounded-2xl overflow-hidden bg-[#0d1424] border border-white/[0.06]">
              <img
                src={result.imageUrl}
                alt="Generated image"
                className="w-full max-h-[600px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    const fallback = document.createElement('div')
                    fallback.className = 'p-6 text-center'
                    const msg = document.createElement('p')
                    msg.className = 'text-sm text-slate-400 mb-2'
                    msg.textContent = 'Image generated but could not display inline.'
                    const link = document.createElement('a')
                    link.href = result.imageUrl ?? ''
                    link.target = '_blank'
                    link.rel = 'noopener noreferrer'
                    link.className = 'text-sm text-blue-400 hover:text-blue-300 underline'
                    link.textContent = 'Open image in new tab →'
                    fallback.appendChild(msg)
                    fallback.appendChild(link)
                    parent.appendChild(fallback)
                  }
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300">
                    {result.routedProvider && <span className="px-2 py-0.5 rounded-lg bg-white/10 backdrop-blur-sm">{result.routedProvider}</span>}
                    {result.routedModel && <span className="px-2 py-0.5 rounded-lg bg-white/10 backdrop-blur-sm">{result.routedModel}</span>}
                  </div>
                  <a href={result.imageUrl} download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/80 backdrop-blur-sm text-xs text-white font-medium hover:bg-blue-500 transition-colors">
                    <Download className="w-3 h-3" /> Download
                  </a>
                  <button onClick={saveArtifact} disabled={savingArtifact}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/80 backdrop-blur-sm text-xs text-white font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                    {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audio output */}
          {result.audioUrl && (
            <div className="space-y-2">
              <audio controls src={result.audioUrl} className="w-full" />
              <a href={result.audioUrl} download className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                Download audio
              </a>
              <button onClick={saveArtifact} disabled={savingArtifact} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save
              </button>
            </div>
          )}

          {/* Video output */}
          {videoJobId && !videoUrl && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Video generating… (Job: {videoJobId.slice(0, 8)}…)
            </div>
          )}
          {videoUrl && (
            <div className="space-y-2">
              <video controls src={videoUrl} className="max-w-full rounded-lg border border-white/[0.06]" />
              <a href={videoUrl} download className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Download className="w-3 h-3" /> Download video
              </a>
              <button onClick={saveArtifact} disabled={savingArtifact} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save
              </button>
            </div>
          )}

          {/* Text output */}
          {result.output && !result.imageUrl && !result.audioUrl && (
            <div className="relative">
              <button onClick={() => { navigator.clipboard.writeText(result.output ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="bg-white/[0.02] rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                {result.output}
              </div>
            </div>
          )}

          {/* Research sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Sources</div>
              {result.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="block px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-xs text-slate-400 hover:text-white transition-colors">
                  <div className="font-medium text-blue-400">{s.title}</div>
                  {s.snippet && <div className="mt-1 text-slate-500 line-clamp-2">{s.snippet}</div>}
                </a>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                  <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Error detail */}
          {result.error && (
            <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/5 rounded-lg p-3">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {result.error}
            </div>
          )}

          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {result.executionMode && <span className="px-2 py-1 rounded-full bg-white/[0.04] text-slate-400">Mode: {result.executionMode}</span>}
            {result.validationUsed && <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Validated</span>}
            {result.consensusUsed && <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-400">Consensus</span>}
            {(result.fallbackUsed || result.fallback_used) && <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">Fallback</span>}
            {/* Cost chip — actual cost from server when available, otherwise estimated */}
            {result.routedModel && (result.costUsdCents != null ? (
              <span className={`px-2 py-1 rounded-full font-mono ${result.costUsdCents > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-slate-400'}`}>
                Cost: ${(result.costUsdCents / 100).toFixed(4)}
              </span>
            ) : estimatedRequestCost !== null && (
              <span className="px-2 py-1 rounded-full bg-white/[0.04] text-slate-400">
                Est. cost: ~${estimatedRequestCost}
              </span>
            ))}
          </div>

          {/* Artifact save feedback */}
          {artifactSaved && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              Saved to Artifacts —{' '}
              <Link href="/admin/dashboard/artifacts" className="underline hover:text-emerald-300">
                View in Artifacts →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
