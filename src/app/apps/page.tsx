'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  Brain,
  ImageIcon,
  Camera,
  Mic,
  Video,
  Music,
  Workflow,
  Code2,
  Bot,
  Archive,
  Database,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

const surfaces = [
  { name: 'Operator Chat', icon: Brain, status: 'Live', desc: 'Reasoning, planning, and orchestration-aware chat operations.' },
  { name: 'Image Forge', icon: ImageIcon, status: 'Live', desc: 'Image generation and editing with provider-aware routing.' },
  { name: 'Adult Image Flow', icon: Camera, status: 'Live', desc: 'Controlled adult-mode image generation surface for approved use cases.' },
  { name: 'Voice Engine', icon: Mic, status: 'Live', desc: 'STT/TTS voice execution with persona and routing controls.' },
  { name: 'Video Pipeline', icon: Video, status: 'Live', desc: 'Queue-backed generation and planning for video tasks.' },
  { name: 'Music Studio', icon: Music, status: 'Live', desc: 'Track generation, lyrics, and media artifacts from one panel.' },
  { name: 'Workflow Grid', icon: Workflow, status: 'Live', desc: 'Repeatable multimodal chains for production operations.' },
  { name: 'App Builder', icon: Code2, status: 'Live', desc: 'App creation, test harnesses, and integration preparation tools.' },
  { name: 'App Agents', icon: Bot, status: 'Live', desc: 'Dedicated AI agents mapped to app behavior and constraints.' },
  { name: 'Artifact Library', icon: Archive, status: 'Live', desc: 'Stored image/audio/video/code outputs with operational traceability.' },
  { name: 'Memory Layer', icon: Database, status: 'Live', desc: 'Retrieval-aware context and persistence where enabled in runtime.' },
]

const statusClass = (status: string) =>
  status === 'Live'
    ? 'bg-emerald-400/10 text-emerald-300'
    : 'bg-amber-400/10 text-amber-300'

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />
      <main className="px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-label text-violet-300">Capability surfaces</p>
          <h1 className="text-display mt-4 max-w-5xl">One orchestration system, multiple production-ready AI surfaces.</h1>
          <p className="mt-6 max-w-4xl text-lg text-slate-300">
            Every capability is part of the same operator runtime: shared routing logic, shared policy controls, shared visibility,
            and shared artifact/memory context.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {surfaces.map((app) => (
              <div key={app.name} className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <app.icon className="h-5 w-5 text-blue-300" />
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass(app.status)}`}>
                    {app.status}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold">{app.name}</h2>
                <p className="mt-2 text-sm text-slate-400">{app.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-title">Built for business and builder workflows</h2>
            <p className="mt-3 text-slate-300">
              Teams use Amarktai Network to run multiple revenue-facing AI features under one operating model instead of managing
              disconnected model wrappers and ad-hoc integrations.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="btn-ghost">See Architecture</Link>
              <Link href="/contact" className="btn-primary">Request Access <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
