'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Mic, Loader2, ShieldCheck } from 'lucide-react'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'

export default function VoiceLoginBridgePage() {
  const [phrase, setPhrase] = useState('')
  const [recordedSample, setRecordedSample] = useState('')
  const [mode, setMode] = useState<VoiceVisualMode>('idle')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const normalizedExpected = useMemo(() => phrase.trim().toLowerCase(), [phrase])

  async function simulateVoiceCapture() {
    setMode('listening')
    setResult(null)
    await new Promise((r) => setTimeout(r, 700))
    setMode('idle')
  }

  async function validateVoiceLogin() {
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/voice-access-settings')
      const data = await res.json().catch(() => ({}))
      const expected = String(data?.settings?.loginPassphrase ?? '').trim().toLowerCase()
      const sample = recordedSample.trim().toLowerCase()
      const passphraseMatch = !!expected && sample === expected
      const voicePatternMatch = !!normalizedExpected && sample.includes(normalizedExpected)
      if (passphraseMatch || voicePatternMatch) {
        setMode('speaking')
        setResult('Voice login validated. Continue with secure session handoff.')
      } else {
        setResult('Voice login check failed. Use standard login fallback.')
      }
    } catch {
      setResult('Voice login service unavailable. Use standard login fallback.')
    } finally {
      setChecking(false)
      setTimeout(() => setMode('idle'), 1000)
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-10 text-white">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-bold">Voice Login Bridge</h1>
          <p className="mt-1 text-sm text-slate-400">
            Validate spoken passphrase or basic voice-pattern match, then continue to standard auth fallback.
          </p>
        </div>

        <VoiceAccessVisualizer mode={mode} />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <label className="text-xs text-slate-300 block">
            Optional expected phrase hint
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300 block">
            Captured spoken phrase (simulation)
            <input value={recordedSample} onChange={(e) => setRecordedSample(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={simulateVoiceCapture}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
              <Mic className="h-3.5 w-3.5" /> Capture voice
            </button>
            <button onClick={validateVoiceLogin} disabled={checking}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Validate login
            </button>
          </div>
          {result && <p className="text-xs text-slate-200">{result}</p>}
        </div>

        <Link href="/admin/login" className="inline-flex text-sm text-cyan-300 hover:text-cyan-200">
          Use standard login instead
        </Link>
      </div>
    </div>
  )
}
