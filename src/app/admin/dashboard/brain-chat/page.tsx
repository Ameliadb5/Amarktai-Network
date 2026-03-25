'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, RefreshCw, PanelRightOpen, PanelRightClose,
  CheckCircle, AlertCircle, Clock, Activity, Zap,
  WifiOff, Loader2, RotateCcw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrainTestResponse {
  success: boolean
  traceId: string
  output: string | null
  routedProvider: string | null
  routedModel: string | null
  executionMode: string
  confidenceScore: number | null
  validationUsed?: boolean
  consensusUsed?: boolean
  fallbackUsed: boolean
  warnings?: string[]
  error: string | null
  latencyMs: number | null
  timestamp: string
}

interface BrainEvent {
  id: number
  traceId: string
  appSlug: string
  taskType: string
  routedProvider: string | null
  routedModel: string | null
  success: boolean
  errorMessage: string | null
  latencyMs: number | null
  timestamp: string
}

interface BrainStats {
  totalRequests: number
  successCount: number
  errorCount: number
  avgLatencyMs: number | null
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
  provider?: string
  model?: string
  latencyMs?: number
  traceId?: string
  timestamp: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ success }: { success: boolean }) {
  if (success) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-semibold tracking-wider">
        <CheckCircle className="w-2.5 h-2.5" /> OK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-[10px] text-red-400 font-semibold tracking-wider">
      <AlertCircle className="w-2.5 h-2.5" /> FAIL
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrainChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sidePanel, setSidePanel] = useState(true)
  const [events, setEvents] = useState<BrainEvent[]>([])
  const [stats, setStats] = useState<BrainStats | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brain/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(Array.isArray(data.events) ? data.events : [])
        setStats(data.stats ?? null)
      }
    } catch (err) {
      console.error('[brain-chat] events fetch error:', err)
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, taskType: 'chat' }),
      })
      const data: BrainTestResponse = await res.json()

      if (data.success && data.output) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.output!,
          provider: data.routedProvider ?? undefined,
          model: data.routedModel ?? undefined,
          latencyMs: data.latencyMs ?? undefined,
          traceId: data.traceId,
          timestamp: data.timestamp,
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'error',
          content: data.error ?? 'Gateway returned an error',
          traceId: data.traceId,
          timestamp: data.timestamp ?? new Date().toISOString(),
        }])
      }

      // Refresh events log
      fetchEvents()
    } catch {
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Network error — could not reach Brain Gateway',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }

  const hasProviders = stats !== null
  const gatewayReady = hasProviders

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* ── Main Chat ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col glass rounded-2xl overflow-hidden min-w-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white font-heading">
                CNS Gateway
              </h1>
              <div className="flex items-center gap-1.5">
                {gatewayReady ? (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider">Gateway active</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">No providers configured</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidePanel(!sidePanel)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition-colors"
          >
            {sidePanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center mb-4">
                <Brain className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                Amarktai CNS is connected. Send a message to test the gateway.
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Uses routing policy → provider vault → normalised response
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/25'
                    : msg.role === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-white/[0.04] border border-white/10'
                }`}>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'error' ? 'text-red-300' : 'text-white'
                  }`}>
                    {msg.content}
                  </p>
                  {(msg.provider || msg.latencyMs) && (
                    <div className="flex items-center gap-2 pt-1">
                      {msg.provider && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {msg.provider}{msg.model ? ` / ${msg.model}` : ''}
                        </span>
                      )}
                      {msg.latencyMs && (
                        <span className="text-[10px] text-slate-600 font-mono">{msg.latencyMs}ms</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/5 flex-shrink-0">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 focus-within:border-blue-500/40 transition-colors">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Send a message to test the CNS gateway…"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                title="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </motion.div>

      {/* ── Side Panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidePanel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-72 flex-shrink-0 space-y-4 hidden lg:flex lg:flex-col overflow-y-auto"
          >
            {/* Stats */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-white font-heading">
                    Gateway Stats
                  </h3>
                </div>
                <button onClick={fetchEvents} className="p-1 text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {stats ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total', value: stats.totalRequests, color: 'text-white' },
                    { label: 'Success', value: stats.successCount, color: 'text-emerald-400' },
                    { label: 'Errors', value: stats.errorCount, color: 'text-red-400' },
                    { label: 'Avg ms', value: stats.avgLatencyMs ?? '—', color: 'text-blue-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  {loadingEvents
                    ? <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                    : <><Zap className="w-5 h-5 text-slate-700 mb-1" /><p className="text-xs text-slate-600">No events yet</p></>}
                </div>
              )}
            </div>

            {/* Recent Events */}
            <div className="glass rounded-2xl p-5 space-y-3 flex-1 min-h-0">
              <h3 className="text-sm font-semibold text-white font-heading">
                Recent Events
              </h3>
              <div className="space-y-2 overflow-y-auto">
                {loadingEvents ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Clock className="w-5 h-5 text-slate-700 mb-2" />
                    <p className="text-xs text-slate-600">No brain events logged yet</p>
                  </div>
                ) : (
                  events.slice(0, 20).map(evt => (
                    <div key={evt.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <div className="flex-shrink-0 mt-0.5">
                        <StatusBadge success={evt.success} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-300 truncate font-mono">{evt.appSlug}</p>
                        <p className="text-[10px] text-slate-600">{evt.routedProvider ?? '—'} · {evt.taskType}</p>
                        {evt.errorMessage && (
                          <p className="text-[10px] text-red-400 truncate mt-0.5">{evt.errorMessage}</p>
                        )}
                        <p className="text-[9px] text-slate-700 mt-0.5">
                          {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                          {evt.latencyMs ? ` · ${evt.latencyMs}ms` : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
