'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, Copy, Check, Gauge, CheckCircle, XCircle,
} from 'lucide-react'

const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'gemini-pro', label: 'Gemini Pro' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat' },
  { id: 'llama-3', label: 'Llama 3' },
]

const CAPABILITIES = [
  'chat', 'code', 'vision', 'reasoning', 'embeddings', 'tts', 'stt', 'image',
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function LabPage() {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [capability, setCapability] = useState('chat')
  const [output, setOutput] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleRun = async () => {
    if (!prompt.trim()) return
    setRunning(true)
    setError(null)
    setOutput(null)
    try {
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt.trim(), taskType: capability }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setOutput(data.output ?? data.error ?? JSON.stringify(data, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Lab</h1>
        <p className="text-sm text-slate-400 mt-1">Admin playground — test requests, models, and capabilities</p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Test Request</h2>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-colors"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0a0f1a] text-white">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Capability Selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Capability</label>
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
            {running ? 'Running…' : 'Run Test'}
          </button>
        </div>

        {/* Output Panel */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Output</h2>
            {output && (
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>

          <div className="flex-1 min-h-[300px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 overflow-auto">
            {running ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Processing…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : output ? (
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <FlaskConical className="w-8 h-8 text-slate-700" />
                <p className="text-sm text-slate-600">Run a test to see output</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Benchmark Panel ─────────────────────────────────── */}
      <BenchmarkPanel />
    </motion.div>
  )
}

/* ── Benchmark ──────────────────────────────────────────── */

const BENCHMARK_PROVIDERS = [
  { key: 'openai',     label: 'OpenAI' },
  { key: 'anthropic',  label: 'Anthropic' },
  { key: 'grok',       label: 'Grok / xAI' },
  { key: 'gemini',     label: 'Gemini' },
  { key: 'deepseek',   label: 'DeepSeek' },
  { key: 'groq',       label: 'Groq' },
  { key: 'mistral',    label: 'Mistral' },
  { key: 'together',   label: 'Together AI' },
]

interface BenchmarkResult {
  providerKey: string
  model: string
  output: string | null
  success: boolean
  error: string | null
  latencyMs: number
}

function BenchmarkPanel() {
  const [benchPrompt, setBenchPrompt] = useState('')
  const [benchTask, setBenchTask] = useState('chat')
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['openai', 'anthropic'])
  const [benchRunning, setBenchRunning] = useState(false)
  const [benchResults, setBenchResults] = useState<BenchmarkResult[] | null>(null)
  const [benchError, setBenchError] = useState<string | null>(null)

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
        <span className="text-xs text-slate-500">Run the same prompt across multiple providers simultaneously</span>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-5">
        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Providers to benchmark</label>
          <div className="flex flex-wrap gap-2">
            {BENCHMARK_PROVIDERS.map(({ key, label }) => (
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
              </button>
            ))}
          </div>
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
          {benchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gauge className="w-4 h-4" />}
          {benchRunning ? `Running across ${selectedProviders.length} providers…` : `Run Benchmark (${selectedProviders.length} providers)`}
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
