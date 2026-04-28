'use client'

/**
 * AivaAssistant — Floating system assistant widget for the admin dashboard.
 *
 * Mode A: Full conversation panel (chat)
 * Mode B: Avatar orb (compact animated avatar with state-aware glow)
 *
 * Avatar images are loaded from /public/aiva/ (see AIVA_AVATAR_ASSETS).
 * If an image is missing or fails to load, the component falls back to the
 * animated SVG gradient orb automatically — no crash.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Mic,
  X,
  Minimize2,
  Maximize2,
  Send,
  ChevronRight,
  AlertTriangle,
  Cpu,
  Image,
  Music,
  Video,
  Globe,
  ExternalLink,
  Loader2,
  Radio,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  capability?: string
  provider?: string
  model?: string
  outputType?: string
  artifactId?: string
  fallbackUsed?: boolean
  warning?: string
  error?: string
  pending?: boolean
}

interface QuickAction {
  label: string
  icon: React.ReactNode
  capability?: string
  prompt?: string
  href?: string
  promptInputLabel?: string
  saveArtifact?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Internal app ID used for Aiva requests that go through the admin brain-test
 * handler. This bypasses normal app-auth and requires an active admin session.
 */
const AIVA_INTERNAL_APP_ID = '__admin_test__'

// ── Avatar Asset Config ────────────────────────────────────────────────────────
/**
 * AIVA_AVATAR_ASSETS maps each orb/avatar state to an image path in /public/aiva/.
 *
 * To add avatar images: place files in /public/aiva/ matching the paths below.
 * Recommended generation prompt (use GenX image_generation capability):
 *
 *   "Semi-realistic futuristic female AI assistant avatar, [STATE] expression,
 *    soft cyan-blue holographic glow, glass-panel aesthetic, dark dashboard
 *    background, clean SaaS control center look, soft studio lighting,
 *    neutral professional appearance, slight transparency, not cartoon,
 *    not hyper-realistic, not sexualized. Square 512×512."
 *
 * Replace [STATE] with: calm neutral (idle) | attentive (listening) |
 *   thoughtful eyes-up (thinking) | mouth slightly open (speaking) |
 *   subtle frown (error)
 *
 * If an image is missing or fails to load, the component falls back to the
 * animated SVG orb automatically.
 */
export const AIVA_AVATAR_ASSETS: Record<OrbState, string> = {
  idle:      '/aiva/avatar-idle.png',
  listening: '/aiva/avatar-listening.png',
  thinking:  '/aiva/avatar-thinking.png',
  speaking:  '/aiva/avatar-speaking.png',
  error:     '/aiva/avatar-error.png',
}

const ORB_COLORS: Record<OrbState, { ring: string; glow: string; pulse: string; glowHex: string }> = {
  idle:      { ring: 'stroke-cyan-400',   glow: '#22d3ee',  pulse: 'bg-cyan-400/20',   glowHex: '#22d3ee' },
  listening: { ring: 'stroke-green-400',  glow: '#4ade80',  pulse: 'bg-green-400/20',  glowHex: '#4ade80' },
  thinking:  { ring: 'stroke-amber-400',  glow: '#fbbf24',  pulse: 'bg-amber-400/20',  glowHex: '#fbbf24' },
  speaking:  { ring: 'stroke-blue-400',   glow: '#60a5fa',  pulse: 'bg-blue-400/20',   glowHex: '#60a5fa' },
  error:     { ring: 'stroke-red-400',    glow: '#f87171',  pulse: 'bg-red-400/20',    glowHex: '#f87171' },
}

// ── Avatar Component ───────────────────────────────────────────────────────────
/**
 * Shows avatar image for the given state.
 * Falls back to a gradient-orb SVG if the image is absent or fails to load.
 */
