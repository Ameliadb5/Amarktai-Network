'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Music, Download, RefreshCw, AlertCircle, FileAudio,
  Sparkles, Clock, CheckCircle, XCircle, Tag,
} from 'lucide-react'

interface MusicArtifact {
  id: string
  title: string
  genre: string
  vocalStyle: string
  mood: string
  durationSeconds: number
  lyrics: string | null
  coverArtUrl: string | null
  audioUrl: string | null
  artifactType: 'generated_audio' | 'blueprint_only'
  status: 'pending' | 'generating' | 'completed' | 'failed'
  provider: string
  model: string
  appSlug: string
  createdAt: string
}

interface StudioStatus {
  available: boolean
  audioProviderConfigured: boolean
  lyricsProviderConfigured: boolean
  coverArtProviderConfigured: boolean
  configuredProviders: string[]
  note: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const GENRE_PRESETS = [
  'Pop', 'Rock', 'Gospel', 'Amapiano', 'EDM', 'Hip-Hop', 'R&B', 'Jazz',
  'Classical', 'Cinematic', 'Lo-Fi', 'Afrobeats', 'Country', 'Reggae',
]

const MOOD_PRESETS = [
  'Uplifting', 'Melancholic', 'Energetic', 'Chill', 'Romantic', 'Dark',
  'Inspirational', 'Nostalgic', 'Aggressive', 'Peaceful',
]

const VOCAL_STYLES = [
  'male_vocal', 'female_vocal', 'duet', 'choir', 'instrumental',
  'whisper', 'rap', 'spoken_word',
]

export default function MusicStudioPage() {
  const [artifacts, setArtifacts] = useState<MusicArtifact[]>([])
  const [status, setStatus] = useState<StudioStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [theme, setTheme] = useState('')
  const [genre, setGenre] = useState('Pop')
  const [mood, setMood] = useState('Uplifting')
  const [vocalStyle, setVocalStyle] = useState('female_vocal')
  const [durationSeconds, setDurationSeconds] = useState(180)
  const [includeLyrics, setIncludeLyrics] = useState(true)
  const [appSlug, setAppSlug] = useState('platform')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [artRes, statusRes] = await Promise.all([
        fetch('/api/admin/music-studio?limit=20'),
        fetch('/api/admin/music-studio?status=true'),
      ])
      if (artRes.ok) {
        const data = await artRes.json()
        setArtifacts(data.artifacts ?? [])
      }
      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data.status ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!theme.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/music-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          request: {
            theme: theme.trim(),
            genre,
            mood,
            vocalStyle,
            durationSeconds,
            includeLyrics,
            appSlug,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setTheme('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
        <span className="ml-3 text-sm text-slate-400">Loading Music Studio…</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Music className="w-6 h-6 text-violet-400" />
              Music Studio
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create music, lyrics, instrumentals, and cover art with AI
            </p>
          </div>
          <button onClick={load} className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Status Banner */}
      {status && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className={`rounded-xl border p-4 ${
            status.available
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-amber-500/20 bg-amber-500/5'
          }`}>
            <div className="flex items-center gap-3">
              {status.available ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <p className={`text-sm font-medium ${status.available ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {status.available ? 'Music Studio Active' : 'Music Studio — Limited Mode'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{status.note}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <StatusPill label="Audio Generation" ok={status.audioProviderConfigured} />
              <StatusPill label="Lyrics" ok={status.lyricsProviderConfigured} />
              <StatusPill label="Cover Art" ok={status.coverArtProviderConfigured} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Creation Form */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Create New Track
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Theme / Description</label>
              <input
                type="text"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                placeholder="e.g. 'An uplifting gospel song about hope and redemption'"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Genre</label>
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
              >
                {GENRE_PRESETS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Mood</label>
              <select
                value={mood}
                onChange={e => setMood(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
              >
                {MOOD_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Vocal Style</label>
              <select
                value={vocalStyle}
                onChange={e => setVocalStyle(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
              >
                {VOCAL_STYLES.map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Duration: {Math.floor(durationSeconds / 60)}:{String(durationSeconds % 60).padStart(2, '0')}
              </label>
              <input
                type="range"
                min={30}
                max={600}
                step={30}
                value={durationSeconds}
                onChange={e => setDurationSeconds(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLyrics}
                  onChange={e => setIncludeLyrics(e.target.checked)}
                  className="accent-violet-500"
                />
                <span className="text-sm text-slate-300">Include Lyrics</span>
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">App</label>
              <input
                type="text"
                value={appSlug}
                onChange={e => setAppSlug(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleCreate}
              disabled={creating || !theme.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create Track'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Artifact Library */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileAudio className="w-5 h-5 text-violet-400" />
          Music Library ({artifacts.length})
        </h2>

        {artifacts.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <Music className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No tracks yet. Create your first track above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {artifacts.map(a => (
              <div
                key={a.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-start gap-3">
                  {a.coverArtUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.coverArtUrl}
                      alt="Cover"
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-violet-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{a.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {a.genre}
                      </span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {Math.floor(a.durationSeconds / 60)}:{String(a.durationSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <ArtifactTypeBadge type={a.artifactType} />
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                </div>

                {/* Audio Player */}
                {a.audioUrl && (
                  <div className="mt-3">
                    <audio controls className="w-full h-8" preload="none">
                      <source src={a.audioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                )}

                {/* Lyrics Preview */}
                {a.lyrics && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      View Lyrics
                    </summary>
                    <pre className="mt-1 text-xs text-slate-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {a.lyrics}
                    </pre>
                  </details>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  {a.audioUrl && (
                    <a
                      href={a.audioUrl}
                      download
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  )}
                  <span className="text-xs text-slate-600">
                    {a.provider}/{a.model}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
      ok ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
         : 'text-slate-400 border-white/10 bg-white/5'
    }`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  )
}

function ArtifactTypeBadge({ type }: { type: string }) {
  const isGenerated = type === 'generated_audio'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${
      isGenerated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
    }`}>
      {isGenerated ? 'Generated' : 'Blueprint'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'text-emerald-400',
    generating: 'text-amber-400',
    pending: 'text-slate-400',
    failed: 'text-red-400',
  }
  return (
    <span className={`text-xs ${colors[status] ?? 'text-slate-400'}`}>
      {status}
    </span>
  )
}
