/**
 * @module music-studio
 * @description Full Music Studio for the AmarktAI Network platform.
 *
 * Provides a complete music production pipeline:
 *   - Lyrics generation
 *   - Song structure generation
 *   - Music/audio generation (via AI music providers: Suno-compatible, MusicGen)
 *   - Cover art generation (via image generation models)
 *   - Genre / vocal style / BPM configuration
 *   - Export / download pipeline
 *   - Artifact metadata (title, genre, duration, model, timestamp)
 *
 * When a real music generation API is not configured the module falls back to
 * generating a full creative blueprint (lyrics + structure + production notes)
 * and marks the audio artifact as `blueprint_only` so the dashboard can
 * display it truthfully.
 *
 * Server-side only.
 */

import { randomUUID } from 'crypto'
import { getVaultApiKey } from '@/lib/brain'

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters from generated lyrics sent to the Suno API as a prompt.
 *  The Suno API accepts prompts up to ~3000 characters. */
const SUNO_MAX_PROMPT_LENGTH = 3_000

/** Number of polling iterations when waiting for a Replicate prediction.
 *  Each iteration waits REPLICATE_POLL_INTERVAL_MS → total max wait = 60 s. */
const REPLICATE_POLL_ITERATIONS = 12

/** Milliseconds to wait between Replicate prediction polling attempts. */
const REPLICATE_POLL_INTERVAL_MS = 5_000

// ── Types ────────────────────────────────────────────────────────────────────

/** Supported music genres. */
export type MusicGenre =
  | 'pop'
  | 'rock'
  | 'hip_hop'
  | 'edm'
  | 'gospel'
  | 'worship'
  | 'amapiano'
  | 'afrobeats'
  | 'jazz'
  | 'classical'
  | 'rnb'
  | 'country'
  | 'blues'
  | 'reggae'
  | 'latin'
  | 'kpop'
  | 'soul'
  | 'ambient'
  | 'lofi'
  | 'cinematic'
  | 'custom'

/** Vocal style options. */
export type VocalStyle =
  | 'male_lead'
  | 'female_lead'
  | 'choir'
  | 'rap'
  | 'spoken_word'
  | 'a_cappella'
  | 'harmonized'
  | 'falsetto'
  | 'instrumental_only'

/** Song section type. */
export type SongSection = 'intro' | 'verse' | 'pre_chorus' | 'chorus' | 'bridge' | 'outro' | 'instrumental_break'

/** Request to create a music piece. */
export interface MusicCreationRequest {
  /** App this music is created for. */
  appSlug: string
  /** Song title (optional — will be auto-generated if omitted). */
  title?: string
  /** Theme or mood of the song (e.g. "hope and redemption"). */
  theme: string
  /** Target genre. */
  genre: MusicGenre
  /** Vocal style. */
  vocalStyle: VocalStyle
  /** Approximate duration in seconds. */
  durationSeconds?: number
  /** BPM (beats per minute). 0 = auto. */
  bpm?: number
  /** Existing lyrics to use (skips lyrics generation step). */
  existingLyrics?: string
  /** Extra creative direction. */
  productionNotes?: string
  /** Whether to also generate a cover art image. */
  generateCoverArt?: boolean
  /** Quality tier for model selection. */
  qualityTier?: 'standard' | 'high' | 'premium'
}

/** One section in a generated song structure. */
export interface SongStructureSection {
  type: SongSection
  durationSeconds: number
  lyrics?: string
  notes?: string
}

/** Full song structure. */
export interface SongStructure {
  sections: SongStructureSection[]
  totalDurationSeconds: number
  bpm: number
  keySignature: string
  timeSignature: string
  productionStyle: string
}

/** Lyrics generation result. */
export interface LyricsResult {
  id: string
  title: string
  genre: MusicGenre
  theme: string
  vocalStyle: VocalStyle
  lyrics: string
  structure: SongStructure
  generatedAt: string
  model: string
}

/** Audio generation result artifact. */
export interface MusicArtifact {
  id: string
  appSlug: string
  title: string
  genre: MusicGenre
  vocalStyle: VocalStyle
  theme: string
  durationSeconds: number
  bpm: number
  /** URL to the audio file (absolute URL or data URI). */
  audioUrl: string | null
  /** MIME type of the audio file. */
  audioMimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg' | null
  /** Whether the audio was actually generated or only a blueprint was produced. */
  artifactType: 'generated_audio' | 'blueprint_only'
  /** Full lyrics for the track. */
  lyrics: string
  /** Full song structure. */
  structure: SongStructure
  /** Cover art image URL (null if not generated). */
  coverArtUrl: string | null
  /** Provider that generated the music. */
  musicProvider: string
  /** Model used for lyrics/structure generation. */
  lyricsModel: string
  /** Model used for cover art generation. */
  coverArtModel: string | null
  /** ISO timestamp of generation. */
  generatedAt: string
  /** Metadata tags for this track. */
  tags: string[]
}

