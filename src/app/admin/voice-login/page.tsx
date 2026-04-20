'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Mic, Loader2, ShieldCheck, MicOff } from 'lucide-react'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'

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

export default function VoiceLoginBridgePage() {
  const [recordedSample, setRecordedSample] = useState('')
  const [mode, setMode] = useState<VoiceVisualMode>('idle')
  const [checking, setChecking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const recognitionRef = useRef<VoiceRecognizer | null>(null)

  const SpeechRecAPI = getSpeechRecognitionConstructor()
  const speechSupported = !!SpeechRecAPI

  const captureVoice = useCallback(() => {
    setMicError(null)
    setResult(null)

    if (!speechSupported || !SpeechRecAPI) {
      setMicError('Speech recognition is not supported in this browser. Type your passphrase manually below.')
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
      setRecordedSample(transcript)
    }

    recognition.onerror = () => {
      setMicError('Microphone capture failed. Check browser permissions and try again, or type your passphrase manually.')
      setMode('idle')
      setRecording(false)
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

  const normalizedSample = useMemo(() => recordedSample.trim().toLowerCase(), [recordedSample])

  async function validateVoiceLogin() {
    if (!normalizedSample) {
      setResult('No passphrase captured. Speak or type your passphrase first.')
      return
    }
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/voice-access-settings')
      const data = await res.json().catch(() => ({}))
      const settings = data?.settings ?? {}
      if (!settings.allowVoiceLogin) {
        setResult('Voice login is not enabled. Use standard login.')
        return
      }
      const expected = String(settings.loginPassphrase ?? '').trim().toLowerCase()
      if (!expected) {
        setResult('No passphrase configured. Configure one in System → Voice Access, or use standard login.')
        return
      }
      if (normalizedSample === expected) {
        setMode('speaking')
        setResult('Voice login validated. Continue with secure session handoff.')
      } else {
        setResult('Passphrase did not match. Try again or use standard login.')
      }
    } catch {
      setResult('Voice login service unavailable. Use standard login fallback.')
    } finally {
      setChecking(false)
      setTimeout(() => setMode('idle'), 1200)
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-bold">Voice Login Bridge</h1>
          <p className="mt-1 text-sm text-slate-400">
            Speak your configured passphrase to authenticate, then continue to your session.
          </p>
          {!speechSupported && (
            <p className="mt-2 text-xs text-amber-400">
              ⚠ Your browser does not support the Web Speech API. Type your passphrase manually below.
            </p>
          )}
        </div>

        <VoiceAccessVisualizer mode={mode} />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {speechSupported && (
              recording ? (
                <button onClick={stopCapture}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                  <MicOff className="h-3.5 w-3.5" /> Stop recording
                </button>
              ) : (
                <button onClick={captureVoice}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
                  <Mic className="h-3.5 w-3.5" /> Speak passphrase
                </button>
              )
            )}
          </div>

          {micError && <p className="text-xs text-amber-300">{micError}</p>}

          <label className="text-xs text-slate-300 block">
            Captured passphrase {speechSupported ? '(or type manually)' : ''}
            <input
              value={recordedSample}
              onChange={(e) => setRecordedSample(e.target.value)}
              placeholder="Your spoken or typed passphrase…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </label>

          <button onClick={validateVoiceLogin} disabled={checking || !normalizedSample}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Validate login
          </button>

          {result && <p className="text-xs text-slate-200">{result}</p>}
        </div>

        <Link href="/admin/login" className="inline-flex text-sm text-cyan-300 hover:text-cyan-200">
          Use standard login instead →
        </Link>
      </div>
    </div>
  )
}
