'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Brain, ImageIcon, Mic, Video, Music, Workflow, Code2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const apps = [
  { name: 'Operator Chat', icon: Brain, status: 'Live', desc: 'Reasoning, planning, and action routing across tools and memory.' },
  { name: 'Image Forge', icon: ImageIcon, status: 'Live', desc: 'Generate, edit, and iterate visuals through controlled creative pipelines.' },
  { name: 'Voice Engine', icon: Mic, status: 'Live', desc: 'Voice interaction stack with persona, synthesis, and transcription layers.' },
  { name: 'Video Studio', icon: Video, status: 'Building', desc: 'Prompt-to-video and transformation workflows under one operator surface.' },
  { name: 'Music Studio', icon: Music, status: 'Building', desc: 'Composition and production flows powered by model orchestration.' },
  { name: 'App Builder', icon: Code2, status: 'Live', desc: 'Design and scaffold AI applications from one workspace.' },
  { name: 'Workflow Grid', icon: Workflow, status: 'Live', desc: 'Chain multimodal tasks into reusable automation deployments.' },
]

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />
      <main className="px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-label text-violet-300">Ecosystem</p>
          <h1 className="text-display mt-4">One super-brain. Multiple operator apps.</h1>
          <p className="mt-6 max-w-3xl text-lg text-slate-300">
            Every app in Amarktai Network shares context, routing intelligence, and control layers—so the ecosystem behaves like one cohesive operating system.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <div key={app.name} className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <app.icon className="h-5 w-5 text-blue-300" />
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${app.status === 'Live' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
                    {app.status}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold">{app.name}</h2>
                <p className="mt-2 text-sm text-slate-400">{app.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-title">Access is controlled.</h2>
            <p className="mt-3 text-slate-300">Amarktai Network is not an open public chatbot. It is a gated operator platform for serious teams.</p>
            <Link href="/contact" className="btn-primary mt-6 inline-flex">Request Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
