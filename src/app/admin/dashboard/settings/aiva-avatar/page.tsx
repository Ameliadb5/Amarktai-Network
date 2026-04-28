'use client'

/**
 * Aiva Avatar Generation Helper
 *
 * Admin UI to generate, preview, and slot avatar assets for each Aiva state
 * using the GenX image_generation capability via /api/brain/execute.
 *
 * Outputs: 512×512 PNG files saved to /public/aiva/ (via download — admin
 * manually copies them to the server or uploads to storage).
 *
 * Route: /admin/dashboard/settings/aiva-avatar
 */

import { useState } from 'react'
import {
  Sparkles,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Info,
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

/**
 * Core prompt template for Aiva avatar generation.
 * Insert the expression hint to produce a state-specific image.
 */
function buildPrompt(expressionHint: string): string {
  return (
    `Semi-realistic futuristic female AI assistant avatar, ${expressionHint}, ` +
    `soft cyan-blue holographic aura, glass-panel aesthetic, dark dashboard background, ` +
    `clean SaaS control center look, soft studio lighting, neutral professional appearance, ` +
    `slight transparency effect around edges, square portrait, 512x512, ` +
    `not cartoon, not hyper-realistic, not sexualized, no text, no watermark`
  )
}

// ── Components ────────────────────────────────────────────────────────────────

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
      <button
        onClick={copy}
        className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 transition"
      >
        {copied ? '✓ Copied' : 'Copy prompt'}
      </button>
    </div>
  )
}

interface GenerateCardProps {
  config: StateConfig
}

function GenerateCard({ config }: GenerateCardProps) {
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [customPromptSuffix, setCustomPromptSuffix] = useState('')
  const [saveAsArtifact, setSaveAsArtifact] = useState(false)

  const prompt = buildPrompt(
    config.expressionHint + (customPromptSuffix ? ', ' + customPromptSuffix : ''),
  )

  async function generate() {
    setGenerating(true)
    setError(null)
    setImageUrl(null)
    try {
      const res = await fetch('/api/brain/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: prompt,
          capability: 'image_generation',
          saveArtifact: saveAsArtifact,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? data.warning ?? 'Generation failed')
        return
      }
      const out = data.output
      if (typeof out === 'string' && out.startsWith('data:')) {
        setImageUrl(out)
      } else if (typeof out === 'string' && out.startsWith('http')) {
        setImageUrl(out)
      } else {
        setError('Unexpected output type: ' + data.outputType + '. Provider may not support image generation.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setGenerating(false)
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
        <span className="ml-auto text-[10px] text-slate-600">{config.targetPath}</span>
      </div>

      {/* Expression hint */}
      <p className="text-xs text-slate-500 italic">{config.expressionHint}</p>

      {/* Prompt preview */}
      <PromptBlock prompt={prompt} />

      {/* Custom suffix */}
      <input
        value={customPromptSuffix}
        onChange={e => setCustomPromptSuffix(e.target.value)}
        placeholder="Optional: add extra details to prompt…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400/40"
      />

      {/* Save as artifact toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saveAsArtifact}
          onChange={e => setSaveAsArtifact(e.target.checked)}
          className="accent-cyan-400 h-4 w-4"
        />
        <span className="text-xs text-slate-400">Save as artifact (for versioning &amp; tracking)</span>
      </label>

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={generating}
        className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs text-cyan-400 transition hover:bg-cyan-400/20 disabled:opacity-40"
      >
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {generating ? 'Generating…' : 'Generate via GenX'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Preview + download */}
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
          </div>
          <button
            onClick={downloadImage}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 transition hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Download — save as <code className="text-cyan-400">{config.targetPath}</code>
          </button>
          <p className="text-[10px] text-slate-600 text-center">
            Place the file at <code className="text-slate-400">public{config.targetPath}</code> on the server.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AivaAvatarPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
        <div className="flex items-center gap-3 mb-2">
          <ImageIcon className="h-6 w-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Aiva Avatar Generator</h1>
        </div>
        <p className="text-sm text-slate-400">
          Generate avatar images for each Aiva state using the GenX image_generation capability.
          Assets are saved to <code className="text-cyan-400">/public/aiva/</code>.
          Aiva automatically falls back to the animated SVG orb if an image is missing or fails to load.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
        <div className="space-y-1">
          <p className="font-medium">How to use</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Generate each avatar state using GenX below (requires GENX_API_KEY + image model).</li>
            <li>Download each image and place it at the path shown (e.g. <code className="text-slate-300">public/aiva/avatar-idle.png</code>).</li>
            <li>Restart or redeploy — Aiva will automatically use the images.</li>
            <li>If an image fails to load, the animated orb fallback activates automatically.</li>
          </ol>
        </div>
      </div>

      {/* Regenerate all note */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw className="h-3 w-3" />
        Generate all 5 states to complete the avatar set.
      </div>

      {/* State cards */}
      <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
        {STATE_CONFIGS.map(cfg => (
          <GenerateCard key={cfg.state} config={cfg} />
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
          Tip: Regenerate with a custom suffix to fine-tune the result. E.g. &ldquo;wearing a sleek black jacket&rdquo; or &ldquo;holographic UI panels in background&rdquo;.
        </p>
      </div>
    </div>
  )
}
