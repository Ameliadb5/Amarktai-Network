'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw, AlertCircle, Mic, Image, Video, MessageSquare, Megaphone,
  Zap, Headphones, Film, Palette, CheckCircle, XCircle,
} from 'lucide-react'

interface MultimodalStatus {
  available: boolean
  supportedContentTypes: string[]
  textGenerationReady: boolean
  imagePromptReady: boolean
  videoConceptReady: boolean
  campaignPlanReady: boolean
  voiceReady: boolean
  statusLabel: string
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } }

const READINESS_ITEMS: {
  key: keyof MultimodalStatus
  label: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
  glow: string
}[] = [
  { key: 'textGenerationReady',  label: 'Text Generation',   description: 'Copy, posts, captions, campaigns',   icon: MessageSquare, color: 'text-blue-400',    glow: 'from-blue-500/20'    },
  { key: 'imagePromptReady',     label: 'Image Prompts',     description: 'AI image generation briefs & DALL-E', icon: Image,         color: 'text-violet-400',  glow: 'from-violet-500/20'  },
  { key: 'videoConceptReady',    label: 'Video & Reels',     description: 'Reel concepts, video production briefs', icon: Film,       color: 'text-rose-400',    glow: 'from-rose-500/20'    },
  { key: 'campaignPlanReady',    label: 'Campaign Plans',    description: 'Full marketing campaign strategy',   icon: Megaphone,     color: 'text-amber-400',   glow: 'from-amber-500/20'   },
  { key: 'voiceReady',           label: 'Voice & TTS',       description: 'Scripts, speech workflows, voice profiles', icon: Mic,     color: 'text-emerald-400', glow: 'from-emerald-500/20' },
]

const VOICE_CONTENT_TYPES = ['voice_script', 'tts_brief', 'speech_workflow', 'voice_profile']
const CREATIVE_CONTENT_TYPES = ['text', 'social_post', 'caption', 'ad_concept', 'brand_voice']
const VISUAL_CONTENT_TYPES = ['image_prompt', 'reel_concept', 'video_concept']
const CAMPAIGN_CONTENT_TYPES = ['campaign_plan', 'content_calendar']

const CONTENT_GROUPS = [
  { title: 'Voice & Audio',          types: VOICE_CONTENT_TYPES,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Headphones },
  { title: 'Creative & Social',      types: CREATIVE_CONTENT_TYPES, color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',      icon: Palette    },
  { title: 'Visual & Video',         types: VISUAL_CONTENT_TYPES,   color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',  icon: Film       },
  { title: 'Campaigns & Planning',   types: CAMPAIGN_CONTENT_TYPES, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',    icon: Megaphone  },
]

export default function MultimodalPage() {
  const [data, setData] = useState<MultimodalStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/multimodal')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const readyCount = data ? READINESS_ITEMS.filter(r => data[r.key] === true).length : 0
  const groupLabel = (ct: string) => ct.replace(/_/g, ' ')

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      {/* ─── Header ──────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-violet-400 text-transparent bg-clip-text">
            Multimodal Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Content generation across text, image, video, voice, and campaign workflows.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/[0.03] rounded-2xl" />)}
          </div>
          <div className="h-48 bg-white/[0.03] rounded-2xl" />
        </div>
      ) : error ? (
        <motion.div variants={fadeUp} className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 font-medium">{error}</p>
          <p className="text-xs text-slate-600 mt-2">Configure at least one AI provider to enable multimodal services.</p>
        </motion.div>
      ) : data ? (
        <>
          {/* ─── Stats Row ────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Content Types', value: String(data.supportedContentTypes?.length ?? 0), color: 'text-white' },
              { label: 'Ready Channels', value: `${readyCount}/${READINESS_ITEMS.length}`, color: readyCount === READINESS_ITEMS.length ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Voice / TTS', value: data.voiceReady ? 'Ready' : 'Not set', color: data.voiceReady ? 'text-emerald-400' : 'text-slate-500' },
              { label: 'Status', value: data.statusLabel?.replace('_', ' ') ?? (data.available ? 'active' : 'unavailable'), color: data.statusLabel === 'operational' ? 'text-emerald-400' : data.statusLabel === 'partial' ? 'text-amber-400' : 'text-red-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 font-mono capitalize ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </motion.div>

          {/* ─── Channel Readiness Grid ───────────────────────── */}
          <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" />
              Channel Readiness
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {READINESS_ITEMS.map(item => {
                const ready = data[item.key] === true
                const Icon = item.icon
                return (
                  <div
                    key={item.key}
                    className={`rounded-2xl p-4 border flex items-start gap-3 transition-all ${
                      ready
                        ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    }`}
                  >
                    <div className={`mt-0.5 p-2 rounded-xl ${ready ? 'bg-gradient-to-br ' + item.glow + ' to-transparent' : 'bg-white/[0.04]'}`}>
                      <Icon className={`w-4 h-4 ${ready ? item.color : 'text-slate-600'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${ready ? 'text-white' : 'text-slate-500'}`}>{item.label}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                      <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${ready ? 'text-emerald-400' : 'text-slate-700'}`}>
                        {ready ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {ready ? 'Ready' : 'Not configured'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* ─── Content Type Groups ──────────────────────────── */}
          {data.supportedContentTypes && data.supportedContentTypes.length > 0 && (
            <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-violet-400" />
                Supported Content Types
              </h2>
              {CONTENT_GROUPS.map(group => {
                const filtered = group.types.filter(t => data.supportedContentTypes.includes(t))
                if (filtered.length === 0) return null
                const GIcon = group.icon
                return (
                  <div key={group.title}>
                    <div className="flex items-center gap-2 mb-2">
                      <GIcon className={`w-3.5 h-3.5 ${group.color}`} />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{group.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filtered.map(ct => (
                        <span key={ct} className={`text-xs px-2.5 py-1 rounded-xl font-mono border ${group.bg} ${group.color}`}>
                          {groupLabel(ct)}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}

          {/* ─── Voice & TTS Info ─────────────────────────────── */}
          <motion.div variants={fadeUp} className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 flex-shrink-0">
              <Mic className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Voice & TTS Support</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Voice scripts, TTS briefs, speech workflow design, and voice profile generation are supported via text model routing.
                Audio generation requires an active OpenAI provider with TTS API access (tts-1 or tts-1-hd models).
                AmarktAI Friends and marketing apps can use multi-voice routing once providers are configured.
              </p>
            </div>
          </motion.div>

          {/* ─── Reels / Video Info ────────────────────────────── */}
          <motion.div variants={fadeUp} className="bg-rose-500/[0.04] border border-rose-500/15 rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-rose-500/10 flex-shrink-0">
              <Video className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Reels & Video Planning</p>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Reel concept generation, video production briefs, and content calendar planning are available through campaign and creative workflows.
                Marketing apps can generate full asset packages including reel scripts, visual direction, and scheduling.
              </p>
            </div>
          </motion.div>
        </>
      ) : null}

      <p className="text-xs text-slate-600">
        Multimodal status depends on configured AI providers. Enable more providers to unlock additional content types.
      </p>
    </motion.div>
  )
}
