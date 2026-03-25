'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { MessageSquare, X, Send, Bot, Lock, Zap } from 'lucide-react'
import { getAppCount } from '@/lib/apps'

type ChatState = 'idle' | 'awaiting-password' | 'authenticating' | 'success' | 'error'

interface Message {
  role: 'bot' | 'user'
  content: string
  timestamp: Date
}

const WELCOME_MSG = `Hello! I'm the AmarktAI assistant.\n\nType **help** for commands, or ask me anything about the platform.`

const COMMANDS: Record<string, string> = {
  help: `Available commands:\n• **show admin** — access the control panel\n• **status** — system status\n• **apps** — view the ecosystem`,
  status: `◈ AmarktAI — operational shell ready\n◈ ${getAppCount()} apps in ecosystem\n◈ Network: ONLINE\n◈ AI orchestration: awaiting backend configuration`,
  apps: `__navigate:/apps__`,
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
      <Bot className="w-3.5 h-3.5 text-white" />
    </div>
  )
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatState, setChatState] = useState<ChatState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const hasOpenedRef = useRef(false)
  const handleOpen = useCallback(() => {
    setOpen(true)
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true
      setTimeout(() => {
        setMessages([{ role: 'bot', content: WELCOME_MSG, timestamp: new Date() }])
      }, 300)
    }
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])

  const toggle = useCallback(() => {
    if (open) setOpen(false)
    else handleOpen()
  }, [open, handleOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, toggle])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addBotMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'bot', content, timestamp: new Date() }])
  }

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content, timestamp: new Date() }])
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return
    setInput('')

    if (chatState === 'awaiting-password') {
      addUserMessage('••••••••')
      setChatState('authenticating')
      try {
        const res = await fetch('/api/admin/quick-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: trimmed }),
        })
        if (res.ok) {
          setChatState('success')
          addBotMessage('✓ Authentication successful. Redirecting to your control center...')
          setTimeout(() => {
            setOpen(false)
            router.push('/admin/dashboard')
          }, 1200)
        } else {
          setChatState('error')
          addBotMessage('✗ Incorrect password. Access denied.')
          setTimeout(() => setChatState('idle'), 2000)
        }
      } catch {
        setChatState('error')
        addBotMessage('✗ Connection error. Please try again.')
        setTimeout(() => setChatState('idle'), 2000)
      }
      return
    }

    addUserMessage(trimmed)
    const cmd = trimmed.toLowerCase()

    if (cmd === 'show admin') {
      setChatState('awaiting-password')
      setTimeout(() => {
        addBotMessage('🔒 Admin access requested.\n\nPlease enter your password to continue:')
        setTimeout(() => inputRef.current?.focus(), 100)
      }, 200)
      return
    }

    const response = COMMANDS[cmd]
    if (response) {
      if (response.startsWith('__navigate:')) {
        const path = response.replace('__navigate:', '')
        addBotMessage(`Navigating to ${path}...`)
        setTimeout(() => router.push(path), 600)
      } else {
        setTimeout(() => addBotMessage(response), 200)
      }
      return
    }

    setTimeout(() => {
      addBotMessage(`I don't recognise that command. Type **help** to see what I can do.`)
    }, 200)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const renderMessage = (content: string) => {
    const parts = content.split(/\*\*(.*?)\*\*/g)
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part
    )
  }

  const isDisabled = chatState === 'authenticating' || chatState === 'success'
  const placeholder = chatState === 'awaiting-password' ? 'Enter password...' : 'Ask me anything...'

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 20 }}
        onClick={toggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-blue-600/40 hover:shadow-blue-600/60 hover:scale-110 transition-all duration-300 group"
        aria-label="Open AI assistant"
        style={{ boxShadow: '0 0 30px rgba(59,130,246,0.35), 0 8px 32px rgba(0,0,0,0.6)' }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="absolute inset-0 rounded-2xl animate-ping bg-blue-500/20" style={{ animationDuration: '3s' }} />
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)]"
            >
              <div
                className="rounded-2xl overflow-hidden border border-white/10"
                style={{
                  background: 'rgba(7, 10, 24, 0.97)',
                  backdropFilter: 'blur(40px)',
                  boxShadow: '0 0 0 1px rgba(59,130,246,0.15), 0 32px 80px rgba(0,0,0,0.85), 0 0 60px rgba(59,130,246,0.1)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-blue-600/5 to-violet-600/5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
                      <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#07091A]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-heading text-xs font-semibold text-white">Amarkt<span className="text-blue-400">AI</span></p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      <p className="text-[10px] text-emerald-400 font-mono">online · ai assistant</p>
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages */}
                <div className="h-72 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {msg.role === 'bot' && <BotAvatar />}
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                          msg.role === 'bot'
                            ? 'bg-white/[0.06] border border-white/[0.08] text-slate-300 rounded-tl-sm'
                            : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm shadow-lg shadow-blue-600/20'
                        }`}
                      >
                        {renderMessage(msg.content)}
                      </div>
                    </motion.div>
                  ))}
                  {chatState === 'authenticating' && (
                    <div className="flex gap-2.5">
                      <BotAvatar />
                      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-white/5">
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200 ${
                    chatState === 'awaiting-password'
                      ? 'bg-violet-500/5 border-violet-500/30 focus-within:border-violet-500/50'
                      : 'bg-white/[0.04] border-white/8 focus-within:border-blue-500/40'
                  }`}>
                    {chatState === 'awaiting-password' && <Lock className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                    <input
                      ref={inputRef}
                      type={chatState === 'awaiting-password' ? 'password' : 'text'}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder={placeholder}
                      disabled={isDisabled}
                      className="flex-1 bg-transparent text-white text-xs placeholder-slate-600 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={isDisabled || !input.trim()}
                      className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105 flex-shrink-0"
                      aria-label="Send"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-700 mt-1.5 text-center font-mono">press ⌘K to toggle</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