/** Result from the music studio pipeline. */
export interface MusicStudioResult {
  artifact: MusicArtifact
  lyrics: LyricsResult
  status: 'generated' | 'blueprint_only' | 'failed'
  message: string
}

/** Summary of music studio activity. */
export interface MusicStudioSummary {
  totalCreated: number
  byGenre: Record<string, number>
  byAppSlug: Record<string, number>
  lastCreatedAt: string | null
  providersUsed: string[]
}

// ── DB-backed artifact persistence ────────────────────────────────────────────
// Uses the platform's Artifact model (type='music') instead of an in-memory Map.
// Falls back gracefully to empty results if the DB is unavailable.

async function saveMusicArtifactToDB(artifact: MusicArtifact): Promise<void> {
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.artifact.create({
      data: {
        id: artifact.id,
        appSlug: artifact.appSlug,
        type: 'music',
        subType: artifact.artifactType,
        title: artifact.title,
        description: `${artifact.genre} • ${artifact.vocalStyle} • ${artifact.theme}`,
        provider: artifact.musicProvider,
        model: artifact.lyricsModel,
        storageDriver: 'url',
        storagePath: '',
        storageUrl: artifact.audioUrl ?? '',
        mimeType: artifact.audioMimeType ?? '',
        fileSizeBytes: 0,
        previewable: true,
        downloadable: !!artifact.audioUrl,
        status: artifact.artifactType === 'generated_audio' ? 'completed' : 'completed',
        metadata: JSON.stringify({
          genre: artifact.genre,
          vocalStyle: artifact.vocalStyle,
          theme: artifact.theme,
          durationSeconds: artifact.durationSeconds,
          bpm: artifact.bpm,
          lyrics: artifact.lyrics,
          structure: artifact.structure,
          coverArtUrl: artifact.coverArtUrl,
          coverArtModel: artifact.coverArtModel,
          artifactType: artifact.artifactType,
          tags: artifact.tags,
          generatedAt: artifact.generatedAt,
        }),
      },
    })
  } catch {
    // DB write failure is non-fatal — log only, do not throw
  }
}

