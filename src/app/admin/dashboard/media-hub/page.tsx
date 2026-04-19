'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImageIcon, Mic, Video, Music, ArrowRight } from 'lucide-react'

const tabs = [
  { key: 'images', label: 'Images', icon: ImageIcon, route: '/admin/dashboard/media', desc: 'Multimodal image generation and edit routing.' },
  { key: 'voice', label: 'Voice', icon: Mic, route: '/admin/dashboard/voice', desc: 'Voice persona control and audio pipeline status.' },
  { key: 'video', label: 'Video', icon: Video, route: '/admin/dashboard/video', desc: 'Video generation jobs and output queue.' },
  { key: 'music', label: 'Music', icon: Music, route: '/admin/dashboard/music-studio', desc: 'Music generation, style controls, and exports.' },
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
        <h2 className="text-lg font-semibold text-white">{tab.label}</h2>
        <p className="mt-2 text-sm text-slate-400">{tab.desc}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Live status views</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Result and empty states</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Routing and provider signals</div>
        </div>
        <Link href={tab.route} className="btn-primary mt-5 inline-flex">Open {tab.label} Control <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  )
}
