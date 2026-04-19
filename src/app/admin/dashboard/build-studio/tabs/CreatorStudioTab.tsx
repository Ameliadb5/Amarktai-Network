'use client'

/**
 * CreatorStudioTab — Image / Audio / Music / Video / Campaign creation inside Build Studio.
 * Accepts optional initialMode to support direct tab navigation from Studio tabs.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  ImageIcon, Music, Mic, Film, Megaphone, Loader2, Download,
  AlertCircle, CheckCircle, Sparkles, ExternalLink,
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

interface CreatorStudioTabProps {
  initialMode?: CreatorMode
}

export default function CreatorStudioTab({ initialMode }: CreatorStudioTabProps) {
  const [mode, setMode] = useState<CreatorMode>(initialMode ?? 'image')
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
  const [voiceGender, setVoiceGender] = useState<'male' | 'female' | ''>('')
  const [voiceId, setVoiceId] = useState('')
  const [voiceAccent, setVoiceAccent] = useState('')
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [savingArtifact, setSavingArtifact] = useState(false)

  // Sync mode when initialMode changes
  useEffect(() => {
    if (initialMode) setMode(initialMode)
  }, [initialMode])

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
        const genreMap: Record<string, string> = {
          Pop: 'pop', Rock: 'rock', Gospel: 'gospel', Amapiano: 'amapiano',
          EDM: 'edm', 'Hip-Hop': 'hip_hop', 'R&B': 'rnb', Jazz: 'jazz',
          Classical: 'classical', Cinematic: 'cinematic', 'Lo-Fi': 'lofi',
          Afrobeats: 'afrobeats', Country: 'country', Reggae: 'reggae',
        }
        res = await fetch('/api/admin/music-studio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            request: {
              appSlug: '__workspace__',
              title: prompt,
              theme: `${prompt}. Mood: ${mood}`,
              genre: genreMap[genre] ?? 'pop',
              vocalStyle: instrumental ? 'instrumental_only' : 'female_lead',
              durationSeconds: 120,
            },
          }),
        })
      } else if (mode === 'voice') {
        res = await fetch('/api/brain/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: '__admin_test__',
            appSecret: 'admin-test-secret',
            text: prompt,
            gender: voiceGender || undefined,
            voiceId: voiceId || undefined,
            accent: voiceAccent || undefined,
          }),
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
      const data = await (async () => {
        // /api/brain/tts returns audio/mpeg on success, JSON on error
        if (mode === 'voice') {
          if (!res.ok) {
            return await res.json().catch(() => ({ success: false, error: `Voice generation failed: HTTP ${res.status}` }))
          }
          const contentType = res.headers.get('Content-Type') ?? ''
          if (contentType.includes('audio')) {
            const buffer = await res.arrayBuffer()
            const bytes = new Uint8Array(buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            return { success: true, audioUrl: `data:audio/mpeg;base64,${base64}`, output: '[TTS audio generated]' }
          }
          return await res.json().catch(() => ({ success: false, error: 'Unexpected TTS response format' }))
        }
        // All other modes return JSON
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: `Request failed: HTTP ${res.status}` }))
          return { success: false, error: errBody.error ?? `Request failed: HTTP ${res.status}` }
        }
        return await res.json().catch(() => ({ success: false, error: 'Invalid JSON response from server' }))
      })()
      const normalized = mode === 'music'
        ? {
            success: !!data?.artifact?.audioUrl || data?.status === 'blueprint_only',
            output: data?.message ?? data?.lyrics?.lyrics ?? null,
            imageUrl: data?.artifact?.coverArtUrl ?? null,
            audioUrl: data?.artifact?.audioUrl ?? null,
            videoUrl: null,
            error: data?.error ?? null,
            provider: data?.artifact?.musicProvider ?? null,
            model: data?.artifact?.lyricsModel ?? null,
            latencyMs: 0,
          }
        : {
            success: data.success ?? (!!data.output || !!data.audioUrl),
            output: data.output ?? data.text ?? null,
            imageUrl: data.imageUrl ?? null,
            audioUrl: data.audioUrl ?? null,
            videoUrl: data.videoUrl ?? null,
            error: data.error ?? null,
            provider: data.routedProvider ?? data.provider ?? null,
            model: data.routedModel ?? data.model ?? null,
            latencyMs: data.latencyMs ?? 0,
          }

      setResult(normalized)
      if (mode === 'video' && data.jobId) {
        setVideoJobId(data.jobId as string)
        const poll = setInterval(async () => {
          try {
            const pr = await fetch(`/api/brain/video-generate/${data.jobId}`)
            if (!pr.ok) return
            const pj = await pr.json().catch(() => null) as { status?: string; resultUrl?: string } | null
            if (!pj) return
            if (pj.status === 'succeeded' && pj.resultUrl) {
              setResult((prev) => prev ? { ...prev, success: true, videoUrl: pj.resultUrl, output: '[Video generated]' } : prev)
              clearInterval(poll)
            } else if (pj.status === 'failed') {
              setResult((prev) => prev ? { ...prev, success: false, error: 'Video generation failed' } : prev)
              clearInterval(poll)
            }
          } catch { /* retry */ }
        }, 5000)
      } else {
        setVideoJobId(null)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Creation failed') } finally { setRunning(false) }
  }, [mode, prompt, genre, mood, instrumental, campaignNiche, voiceGender, voiceId, voiceAccent])

  const saveArtifact = useCallback(async () => {
    if (!result) return
    const preferAudio = mode === 'music' || mode === 'voice'
    const primaryAudioUrl = preferAudio ? (result.audioUrl ?? null) : null
    const primaryImageUrl = result.imageUrl ?? null
    const primaryVideoUrl = result.videoUrl ?? null
    const fallbackAudioUrl = !preferAudio ? (result.audioUrl ?? null) : null
    const contentUrl = primaryAudioUrl ?? primaryImageUrl ?? primaryVideoUrl ?? fallbackAudioUrl
    if (!contentUrl) return
    const type =
      contentUrl === primaryAudioUrl
        ? (mode === 'music' ? 'music' : 'audio')
        : contentUrl === primaryImageUrl
          ? 'image'
          : 'video'
    const subType = mode === 'voice' ? 'tts' : mode
    setSavingArtifact(true)
    try {
      const res = await fetch('/api/admin/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSlug: '__workspace__',
          type,
          subType,
          title: `${mode} output`,
          description: prompt,
          provider: result.provider ?? '',
          model: result.model ?? '',
          contentUrl,
          metadata: { mode, prompt },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Save failed (HTTP ${res.status})`)
      setResult((prev) => prev ? { ...prev, output: `${prev.output ?? ''}\n[Saved to Artifacts: ${data.artifact?.id ?? 'ok'}]`.trim() } : prev)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save artifact')
    } finally {
      setSavingArtifact(false)
    }
  }, [mode, prompt, result])

  // Show mode selector only when opened without a specific initialMode
  const showModeSelector = !initialMode

  return (
    <div className="space-y-6">
      {/* Mode selector — only when accessed via generic Create Media tab */}
      {showModeSelector && (
        <div className="flex items-center gap-2 flex-wrap">
          {MODES.map(m => (
            <button key={m.key} onClick={() => { setMode(m.key); setResult(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-xl border transition-all
                ${mode === m.key ? 'bg-white/[0.06] border-white/[0.10] text-white' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
              <m.icon className={`w-4 h-4 ${mode === m.key ? 'text-blue-400' : ''}`} /> {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      <div className="space-y-4">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={
            mode === 'image' ? 'Describe the image to generate…' :
            mode === 'music' ? 'Song title or theme…' :
            mode === 'voice' ? 'Text to convert to speech…' :
            mode === 'video' ? 'Describe the video concept…' :
            'Describe the campaign theme…'
          }
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all" />

        {mode === 'music' && (
          <div className="flex items-center gap-3 flex-wrap">
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white">
              {['Pop','Rock','Gospel','Amapiano','EDM','Hip-Hop','R&B','Jazz','Classical','Cinematic','Lo-Fi','Afrobeats','Country','Reggae'].map(g =>
                <option key={g} value={g}>{g}</option>
              )}
            </select>
            <select value={mood} onChange={e => setMood(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white">
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

        {mode === 'voice' && (
          <div className="flex items-center gap-3 flex-wrap">
            <select value={voiceGender} onChange={e => setVoiceGender(e.target.value as 'male' | 'female' | '')}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white">
              <option value="">Any gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="Voice ID (optional)"
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500" />
            <input value={voiceAccent} onChange={e => setVoiceAccent(e.target.value)} placeholder="Accent (optional)"
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500" />
          </div>
        )}

        {mode === 'campaign' && (
          <div>
            <input value={campaignNiche} onChange={e => setCampaignNiche(e.target.value)} placeholder="Niche (e.g. fitness, saas, church)…"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 transition-all" />
            <p className="text-[10px] text-slate-600 mt-1.5">Uses AI chat to generate social copy, email, blog outline, and landing page concepts.</p>
          </div>
        )}

        <button onClick={create} disabled={running || !prompt.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/20 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {running ? 'Creating…' : 'Create'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center gap-2">
              {result.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className="text-sm font-medium text-white">{result.success ? 'Created Successfully' : 'Creation Failed'}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              {result.provider && <span>via {result.provider}</span>}
              {result.model && <span>{result.model}</span>}
              {result.latencyMs && result.latencyMs > 0 && <span>{result.latencyMs}ms</span>}
            </div>
          </div>

          {/* Image output — PREMIUM INLINE DISPLAY */}
          {result.imageUrl && (
            <div className="p-5">
              <div className="image-result-container relative rounded-2xl overflow-hidden bg-[#0d1424] border border-white/[0.06]">
                <img
                  src={result.imageUrl}
                  alt="Generated image"
                  className="w-full max-h-[600px] object-contain"
                  onError={(e) => {
                    // Fallback: show as link if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      const fallback = document.createElement('div')
                      fallback.className = 'p-6 text-center'
                      const msg = document.createElement('p')
                      msg.className = 'text-sm text-slate-400 mb-2'
                      msg.textContent = 'Image generated but could not display inline.'
                      const link = document.createElement('a')
                      link.href = result.imageUrl ?? ''
                      link.target = '_blank'
                      link.rel = 'noopener noreferrer'
                      link.className = 'text-sm text-blue-400 hover:text-blue-300 underline'
                      link.textContent = 'Open image in new tab →'
                      fallback.appendChild(msg)
                      fallback.appendChild(link)
                      parent.appendChild(fallback)
                    }
                  }}
                />
                {/* Overlay with download */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      {result.provider && <span className="px-2 py-0.5 rounded-lg bg-white/10 backdrop-blur-sm">{result.provider}</span>}
                      {result.model && <span className="px-2 py-0.5 rounded-lg bg-white/10 backdrop-blur-sm">{result.model}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={result.imageUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-xs text-white hover:bg-white/20 transition-colors">
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                      <a href={result.imageUrl} download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/80 backdrop-blur-sm text-xs text-white font-medium hover:bg-blue-500 transition-colors">
                        <Download className="w-3 h-3" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audio output */}
          {result.audioUrl && (
            <div className="p-5 space-y-3">
              <audio controls src={result.audioUrl} className="w-full rounded-xl" />
              <div className="flex items-center gap-2">
                <a href={result.audioUrl} download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-blue-400 hover:text-blue-300 hover:bg-white/[0.06] transition-colors">
                  <Download className="w-3 h-3" /> Download Audio
                </a>
                <button onClick={saveArtifact} disabled={savingArtifact}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                  {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save to Artifacts
                </button>
              </div>
            </div>
          )}

          {videoJobId && !result.videoUrl && (
            <div className="p-5 text-xs text-blue-300">
              Video generation in progress… Job {videoJobId.slice(0, 8)}…
            </div>
          )}

          {/* Video output */}
          {result.videoUrl && (
            <div className="p-5 space-y-3">
              <video controls src={result.videoUrl} className="w-full rounded-xl border border-white/[0.06]" />
              <div className="flex items-center gap-2">
                <a href={result.videoUrl} download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-blue-400 hover:text-blue-300 hover:bg-white/[0.06] transition-colors">
                  <Download className="w-3 h-3" /> Download Video
                </a>
                <button onClick={saveArtifact} disabled={savingArtifact}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                  {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save to Artifacts
                </button>
              </div>
            </div>
          )}

          {/* Image save action */}
          {result.imageUrl && (
            <div className="px-5 pb-5">
              <button onClick={saveArtifact} disabled={savingArtifact}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">
                {savingArtifact ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Save to Artifacts
              </button>
            </div>
          )}

          {/* Text output */}
          {result.output && !result.imageUrl && !result.audioUrl && (
            <div className="p-5">
              <div className="bg-white/[0.02] rounded-xl p-5 text-sm text-slate-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed border border-white/[0.04]">
                {result.output}
              </div>
            </div>
          )}

          {/* Error detail */}
          {result.error && (
            <div className="mx-5 mb-5 text-xs text-red-300 bg-red-500/[0.06] rounded-xl p-4 border border-red-500/20">{result.error}</div>
          )}
        </div>
      )}
    </div>
  )
}