async function loadMusicArtifactsFromDB(appSlug?: string, limit = 50): Promise<MusicArtifact[]> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const rows = await prisma.artifact.findMany({
      where: { type: 'music', ...(appSlug ? { appSlug } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map((row): MusicArtifact => {
      let meta: Record<string, unknown> = {}
      try { meta = JSON.parse(row.metadata) as Record<string, unknown> } catch { /* ignore */ }
      return {
        id: row.id,
        appSlug: row.appSlug,
        title: row.title,
        genre: (meta.genre as MusicGenre) ?? 'pop',
        vocalStyle: (meta.vocalStyle as VocalStyle) ?? 'female_lead',
        theme: (meta.theme as string) ?? '',
        durationSeconds: (meta.durationSeconds as number) ?? 180,
        bpm: (meta.bpm as number) ?? 100,
        audioUrl: row.storageUrl || null,
        audioMimeType: (row.mimeType as 'audio/mpeg' | 'audio/wav' | 'audio/ogg') || null,
        artifactType: (meta.artifactType as 'generated_audio' | 'blueprint_only') ?? 'blueprint_only',
        lyrics: (meta.lyrics as string) ?? '',
        structure: (meta.structure as SongStructure) ?? { sections: [] },
        coverArtUrl: (meta.coverArtUrl as string) ?? null,
        musicProvider: row.provider,
        lyricsModel: row.model,
        coverArtModel: (meta.coverArtModel as string) ?? null,
        generatedAt: row.createdAt.toISOString(),
        tags: (meta.tags as string[]) ?? [],
      }
    })
  } catch {
    return []
  }
}

// ── Genre display names ───────────────────────────────────────────────────────

const GENRE_DISPLAY: Record<MusicGenre, string> = {
  pop: 'Pop',
  rock: 'Rock',
  hip_hop: 'Hip Hop',
  edm: 'EDM',
  gospel: 'Gospel',
  worship: 'Worship',
  amapiano: 'Amapiano',
  afrobeats: 'Afrobeats',
  jazz: 'Jazz',
  classical: 'Classical',
  rnb: 'R&B',
  country: 'Country',
  blues: 'Blues',
  reggae: 'Reggae',
  latin: 'Latin',
  kpop: 'K-Pop',
  soul: 'Soul',
  ambient: 'Ambient',
  lofi: 'Lo-Fi',
  cinematic: 'Cinematic',
  custom: 'Custom',
}

// ── Genre defaults (BPM, key, production notes) ───────────────────────────────

interface GenreDefaults {
  typicalBpm: number
  typicalKey: string
  timeSignature: string
  productionStyle: string
}

const GENRE_DEFAULTS: Record<string, GenreDefaults> = {
  pop:        { typicalBpm: 120, typicalKey: 'C major', timeSignature: '4/4', productionStyle: 'polished, hooky, radio-ready' },
  rock:       { typicalBpm: 140, typicalKey: 'G major', timeSignature: '4/4', productionStyle: 'electric guitars, powerful drums, driven mix' },
  hip_hop:    { typicalBpm: 90,  typicalKey: 'D minor', timeSignature: '4/4', productionStyle: 'boom-bap or trap drums, sub bass, sampled chops' },
  edm:        { typicalBpm: 128, typicalKey: 'A minor', timeSignature: '4/4', productionStyle: 'synthesizer leads, sidechain compression, drop builds' },
  gospel:     { typicalBpm: 80,  typicalKey: 'F major', timeSignature: '4/4', productionStyle: 'organ, choir harmonies, uplifting key changes' },
  worship:    { typicalBpm: 75,  typicalKey: 'E major', timeSignature: '4/4', productionStyle: 'atmospheric pads, acoustic guitar, congregational feel' },
  amapiano:   { typicalBpm: 112, typicalKey: 'C minor', timeSignature: '4/4', productionStyle: 'log drum, deep house piano, sub bass, percussion groove' },
  afrobeats:  { typicalBpm: 105, typicalKey: 'G minor', timeSignature: '4/4', productionStyle: 'percussive polyrhythm, talking drum, bright keys' },
  jazz:       { typicalBpm: 95,  typicalKey: 'Bb major', timeSignature: '4/4', productionStyle: 'swing feel, walking bass, improvised solos' },
  classical:  { typicalBpm: 80,  typicalKey: 'D major', timeSignature: '4/4', productionStyle: 'orchestral dynamics, counterpoint, thematic development' },
  rnb:        { typicalBpm: 85,  typicalKey: 'A major', timeSignature: '4/4', productionStyle: 'smooth groove, sustained chords, emotional melisma' },
  country:    { typicalBpm: 110, typicalKey: 'G major', timeSignature: '4/4', productionStyle: 'acoustic guitar, steel guitar, storytelling lyrics' },
  blues:      { typicalBpm: 80,  typicalKey: 'E major', timeSignature: '4/4', productionStyle: '12-bar blues, call-and-response, emotive guitar bends' },
  reggae:     { typicalBpm: 80,  typicalKey: 'G major', timeSignature: '4/4', productionStyle: 'offbeat skank, bass-driven, roots rhythm' },
  latin:      { typicalBpm: 100, typicalKey: 'A minor', timeSignature: '4/4', productionStyle: 'clave rhythm, brass stabs, Latin percussion' },
  kpop:       { typicalBpm: 130, typicalKey: 'B major', timeSignature: '4/4', productionStyle: 'ultra-polished, synth-heavy, choreography-ready drops' },
  soul:       { typicalBpm: 85,  typicalKey: 'E major', timeSignature: '4/4', productionStyle: 'horn section, Hammond organ, emotive vocal delivery' },
  ambient:    { typicalBpm: 70,  typicalKey: 'F major', timeSignature: '4/4', productionStyle: 'textural pads, slow evolving soundscapes, no hard drum hits' },
  lofi:       { typicalBpm: 80,  typicalKey: 'C major', timeSignature: '4/4', productionStyle: 'vinyl crackle, muffled highs, laid-back swing' },
  cinematic:  { typicalBpm: 75,  typicalKey: 'D minor', timeSignature: '4/4', productionStyle: 'full orchestra, emotional arc, tension and release' },
  custom:     { typicalBpm: 100, typicalKey: 'C major', timeSignature: '4/4', productionStyle: 'genre-blending, experimental approach' },
}

// ── Lyrics Generation ────────────────────────────────────────────────────────

/**
 * Build a detailed lyrics generation prompt for an AI language model.
 */
export function buildLyricsPrompt(request: MusicCreationRequest): string {
  const genreName = GENRE_DISPLAY[request.genre] ?? request.genre
  const defs = GENRE_DEFAULTS[request.genre] ?? GENRE_DEFAULTS.pop
  const bpm = request.bpm || defs.typicalBpm
  const style = request.vocalStyle.replace(/_/g, ' ')

  return `You are a professional songwriter and music producer. Create complete, polished song lyrics for the following track.

TRACK DETAILS:
- Title: ${request.title ?? 'auto-generate a compelling title'}
- Genre: ${genreName}
- Theme / mood: ${request.theme}
- Vocal style: ${style}
- BPM: ${bpm}
- Production style: ${defs.productionStyle}
${request.productionNotes ? `- Extra direction: ${request.productionNotes}` : ''}

REQUIRED OUTPUT (respond in this exact format):

TITLE: <song title>

STRUCTURE:
[Intro] (${Math.round((request.durationSeconds ?? 180) * 0.07)}s)
[Verse 1] (${Math.round((request.durationSeconds ?? 180) * 0.18)}s)
[Pre-Chorus] (${Math.round((request.durationSeconds ?? 180) * 0.10)}s)
[Chorus] (${Math.round((request.durationSeconds ?? 180) * 0.15)}s)
[Verse 2] (${Math.round((request.durationSeconds ?? 180) * 0.18)}s)
[Pre-Chorus] (${Math.round((request.durationSeconds ?? 180) * 0.10)}s)
[Chorus] (${Math.round((request.durationSeconds ?? 180) * 0.15)}s)
[Bridge] (${Math.round((request.durationSeconds ?? 180) * 0.12)}s)
[Outro] (${Math.round((request.durationSeconds ?? 180) * 0.10)}s)

LYRICS:
(Write full lyrics for every section above. Mark each section clearly.)

PRODUCTION NOTES:
(2-3 sentences on instrumentation, feel, key changes, production tips.)

Make the lyrics emotionally resonant, commercially viable, and true to the genre. Be specific and creative.`
}

/**
 * Parse raw AI lyrics output into a structured LyricsResult.
 */
export function parseLyricsOutput(
  raw: string,
  request: MusicCreationRequest,
  model: string,
): LyricsResult {
  const id = randomUUID()
  const defs = GENRE_DEFAULTS[request.genre] ?? GENRE_DEFAULTS.pop
  const bpm = request.bpm || defs.typicalBpm

  // Extract title
  const titleMatch = raw.match(/TITLE:\s*(.+)/i)
  const title = titleMatch?.[1]?.trim() ?? request.title ?? `${request.theme} (${GENRE_DISPLAY[request.genre]})`

  // Extract lyrics section using a linear split to avoid ReDoS on adversarial input.
  // Split on "PRODUCTION NOTES:" (case-insensitive) and take the portion after "LYRICS:".
  const prodNotesSplit = raw.split(/PRODUCTION NOTES:/i)
  const beforeProdNotes = prodNotesSplit[0] ?? raw
  const lyricsSplit = beforeProdNotes.split(/LYRICS:/i)
  const lyrics = (lyricsSplit.length > 1 ? lyricsSplit.slice(1).join('') : raw).trim()

  // Build a simple structure from the raw text
  const SECTION_TYPES: Array<{ label: string; type: SongSection }> = [
    { label: 'Intro', type: 'intro' },
    { label: 'Verse 1', type: 'verse' },
    { label: 'Verse 2', type: 'verse' },
    { label: 'Verse 3', type: 'verse' },
    { label: 'Pre-Chorus', type: 'pre_chorus' },
    { label: 'Chorus', type: 'chorus' },
    { label: 'Bridge', type: 'bridge' },
    { label: 'Outro', type: 'outro' },
    { label: 'Instrumental', type: 'instrumental_break' },
  ]

  const totalDuration = request.durationSeconds ?? 180
  const sections: SongStructureSection[] = []
  const rawLines = lyrics.split('\n')

  for (const { label, type } of SECTION_TYPES) {
    const regex = new RegExp(`\\[${label}\\]([^\\[]*)`, 'i')
    const match = raw.match(regex)
    if (match) {
      sections.push({
        type,
        durationSeconds: Math.round(totalDuration / (SECTION_TYPES.length || 1)),
        lyrics: match[1]?.trim(),
      })
    }
  }

  if (sections.length === 0) {
    // Fallback: chunk lyrics into verse/chorus/verse/chorus structure
    const chunks = rawLines.filter((l) => l.trim()).slice(0, 24)
    const chunkSize = Math.ceil(chunks.length / 4)
    const sectionTypes: SongSection[] = ['verse', 'chorus', 'verse', 'chorus']
    for (let i = 0; i < 4; i++) {
      sections.push({
        type: sectionTypes[i],
        durationSeconds: Math.round(totalDuration / 4),
        lyrics: chunks.slice(i * chunkSize, (i + 1) * chunkSize).join('\n'),
      })
    }
  }

  const structure: SongStructure = {
    sections,
    totalDurationSeconds: totalDuration,
    bpm,
    keySignature: defs.typicalKey,
    timeSignature: defs.timeSignature,
    productionStyle: defs.productionStyle,
  }

  return {
    id,
    title,
    genre: request.genre,
    theme: request.theme,
    vocalStyle: request.vocalStyle,
    lyrics,
    structure,
    generatedAt: new Date().toISOString(),
    model,
  }
}

// ── Music Generation API ──────────────────────────────────────────────────────

/** Providers that support real music audio generation (currently external services). */
export type MusicProvider = 'suno' | 'udio' | 'musicgen_replicate' | 'blueprint_only'

/**
 * Attempt to generate audio via a configured music provider.
 * Returns null when no provider is available (falls back to blueprint_only).
 *
 * Key resolution order: DB vault (set via Admin → AI Providers UI) first,
 * then raw environment variable fallback (for local dev / CI).
 */
async function generateAudio(
  request: MusicCreationRequest,
  lyrics: LyricsResult,
): Promise<{ audioUrl: string; mimeType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg'; provider: MusicProvider } | null> {
  // Suno API — resolve key from vault first, then env fallback
  const sunoKey = (await getVaultApiKey('suno').catch(() => null)) ?? process.env.SUNO_API_KEY?.trim() ?? null
  if (sunoKey) {
    try {
      const res = await fetch('https://studio-api.suno.ai/api/generate/v2/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sunoKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: lyrics.lyrics.slice(0, SUNO_MAX_PROMPT_LENGTH),
          tags: `${GENRE_DISPLAY[request.genre].toLowerCase()} ${request.vocalStyle.replace(/_/g, ' ')}`,
          title: lyrics.title,
          make_instrumental: request.vocalStyle === 'instrumental_only',
        }),
      })
      if (res.ok) {
        const data = await res.json() as { clips?: Array<{ audio_url: string }> }
        const url = data?.clips?.[0]?.audio_url
        if (url) return { audioUrl: url, mimeType: 'audio/mpeg', provider: 'suno' }
      }
    } catch { /* fall through */ }
  }

  // Replicate MusicGen — resolve key from vault first, then env fallback
  const replicateKey = (await getVaultApiKey('replicate').catch(() => null)) ?? process.env.REPLICATE_API_TOKEN?.trim() ?? null
  if (replicateKey) {
    try {
      // Fire-and-poll approach for Replicate
      const createRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Token ${replicateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6945b23e43fd3fe3fa33a2571', // MusicGen melody
          input: {
            prompt: `${GENRE_DISPLAY[request.genre]} music: ${request.theme}. ${GENRE_DEFAULTS[request.genre]?.productionStyle ?? ''}`,
            duration: Math.min(request.durationSeconds ?? 30, 30),
          },
        }),
      })
      if (createRes.ok) {
        const pred = await createRes.json() as { id: string; output?: string | null }
        if (pred.id) {
          // Poll for up to REPLICATE_POLL_ITERATIONS × REPLICATE_POLL_INTERVAL_MS
          for (let i = 0; i < REPLICATE_POLL_ITERATIONS; i++) {
            await new Promise((r) => setTimeout(r, REPLICATE_POLL_INTERVAL_MS))
            const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
              headers: { Authorization: `Token ${replicateKey}` },
            })
            if (pollRes.ok) {
              const poll = await pollRes.json() as { status: string; output?: string | null }
              if (poll.status === 'succeeded' && poll.output) {
                return { audioUrl: String(poll.output), mimeType: 'audio/wav', provider: 'musicgen_replicate' }
              }
              if (poll.status === 'failed') break
            }
          }
        }
      }
    } catch { /* fall through */ }
  }

  return null
}

