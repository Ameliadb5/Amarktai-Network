'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImageIcon, Mic, Video, Music, ArrowRight } from 'lucide-react'

const tabs = [
  {
    key: 'images',
    label: 'Images',
    icon: ImageIcon,
    route: '/admin/dashboard/media',
    desc: 'Generate, edit, and manage images. Inline preview, save, and download.',
    links: [
      { label: 'Go to Images', href: '/admin/dashboard/media' },
      { label: 'Open Workspace → Images', href: '/admin/dashboard/workspace' },
    ],
  },
  {
    key: 'voice',
    label: 'Voice',
    icon: Mic,
    route: '/admin/dashboard/voice',
    desc: 'TTS with multiple voices and accents. Voice access and login bridge setup.',
    links: [
      { label: 'Go to Voice', href: '/admin/dashboard/voice' },
      { label: 'Voice Access Setup', href: '/admin/dashboard/system/voice-access' },
      { label: 'Voice Login Bridge', href: '/admin/voice-login' },
    ],
  },
  {
    key: 'video',
    label: 'Video',
    icon: Video,
    route: '/admin/dashboard/video',
    desc: 'Video generation via Replicate (Wan2.1, MiniMax) and HuggingFace ZeroScope.',
    links: [
      { label: 'Go to Video', href: '/admin/dashboard/video' },
      { label: 'Open Workspace → Video', href: '/admin/dashboard/workspace' },
    ],
  },
  {
    key: 'music',
    label: 'Music',
    icon: Music,
    route: '/admin/dashboard/music-studio',
    desc: 'Music generation with lyrics, genre, mood, vocal style, and cover art.',
    links: [
      { label: 'Go to Music Studio', href: '/admin/dashboard/music-studio' },
      { label: 'Open Workspace → Music', href: '/admin/dashboard/workspace' },
    ],
  },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function MediaHubPage() {
  const [active, setActive] = useState<TabKey>('images')
  const tab = tabs.find(t => t.key === active) ?? tabs[0]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f162c] to-[#070d1a] p-6">
        <h1 className="text-2xl font-bold text-white">Media</h1>
        <p className="mt-1 text-sm text-slate-400">Unified media command area for images, voice, video, and music.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setActive(item.key)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${active === item.key ? 'border-cyan-400/40 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      <div className="card-premium p-6">
        <div className="flex items-center gap-3 mb-3">
          <tab.icon className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">{tab.label}</h2>
        </div>
        <p className="text-sm text-slate-400">{tab.desc}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {tab.links.map(l => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-all">
              {l.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
