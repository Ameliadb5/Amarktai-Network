'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Mic, ShieldCheck, Waves } from 'lucide-react'
import VoiceAccessVisualizer, { VoiceVisualMode } from '@/components/voice/VoiceAccessVisualizer'

const steps = [
  { title: 'Device Permission', note: 'Confirm microphone availability and secure device binding.' },
  { title: 'Voice Enrollment', note: 'Capture enrollment phrases and evaluate waveform consistency.' },
  { title: 'Verification Ready', note: 'Store profile metadata placeholder for future auth backend.' },
]

export default function VoiceEnrollmentPage() {
  const [step, setStep] = useState(0)
  const mode: VoiceVisualMode = step === 0 ? 'idle' : step === 1 ? 'listening' : 'speaking'

  return (
    <div className="space-y-6">
      <Link href="/admin/dashboard/system/voice-access" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Voice Access
      </Link>

      <div className="rounded-2xl border border-white/10 bg-[#071127] p-6">
        <h1 className="text-xl font-bold text-white">Voice Enrollment UI Flow</h1>
        <p className="mt-1 text-sm text-slate-400">Frontend-only setup flow ready for backend enrollment and login verification wiring.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((item, index) => (
          <button key={item.title} onClick={() => setStep(index)} className={`rounded-xl border p-4 text-left ${step === index ? 'border-cyan-400/50 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
            <p className="text-xs uppercase tracking-[0.12em]">Step {index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{item.title}</p>
            <p className="mt-2 text-xs text-slate-400">{item.note}</p>
          </button>
        ))}
      </div>

      <VoiceAccessVisualizer mode={mode} />

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
        <p className="font-semibold text-white">Active state: {steps[step].title}</p>
        <p className="mt-2">{steps[step].note}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1"><Mic className="mr-1 inline h-3 w-3" />Mic status</span>
          <span className="rounded-full bg-white/10 px-3 py-1"><Waves className="mr-1 inline h-3 w-3" />Waveform monitor</span>
          <span className="rounded-full bg-white/10 px-3 py-1"><ShieldCheck className="mr-1 inline h-3 w-3" />Permission state</span>
          <span className="rounded-full bg-white/10 px-3 py-1"><CheckCircle2 className="mr-1 inline h-3 w-3" />Login-ready handoff</span>
        </div>
      </div>
    </div>
  )
}
