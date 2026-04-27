'use client'

/**
 * AIPartnerWidget — Floating AI Partner for Workspace.
 *
 * Phase 2: Real voice assistant loop — STT input → AI reply → TTS playback.
 * Phase 3: Structured command dispatch — navigate_to, generate_image, run_test,
 *           show_artifacts, check_budget, start_onboarding.
 *
 * Voice persona settings from System → Voice Access are applied automatically
 * to all TTS calls (Phase 1 fix).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, X, Send, Mic, MicOff, Loader2, Volume2, VolumeX } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** Parsed action, if the assistant returned one */
  action?: AssistantAction | null
}

/** Structured action the assistant can dispatch */
export interface AssistantAction {
  type: 'navigate_to' | 'generate_image' | 'run_test' | 'show_artifacts' | 'check_budget' | 'start_onboarding'
  payload?: Record<string, string>
}

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

/** Parse a structured action block out of an assistant reply.
 *  The AI is instructed to include a JSON block like:
 *  ACTION:{"type":"navigate_to","payload":{"section":"models"}}
 *
 *  Uses a robust multi-pass strategy:
 *  1. Scan for the ACTION: marker and extract everything from the first { to
 *     the last balanced }, handling nested objects correctly.
 *  2. Falls back to a simple regex as a last resort.
 */
function parseAction(text: string): { clean: string; action: AssistantAction | null } {
  // Find the ACTION: marker (case-insensitive)
  const markerIdx = text.search(/ACTION\s*:/i)
  if (markerIdx === -1) return { clean: text, action: null }

  // Find the opening brace after the marker
  const braceStart = text.indexOf('{', markerIdx)
  if (braceStart === -1) return { clean: text, action: null }

  // Walk forward balancing braces to find the closing brace
  let depth = 0
  let braceEnd = -1
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) { braceEnd = i; break }
    }
  }
  if (braceEnd === -1) return { clean: text, action: null }

  const jsonStr = text.slice(braceStart, braceEnd + 1)
  try {
    const action = JSON.parse(jsonStr) as AssistantAction
    if (!action.type) return { clean: text, action: null }
    const markerText = text.slice(markerIdx, braceEnd + 1)
    const clean = text.replace(markerText, '').replace(/\n{3,}/g, '\n\n').trim()
    return { clean, action }
  } catch {
    return { clean: text, action: null }
  }
}

/** Returns true for destructive/high-impact actions that require confirmation */
function requiresConfirmation(action: AssistantAction): boolean {
  return action.type === 'generate_image' || action.type === 'run_test'
}

/** Base system prompt — the memory context block is appended dynamically per-session */
const BASE_SYSTEM_PROMPT = `You are the Amarktai Network AI Partner — a capable operator assistant embedded in the admin dashboard.
You can answer questions, explain features, AND trigger real dashboard actions.

Available actions you can dispatch (include at the END of your reply if appropriate):
- ACTION:{"type":"navigate_to","payload":{"section":"models"}}  — valid sections: models, apps, voice, intelligence, artifacts, budget, operations, onboarding, workspace, events
- ACTION:{"type":"show_artifacts"}
- ACTION:{"type":"check_budget"}
- ACTION:{"type":"start_onboarding"}
- ACTION:{"type":"generate_image","payload":{"prompt":"<description>"}}  — opens the Images tab; operator reviews before sending
- ACTION:{"type":"run_test","payload":{"capability":"chat","prompt":"Hello"}}  — opens the Test AI tab; operator reviews before sending

Rules:
- Only include an ACTION block when the operator explicitly asks for an action or you are certain it is appropriate.
- generate_image and run_test open the relevant workspace tab so the operator can review and execute.
- Be concise and direct. Avoid unnecessary explanation.
- When context or memory is provided below, reference it naturally in your replies to feel memory-aware.`

interface PartnerContext {
  memoryLines: string[]
  usageLines: string[]
  memoryCount: number
}

