'use client'

/**
 * Voice login is DISABLED. This page now redirects to standard login.
 * PHASE 3I: dead voice-login route removed.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceLoginRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/login') }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030712] text-sm text-slate-400">
      Redirecting to standard login…
    </div>
  )
}

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

export default function VoiceLoginPage() {
  const router = useRouter()
  const [passphrase, setPassphrase] = useState('')
  const [mode, setMode] = useState<VoiceVisualMode>('idle')
  const [checking, setChecking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showManual, setShowManual] = useState(false)
  const recognitionRef = useRef<VoiceRecognizer | null>(null)

  const SpeechRecAPI = getSpeechRecognitionConstructor()
  const speechSupported = !!SpeechRecAPI

  const captureVoice = useCallback(() => {
    setMicError(null)
    setResult(null)

    if (!speechSupported || !SpeechRecAPI) {
      setMicError('Speech recognition not supported. Type your passphrase below.')
      setShowManual(true)
      return
    }

    const recognition = new SpeechRecAPI()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    setMode('listening')
    setRecording(true)

    recognition.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      setPassphrase(transcript)
    }

    recognition.onerror = () => {
      setMicError('Microphone access failed. Check browser permissions, or enter passphrase manually.')
      setMode('fallback')
      setRecording(false)
      setShowManual(true)
    }

    recognition.onend = () => {
      setMode('idle')
      setRecording(false)
    }

    recognition.start()
  }, [speechSupported, SpeechRecAPI])

  const stopCapture = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setMode('idle')
    setRecording(false)
  }, [])

  const normalizedPassphrase = useMemo(() => passphrase.trim().toLowerCase(), [passphrase])

  async function validateVoiceLogin() {
    if (!normalizedPassphrase) {
      setResult({ ok: false, message: 'No passphrase captured. Speak or type your passphrase first.' })
      return
    }
    setChecking(true)
    setMode('processing')
    setResult(null)
    try {
      const res = await fetch('/api/admin/voice-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: normalizedPassphrase }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; success?: boolean }

      if (res.ok && data.success) {
        setMode('success')
        setResult({ ok: true, message: 'Voice authentication successful. Entering dashboard…' })
        setTimeout(() => {
          router.push('/admin/dashboard')
        }, 1400)
      } else {
        setResult({ ok: false, message: data.error ?? 'Voice login failed. Try again or use standard login.' })
        setMode('idle')
      }
    } catch {
      setResult({ ok: false, message: 'Voice login service unavailable. Use standard login fallback.' })
      setMode('fallback')
    } finally {
      setChecking(false)
    }
  }

  const handlePassphraseKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      validateVoiceLogin()
    }
  // validateVoiceLogin is a stable function reference — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#030a18] text-white overflow-hidden flex flex-col">

      {/* Top bar — minimal, non-dominant */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white/80 tracking-wide">Amarktai · Voice Access</span>
        </div>
        <Link
          href="/admin/login"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Standard login →
        </Link>
      </div>

      {/* Main immersive area — visualizer takes full center */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Full-screen visualizer */}
        <div className="absolute inset-0">
          <VoiceAccessVisualizer mode={mode} size="full" />
        </div>

        {/* Central control overlay */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-4">

          {/* Primary action button */}
          <AnimatePresence mode="wait">
            {mode === 'success' ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.7, repeat: 3 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center"
                >
                  <ShieldCheck className="w-9 h-9 text-emerald-400" />
                </motion.div>
                <p className="text-emerald-300 text-sm font-medium text-center">{result?.message}</p>
              </motion.div>
            ) : mode === 'processing' ? (
              <motion.div
                key="processing"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-20 h-20 rounded-full border-2 border-violet-400/40 flex items-center justify-center"
              >
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
              </motion.div>
            ) : recording ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={stopCapture}
                className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-400/50 flex items-center justify-center hover:bg-red-500/25 transition-colors"
              >
                <MicOff className="w-8 h-8 text-red-300" />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={captureVoice}
                disabled={checking}
                className="w-20 h-20 rounded-full bg-blue-500/15 border-2 border-blue-400/50 flex items-center justify-center hover:bg-blue-500/25 hover:border-blue-400/80 transition-all disabled:opacity-40"
              >
                <Mic className="w-8 h-8 text-blue-300" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Instruction text */}
          <AnimatePresence mode="wait">
            {mode !== 'success' && mode !== 'processing' && (
              <motion.p
                key={recording ? 'recording' : 'idle'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-slate-400 text-center max-w-xs"
              >
                {recording
                  ? 'Speak your passphrase now…'
                  : 'Tap the microphone and speak your passphrase'}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Passphrase captured indicator */}
          <AnimatePresence>
            {normalizedPassphrase && mode !== 'success' && mode !== 'processing' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <span className="text-xs text-slate-400">Passphrase captured.</span>
                <button
                  onClick={validateVoiceLogin}
                  disabled={checking}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Authenticate
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error feedback */}
          <AnimatePresence>
            {(micError || (result && !result.ok)) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 max-w-xs text-center"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{micError ?? result?.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual passphrase toggle */}
          {!showManual && !speechSupported && (
            <button
              onClick={() => setShowManual(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline-offset-2 underline"
            >
              Enter passphrase manually
            </button>
          )}
        </div>
      </div>

      {/* Manual fallback — slides up from bottom */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="relative z-20 px-4 pb-8"
          >
            <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#050d1e]/90 backdrop-blur-xl p-5 space-y-3">
              <p className="text-xs text-slate-400 font-medium">Manual passphrase entry</p>
              <div className="flex gap-2">
                <input
                  value={passphrase}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassphrase(e.target.value)}
                  onKeyDown={handlePassphraseKeyDown}
                  placeholder="Your passphrase…"
                  type="password"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                />
                <button
                  onClick={validateVoiceLogin}
                  disabled={checking || !normalizedPassphrase}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-200 disabled:opacity-50 hover:bg-emerald-400/15 transition-colors whitespace-nowrap"
                >
                  {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Validate
                </button>
              </div>
              <button
                onClick={() => setShowManual(false)}
                className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom notice */}
      <div className="absolute bottom-4 inset-x-0 z-20 flex justify-center">
        <p className="text-[10px] text-slate-700 text-center px-4">
          Passphrase-based voice login · not biometric voiceprint authentication
        </p>
      </div>
    </div>
  )
}
