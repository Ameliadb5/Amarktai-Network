'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Play, Loader2, Copy, Check,
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
    </motion.div>
  )
}
