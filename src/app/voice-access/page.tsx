'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'
import { Mic, Waves, Bot, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function VoiceAccessPreviewPage() {
  const [mode, setMode] = useState<VoiceVisualMode>('idle')

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-36 sm:px-6 lg:px-8">
        <p className="text-label text-cyan-300">Future Voice Login</p>
        <h1 className="text-headline mt-4">Voice access visual system preview.</h1>
        <p className="mt-4 max-w-2xl text-slate-300">This frontend flow is prepared for future voice authentication integration across Amarktai Network operator surfaces.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { key: 'idle', label: 'Idle', icon: Waves },
            { key: 'listening', label: 'User Voice Active', icon: Mic },
            { key: 'speaking', label: 'AI Speaking', icon: Bot },
          ].map((item) => (
            <button key={item.key} onClick={() => setMode(item.key as VoiceVisualMode)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${mode === item.key ? 'border-cyan-400/60 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
              <item.icon className="mb-2 h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <VoiceAccessVisualizer mode={mode} />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-base font-semibold">Integration status</h2>
          <p className="mt-2 text-sm text-slate-300">UI flow complete. Backend authentication handoff pending future phase.</p>
          <Link href="/contact" className="btn-primary mt-5 inline-flex">Request Platform Access <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
