'use client'

import Link from 'next/link'
import {
  Brain,
  GitBranch,
  Database,
  Bot,
  ShieldCheck,
  Layers,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const pillars = [
  { icon: Brain, title: 'Intelligence Core', desc: 'A central execution brain that classifies tasks and orchestrates decision paths.' },
  { icon: GitBranch, title: 'Provider Orchestration', desc: 'Adaptive provider/model selection with fallback and capability matching.' },
  { icon: Database, title: 'Memory & Context', desc: 'Shared retrieval and memory layers that can persist useful operational context.' },
  { icon: Bot, title: 'App Agent Runtime', desc: 'Dedicated app agents with scoped behavior, capabilities, and learning flows.' },
  { icon: ShieldCheck, title: 'Governance Layer', desc: 'Budgets, policies, and readiness checks built into system operations.' },
  { icon: Layers, title: 'Unified Surfaces', desc: 'Website, API, and dashboard all map to one underlying operating model.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />

      <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-75" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="text-label text-cyan-300">Architecture</p>
          <h1 className="text-display mt-4 max-w-5xl">Amarktai Network is an AI orchestration infrastructure layer for real product ecosystems.</h1>
          <p className="mt-6 max-w-4xl text-lg text-slate-300">
            It is not a single assistant app. It is a routing and operations system that coordinates models, providers,
            tools, and outputs across multiple application surfaces.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((item) => (
            <div key={item.title} className="card-premium p-6">
              <item.icon className="h-5 w-5 text-blue-300" />
              <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-title">Operational model</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• App sends task through one gateway.</li>
              <li>• Router evaluates capability + provider + economics.</li>
              <li>• Execution returns output, artifacts, and trace telemetry.</li>
              <li>• Operators inspect readiness, events, and costs in dashboard.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-title flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-300" /> Why teams adopt it</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>• Avoid vendor lock to one model/provider.</li>
              <li>• Keep one operator console for many app surfaces.</li>
              <li>• Build multimodal capabilities with controlled complexity.</li>
              <li>• Move from experimental prompts to production AI operations.</li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1226] to-[#040916] p-8 text-center">
          <h2 className="text-headline">Built for high-signal operators, builders, and integration teams.</h2>
          <div className="mt-7 flex justify-center gap-3">
            <Link href="/apps" className="btn-ghost">View Capability Surfaces</Link>
            <Link href="/contact" className="btn-primary">Request Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
