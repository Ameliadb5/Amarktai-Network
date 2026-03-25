'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, Send, Loader2, RefreshCw, AlertCircle, CheckCircle,
  WifiOff, Activity,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────
interface BrainTestResponse {
  success: boolean
  traceId: string
  output: string | null
  routedProvider: string | null
  routedModel: string | null
  executionMode: string
  confidenceScore: number | null
  fallbackUsed: boolean
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

interface Message {
  role: 'user' | 'assistant'
  content: string
  meta?: { provider?: string | null; model?: string | null; latency?: number | null; error?: string | null; traceId?: string }
}

// Slug used for admin test requests to the brain gateway
const ADMIN_TEST_APP_SLUG = 'admin-test'
async function checkGateway(): Promise<{ ready: boolean; providerCount: number }> {
  try {
    const res = await fetch('/api/admin/providers')
    if (!res.ok) return { ready: false, providerCount: 0 }
    const providers = await res.json()
    const healthy = providers.filter((p: { healthStatus: string; enabled: boolean }) => p.enabled && p.healthStatus === 'healthy')
    return { ready: healthy.length > 0, providerCount: healthy.length }
  } catch {
    return { ready: false, providerCount: 0 }
  }
}

// ── Page ──────────────────────────────────────────────────────────
export default function BrainChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [gatewayReady, setGatewayReady] = useState(false)
  const [providerCount, setProviderCount] = useState(0)
  const [recentEvents, setRecentEvents] = useState<BrainEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)

  const loadStatus = useCallback(async () => {
    const { ready, providerCount: pc } = await checkGateway()
    setGatewayReady(ready)
    setProviderCount(pc)
  }, [])

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch('/api/admin/brain/events')
      if (res.ok) {
        const data = await res.json()
        setRecentEvents(Array.isArray(data) ? data.slice(0, 10) : [])
      }
    } catch { /* silent */ }
    finally { setLoadingEvents(false) }
  }, [])

  useEffect(() => {
    loadStatus()
    loadEvents()
  }, [loadStatus, loadEvents])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setSending(true)
    try {
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, appSlug: ADMIN_TEST_APP_SLUG }),
      })
      const data: BrainTestResponse = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.output ?? data.error ?? 'No response',
        meta: {
          provider: data.routedProvider,
          model: data.routedModel,
          latency: data.latencyMs,
          error: data.error,
          traceId: data.traceId,
        },
      }])
      // Refresh events after a test
      loadEvents()
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Request failed — check console for details.',
        meta: { error: String(err) },
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-5xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AmarktAI Gateway Test</h1>
          <p className="text-sm text-slate-500 mt-1">
            Send test requests directly to the AmarktAI execution layer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gatewayReady ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              {providerCount} provider{providerCount > 1 ? 's' : ''} ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">
              <WifiOff className="w-3 h-3" />
              No providers configured
            </span>
          )}
          <button
            onClick={() => { loadStatus(); loadEvents() }}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!gatewayReady && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          No healthy AI providers configured. Configure and test providers in{' '}
          <a href="/admin/dashboard/ai-providers" className="underline hover:no-underline">AI Providers</a>{' '}
          before using the gateway test.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Chat panel */}
        <div className="lg:col-span-3 bg-[#0A1020] border border-white/8 rounded-xl flex flex-col h-[520px]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="w-10 h-10 text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">
                  {gatewayReady
                    ? 'Gateway ready. Send a test message.'
                    : 'Configure at least one AI provider to enable the gateway.'}
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.meta?.error
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-white/[0.06] border border-white/8 text-slate-200'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && msg.meta && (
                    <div className="flex flex-wrap gap-2 px-1">
                      {msg.meta.provider && (
                        <span className="text-[10px] text-slate-600 font-mono">{msg.meta.provider}</span>
                      )}
                      {msg.meta.model && (
                        <span className="text-[10px] text-slate-600 font-mono">{msg.meta.model}</span>
                      )}
                      {msg.meta.latency != null && (
                        <span className="text-[10px] text-slate-600 font-mono">{msg.meta.latency}ms</span>
                      )}
                      {msg.meta.traceId && (
                        <span className="text-[10px] text-slate-700 font-mono">{msg.meta.traceId.slice(0, 8)}…</span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing…
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t border-white/5 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={sending || !gatewayReady}
              placeholder={gatewayReady ? 'Send a test message to AmarktAI…' : 'Configure a provider first…'}
              className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || !gatewayReady}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Recent events panel */}
        <div className="lg:col-span-2 bg-[#0A1020] border border-white/8 rounded-xl flex flex-col h-[520px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Recent Executions
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {loadingEvents ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-white/4 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-slate-600">No executions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(ev => (
                  <div key={ev.id} className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white font-mono">{ev.appSlug}</span>
                      {ev.success
                        ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                        : <AlertCircle className="w-3 h-3 text-red-400" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span className="font-mono">{ev.routedProvider ?? '—'}</span>
                      {ev.latencyMs != null && <span>{ev.latencyMs}ms</span>}
                      <span className="ml-auto">{formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