// ── Cover Art ────────────────────────────────────────────────────────────────

/**
 * Generate cover art for the track using the platform's image generation route.
 * Returns a data URL or CDN URL, or null if unavailable.
 */
async function generateCoverArt(
  lyrics: LyricsResult,
  request: MusicCreationRequest,
): Promise<{ url: string; model: string } | null> {
  // Resolve OpenAI key: DB vault first, then environment variable fallback
  const openAiKey = (await getVaultApiKey('openai').catch(() => null)) ?? process.env.OPENAI_API_KEY?.trim() ?? null
  if (!openAiKey) return null

  try {
    const prompt =
      `Album cover art for a ${GENRE_DISPLAY[request.genre]} song titled "${lyrics.title}". ` +
      `Theme: ${request.theme}. Style: ${GENRE_DEFAULTS[request.genre]?.productionStyle ?? 'modern'}. ` +
      'High quality, visually compelling, no text overlays.'

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      }),
    })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ url: string }> }
      const url = data?.data?.[0]?.url
      if (url) return { url, model: 'dall-e-3' }
    }
  } catch { /* fall through */ }
  return null
}

// ── Lyrics-only Generation ────────────────────────────────────────────────────

/**
 * Generate lyrics by calling the platform's internal chat API.
 *
 * Provider resolution order:
 * 1. OpenAI key from DB vault (set via Admin → AI Providers UI)
 * 2. OPENAI_API_KEY environment variable fallback (local dev / CI)
 * 3. Groq fallback via vault → env (cheap, fast, supports long output)
 * 4. Template fallback when no key is available anywhere
 */
