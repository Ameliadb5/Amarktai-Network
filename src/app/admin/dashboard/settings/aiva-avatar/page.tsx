'use client'

/**
 * Aiva Avatar Generation Helper
 *
 * Admin UI to generate, preview, and save avatar assets for each Aiva state
 * using the GenX image_generation capability via /api/brain/execute.
 *
 * Generated images are saved as artifacts and their URLs are persisted in
 * DB settings (/api/admin/aiva/avatar-settings) so AivaAssistant can load
 * them dynamically — no manual file placement required.
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
  Zap,
} from 'lucide-react'
import { AIVA_AVATAR_ASSETS } from '@/components/AivaAssistant'

// ── Avatar State Definitions ─────────────────────────────────────────────────

type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface StateConfig {
  state: AvatarState
  label: string
  expressionHint: string
  targetPath: string
  glowColor: string
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

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

interface GenerateCardProps {
  config: StateConfig
  savedUrl: string | null
  onSaved: (state: AvatarState, url: string) => void
}

function GenerateCard({ config, savedUrl, onSaved }: GenerateCardProps) {
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [artifactId, setArtifactId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customSuffix, setCustomSuffix] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const prompt = buildPrompt(config.expressionHint + (customSuffix ? ', ' + customSuffix : ''))

  async function generate() {
    setGenerating(true); setError(null); setImageUrl(null); setArtifactId(null); setSavedOk(false)
    try {
      const res = await fetch('/api/brain/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: prompt, capability: 'image_generation', saveArtifact: true, metadata: { avatarState: config.state } }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? data.warning ?? 'Generation failed'); return }
      const out = data.output
      if (typeof out === 'string' && (out.startsWith('data:') || out.startsWith('http'))) {
        setImageUrl(out)
        if (data.artifactId) setArtifactId(data.artifactId as string)
      } else {
        setError('Unexpected output type: ' + data.outputType + '. Provider may not support image generation.')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed') }
    finally { setGenerating(false) }
  }

  async function saveAsAivaAvatar() {
    if (!imageUrl) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/aiva/avatar-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: config.state, url: imageUrl }),
      })
      if (!res.ok) throw new Error('Failed to save avatar settings')
      setSavedOk(true)
      onSaved(config.state, imageUrl)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
    finally { setSaving(false) }
  }

  function downloadImage() {
    if (!imageUrl) return
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = config.targetPath.split('/').pop() ?? `aiva-${config.state}.png`
    link.click()
  }

  const displayUrl = imageUrl ?? savedUrl

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: config.glowColor, boxShadow: `0 0 6px ${config.glowColor}` }} />
        <span className="text-sm font-semibold text-white">{config.label}</span>
        {savedUrl && !imageUrl && (
          <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {displayUrl && (
        <div className="mx-auto rounded-full overflow-hidden border-2" style={{ width: 80, height: 80, borderColor: config.glowColor + '66' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayUrl} alt={`Aiva ${config.state} avatar`} className="w-full h-full object-cover" />
        </div>
      )}

      <p className="text-xs text-slate-500 italic">{config.expressionHint}</p>
      <PromptBlock prompt={prompt} />

      <input
        value={customSuffix}
        onChange={e => setCustomSuffix(e.target.value)}
        placeholder="Optional: add extra details to prompt…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
      />

      <button
        onClick={generate}
        disabled={generating}
        className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-40"
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? 'Generating…' : 'Generate via GenX'}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {imageUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 justify-center">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Generated</span>
            {artifactId && <span className="text-[10px] text-slate-600">artifact: {artifactId.slice(0, 8)}…</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveAsAivaAvatar}
              disabled={saving || savedOk}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {savedOk ? 'Saved as Aiva Avatar!' : saving ? 'Saving…' : 'Set as Aiva Avatar'}
            </button>
            <button
              onClick={downloadImage}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AivaAvatarPage() {
  const [savedUrls, setSavedUrls] = useState<Record<string, string | null>>({})
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generateAllProgress, setGenerateAllProgress] = useState<string>('')
  const [generateAllError, setGenerateAllError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/aiva/avatar-settings')
      .then(r => r.json())
      .then(d => {
        const urls = (d as { avatarUrls?: Record<string, string | null> | null }).avatarUrls ?? {}
        setSavedUrls(urls)
        setLoadingSettings(false)
      })
      .catch(() => setLoadingSettings(false))
  }, [])

  const handleSaved = useCallback((state: AvatarState, url: string) => {
    setSavedUrls(prev => ({ ...prev, [state]: url }))
  }, [])

  async function generateAll() {
    setGeneratingAll(true); setGenerateAllError(null); setGenerateAllProgress('Starting…')
    const results: Record<string, string | null> = {}
    for (const cfg of STATE_CONFIGS) {
      setGenerateAllProgress(`Generating ${cfg.label}… (${STATE_CONFIGS.indexOf(cfg) + 1}/${STATE_CONFIGS.length})`)
      try {
        const res = await fetch('/api/brain/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: buildPrompt(cfg.expressionHint), capability: 'image_generation', saveArtifact: true, metadata: { avatarState: cfg.state } }),
        })
        const data = await res.json()
        results[cfg.state] = (data.success && typeof data.output === 'string') ? data.output : null
      } catch { results[cfg.state] = null }
    }
    const urlsToSave = Object.fromEntries(Object.entries(results).filter(([, v]) => v !== null)) as Record<string, string>
    if (Object.keys(urlsToSave).length > 0) {
      setGenerateAllProgress('Saving avatar settings…')
      try {
        const saveRes = await fetch('/api/admin/aiva/avatar-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarUrls: urlsToSave }),
        })
        if (saveRes.ok) setSavedUrls(prev => ({ ...prev, ...urlsToSave }))
      } catch { setGenerateAllError('Generated but failed to save avatar settings.') }
    }
    const failed = STATE_CONFIGS.filter(c => !results[c.state])
    if (failed.length > 0) {
      setGenerateAllError(
        `${STATE_CONFIGS.length - failed.length}/${STATE_CONFIGS.length} states generated. ` +
        `Failed: ${failed.map(c => c.label).join(', ')}. Check GenX / image_generation capability.`,
      )
    }
    setGenerateAllProgress(
      Object.keys(urlsToSave).length === STATE_CONFIGS.length
        ? `All ${STATE_CONFIGS.length} states generated and saved!`
        : `${Object.keys(urlsToSave).length}/${STATE_CONFIGS.length} states saved.`,
    )
    setGeneratingAll(false)
  }

  const savedCount = Object.values(savedUrls).filter(Boolean).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
        <div className="flex items-center gap-3 mb-2">
          <ImageIcon className="h-6 w-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Aiva Avatar Generator</h1>
          {loadingSettings ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500 ml-auto" />
          ) : (
            <span className="ml-auto text-xs text-slate-500">{savedCount}/{STATE_CONFIGS.length} states saved</span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Generate avatar images for each Aiva state using the GenX image_generation capability.
          Images are saved as artifacts and stored in settings — Aiva loads them automatically.
          Falls back to the animated SVG orb if an image is missing or fails to load.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
        <div className="space-y-1">
          <p className="font-medium">How it works</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Click &ldquo;Generate Aiva Avatar Set&rdquo; to generate all 5 states at once (requires GenX image model).</li>
            <li>Or generate and preview individual states below.</li>
            <li>Click &ldquo;Set as Aiva Avatar&rdquo; on any generated image to save it to DB settings.</li>
            <li>Aiva loads saved URLs from the database — no file placement or restart needed.</li>
            <li>If an image fails to load, the animated orb fallback activates automatically.</li>
          </ol>
        </div>
      </div>

      {/* Generate All */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Generate Full Avatar Set</span>
        </div>
        <p className="text-xs text-slate-500">
          Generates all 5 states in sequence via GenX, saves as artifacts, and stores URLs in settings. Aiva will use these images immediately.
        </p>
        <button
          onClick={generateAll}
          disabled={generatingAll}
          className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-sm text-amber-400 transition hover:bg-amber-400/20 disabled:opacity-40"
        >
          {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generatingAll ? generateAllProgress : 'Generate Aiva Avatar Set'}
        </button>
        {generateAllProgress && !generatingAll && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> {generateAllProgress}
          </p>
        )}
        {generateAllError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{generateAllError}
          </div>
        )}
      </div>

      {/* Individual cards */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw className="h-3 w-3" />
        Or generate and set each state individually below.
      </div>

      <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
        {STATE_CONFIGS.map(cfg => (
          <GenerateCard key={cfg.state} config={cfg} savedUrl={savedUrls[cfg.state] ?? null} onSaved={handleSaved} />
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
          Tip: Regenerate with a custom suffix to fine-tune. E.g. &ldquo;wearing a sleek black jacket&rdquo; or &ldquo;holographic UI panels in background&rdquo;.
        </p>
      </div>
    </div>
  )
}
