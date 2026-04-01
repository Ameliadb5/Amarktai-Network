'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, Copy, Check, Gauge, CheckCircle, XCircle,
  Zap, Info, RefreshCw, Route,
} from 'lucide-react'

const CAPABILITIES = [
  'chat', 'code', 'vision', 'reasoning', 'embeddings', 'tts', 'stt', 'image',
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

interface TestResult {
  success: boolean
  output: string | null
  routedProvider: string | null
  routedModel: string | null
  executionMode: string | null
  confidenceScore: number | null
  validationUsed: boolean
  consensusUsed: boolean
  fallbackUsed: boolean
  routingReason?: string
  warnings: string[]
  error: string | null
  latencyMs: number
}

export default function LabPage() {
  const [prompt, setPrompt] = useState('')
  const [capability, setCapability] = useState('chat')
  const [forceProvider, setForceProvider] = useState<string>('auto')
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [result, setResult] = useState<TestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      }
    } catch {
      // best-effort
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  useEffect(() => { loadProviders() }, [loadProviders])

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
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      // Throw for network-level errors that have no usable routing metadata.
      // When the response contains routedProvider (even on 4xx/5xx), we still
      // render the routing decision panel rather than just showing a generic error.
      if (!res.ok && data.routedProvider == null) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setResult({
        success: data.success ?? res.ok,
        output: data.output ?? null,
        routedProvider: data.routedProvider ?? null,
        routedModel: data.routedModel ?? null,
        executionMode: data.executionMode ?? null,
        confidenceScore: data.confidenceScore ?? null,
        validationUsed: data.validationUsed ?? false,
        consensusUsed: data.consensusUsed ?? false,
        fallbackUsed: data.fallbackUsed ?? false,
        routingReason: data.routingReason,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        error: data.error ?? null,
        latencyMs: data.latencyMs ?? 0,
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

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Lab</h1>
        <p className="text-sm text-slate-400 mt-1">Admin test environment — capability-first routing with real provider selection</p>
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
              <option value="auto" className="bg-[#0a0f1a] text-white">⚡ Auto-Route (best available)</option>
              {providers.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#0a0f1a] text-white">
                  {p.label} ({p.healthStatus})
                </option>
              ))}
            </select>
            {forceProvider === 'auto' && (
              <p className="text-[10px] text-slate-500">The system selects the best configured provider for this task type.</p>
            )}
            {providers.length === 0 && !loadingProviders && (
              <p className="text-[10px] text-amber-400">No enabled providers found. Configure keys in Operations → Providers.</p>
            )}
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
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Prompt</label>
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

          {/* Routing Metadata */}
          {result && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-2">
                <Route className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Routing Decision</span>
                {result.success
                  ? <CheckCircle className="w-3 h-3 text-emerald-400 ml-auto" />
                  : <XCircle className="w-3 h-3 text-red-400 ml-auto" />}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
                {result.confidenceScore !== null && (
                  <>
                    <span className="text-slate-500">Confidence</span>
                    <span className="text-slate-300 font-mono">{Math.round(result.confidenceScore * 100)}%</span>
                  </>
                )}
                {result.fallbackUsed && (
                  <>
                    <span className="text-slate-500">Fallback</span>
                    <span className="text-amber-400 font-mono">used</span>
                  </>
                )}
                {result.validationUsed && (
                  <>
                    <span className="text-slate-500">Validation</span>
                    <span className="text-blue-400 font-mono">yes</span>
                  </>
                )}
              </div>
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
            ) : result?.error && !result.output ? (
              <p className="text-sm text-red-400">{result.error}</p>
            ) : result?.output ? (
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{result.output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <FlaskConical className="w-8 h-8 text-slate-700" />
                <p className="text-sm text-slate-600">Run a test to see output</p>
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