async function generateLyricsViaChat(
  request: MusicCreationRequest,
): Promise<{ lyrics: string; model: string }> {
  // Try OpenAI first (vault → env)
  const openAiKey = (await getVaultApiKey('openai').catch(() => null)) ?? process.env.OPENAI_API_KEY?.trim() ?? null
  if (openAiKey) {
    const prompt = buildLyricsPrompt(request)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.85,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }>; model: string }
        const content = data?.choices?.[0]?.message?.content ?? ''
        return { lyrics: content, model: data.model ?? 'gpt-4o' }
      }
    } catch { /* fall through to Groq */ }
  }

  // Groq fallback (vault → env) — fast and cost-effective for text generation
  const groqKey = (await getVaultApiKey('groq').catch(() => null)) ?? process.env.GROQ_API_KEY?.trim() ?? null
  if (groqKey) {
    const prompt = buildLyricsPrompt(request)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.85,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }>; model: string }
        const content = data?.choices?.[0]?.message?.content ?? ''
        return { lyrics: content, model: data.model ?? 'llama-3.3-70b-versatile' }
      }
    } catch { /* fall through to template */ }
  }

  // Template fallback — no AI key available anywhere
  return { lyrics: buildFallbackLyrics(request), model: 'template' }
}

/**
 * Build a structured lyrics template when AI generation is unavailable.
 * This is a real, usable starting point — not a placeholder.
 */
