'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Terminal, Zap, X, ChevronRight, Lock } from 'lucide-react'

interface CommandResponse {
  type: 'info' | 'success' | 'warning' | 'error' | 'system'
  message: string
  action?: () => void
  actionLabel?: string
}

function buildCommands(router: ReturnType<typeof useRouter>): Record<string, CommandResponse> {
  return {
    'show admin': {
      type: 'success',
      message: 'Admin access detected. Please authenticate.',
    },
    help: {
      type: 'info',
      message: 'Available: show admin | status | apps | clear',
    },
    status: {
      type: 'system',
      message: 'All systems nominal. 8 platforms active. Network: ONLINE.',
    },
    apps: {
      type: 'info',
      message: 'Navigating to ecosystem apps...',
      action: () => router.push('/apps'),
      actionLabel: 'View Apps',
    },
    clear: {
      type: 'system',
      message: '__CLEAR__',
    },
  }
}

export default function CommandBar() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<{ cmd: string; res: CommandResponse }[]>([])
  const [adminTriggered, setAdminTriggered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const toggle = useCallback(() => {
    setOpen(prev => !prev)
    setInput('')
  }, [])

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
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [history])

  const execute = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()
    if (!trimmed) return

    const commands = buildCommands(router)
    const res = commands[trimmed]
    if (!res) {
      setHistory(prev => [...prev, {
        cmd,
        res: { type: 'error', message: `Unknown command: "${trimmed}". Type 'help' for available commands.` }
      }])
      setInput('')
      return
    }

    if (res.message === '__CLEAR__') {
      setHistory([])
      setInput('')
      return
    }

    if (trimmed === 'show admin') {
      setAdminTriggered(true)
      setHistory(prev => [...prev, { cmd, res }])
      setInput('')
      setTimeout(() => {
        setOpen(false)
        router.push('/admin/login')
      }, 1500)
      return
    }

    if (res.action) {
      res.action()
    }

    setHistory(prev => [...prev, { cmd, res }])
    setInput('')
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') execute(input)
  }

  const typeColor: Record<string, string> = {
    info: 'text-cyan-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    system: 'text-violet-400',
  }

  const typePrefix: Record<string, string> = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
    system: '◈',
  }

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        onClick={toggle}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-blue-500/30 bg-[#0A0F22]/90 backdrop-blur-xl text-slate-400 hover:text-white hover:border-blue-500/60 transition-all duration-300 shadow-2xl shadow-black/50"
        style={{ boxShadow: '0 0 20px rgba(59,130,246,0.15), 0 8px 32px rgba(0,0,0,0.5)' }}
        aria-label="Open command bar"
      >
        <Terminal className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-mono hidden sm:block">Command</span>
        <span className="text-[10px] font-mono text-slate-600 hidden sm:block border border-white/10 px-1.5 py-0.5 rounded-md bg-white/5">⌘K</span>
        {/* Glow pulse */}
        <span className="absolute inset-0 rounded-xl bg-blue-500/5 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.button>

      {/* Command overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="fixed bottom-20 right-6 z-[70] w-full max-w-md sm:max-w-lg"
            >
              <div className="rounded-2xl border border-blue-500/25 bg-[#06091A]/98 backdrop-blur-2xl overflow-hidden shadow-2xl"
                style={{ boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 24px 60px rgba(0,0,0,0.7)' }}>
                {/* Terminal header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                    </div>
                    <span className="text-xs font-mono text-slate-500 ml-1">amarktai — cmd</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
                    </div>
                    <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-white transition-colors p-0.5 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Welcome / history */}
                <div ref={historyRef} className="px-4 pt-4 pb-2 space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
                  {history.length === 0 && (
                    <div className="text-slate-600 leading-relaxed space-y-1">
                      <div className="flex items-center gap-2 text-violet-400/80">
                        <Zap className="w-3 h-3" />
                        <span>Amarktai AI Command Interface v2.0</span>
                      </div>
                      <p className="text-slate-700">Type <span className="text-cyan-500">help</span> for available commands.</p>
                      <p className="text-slate-700">Try: <span className="text-slate-500">show admin</span> · <span className="text-slate-500">status</span> · <span className="text-slate-500">apps</span></p>
                    </div>
                  )}
                  {history.map((entry, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-blue-500/70">›</span>
                        <span>{entry.cmd}</span>
                      </div>
                      <div className={`flex items-start gap-2 pl-4 ${typeColor[entry.res.type]}`}>
                        <span className="flex-shrink-0 mt-px">{typePrefix[entry.res.type]}</span>
                        <span className="leading-relaxed">{entry.res.message}</span>
                      </div>
                      {entry.res.type === 'success' && entry.cmd.toLowerCase().trim() === 'show admin' && (
                        <div className="pl-4 flex items-center gap-2 text-violet-400 animate-pulse">
                          <Lock className="w-3 h-3" />
                          <span>Redirecting to secure login...</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {adminTriggered && history.length === 0 && null}
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-white/[0.01]">
                  <span className="text-blue-500 font-mono text-xs flex-shrink-0">›</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Enter command..."
                    className="flex-1 bg-transparent text-white text-xs font-mono placeholder-slate-700 focus:outline-none caret-blue-500"
                  />
                  <button
                    onClick={() => execute(input)}
                    className="text-slate-600 hover:text-blue-400 transition-colors p-1 rounded"
                    aria-label="Execute"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