/** Build a full system prompt with injected memory/usage context */
function buildSystemPrompt(ctx: PartnerContext | null): string {
  if (!ctx || (ctx.memoryLines.length === 0 && ctx.usageLines.length === 0)) {
    return BASE_SYSTEM_PROMPT
  }
  const sections: string[] = [BASE_SYSTEM_PROMPT]
  if (ctx.memoryLines.length > 0) {
    sections.push(`\nRecent workspace activity (memory context — use to inform replies):\n${ctx.memoryLines.join('\n')}`)
  }
  if (ctx.usageLines.length > 0) {
    sections.push(`\nWorkspace usage snapshot:\n${ctx.usageLines.map(l => `- ${l}`).join('\n')}`)
  }
  return sections.join('\n')
}

export interface AIPartnerWidgetProps {
  open: boolean
  onClose: () => void
  variant?: 'floating' | 'panel'
  /** Called when the assistant dispatches a confirmed operator action */
  onAction?: (action: AssistantAction) => void
}

/** Sentinel empty context used when the context fetch fails or returns nothing */
const EMPTY_PARTNER_CONTEXT: PartnerContext = { memoryLines: [], usageLines: [], memoryCount: 0 }

export default function AIPartnerWidget({ open, onClose, onAction, variant = 'floating' }: AIPartnerWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [pendingAction, setPendingAction] = useState<AssistantAction | null>(null)
  const [browserNote, setBrowserNote] = useState<string | null>(null)
  const [partnerContext, setPartnerContext] = useState<PartnerContext | null>(null)
  const [greeted, setGreeted] = useState(false)
  /** True when a voice TTS error has occurred — shows error state */
  const [voiceError, setVoiceError] = useState<string | null>(null)
  /** Whether TTS provider is known to be unconfigured */
  const [ttsUnconfigured, setTtsUnconfigured] = useState(false)

  const recognitionRef = useRef<VoiceRecognizer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  /** Ref to startVoice — avoids stale closure in speakText's audio.onended */
  const startVoiceRef = useRef<(() => void) | null>(null)
  const SR = getSpeechRecognitionConstructor()

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Load voice settings once so we can pass them to TTS
  const voiceSettingsRef = useRef<{ voiceId: string; accent: string } | null>(null)
  useEffect(() => {
    fetch('/api/admin/voice-access-settings')
      .then(r => r.json())
      .then(d => { if (d?.settings) voiceSettingsRef.current = d.settings })
      .catch(() => {})
  }, [])

  // Load memory + usage context when the widget opens for the first time
  useEffect(() => {
    if (!open || partnerContext !== null) return
    fetch('/api/admin/ai-partner/context')
      .then(r => r.ok ? r.json() : null)
      .then((ctx: PartnerContext | null) => { setPartnerContext(ctx ?? EMPTY_PARTNER_CONTEXT) })
      .catch(() => { setPartnerContext(EMPTY_PARTNER_CONTEXT) })
  }, [open, partnerContext])

  // Show a memory-aware greeting the first time the widget is opened
  useEffect(() => {
    if (!open || greeted || partnerContext === null) return
    setGreeted(true)
    const hasActivity = partnerContext.usageLines.length > 0
    const activityHint = hasActivity
      ? ` I can see some recent activity — ${partnerContext.usageLines[0]}.`
      : ''
    const greeting = `Hi, I'm your AI Partner.${activityHint} How can I help you today?`
    setMessages([{ role: 'assistant', content: greeting }])
  }, [open, greeted, partnerContext])

  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return
    setVoiceError(null)
    setSpeaking(true)
    try {
      const vs = voiceSettingsRef.current
      const body: Record<string, unknown> = { text, provider: 'auto' }
      if (vs?.voiceId) body.voiceId = vs.voiceId
      if (vs?.accent) body.accent = vs.accent

      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 503 || res.status === 404) {
          setTtsUnconfigured(true)
          setVoiceError('Voice (TTS) provider not configured. Set up a TTS provider in Admin Settings (/admin/dashboard/settings) to enable Voice Buddy.')
        } else {
          setVoiceError(`Voice playback failed (HTTP ${res.status})`)
        }
        setSpeaking(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
        // Auto-restart listening in voice loop mode — use ref to avoid stale closure
        startVoiceRef.current?.()
      }
      audio.onerror = () => {
        setSpeaking(false)
        setVoiceError('Audio playback error — check browser audio permissions.')
      }
      await audio.play()
    } catch (e) {
      setSpeaking(false)
      setVoiceError(e instanceof Error ? e.message : 'Voice playback failed')
    }
  }, []) // voiceMode and startVoice accessed via refs — no closure issue

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const send = useCallback(async (text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages((prev: Message[]) => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      // Build the conversation history up to the context limit.
      // Include the just-added user message so the AI sees the full turn.
      const contextMessages = [...messages, userMsg]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((m: Message) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const systemPrompt = buildSystemPrompt(partnerContext)

      // Use the dedicated AI Partner chat route which properly formats the
      // system prompt as role:"system" and conversation history as structured
      // messages — NOT concatenated into a single user text blob.
      const res = await fetch('/api/admin/ai-partner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          messages: contextMessages,
        }),
      })
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as {
        reply?: string; error?: string; code?: string
      }
      const rawReply = data.reply ?? data.error ?? 'No response.'
      const { clean: reply, action } = parseAction(rawReply)

      const assistantMsg: Message = { role: 'assistant', content: reply, action }
      setMessages((prev: Message[]) => [...prev, assistantMsg])

      // Dispatch action or queue for confirmation
      if (action) {
        if (requiresConfirmation(action)) {
          setPendingAction(action)
        } else {
          onAction?.(action)
        }
      }

      // TTS playback in voice mode
      if (voiceMode) {
        await speakText(reply)
      }
    } catch (e) {
      setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: e instanceof Error ? e.message : 'Error communicating with AI.' }])
    } finally {
      setSending(false)
    }
  }, [messages, onAction, voiceMode, speakText, partnerContext])

  // Keep startVoiceRef in sync with the current startVoice function
  // so speakText's onended handler can call it without stale closure

  const startVoice = useCallback(() => {
    if (!SR) {
      setBrowserNote('Speech recognition is not supported in this browser. Use text input instead.')
      return
    }
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
    r.onerror = () => { setRecording(false); setBrowserNote('Microphone access failed — check browser permissions.') }
    r.onend = () => setRecording(false)
    r.start()
  }, [SR, send])

  // Sync startVoice to ref so speakText's audio.onended can call it without stale closure
  useEffect(() => {
    startVoiceRef.current = voiceMode ? startVoice : null
  }, [voiceMode, startVoice])

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) {
      stopVoice()
      stopSpeaking()
      setVoiceMode(false)
      setVoiceError(null)
    } else {
      if (!SR) {
        setBrowserNote('Speech recognition is not supported in this browser. Voice mode requires Chrome, Edge, or Safari.')
        return
      }
      if (ttsUnconfigured) {
        setBrowserNote('Voice (TTS) provider not configured. Configure a TTS-capable provider in Settings to enable Voice Buddy.')
        return
      }
      setVoiceError(null)
      setVoiceMode(true)
      startVoice()
    }
  }, [voiceMode, SR, ttsUnconfigured, stopVoice, stopSpeaking, startVoice])

  const confirmAction = useCallback(() => {
    if (pendingAction) {
      onAction?.(pendingAction)
      setPendingAction(null)
    }
  }, [pendingAction, onAction])

  if (!open) return null

  const isActive = recording || speaking
  const rootClass = variant === 'panel'
    ? 'flex h-full w-full flex-col rounded-2xl border border-white/10 bg-[#090f21]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden'
    : 'fixed bottom-6 right-6 z-50 w-80 flex flex-col rounded-2xl border border-white/10 bg-[#090f21]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden'

  return (
    <div className={rootClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          {/* Avatar — layered rings with idle/active pulse */}
          <div className="relative flex items-center justify-center">
            {/* Outer idle ring */}
            <motion.div
              className="absolute rounded-full border border-blue-400/25"
              animate={{ scale: isActive ? [1, 1.5, 1] : [1, 1.15, 1], opacity: isActive ? [0.5, 0, 0.5] : [0.2, 0.5, 0.2] }}
              transition={{ duration: isActive ? 1.0 : 3.5, repeat: Infinity, ease: 'easeOut' }}
              style={{ width: 32, height: 32 }}
            />
            {/* Mid ring */}
            <motion.div
              className="absolute rounded-full border"
              animate={{ scale: speaking ? [1, 1.35, 1] : recording ? [1, 1.2, 1] : [1, 1.06, 1], opacity: speaking ? [0.6, 0, 0.6] : recording ? [0.45, 0, 0.45] : [0.1, 0.3, 0.1] }}
              transition={{ duration: speaking ? 0.7 : recording ? 1.0 : 4.2, repeat: Infinity, ease: 'easeOut', delay: 0.15 }}
              style={{ width: 26, height: 26, borderColor: speaking ? 'rgba(34,211,238,0.7)' : recording ? 'rgba(96,165,250,0.6)' : 'rgba(99,102,241,0.25)' }}
            />
            {/* Core avatar */}
            <motion.div
              className="relative w-7 h-7 rounded-full flex items-center justify-center"
              animate={{
                background: speaking
                  ? ['linear-gradient(135deg,#0ea5e9,#22d3ee)', 'linear-gradient(135deg,#22d3ee,#0ea5e9)', 'linear-gradient(135deg,#0ea5e9,#22d3ee)']
                  : recording
                  ? ['linear-gradient(135deg,#3b82f6,#6366f1)', 'linear-gradient(135deg,#6366f1,#3b82f6)', 'linear-gradient(135deg,#3b82f6,#6366f1)']
                  : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                boxShadow: isActive ? ['0 0 0px rgba(34,211,238,0.3)', '0 0 12px rgba(34,211,238,0.6)', '0 0 0px rgba(34,211,238,0.3)'] : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{ duration: isActive ? 1.2 : 0.4, repeat: isActive ? Infinity : 0 }}
            >
              <Bot className="w-3.5 h-3.5 text-white" />
            </motion.div>
          </div>
          <span className="text-sm font-medium text-white">AI Partner</span>
          <span className={`text-[10px] rounded-full px-2 py-0.5 transition-colors ${
            voiceError ? 'text-red-300 bg-red-400/10' :
            speaking ? 'text-cyan-300 bg-cyan-400/10' :
            recording ? 'text-blue-300 bg-blue-400/10' :
            sending ? 'text-violet-300 bg-violet-400/10' :
            'text-emerald-400 bg-emerald-400/10'
          }`}>
            {voiceError ? 'Voice Error' : speaking ? 'Speaking' : recording ? 'Listening' : sending ? 'Thinking' : 'Online'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Voice mode toggle */}
          <button
            onClick={toggleVoiceMode}
            title={voiceMode ? 'Exit voice mode' : 'Enter voice mode (continuous STT + TTS)'}
            className={`p-1.5 rounded-lg transition-colors ${voiceMode ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30' : 'hover:bg-white/[0.08] text-slate-400 hover:text-white'}`}
          >
            {voiceMode ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Waveform bars — react to actual audio state */}
      {isActive && (
        <div className="flex items-end justify-center gap-0.5 py-2 bg-white/[0.01]">
          {[3, 7, 5, 9, 6, 11, 4, 8, 5, 7, 3, 6].map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all ${speaking ? 'bg-cyan-400' : 'bg-blue-400'}`}
              style={{
                height: `${h * 2}px`,
                animation: `pulse 0.${8 + (i % 4)}s ease-in-out ${i * 0.06}s infinite alternate`,
                opacity: 0.7 + (i % 3) * 0.1,
              }}
            />
          ))}
        </div>
      )}

      {/* Pending action confirmation */}
      {pendingAction && (
        <div className="mx-3 mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
          <p className="text-[11px] text-amber-300 mb-2">
            Confirm action: <span className="font-mono font-medium">{pendingAction.type}</span>
            {pendingAction.payload?.prompt && <span className="text-slate-400"> — &ldquo;{pendingAction.payload.prompt}&rdquo;</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={confirmAction} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
              Open tab
            </button>
            <button onClick={() => setPendingAction(null)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:bg-white/[0.08] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${variant === 'panel' ? '' : 'max-h-64'}`}>
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot className="mx-auto w-8 h-8 text-blue-400/40 mb-2" />
            <p className="text-xs text-slate-500">Loading context…</p>
          </div>
        )}
        {messages.map((m: Message, i: number) => (
          <React.Fragment key={i}>
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600/70 text-white'
                  : 'bg-white/[0.06] text-slate-300'
              }`}>
                {m.content}
                {m.action && !requiresConfirmation(m.action) && (
                  <div className="mt-1.5 text-[10px] text-emerald-400/70 font-mono">
                    ✓ {m.action.type}
                  </div>
                )}
              </div>
            </div>
            {/* Show suggestion chips after the greeting (first assistant message) */}
            {i === 0 && m.role === 'assistant' && messages.length === 1 && (
              <div className="space-y-1 pl-1">
                {[
                  'Check my budget',
                  'Go to Models',
                  'What capabilities are available?',
                ].map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="block w-full text-left text-[11px] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-colors">
                    {s}
                  </button>
                ))}
                {!SR && (
                  <p className="text-[10px] text-amber-400/70 mt-1 px-1">⚠ Voice requires Chrome/Edge/Safari.</p>
                )}
              </div>
            )}
          </React.Fragment>
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

      {/* Voice error state */}
      {voiceError && (
        <div className="mx-3 mb-1 rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-1.5">
          <p className="text-[10px] text-red-300">{voiceError}</p>
          {ttsUnconfigured && (
            <a href="/admin/dashboard/settings" className="text-[10px] text-cyan-400 hover:text-cyan-300 underline">
              Configure voice provider in Settings
            </a>
          )}
          <button onClick={() => { setVoiceError(null) }} className="ml-2 text-[9px] text-slate-500 hover:text-slate-300">Dismiss</button>
        </div>
      )}

      {/* Browser note */}
      {browserNote && (
        <div className="mx-3 mb-1 rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-1.5">
          <p className="text-[10px] text-amber-300">{browserNote}</p>
          <button onClick={() => setBrowserNote(null)} className="text-[9px] text-slate-500 hover:text-slate-300 mt-0.5">Dismiss</button>
        </div>
      )}

      {/* Input row */}
      <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <input
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder={voiceMode ? 'Voice mode active…' : 'Ask anything…'}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-all"
          disabled={sending || voiceMode}
        />
        {SR && !voiceMode && (
          <button
            onClick={recording ? stopVoice : startVoice}
            title={recording ? 'Stop recording' : 'Speak a single message'}
            className={`p-2 rounded-xl border transition-colors ${recording ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white'}`}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}
        {speaking && (
          <button
            onClick={stopSpeaking}
            title="Stop speaking"
            className="p-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 transition-colors"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        )}
        {!voiceMode && (
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Voice mode indicator */}
      {voiceMode && (
        <div className="px-4 pb-2 text-[10px] text-cyan-400/60 text-center">
          Voice mode: {recording ? '🎙 Listening…' : speaking ? '🔊 Speaking…' : '⏸ Paused'} — click volume icon to exit
        </div>
      )}

      <style>{`
        @keyframes pulse {
          from { transform: scaleY(0.6); }
          to { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  )
}
