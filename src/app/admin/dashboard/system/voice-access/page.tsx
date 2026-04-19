'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mic, Save, Volume2, Loader2, CheckCircle } from 'lucide-react'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'

type VoiceBehavior = 'talk_only' | 'talk_execute'

interface VoiceAccessSettings {
  enabled: boolean
  voiceId: string
  accent: string
  behavior: VoiceBehavior
  wakePhrase: string
  allowVoiceLogin: boolean
  loginPassphrase: string
}

const DEFAULT_SETTINGS: VoiceAccessSettings = {
  enabled: false,
  voiceId: 'alloy',
  accent: 'neutral',
  behavior: 'talk_only',
  wakePhrase: 'Hey Amarktai',
  allowVoiceLogin: false,
  loginPassphrase: '',
}

const VOICES = ['alloy', 'nova', 'shimmer', 'echo', 'onyx', 'fable']
const ACCENTS = ['neutral', 'american', 'british', 'australian', 'south-african']

export default function VoiceAccessSetupPage() {
  const [mode, setMode] = useState<VoiceVisualMode>('idle')
  const [settings, setSettings] = useState<VoiceAccessSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/voice-access-settings')
      .then((r) => r.json())
      .then((d) => setSettings(d?.settings ?? DEFAULT_SETTINGS))
      .catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/admin/voice-access-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Save failed: HTTP ${res.status}`)
      setSettings(data.settings ?? settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function runVoiceTest() {
    setTesting(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: '__admin_test__',
          appSecret: 'admin-test-secret',
          text: 'Voice setup test successful.',
          voiceId: settings.voiceId,
          accent: settings.accent,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Voice test failed: HTTP ${res.status}`)
      }
      setMode('speaking')
      setTimeout(() => setMode('idle'), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060e1f] p-6">
        <h1 className="text-2xl font-bold text-white">Voice Access Setup</h1>
        <p className="mt-1 text-sm text-slate-400">Configure operator voice settings and optional voice-login bridge.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <label className="flex items-center justify-between text-sm text-white">
            Enable voice assistant
            <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-300">
              Voice
              <select value={settings.voiceId} onChange={(e) => setSettings((s) => ({ ...s, voiceId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Accent
              <select value={settings.accent} onChange={(e) => setSettings((s) => ({ ...s, accent: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                {ACCENTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="text-xs text-slate-300 block">
            Behavior
            <select value={settings.behavior} onChange={(e) => setSettings((s) => ({ ...s, behavior: e.target.value as VoiceBehavior }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              <option value="talk_only">Talk only</option>
              <option value="talk_execute">Talk + execute actions</option>
            </select>
          </label>

          <label className="text-xs text-slate-300 block">
            Wake phrase
            <input value={settings.wakePhrase} onChange={(e) => setSettings((s) => ({ ...s, wakePhrase: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
          </label>

          <label className="flex items-center justify-between text-sm text-white">
            Allow voice login
            <input type="checkbox" checked={settings.allowVoiceLogin} onChange={(e) => setSettings((s) => ({ ...s, allowVoiceLogin: e.target.checked }))} />
          </label>

          {settings.allowVoiceLogin && (
            <label className="text-xs text-slate-300 block">
              Spoken passphrase
              <input value={settings.loginPassphrase} onChange={(e) => setSettings((s) => ({ ...s, loginPassphrase: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
            </label>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={runVoiceTest} disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200 disabled:opacity-50">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />} Voice test
            </button>
            <button onClick={saveSettings} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? 'Saved' : 'Save config'}
            </button>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { key: 'idle', label: 'Idle', icon: Mic },
              { key: 'listening', label: 'Listening', icon: Mic },
              { key: 'speaking', label: 'Speaking', icon: Volume2 },
            ].map((item) => (
              <button key={item.key} onClick={() => setMode(item.key as VoiceVisualMode)}
                className={`rounded-xl border px-4 py-3 text-left text-sm ${mode === item.key ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                <item.icon className="mb-2 h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
          <VoiceAccessVisualizer mode={mode} />
          <Link href="/admin/voice-login" className="btn-primary inline-flex">
            Open Voice Login Bridge <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
