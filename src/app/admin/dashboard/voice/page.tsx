'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Mic, RefreshCw, AlertCircle, Loader2, Save, Volume2,
  User, Sparkles, Gauge,
} from 'lucide-react'

/* ── Types ───────────────────────────────────────────────── */
interface VoicePersona {
  appSlug: string
  appName: string
  voiceStyle: string
  voiceTone: string
  voicePersonality: string
  voiceSpeed: string
  voiceGender: string
  voiceAccent: string
}

/* ── Options ─────────────────────────────────────────────── */
const VOICE_STYLES = ['neutral', 'warm', 'authoritative', 'gentle', 'energetic']
const VOICE_TONES = ['professional', 'casual', 'empathetic', 'cheerful']
const VOICE_PERSONALITIES = ['helpful', 'playful', 'serious', 'caring']
const VOICE_SPEEDS = ['slow', 'normal', 'fast']
const VOICE_GENDERS = ['male', 'female', 'neutral']

/* ── Page ────────────────────────────────────────────────── */
export default function VoiceDashboardPage() {
  const [agents, setAgents] = useState<VoicePersona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<VoicePersona | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voice-persona')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAgents(data.agents ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/voice-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
      await fetchData()
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const glass = 'bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl'
  const inputCls = 'w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
                <Mic className="w-5 h-5 text-emerald-400" />
                Voice &amp; Persona
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Configure voice persona per app agent — STT → Brain → TTS pipeline</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className={`${glass} p-4 border-red-500/20`}>
            <p className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          </div>
        )}

        {loading && !agents.length ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent List */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-400 mb-2">App Agents</h2>
              {agents.length === 0 ? (
                <div className={`${glass} p-6 text-center`}>
                  <p className="text-xs text-slate-500">No active agents. Create one in App Agents.</p>
                </div>
              ) : (
                agents.map(a => (
                  <button
                    key={a.appSlug}
                    onClick={() => setSelected({ ...a })}
                    className={`w-full text-left ${glass} p-3 transition-colors hover:border-violet-500/30 ${
                      selected?.appSlug === a.appSlug ? 'border-violet-500/40 bg-violet-500/5' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{a.appName}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{a.appSlug}</p>
                    <div className="flex gap-2 mt-1.5 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{a.voiceStyle}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{a.voiceGender}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04]">{a.voiceSpeed}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Persona Editor */}
            <div className="lg:col-span-2">
              {!selected ? (
                <div className={`${glass} p-10 text-center`}>
                  <Volume2 className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">Select an app agent to configure its voice persona.</p>
                  <p className="text-xs text-slate-600 mt-1">Voice persona controls how STT/TTS behaves per-app through the brain pipeline.</p>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`${glass} p-6 space-y-5`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-violet-400" />
                      {selected.appName} Voice Persona
                    </h2>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-medium border border-violet-500/30 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Sparkles className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                      {saved ? 'Saved!' : 'Save'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Voice Style" icon={Volume2}>
                      <select className={inputCls} value={selected.voiceStyle} onChange={e => setSelected({ ...selected, voiceStyle: e.target.value })}>
                        {VOICE_STYLES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Tone" icon={Sparkles}>
                      <select className={inputCls} value={selected.voiceTone} onChange={e => setSelected({ ...selected, voiceTone: e.target.value })}>
                        {VOICE_TONES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Personality" icon={User}>
                      <select className={inputCls} value={selected.voicePersonality} onChange={e => setSelected({ ...selected, voicePersonality: e.target.value })}>
                        {VOICE_PERSONALITIES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Speed" icon={Gauge}>
                      <select className={inputCls} value={selected.voiceSpeed} onChange={e => setSelected({ ...selected, voiceSpeed: e.target.value })}>
                        {VOICE_SPEEDS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Gender" icon={User}>
                      <select className={inputCls} value={selected.voiceGender} onChange={e => setSelected({ ...selected, voiceGender: e.target.value })}>
                        {VOICE_GENDERS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </Field>

                    <Field label="Accent (optional)" icon={Mic}>
                      <input
                        className={`${inputCls} cursor-text`}
                        value={selected.voiceAccent}
                        onChange={e => setSelected({ ...selected, voiceAccent: e.target.value })}
                        placeholder="e.g. british, american, australian"
                      />
                    </Field>
                  </div>

                  {/* Pipeline info */}
                  <div className="border-t border-white/[0.06] pt-4 mt-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Voice Pipeline</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Mic / STT</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">Brain + Routing</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">TTS + Persona</span>
                      <span>→</span>
                      <span className="px-2 py-1 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">Playback</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2">Budget mode and app-agent rules are enforced at the Brain routing stage.</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
    </motion.div>
  )
}

/* ── Field component ─────────────────────────────────────── */
function Field({ label, icon: Icon, children }: { label: string; icon: typeof Mic; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  )
}
