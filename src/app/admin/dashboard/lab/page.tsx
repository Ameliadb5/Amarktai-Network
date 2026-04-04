'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, Copy, Check, Gauge, CheckCircle, XCircle,
  Zap, Info, RefreshCw, Route, AlertCircle, ShieldAlert,
} from 'lucide-react'

const CAPABILITIES = [
  'chat', 'code', 'reasoning', 'image', 'image_editing', 'video', 'video_planning',
  'tts', 'stt', 'vision', 'embeddings', 'reranking', 'research', 'suggestive',
  'app_builder',
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
      setResult({
        success: data.success ?? res.ok,
        executed: data.executed ?? (data.success ?? false),
        output: data.output ?? null,
        capability: Array.isArray(data.capability) ? data.capability : [],
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
        error: data.error ?? null,
        latencyMs: data.latencyMs ?? 0,
        imageUrl: data.imageUrl ?? data.image_url ?? null,
        audioUrl: data.audioUrl ?? data.audio_url ?? null,
        videoStatus: data.videoStatus ?? data.video_status ?? null,
      })
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
          <button
            onClick={handleRun}
            disabled={running || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Running…' : forceProvider === 'auto' ? 'Auto-Route & Run' : `Run via ${forceProvider}`}
          </button>
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
                    <img
                      src={result.imageUrl}
                      alt="Generated"
                      className="max-w-full rounded-lg border border-white/[0.06]"
                    />
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

                {/* Video Status */}
                {result?.videoStatus && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Video Status</p>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                      <span className="text-xs text-violet-400 font-mono">{result.videoStatus}</span>
                    </div>
                  </div>
                )}

                {/* Text Output */}
                {result?.output ? (
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{result.output}</pre>
                ) : !result?.imageUrl && !result?.audioUrl && !result?.videoStatus ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <FlaskConical className="w-8 h-8 text-slate-700" />
                    <p className="text-sm text-slate-600">Run a test to see output</p>
                  </div>
                ) : null}

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
  success: boolean
  error: string | null
  latencyMs: number
}

function BenchmarkPanel() {
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [benchPrompt, setBenchPrompt] = useState('')
  const [benchTask, setBenchTask] = useState('chat')
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

        {/* Run */}
        <button
          onClick={handleBenchmark}
          disabled={benchRunning || !benchPrompt.trim() || selectedProviders.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {benchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {benchRunning
            ? `Running across ${selectedProviders.length} provider${selectedProviders.length !== 1 ? 's' : ''}…`
            : `Benchmark ${selectedProviders.length} provider${selectedProviders.length !== 1 ? 's' : ''}`}
        </button>

        {benchError && <p className="text-sm text-red-400">{benchError}</p>}
      </div>

      {/* Results grid */}
      {benchResults && benchResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {benchResults.map((r, i) => (
            <div
              key={i}
              className={`bg-white/[0.03] border rounded-xl p-5 space-y-3 ${
                r.success ? 'border-white/[0.06]' : 'border-red-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{r.providerKey}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{r.model}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.success
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-xs text-slate-500">{r.latencyMs}ms</span>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 min-h-[80px] max-h-[200px] overflow-auto">
                {r.success && r.output ? (
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{r.output}</pre>
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
