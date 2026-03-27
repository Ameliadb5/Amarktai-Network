'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle, Mic, Image, Video, MessageSquare, Megaphone, Zap } from 'lucide-react'

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

const READINESS_ITEMS: {
  key: keyof MultimodalStatus
  label: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
}[] = [
  { key: 'textGenerationReady',  label: 'Text Generation',   description: 'Copy, posts, captions, campaigns',   icon: MessageSquare, color: 'text-blue-400'    },
  { key: 'imagePromptReady',     label: 'Image Prompts',     description: 'AI image generation briefs',         icon: Image,         color: 'text-violet-400'  },
  { key: 'videoConceptReady',    label: 'Video Concepts',    description: 'Reel & video production briefs',     icon: Video,         color: 'text-rose-400'    },
  { key: 'campaignPlanReady',    label: 'Campaign Plans',    description: 'Full marketing campaign strategy',   icon: Megaphone,     color: 'text-amber-400'   },
  { key: 'voiceReady',           label: 'Voice & TTS',       description: 'Scripts, briefs, voice profiles',    icon: Mic,           color: 'text-emerald-400' },
]

const VOICE_CONTENT_TYPES = ['voice_script', 'tts_brief', 'speech_workflow', 'voice_profile']
const CREATIVE_CONTENT_TYPES = ['text', 'social_post', 'caption', 'ad_concept', 'brand_voice']
const VISUAL_CONTENT_TYPES = ['image_prompt', 'reel_concept', 'video_concept']
const CAMPAIGN_CONTENT_TYPES = ['campaign_plan', 'content_calendar']

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

  const renderContentGroup = (title: string, types: string[], color: string, available: string[]) => {
    const filtered = types.filter(t => available.includes(t))
    if (filtered.length === 0) return null
    return (
      <div key={title}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
        <div className="flex flex-wrap gap-2">
          {filtered.map(ct => (
            <span key={ct} className={`text-xs px-2 py-1 rounded-lg font-mono border ${color}`}>
              {groupLabel(ct)}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-rose-400" />
            Multimodal Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Content generation capabilities — text, image, video, voice, and campaigns.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#0A1020] border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-slate-600 mt-2">Configure at least one AI provider to enable multimodal services.</p>
        </div>
      ) : data ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Content Types</p>
              <p className="text-2xl font-bold text-white mt-1">{data.supportedContentTypes?.length ?? 0}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Ready Channels</p>
              <p className="text-2xl font-bold text-white mt-1">{readyCount} / {READINESS_ITEMS.length}</p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Voice / TTS</p>
              <p className={`text-2xl font-bold mt-1 ${data.voiceReady ? 'text-emerald-400' : 'text-slate-600'}`}>
                {data.voiceReady ? 'Ready' : 'Not set'}
              </p>
            </div>
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-4">
              <p className="text-xs text-slate-500">Status</p>
              <p className={`text-2xl font-bold mt-1 capitalize ${
                data.statusLabel === 'operational' ? 'text-emerald-400' :
                data.statusLabel === 'partial' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {data.statusLabel?.replace('_', ' ') ?? (data.available ? 'active' : 'unavailable')}
              </p>
            </div>
          </div>

          {/* Channel readiness grid */}
          <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-4">Channel Readiness</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {READINESS_ITEMS.map(item => {
                const ready = data[item.key] === true
                const Icon = item.icon
                return (
                  <div
                    key={item.key}
                    className={`rounded-xl p-4 border flex items-start gap-3 ${
                      ready
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-white/[0.02] border-white/8'
                    }`}
                  >
                    <div className={`mt-0.5 ${ready ? item.color : 'text-slate-600'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${ready ? 'text-white' : 'text-slate-500'}`}>{item.label}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                      <p className={`text-xs mt-1 font-medium ${ready ? 'text-emerald-400' : 'text-slate-700'}`}>
                        {ready ? '● Ready' : '○ Not configured'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Content type groups */}
          {data.supportedContentTypes && data.supportedContentTypes.length > 0 && (
            <div className="bg-[#0A1020] border border-white/8 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Supported Content Types</h2>
              {renderContentGroup('Voice & Audio', VOICE_CONTENT_TYPES, 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', data.supportedContentTypes)}
              {renderContentGroup('Creative & Social', CREATIVE_CONTENT_TYPES, 'text-blue-400 bg-blue-500/10 border-blue-500/20', data.supportedContentTypes)}
              {renderContentGroup('Visual & Video', VISUAL_CONTENT_TYPES, 'text-violet-400 bg-violet-500/10 border-violet-500/20', data.supportedContentTypes)}
              {renderContentGroup('Campaigns & Planning', CAMPAIGN_CONTENT_TYPES, 'text-amber-400 bg-amber-500/10 border-amber-500/20', data.supportedContentTypes)}
            </div>
          )}

          {/* Voice note */}
          <div className="bg-[#0A1020] border border-emerald-500/15 rounded-xl p-4 flex items-start gap-3">
            <Mic className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Voice & TTS Support</p>
              <p className="text-xs text-slate-500 mt-1">
                Voice scripts, TTS briefs, speech workflow design, and voice profile generation are supported via text model routing.
                Audio generation requires an active OpenAI provider with TTS API access (tts-1 or tts-1-hd models).
                AmarktAI Friends and marketing apps can use multi-voice routing once providers are configured.
              </p>
            </div>
          </div>
        </>
      ) : null}

      <p className="text-xs text-slate-600">
        Multimodal status depends on configured AI providers. Enable more providers to unlock additional content types.
      </p>
    </div>
  )
}
