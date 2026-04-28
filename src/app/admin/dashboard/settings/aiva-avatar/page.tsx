'use client'

/**
 * Aiva Avatar Generation — Admin Dashboard
 *
 * Generates, previews, and persists avatar images for each Aiva state.
 * Images are generated via /api/brain/execute (capability=image_generation),
 * saved as Artifacts, then stored in the AivaAvatarConfig table via
 * /api/admin/aiva/avatar-config so AivaAssistant loads them dynamically.
 *
 * Route: /admin/dashboard/settings/aiva-avatar
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Info,
  Save,
  Database,
} from 'lucide-react'
import { AIVA_AVATAR_ASSETS } from '@/components/AivaAssistant'

// ── Types ─────────────────────────────────────────────────────────────────────

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface StateConfig {
  state: AvatarState
  label: string
  expressionHint: string
  targetPath: string
  glowColor: string
}

interface SavedConfig {
  artifactId: string | null
  imageUrl: string
  prompt: string
}

// ── State Definitions ─────────────────────────────────────────────────────────

const STATE_CONFIGS: StateConfig[] = [
  {
    state: 'idle',
    label: 'Idle',
    expressionHint: 'calm neutral expression, soft forward gaze, relaxed posture',
    targetPath: AIVA_AVATAR_ASSETS['idle'],
    glowColor: '#22d3ee',
  },
  {
    state: 'listening',
    label: 'Listening',
    expressionHint: 'attentive expression, head slightly tilted, focused eyes, leaning in subtly',
    targetPath: AIVA_AVATAR_ASSETS['listening'],
    glowColor: '#4ade80',
  },
  {
    state: 'thinking',
    label: 'Thinking',
    expressionHint: 'thoughtful expression, eyes gazing slightly upward, contemplative look',
    targetPath: AIVA_AVATAR_ASSETS['thinking'],
    glowColor: '#fbbf24',
  },
  {
    state: 'speaking',
    label: 'Speaking',
    expressionHint: 'mouth slightly open as if mid-sentence, engaged expression, clear eye contact',
    targetPath: AIVA_AVATAR_ASSETS['speaking'],
    glowColor: '#60a5fa',
  },
  {
    state: 'error',
    label: 'Error',
    expressionHint: 'subtle concerned frown, slight head tilt, empathetic worried look',
    targetPath: AIVA_AVATAR_ASSETS['error'],
    glowColor: '#f87171',
  },
]

function buildPrompt(expressionHint: string): string {
  return (
    `Semi-realistic futuristic female AI assistant avatar, ${expressionHint}, ` +
    `soft cyan-blue holographic aura, glass-panel aesthetic, dark dashboard background, ` +
    `clean SaaS control center look, soft studio lighting, neutral professional appearance, ` +
    `slight transparency effect around edges, square portrait, 512x512, ` +
    `not cartoon, not hyper-realistic, not sexualized, no text, no watermark`
  )
}

// ── PromptBlock ───────────────────────────────────────────────────────────────

function PromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[11px] text-slate-400 leading-relaxed font-mono">{prompt}</p>
      <button onClick={copy} className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 transition">
        {copied ? '✓ Copied' : 'Copy prompt'}
      </button>
    </div>
  )
}

// ── GenerateCard ──────────────────────────────────────────────────────────────

interface GenerateCardProps {
  config: StateConfig
  saved: SavedConfig | null
  onSaved: (state: AvatarState, cfg: SavedConfig) => void
}

function GenerateCard({ config, saved, onSaved }: GenerateCardProps) {
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(saved?.imageUrl || null)
  const [artifactId, setArtifactId] = useState<string | null>(saved?.artifactId || null)
  const [error, setError] = useState<string | null>(null)
  const [customPromptSuffix, setCustomPromptSuffix] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedToAiva, setSavedToAiva] = useState(!!saved?.imageUrl)

  const prompt = buildPrompt(
    config.expressionHint + (customPromptSuffix ? ', ' + customPromptSuffix : ''),
  )

  async function generate() {
    setGenerating(true)
    setError(null)
    setImageUrl(null)
    setArtifactId(null)
    setSavedToAiva(false)
    try {
      const res = await fetch('/api/brain/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: prompt,
          capability: 'image_generation',
          saveArtifact: true,
        }),
      })
      const data = await res.json() as {
        success: boolean; output?: string; outputType?: string;
        artifactId?: string; error?: string; warning?: string;
      }
      if (!data.success) {
        setError(data.error ?? data.warning ?? 'Generation failed')
        return
      }
      const out = data.output ?? ''
      if ((typeof out === 'string') && (out.startsWith('data:') || out.startsWith('http'))) {
        setImageUrl(out)
        setArtifactId(data.artifactId ?? null)
      } else {
        setError('Unexpected output type: ' + (data.outputType ?? 'unknown') + '. Provider may not support image generation.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setGenerating(false)
    }
  }

  async function saveToAiva() {
    if (!imageUrl) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/aiva/avatar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: config.state,
          imageUrl,
          artifactId: artifactId ?? undefined,
          prompt,
        }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) {
        setError(data.error ?? 'Failed to save avatar config')
        return
      }
      setSavedToAiva(true)
      onSaved(config.state, { imageUrl, artifactId, prompt })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function downloadImage() {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    const filename = config.targetPath.split('/').pop() ?? `aiva-${config.state}.png`
    link.download = filename
    link.click()
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: config.glowColor, boxShadow: `0 0 6px ${config.glowColor}` }}
        />
        <span className="text-sm font-semibold text-white">{config.label}</span>
        {savedToAiva && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
            <Database className="h-3 w-3" /> Saved to Aiva
          </span>
        )}
        {!savedToAiva && (
          <span className="ml-auto text-[10px] text-slate-600">{config.targetPath}</span>
        )}
      </div>

      {/* Saved preview */}
      {savedToAiva && saved?.imageUrl && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={saved.imageUrl}
            alt={`Saved Aiva ${config.state} avatar`}
            className="h-12 w-12 rounded-full object-cover"
          />
          <div>
            <p className="text-xs text-emerald-400 font-medium">Active avatar image</p>
            {saved.artifactId && (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">artifact: {saved.artifactId.slice(0, 16)}…</p>
            )}
          </div>
        </div>
      )}

      {/* Expression hint */}
      <p className="text-xs text-slate-500 italic">{config.expressionHint}</p>

      {/* Prompt preview */}
      <PromptBlock prompt={prompt} />

      {/* Custom suffix */}
      <input
        value={customPromptSuffix}
        onChange={e => setCustomPromptSuffix(e.target.value)}
        placeholder="Optional: add extra prompt details…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
      />

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={generating}
        className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-40"
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? 'Generating…' : 'Generate via GenX'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Preview + save + download */}
      {imageUrl && (
        <div className="space-y-2">
          <div
            className="mx-auto rounded-full overflow-hidden border-2"
            style={{ width: 96, height: 96, borderColor: config.glowColor + '66' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Aiva ${config.state} avatar preview`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2 justify-center">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Generated</span>
            {artifactId && <span className="text-[10px] text-slate-500 font-mono">·&nbsp;artifact saved</span>}
          </div>

          {/* Save to Aiva */}
          <button
            onClick={saveToAiva}
            disabled={saving || savedToAiva}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {savedToAiva ? '✓ Saved to Aiva' : saving ? 'Saving…' : 'Save as Aiva Avatar'}
          </button>

          <button
            onClick={downloadImage}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AivaAvatarPage() {
  const [savedConfigs, setSavedConfigs] = useState<Record<AvatarState, SavedConfig | null>>({
    idle: null, listening: null, thinking: null, speaking: null, error: null,
  })
  const [loadingConfigs, setLoadingConfigs] = useState(true)

  // Load existing saved configs on mount
  const loadConfigs = useCallback(async () => {
    setLoadingConfigs(true)
    try {
      const res = await fetch('/api/admin/aiva/avatar-config')
      const data = await res.json() as { config?: Record<string, SavedConfig> }
      if (data.config) {
        setSavedConfigs({
          idle: data.config.idle ?? null,
          listening: data.config.listening ?? null,
          thinking: data.config.thinking ?? null,
          speaking: data.config.speaking ?? null,
          error: data.config.error ?? null,
        })
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingConfigs(false)
    }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  function handleSaved(state: AvatarState, cfg: SavedConfig) {
    setSavedConfigs(prev => ({ ...prev, [state]: cfg }))
  }

  const savedCount = Object.values(savedConfigs).filter(c => c?.imageUrl).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
        <div className="flex items-center gap-3 mb-2">
          <ImageIcon className="h-6 w-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Aiva Avatar Generator</h1>
          {!loadingConfigs && savedCount > 0 && (
            <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
              <Database className="h-3.5 w-3.5" />
              {savedCount}/5 states saved
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Generate avatar images for each Aiva state via the GenX image_generation capability.
          Images are saved as artifacts and stored in the DB — Aiva loads them automatically.
          Falls back to the animated SVG orb if an image is missing.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
        <div className="space-y-1">
          <p className="font-medium">How to use</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Generate each avatar state using the GenX button below (requires image model).</li>
            <li>Click <strong className="text-slate-200">Save as Aiva Avatar</strong> — the image URL is stored in the DB.</li>
            <li>Aiva will immediately use the saved image for that state — no server restart needed.</li>
            <li>If an image fails to load, the animated orb fallback activates automatically.</li>
          </ol>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw className="h-3 w-3" />
        {loadingConfigs
          ? 'Loading saved configs…'
          : savedCount === 5
            ? '✓ All 5 avatar states configured.'
            : `Generate and save all 5 states to complete the avatar set. (${savedCount}/5 saved)`}
      </div>

      {/* State cards */}
      <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
        {STATE_CONFIGS.map(cfg => (
          <GenerateCard
            key={cfg.state}
            config={cfg}
            saved={savedConfigs[cfg.state]}
            onSaved={handleSaved}
          />
        ))}
      </div>

      {/* Style reference */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Style Reference</h2>
        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
          <li>Semi-realistic futuristic female AI assistant</li>
          <li>Clean SaaS control center aesthetic</li>
          <li>Soft cyan/blue holographic glow</li>
          <li>Dark dashboard compatible background</li>
          <li>Glass/AI aesthetic — slight transparency</li>
          <li>Not cartoon, not hyper-real, not sexualized</li>
          <li>512×512 square portrait</li>
        </ul>
        <p className="text-[11px] text-slate-600">
          Tip: Add a custom suffix to fine-tune the result — e.g. &ldquo;wearing a sleek black jacket&rdquo; or &ldquo;holographic UI panels in background&rdquo;.
        </p>
      </div>
    </div>
  )
}