function buildFallbackLyrics(request: MusicCreationRequest): string {
  const genreName = GENRE_DISPLAY[request.genre] ?? request.genre
  const defs = GENRE_DEFAULTS[request.genre] ?? GENRE_DEFAULTS.pop

  return `TITLE: ${request.title ?? request.theme}

STRUCTURE:
[Intro] (~12s)
[Verse 1] (~30s)
[Pre-Chorus] (~16s)
[Chorus] (~24s)
[Verse 2] (~30s)
[Pre-Chorus] (~16s)
[Chorus] (~24s)
[Bridge] (~20s)
[Outro] (~16s)

LYRICS:
[Intro]
(Instrumental introduction — ${defs.productionStyle})

[Verse 1]
In the silence of the morning light,
Every thought that I've been holding tight.
${request.theme} fills the air around,
A new beginning, breaking ground.

[Pre-Chorus]
And I can feel it rising,
Something new is coming through,
The horizon is surprising,
Every moment fresh and true.

[Chorus]
${request.theme}, ${request.theme},
Let it carry us away.
${request.theme}, ${request.theme},
Light the fire, make it stay.

[Verse 2]
Through the shadows and the doubt within,
${genreName} flows like wind beneath my skin.
Every note a step along the way,
Turning yesterday to today.

[Bridge]
(Hold on, let it go — the feeling you know,
${request.theme} is the rhythm of the soul.)

[Outro]
(Fade out — ${defs.productionStyle})

PRODUCTION NOTES:
${genreName} track in ${defs.typicalKey} at ${defs.typicalBpm} BPM. ${defs.productionStyle}. 
Vocal style: ${request.vocalStyle.replace(/_/g, ' ')}. Arrange for maximum emotional impact.`
}

// ── Main Pipeline ─────────────────────────────────────────────────────────────

// In-memory cache for artifacts created in the current server process lifetime.
// Production persistence uses the Artifact DB model (see saveMusicArtifactToDB).
const artifactStore = new Map<string, MusicArtifact>()

/**
 * Full music creation pipeline:
 * 1. Generate lyrics + structure
 * 2. Attempt real audio generation
 * 3. Optionally generate cover art
 * 4. Assemble and store the artifact
 */
export async function createMusic(
  request: MusicCreationRequest,
): Promise<MusicStudioResult> {
  const defs = GENRE_DEFAULTS[request.genre] ?? GENRE_DEFAULTS.pop
  const bpm = request.bpm || defs.typicalBpm

  // Step 1: Generate lyrics
  const { lyrics: rawLyrics, model: lyricsModel } = await generateLyricsViaChat(request)
  const lyricsResult = parseLyricsOutput(rawLyrics, request, lyricsModel)

  // Step 2: Attempt audio generation
  const audioResult = await generateAudio(request, lyricsResult)

  // Step 3: Optional cover art
  let coverArtUrl: string | null = null
  let coverArtModel: string | null = null
  if (request.generateCoverArt !== false) {
    const art = await generateCoverArt(lyricsResult, request)
    if (art) {
      coverArtUrl = art.url
      coverArtModel = art.model
    }
  }

  const artifactType = audioResult ? 'generated_audio' : 'blueprint_only'

  const artifact: MusicArtifact = {
    id: randomUUID(),
    appSlug: request.appSlug,
    title: lyricsResult.title,
    genre: request.genre,
    vocalStyle: request.vocalStyle,
    theme: request.theme,
    durationSeconds: request.durationSeconds ?? 180,
    bpm,
    audioUrl: audioResult?.audioUrl ?? null,
    audioMimeType: audioResult?.mimeType ?? null,
    artifactType,
    lyrics: lyricsResult.lyrics,
    structure: lyricsResult.structure,
    coverArtUrl,
    musicProvider: audioResult?.provider ?? 'blueprint_only',
    lyricsModel,
    coverArtModel,
    generatedAt: new Date().toISOString(),
    tags: [request.genre, request.vocalStyle, request.theme.toLowerCase().slice(0, 20)],
  }

  artifactStore.set(artifact.id, artifact)
  // Persist to DB for production durability
  await saveMusicArtifactToDB(artifact)

  return {
    artifact,
    lyrics: lyricsResult,
    status: audioResult ? 'generated' : 'blueprint_only',
    message: audioResult
      ? `Music generated via ${audioResult.provider}. Audio and lyrics available.`
      : 'Lyrics and song blueprint generated. Configure SUNO_API_KEY or REPLICATE_API_TOKEN for audio generation.',
  }
}

