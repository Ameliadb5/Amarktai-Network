'use client'

import Link from 'next/link'
import { Brain, GitBranch, ShieldCheck, Database, Bot, ArrowRight } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const pillars = [
  { icon: Brain, title: 'Intelligence Core', desc: 'One central decision engine orchestrates all app requests.' },
  { icon: GitBranch, title: 'Provider Orchestration', desc: 'Adaptive routing and fallback across providers and models.' },
  { icon: Database, title: 'Persistent Memory', desc: 'Cross-app memory and knowledge continuity for compound intelligence.' },
  { icon: Bot, title: 'App Agents', desc: 'Dedicated agents per app with scoped capabilities and rules.' },
  { icon: ShieldCheck, title: 'Operator Governance', desc: 'Budgets, controls, policy layers, and auditable execution.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />

      <section className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-70" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <p className="text-label text-cyan-300">Architecture</p>
          <h1 className="text-display mt-4">Amarktai Network is the intelligence system behind multiple products.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
            The platform is engineered as a command network: one super-brain, many app surfaces, controlled capabilities, and operator-level observability.
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

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
          <h2 className="text-headline">Designed for high-signal operators.</h2>
          <p className="mt-4 text-slate-300">Amarktai Network exists for teams building serious AI products with serious reliability, control, and velocity requirements.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/apps" className="btn-ghost">View Ecosystem</Link>
            <Link href="/contact" className="btn-primary">Request Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
