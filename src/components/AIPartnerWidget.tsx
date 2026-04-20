'use client'

/**
 * AIPartnerWidget — Optional floating AI partner for Workspace.
 *
 * Toggle on/off. Text mode + voice+text mode.
 * Can answer questions, navigate, explain, and trigger allowed actions.
 * Designed to be the foundation for future AI friend/avatar integration.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Bot, X, Send, Mic, MicOff, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/** Maximum number of recent messages to include in conversation context sent to the AI. */
const MAX_CONTEXT_MESSAGES = 10

interface VoiceRecognizer {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  onerror: ((ev: Event) => void) | null
  onend: ((ev: Event) => void) | null
}

function getSpeechRecognitionConstructor(): (new () => VoiceRecognizer) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => VoiceRecognizer
    webkitSpeechRecognition?: new () => VoiceRecognizer
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface AIPartnerWidgetProps {
  /** Whether the widget panel is visible */
  open: boolean
  onClose: () => void
}

export default function AIPartnerWidget({ open, onClose }: AIPartnerWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<VoiceRecognizer | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const SR = getSpeechRecognitionConstructor()

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const history = [...messages, userMsg]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map(m => `${m.role === 'user' ? 'Operator' : 'Partner'}: ${m.content}`)
        .join('\n')
      const systemNote = 'You are the Amarktai Network AI partner. You help the operator navigate the dashboard, understand features, and get things done. Be concise, direct, and helpful. You can explain what sections do, suggest next steps, and help with AI tasks. You cannot execute actions directly — you guide the operator instead.'
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: '__admin_test__',
          appSecret: 'admin-test-secret',
          taskType: 'chat',
          message: `${systemNote}\n\nConversation so far:\n${history}`,
        }),
      })
      const data = await res.json().catch(() => ({ error: `Response error (HTTP ${res.status})` }))
      const reply = data.output ?? data.text ?? data.error ?? 'No response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e instanceof Error ? e.message : 'Error communicating with AI.' }])
    } finally {
      setSending(false)
    }
  }, [messages])

  const startVoice = useCallback(() => {
    if (!SR) return
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1
    recognitionRef.current = r
    setRecording(true)
    r.onresult = (ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? ''
      if (transcript) send(transcript)
    }
    r.onerror = () => setRecording(false)
    r.onend = () => setRecording(false)
    r.start()
  }, [SR, send])

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  if (!open) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 flex flex-col rounded-2xl border border-white/10 bg-[#090f21]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-white">AI Partner</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">Online</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-72">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot className="mx-auto w-8 h-8 text-blue-400/40 mb-2" />
            <p className="text-xs text-slate-500">Hi! I can help you navigate Workspace, explain features, and assist with AI tasks.</p>
            <div className="mt-3 space-y-1">
              {['What can I do in Workspace?', 'How do I generate an image?', 'How do I compare models?'].map(s => (
                <button key={s} onClick={() => send(s)}
                  className="block w-full text-left text-[11px] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600/70 text-white'
                : 'bg-white/[0.06] text-slate-300'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.06] px-3 py-2 rounded-xl">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask anything…"
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-all"
          disabled={sending}
        />
        {SR && (
          <button
            onClick={recording ? stopVoice : startVoice}
            className={`p-2 rounded-xl border transition-colors ${recording ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white'}`}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