// ── Lyrics-only Pipeline ─────────────────────────────────────────────────────

/** Generate only lyrics and song structure (no audio generation). */
export async function generateLyrics(
  request: MusicCreationRequest,
): Promise<LyricsResult> {
  const { lyrics: rawLyrics, model } = await generateLyricsViaChat(request)
  return parseLyricsOutput(rawLyrics, request, model)
}

// ── Artifact Accessors ────────────────────────────────────────────────────────
// These are async wrappers over DB reads with an in-memory cache for
// artifacts created in the current server process lifetime.

export function getMusicArtifact(id: string): MusicArtifact | undefined {
  return artifactStore.get(id)
}

export async function getMusicArtifactAsync(id: string): Promise<MusicArtifact | undefined> {
  if (artifactStore.has(id)) return artifactStore.get(id)
  const rows = await loadMusicArtifactsFromDB(undefined, 100)
  return rows.find((a) => a.id === id)
}

export async function getMusicArtifactsByAppAsync(appSlug: string, limit = 20): Promise<MusicArtifact[]> {
  return loadMusicArtifactsFromDB(appSlug, limit)
}

export async function getAllMusicArtifactsAsync(limit = 50): Promise<MusicArtifact[]> {
  return loadMusicArtifactsFromDB(undefined, limit)
}

/** @deprecated Use getMusicArtifactsByAppAsync — falls back to in-process cache only */
export function getMusicArtifactsByApp(appSlug: string, limit = 20): MusicArtifact[] {
  return Array.from(artifactStore.values())
    .filter((a) => a.appSlug === appSlug)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit)
}

/** @deprecated Use getAllMusicArtifactsAsync — falls back to in-process cache only */
export function getAllMusicArtifacts(limit = 50): MusicArtifact[] {
  return Array.from(artifactStore.values())
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit)
}

// ── Genre/Style Lists ────────────────────────────────────────────────────────

export const AVAILABLE_GENRES: Array<{ id: MusicGenre; name: string }> = Object.entries(
  GENRE_DISPLAY,
).map(([id, name]) => ({ id: id as MusicGenre, name }))

export const AVAILABLE_VOCAL_STYLES: Array<{ id: VocalStyle; name: string }> = [
  { id: 'male_lead', name: 'Male Lead Vocal' },
  { id: 'female_lead', name: 'Female Lead Vocal' },
  { id: 'choir', name: 'Choir / Group Vocal' },
  { id: 'rap', name: 'Rap / Spoken' },
  { id: 'spoken_word', name: 'Spoken Word' },
  { id: 'a_cappella', name: 'A Cappella' },
  { id: 'harmonized', name: 'Harmonized Vocals' },
  { id: 'falsetto', name: 'Falsetto' },
  { id: 'instrumental_only', name: 'Instrumental Only' },
]

// ── Studio Status ────────────────────────────────────────────────────────────

export interface MusicStudioStatus {
  lyricsGeneration: 'available' | 'needs_key'
  audioGeneration: 'available' | 'needs_key'
  coverArtGeneration: 'available' | 'needs_key'
  audioProvider: MusicProvider | null
  message: string
}

export function getMusicStudioStatus(): MusicStudioStatus {
  const hasChatKey = Boolean(process.env.OPENAI_API_KEY?.trim()) ||
    Boolean(process.env.GROQ_API_KEY?.trim()) ||
    Boolean(process.env.TOGETHER_API_KEY?.trim())
  const hasSuno = Boolean(process.env.SUNO_API_KEY?.trim())
  const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN?.trim())
  const hasImageKey = Boolean(process.env.OPENAI_API_KEY?.trim())

  const audioProvider: MusicProvider | null = hasSuno
    ? 'suno'
    : hasReplicate
    ? 'musicgen_replicate'
    : null

  return {
    lyricsGeneration: hasChatKey ? 'available' : 'needs_key',
    audioGeneration: audioProvider ? 'available' : 'needs_key',
    coverArtGeneration: hasImageKey ? 'available' : 'needs_key',
    audioProvider,
    message: hasChatKey
      ? audioProvider
        ? `Lyrics, audio (${audioProvider}), and cover art generation available.`
        : 'Lyrics and cover art available. Set SUNO_API_KEY or REPLICATE_API_TOKEN for audio generation.'
      : 'Set at least one AI provider key (OPENAI_API_KEY, GROQ_API_KEY, or TOGETHER_API_KEY) to enable music studio.',
  }
}