function AivaAvatarDisplay({
  state,
  size = 96,
  onClick,
}: {
  state: OrbState
  size?: number
  onClick?: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const colors = ORB_COLORS[state]
  const isSpeaking = state === 'speaking'
  const isActive = state !== 'idle'

  // Reset failure state when state changes (different state may have its asset)
  useEffect(() => { setImgFailed(false) }, [state])

  const src = AIVA_AVATAR_ASSETS[state]
  const showOrb = imgFailed || !src

  return (
    <button
      onClick={onClick}
      className="relative focus:outline-none"
      style={{ width: size, height: size }}
      title={state}
    >
      {/* Outer pulse ring */}
      <div
        className={`absolute inset-0 rounded-full ${colors.pulse} ${isActive ? 'animate-ping' : ''} opacity-25`}
        style={{ borderRadius: '50%' }}
      />

      {/* SVG ring always rendered behind content */}
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        style={{ borderRadius: '50%' }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={size / 2 - 3}
          fill="none" strokeWidth="2"
          className={`${colors.ring} opacity-25`}
        />
        <circle
          cx={size / 2} cy={size / 2} r={size / 2 - 3}
          fill="none" strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={Math.PI * (size - 6)}
          strokeDashoffset={state === 'idle' ? Math.PI * (size - 6) / 2 : 0}
          className={`${colors.ring} transition-all duration-700`}
          style={{ filter: `drop-shadow(0 0 5px ${colors.glow})` }}
        />
      </svg>

      {/* Avatar image or orb fallback */}
      <div
        className="absolute"
        style={{
          inset: 6,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `0 0 18px ${colors.glow}33`,
        }}
      >
        {showOrb ? (
          /* Gradient orb fallback */
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 40% 35%, ${colors.glow}44, #030712 70%)`,
              borderRadius: '50%',
            }}
          >
            {state === 'thinking' ? (
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            ) : state === 'speaking' ? (
              <Radio className="h-6 w-6 text-blue-400 animate-pulse" />
            ) : state === 'listening' ? (
              <Mic className="h-6 w-6 text-green-400" />
            ) : state === 'error' ? (
              <AlertTriangle className="h-6 w-6 text-red-400" />
            ) : (
              <Mic className="h-6 w-6 text-cyan-400" />
            )}
          </div>
        ) : (
          /* Avatar image with speaking animation */
          <div
            className="w-full h-full relative"
            style={{
              animation: isSpeaking ? 'aivaSpeakingPulse 1.4s ease-in-out infinite' : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Aiva ${state}`}
              className="w-full h-full object-cover"
              style={{ borderRadius: '50%' }}
              onError={() => setImgFailed(true)}
            />
            {/* Speaking glow overlay */}
            {isSpeaking && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${colors.glow}22 0%, transparent 70%)`,
                  animation: 'aivaSpeakingGlow 1.4s ease-in-out infinite',
                }}
              />
            )}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Quick Action Definitions ───────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "What's broken?",
    icon: <AlertTriangle className="h-3 w-3" />,
    capability: 'chat',
    prompt: 'What is broken in the system?',
  },
  {
    label: 'System status',
    icon: <Cpu className="h-3 w-3" />,
    capability: 'chat',
    prompt: 'Give me a full system status report',
  },
  {
    label: 'Create image',
    icon: <Image className="h-3 w-3" />,
    capability: 'image_generation',
    promptInputLabel: 'Describe the image…',
    saveArtifact: true,
  },
  {
    label: 'Create music',
    icon: <Music className="h-3 w-3" />,
    capability: 'music_generation',
    promptInputLabel: 'Describe the music…',
    saveArtifact: true,
  },
  {
    label: 'Create video plan',
    icon: <Video className="h-3 w-3" />,
    capability: 'video_generation',
    promptInputLabel: 'Describe the video…',
    saveArtifact: true,
  },
  {
    label: 'Scrape website',
    icon: <Globe className="h-3 w-3" />,
    capability: 'scrape_website',
    promptInputLabel: 'Enter URL…',
  },
  {
    label: 'Show artifacts',
    icon: <ExternalLink className="h-3 w-3" />,
    href: '/admin/dashboard/artifacts',
  },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AivaAssistant() {
  const [mode, setMode] = useState<'chat' | 'orb'>('chat')
  const [minimized, setMinimized] = useState(false)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi, I'm Aiva — your Amarktai system assistant. How can I help?",
      capability: 'chat',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null)
  const [actionInput, setActionInput] = useState('')

  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  const [conversationId, setConversationId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aiva-conversation-id') ?? undefined
    }
  })

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('aiva-conversation-id', conversationId)
    }
  }, [conversationId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ── Send Message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    text: string,
    capability?: string,
    saveArtifact?: boolean
  ) => {
    if (!text.trim() || sending) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    }
    const pendingMsg: Message = {
      id: `pending-${Date.now()}`,
      role: 'assistant',
      content: '',
      pending: true,
    }

    setMessages(prev => [...prev, userMsg, pendingMsg])
    setSending(true)
    setOrbState('thinking')

    try {
      const res = await fetch('/api/admin/aiva/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId,
          capability,
          saveArtifact,
        }),
      })

      const data = await res.json()

      if (data.conversationId) setConversationId(data.conversationId)

      const assistantMsg: Message = {
        id: data.messageId ?? `assistant-${Date.now()}`,
        role: 'assistant',
        content: typeof data.output === 'string' ? data.output : JSON.stringify(data.output),
        capability: data.capability,
        provider: data.provider,
        model: data.model,
        outputType: data.outputType,
        artifactId: data.artifactId,
        fallbackUsed: data.fallbackUsed,
        warning: data.warning,
        error: data.error,
      }

      setMessages(prev => prev.filter(m => !m.pending).concat(assistantMsg))
      setOrbState('idle')
    } catch (err) {
      const errMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '',
        error: err instanceof Error ? err.message : 'Request failed',
      }
      setMessages(prev => prev.filter(m => !m.pending).concat(errMsg))
      setOrbState('error')
      setTimeout(() => setOrbState('idle'), 3000)
    } finally {
      setSending(false)
    }
  }, [sending, conversationId])

  // ── Handle Submit ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }, [input, sendMessage])

  // ── Quick Action ──────────────────────────────────────────────────────────

  const handleQuickAction = useCallback((action: QuickAction) => {
    if (action.href) {
      window.location.href = action.href
      return
    }
    if (action.prompt) {
      sendMessage(action.prompt, action.capability, action.saveArtifact)
      return
    }
    // Needs user input
    setPendingAction(action)
    setActionInput('')
  }, [sendMessage])

  const submitActionInput = useCallback(() => {
    if (!pendingAction || !actionInput.trim()) return
    sendMessage(actionInput.trim(), pendingAction.capability, pendingAction.saveArtifact)
    setPendingAction(null)
    setActionInput('')
  }, [pendingAction, actionInput, sendMessage])

  // ── Voice (Orb Mode) ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        // Convert to base64
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          setOrbState('thinking')
          try {
            // STT
            const sttRes = await fetch('/api/brain/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                app_id: AIVA_INTERNAL_APP_ID,
                task: 'stt',
                input: base64,
                metadata: { mimeType: 'audio/webm' },
              }),
            })
            const sttData = await sttRes.json()
            const transcript = sttData.output ?? sttData.result ?? ''
            if (!transcript) {
              setOrbState('error')
              setTimeout(() => setOrbState('idle'), 2000)
              return
            }

            // Chat
            const chatRes = await fetch('/api/admin/aiva/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: transcript, conversationId }),
            })
            const chatData = await chatRes.json()
            if (chatData.conversationId) setConversationId(chatData.conversationId)
            const responseText = typeof chatData.output === 'string' ? chatData.output : ''

            if (responseText) {
              setOrbState('speaking')
              // TTS
              try {
                const ttsRes = await fetch('/api/brain/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    app_id: AIVA_INTERNAL_APP_ID,
                    task: 'tts',
                    input: responseText,
                  }),
                })
                const ttsData = await ttsRes.json()
                if (ttsData.output && typeof ttsData.output === 'string') {
                  const audio = new Audio(`data:audio/mpeg;base64,${ttsData.output}`)
                  audio.onended = () => setOrbState('idle')
                  audio.onerror = () => {
                    console.error('[Aiva] TTS audio playback failed')
                    setOrbState('idle')
                  }
                  audio.play().catch(err => {
                    console.error('[Aiva] TTS play() rejected:', err)
                    setOrbState('idle')
                  })
                } else {
                  setOrbState('idle')
                }
              } catch {
                setOrbState('idle')
              }
            } else {
              setOrbState('idle')
            }

            // Add to chat messages
            const assistantMsg: Message = {
              id: `voice-${Date.now()}`,
              role: 'assistant',
              content: responseText,
              capability: chatData.capability,
              provider: chatData.provider,
              model: chatData.model,
            }
            const userMsg: Message = {
              id: `voice-user-${Date.now()}`,
              role: 'user',
              content: transcript,
            }
            setMessages(prev => [...prev, userMsg, assistantMsg])
          } catch {
            setOrbState('error')
            setTimeout(() => setOrbState('idle'), 2000)
          }
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setOrbState('listening')
    } catch {
      setOrbState('error')
      setTimeout(() => setOrbState('idle'), 2000)
    }
  }, [conversationId])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  // ── Render ────────────────────────────────────────────────────────────────

  /* Inject speaking keyframe animations once into the document */
  const speakingStyles = `
    @keyframes aivaSpeakingPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.03); }
    }
    @keyframes aivaSpeakingGlow {
      0%, 100% { opacity: 0.15; }
      50% { opacity: 0.45; }
    }
  `

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <style>{speakingStyles}</style>
        {/* Compact avatar bubble — click to restore */}
        <div className="flex flex-col items-center gap-1">
          <AivaAvatarDisplay
            state={orbState}
            size={56}
            onClick={() => setMinimized(false)}
          />
          <span className="text-[9px] uppercase tracking-widest text-cyan-400/70">Aiva</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <style>{speakingStyles}</style>
      {/* Mode toggle */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMode('chat')}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition ${
            mode === 'chat'
              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMode('orb')}
          className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition ${
            mode === 'orb'
              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Avatar
        </button>
        <button
          onClick={() => setMinimized(true)}
          className="ml-1 rounded-lg p-1 text-slate-500 hover:text-slate-300 transition"
          title="Minimize"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Mode A: Chat Panel ─────────────────────────────────────────────── */}
      {mode === 'chat' && (
        <div className="flex w-[360px] flex-col rounded-2xl border border-white/10 bg-[#030712]/95 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                <div className="absolute inset-0 h-2 w-2 rounded-full bg-cyan-400 animate-ping opacity-50" />
              </div>
              <span className="text-sm font-semibold text-white">Aiva</span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-px text-[9px] text-cyan-400">
                SYSTEM ASSISTANT
              </span>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex max-h-72 flex-col gap-3 overflow-y-auto p-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-cyan-400/15 text-white border border-cyan-400/20'
                      : 'bg-white/5 text-slate-200 border border-white/[0.06]'
                  }`}
                >
                  {msg.pending ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking…
                    </span>
                  ) : msg.error ? (
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {msg.error}
                    </span>
                  ) : (
                    <span>{msg.content}</span>
                  )}

                  {msg.warning && (
                    <div className="mt-1.5 flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                      {msg.warning}
                    </div>
                  )}

                  {(msg.capability || msg.provider || msg.model) && !msg.pending && !msg.error && msg.role === 'assistant' && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.capability && (
                        <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-[9px] text-slate-500">
                          {msg.capability}
                        </span>
                      )}
                      {msg.provider && (
                        <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-[9px] text-slate-500">
                          {msg.provider}
                        </span>
                      )}
                      {msg.model && (
                        <span className="rounded border border-white/10 bg-white/5 px-1 py-px text-[9px] text-slate-500 truncate max-w-[100px]">
                          {msg.model}
                        </span>
                      )}
                      {msg.fallbackUsed && (
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1 py-px text-[9px] text-amber-400">
                          fallback
                        </span>
                      )}
                      {msg.artifactId && (
                        <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1 py-px text-[9px] text-purple-400">
                          artifact saved
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action input (for quick actions that need user text) */}
          {pendingAction && (
            <div className="border-t border-white/10 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                {pendingAction.icon}
                <span className="text-[10px] text-slate-400">{pendingAction.label}</span>
                <button onClick={() => setPendingAction(null)} className="ml-auto text-slate-500 hover:text-slate-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={actionInput}
                  onChange={e => setActionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitActionInput()}
                  placeholder={pendingAction.promptInputLabel ?? 'Enter prompt…'}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
                />
                <button
                  onClick={submitActionInput}
                  disabled={!actionInput.trim()}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick actions */}
          {!pendingAction && (
            <div className="border-t border-white/10 px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {QUICK_ACTIONS.map(action => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    disabled={sending}
                    className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/10 px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder="Ask Aiva anything…"
                disabled={sending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40 disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || sending}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setMode('orb')}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:text-white"
                title="Switch to voice orb"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode B: Avatar / Voice Orb ────────────────────────────────────── */}
      {mode === 'orb' && (
        <div className="flex flex-col items-center gap-3">
          {/* Avatar with state-aware glow — falls back to orb if image missing */}
          <AivaAvatarDisplay
            state={isRecording ? 'listening' : orbState}
            size={104}
            onClick={toggleRecording}
          />

          {/* State label */}
          <span className="text-[11px] uppercase tracking-widest text-slate-500">
            {orbState === 'idle' && !isRecording && 'Tap to speak'}
            {isRecording && 'Listening…'}
            {!isRecording && orbState === 'thinking' && 'Processing…'}
            {!isRecording && orbState === 'speaking' && 'Speaking…'}
            {!isRecording && orbState === 'error' && 'Error — try again'}
          </span>

          {/* Expand to chat */}
          <button
            onClick={() => setMode('chat')}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:text-white"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Open chat
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
