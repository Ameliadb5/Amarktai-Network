'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Mic, Bot, Waves } from 'lucide-react'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'

export default function VoiceAccessSetupPage() {
  const [mode, setMode] = useState<VoiceVisualMode>('idle')

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060e1f] p-6">
        <h1 className="text-2xl font-bold text-white">Voice Access Setup</h1>
        <p className="mt-1 text-sm text-slate-400">Frontend flow for future voice authentication and operator voice access enrollment.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: 'idle', label: 'Idle / Standby', icon: Waves },
          { key: 'listening', label: 'User Voice Active', icon: Mic },
          { key: 'speaking', label: 'AI Speaking', icon: Bot },
        ].map((item) => (
          <button key={item.key} onClick={() => setMode(item.key as VoiceVisualMode)} className={`rounded-xl border px-4 py-3 text-left text-sm ${mode === item.key ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
            <item.icon className="mb-2 h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <VoiceAccessVisualizer mode={mode} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Microphone & permission states</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• Permission pending</li>
            <li>• Permission granted</li>
            <li>• Device unavailable</li>
            <li>• Encrypted capture ready</li>
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Future login-ready flow</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• Enrollment phrase capture</li>
            <li>• Voice signature confirmation</li>
            <li>• Risk signal checkpoint</li>
            <li>• Login handoff placeholder</li>
          </ul>
        </div>
      </div>

      <Link href="/admin/dashboard/system/voice-access/enrollment" className="btn-primary inline-flex">
        Open Enrollment Flow <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