/**
 * Vault-aware variant of getMusicStudioStatus.
 * Checks the DB vault (Admin → AI Providers) first, then environment variable
 * fallbacks. Use this from API routes where async is available.
 */
export async function getMusicStudioStatusAsync(): Promise<MusicStudioStatus & { available: boolean; audioProviderConfigured: boolean; lyricsProviderConfigured: boolean; coverArtProviderConfigured: boolean; configuredProviders: string[]; note: string }> {
  const resolveKey = async (vaultKey: string, envVar: string): Promise<boolean> => {
    const vaultVal = await getVaultApiKey(vaultKey).catch(() => null)
    return Boolean(vaultVal) || Boolean(process.env[envVar]?.trim())
  }

  const [hasOpenAi, hasGroq, hasTogether, hasSuno, hasReplicate] = await Promise.all([
    resolveKey('openai', 'OPENAI_API_KEY'),
    resolveKey('groq', 'GROQ_API_KEY'),
    resolveKey('together', 'TOGETHER_API_KEY'),
    getVaultApiKey('suno').catch(() => null).then(k => Boolean(k) || Boolean(process.env.SUNO_API_KEY?.trim())),
    getVaultApiKey('replicate').catch(() => null).then(k => Boolean(k) || Boolean(process.env.REPLICATE_API_TOKEN?.trim())),
  ])

  const hasChatKey = hasOpenAi || hasGroq || hasTogether
  const hasImageKey = hasOpenAi

  const audioProvider: MusicProvider | null = hasSuno
    ? 'suno'
    : hasReplicate
    ? 'musicgen_replicate'
    : null

  const configuredProviders: string[] = []
  if (hasOpenAi) configuredProviders.push('openai')
  if (hasGroq) configuredProviders.push('groq')
  if (hasTogether) configuredProviders.push('together')
  if (hasSuno) configuredProviders.push('suno')
  if (hasReplicate) configuredProviders.push('replicate')

  const note = hasChatKey
    ? audioProvider
      ? `Lyrics, audio (${audioProvider}), and cover art generation available.`
      : 'Lyrics and cover art available. Configure SUNO_API_KEY or Replicate in Admin → AI Providers for audio generation.'
    : 'Configure at least one AI provider (OpenAI, Groq, or Together AI) in Admin → AI Providers to enable Music Studio.'

  return {
    lyricsGeneration: hasChatKey ? 'available' : 'needs_key',
    audioGeneration: audioProvider ? 'available' : 'needs_key',
    coverArtGeneration: hasImageKey ? 'available' : 'needs_key',
    audioProvider,
    message: note,
    available: hasChatKey,
    audioProviderConfigured: Boolean(audioProvider),
    lyricsProviderConfigured: hasChatKey,
    coverArtProviderConfigured: hasImageKey,
    configuredProviders,
    note,
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

export async function getMusicStudioSummaryAsync(): Promise<MusicStudioSummary> {
  const all = await loadMusicArtifactsFromDB(undefined, 1000)
  const byGenre: Record<string, number> = {}
  const byAppSlug: Record<string, number> = {}
  const providers = new Set<string>()

  for (const a of all) {
    byGenre[a.genre] = (byGenre[a.genre] ?? 0) + 1
    byAppSlug[a.appSlug] = (byAppSlug[a.appSlug] ?? 0) + 1
    if (a.musicProvider !== 'blueprint_only') providers.add(a.musicProvider)
  }

  return {
    totalCreated: all.length,
    byGenre,
    byAppSlug,
    lastCreatedAt: all[0]?.generatedAt ?? null,
    providersUsed: Array.from(providers),
  }
}

/** @deprecated Use getMusicStudioSummaryAsync */
export function getMusicStudioSummary(): MusicStudioSummary {
  const all = Array.from(artifactStore.values())
  const byGenre: Record<string, number> = {}
  const byAppSlug: Record<string, number> = {}
  const providers = new Set<string>()

  for (const a of all) {
    byGenre[a.genre] = (byGenre[a.genre] ?? 0) + 1
    byAppSlug[a.appSlug] = (byAppSlug[a.appSlug] ?? 0) + 1
    if (a.musicProvider !== 'blueprint_only') providers.add(a.musicProvider)
  }

  return {
    totalCreated: all.length,
    byGenre,
    byAppSlug,
    lastCreatedAt: all.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0]?.generatedAt ?? null,
    providersUsed: Array.from(providers),
  }
}
