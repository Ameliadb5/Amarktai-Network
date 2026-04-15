'use client'

/**
 * CreatorStudioTab — Image / Audio / Music / Video / Campaign creation inside Build Studio.
 */

import { useState, useCallback } from 'react'
import {
  ImageIcon, Music, Mic, Film, Megaphone, Loader2, Download,
  AlertCircle, CheckCircle, Sparkles,
} from 'lucide-react'

type CreatorMode = 'image' | 'music' | 'voice' | 'video' | 'campaign'

const MODES: { key: CreatorMode; label: string; icon: typeof ImageIcon }[] = [
  { key: 'image',    label: 'Image',    icon: ImageIcon },
  { key: 'music',    label: 'Music',    icon: Music },
  { key: 'voice',    label: 'Voice',    icon: Mic },
  { key: 'video',    label: 'Video',    icon: Film },
  { key: 'campaign', label: 'Campaign', icon: Megaphone },
]

interface CreationResult {
  success: boolean
  output?: string | null
  imageUrl?: string | null
  audioUrl?: string | null
  videoUrl?: string | null
  error?: string | null
  provider?: string | null
  model?: string | null
  latencyMs?: number
  artifacts?: Array<{ type: string; content: string }>
}

export default function CreatorStudioTab() {
  const [mode, setMode] = useState<CreatorMode>('image')
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CreationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Music-specific
  const [genre, setGenre] = useState('Pop')
  const [mood, setMood] = useState('Uplifting')
  const [instrumental, setInstrumental] = useState(false)
  // Campaign-specific
  const [campaignNiche, setCampaignNiche] = useState('')

  const create = useCallback(async () => {
    if (!prompt.trim()) return
    setRunning(true); setError(null); setResult(null)
    try {
      let res: Response
      if (mode === 'image') {
        res = await fetch('/api/admin/brain/test', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: '__admin_test__', appSecret: 'admin-test-secret', taskType: 'image', message: prompt }),
        })
      } else if (mode === 'music') {
        res = await fetch('/api/admin/music-studio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', title: prompt, genre, mood, vocalStyle: instrumental ? 'instrumental' : 'vocal', durationSeconds: 120, lyrics: prompt }),
        })
      } else if (mode === 'voice') {
        res = await fetch('/api/brain/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: '__admin_test__', appSecret: 'admin-test-secret', text: prompt }),
        })
      } else if (mode === 'video') {
        res = await fetch('/api/brain/video-generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: '__admin_test__', appSecret: 'admin-test-secret', prompt }),
        })
      } else if (mode === 'campaign') {
        res = await fetch('/api/admin/brain/test', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: '__admin_test__', appSecret: 'admin-test-secret', taskType: 'chat',
            message: `Generate a full marketing campaign pack for: "${prompt}"\nNiche: ${campaignNiche || 'general'}\n\nInclude:\n1. Social media image prompt\n2. Instagram caption\n3. Email subject + body\n4. Blog post outline\n5. Landing page headline + CTA\n6. Promo concept\n\nReturn each section clearly labeled.`,
          }),
        })
      } else {
        throw new Error(`Unknown mode: ${mode}`)
      }
      const data = await res.json()
      setResult({
        success: data.success ?? (!!data.output || !!data.audioUrl),
        output: data.output ?? data.text ?? null,
        imageUrl: data.imageUrl ?? null,
        audioUrl: data.audioUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        error: data.error ?? null,
        provider: data.routedProvider ?? data.provider ?? null,
        model: data.routedModel ?? data.model ?? null,
        latencyMs: data.latencyMs ?? 0,
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Creation failed') } finally { setRunning(false) }
  }, [mode, prompt, genre, mood, instrumental, campaignNiche])

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex items-center gap-2">
        {MODES.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setResult(null) }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-all
              ${mode === m.key ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
            <m.icon className={`w-4 h-4 ${mode === m.key ? 'text-blue-400' : ''}`} /> {m.label}
          </button>
        ))}
      </div>

      {/* Input form */}
      <div className="space-y-3">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={
            mode === 'image' ? 'Describe the image to generate…' :
            mode === 'music' ? 'Song title or theme…' :
            mode === 'voice' ? 'Text to convert to speech…' :
            mode === 'video' ? 'Describe the video concept…' :
            'Describe the campaign theme…'
          }
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 resize-none" />

        {mode === 'music' && (
          <div className="flex items-center gap-3">
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
              {['Pop','Rock','Gospel','Amapiano','EDM','Hip-Hop','R&B','Jazz','Classical','Cinematic','Lo-Fi','Afrobeats','Country','Reggae'].map(g =>
                <option key={g} value={g}>{g}</option>
              )}
            </select>
            <select value={mood} onChange={e => setMood(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
              {['Uplifting','Melancholic','Energetic','Chill','Romantic','Dark','Inspirational','Nostalgic','Aggressive','Peaceful'].map(m =>
                <option key={m} value={m}>{m}</option>
              )}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={instrumental} onChange={e => setInstrumental(e.target.checked)} className="rounded border-slate-600 bg-transparent" />
              Instrumental only
            </label>
          </div>
        )}

        {mode === 'campaign' && (
          <div>
            <input value={campaignNiche} onChange={e => setCampaignNiche(e.target.value)} placeholder="Niche (e.g. fitness, saas, church)…"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40" />
            <p className="text-[10px] text-slate-600 mt-1">Uses AI chat to generate social copy, email, blog outline, and landing page concepts.</p>
          </div>
        )}

        <button onClick={create} disabled={running || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {running ? 'Creating…' : 'Create'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
            <span className="text-sm font-medium text-white">{result.success ? 'Created Successfully' : 'Creation Failed'}</span>
            {result.provider && <span className="text-[10px] text-slate-500 ml-2">via {result.provider}{result.model ? ` / ${result.model}` : ''}</span>}
          </div>

          {result.imageUrl && (
            <div className="space-y-2">
              <img src={result.imageUrl} alt="Generated" className="max-w-full max-h-[500px] rounded-lg border border-white/[0.06]" />
              <a href={result.imageUrl} download className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Download className="w-3 h-3" /> Download</a>
            </div>
          )}

          {result.audioUrl && (
            <div className="space-y-2">
              <audio controls src={result.audioUrl} className="w-full" />
              <a href={result.audioUrl} download className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Download className="w-3 h-3" /> Download</a>
            </div>
          )}

          {result.videoUrl && (
            <div className="space-y-2">
              <video controls src={result.videoUrl} className="max-w-full rounded-lg" />
              <a href={result.videoUrl} download className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Download className="w-3 h-3" /> Download</a>
            </div>
          )}

          {result.output && !result.imageUrl && !result.audioUrl && (
            <div className="bg-white/[0.02] rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {result.output}
            </div>
          )}

          {result.error && (
            <div className="text-xs text-red-300 bg-red-500/5 rounded-lg p-3">{result.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
