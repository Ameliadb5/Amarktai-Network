'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  Brain, Shield, Layers, ArrowRight, Cpu, Zap, Database,
  GitBranch, Network, Bot,
} from 'lucide-react'
import Link from 'next/link'

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >{children}</motion.div>
  )
}

const ARCHITECTURE = [
  { icon: GitBranch, title: 'Multi-Provider Orchestration', desc: '13+ AI providers with real fallback chains. Requests route to the optimal model based on capability, cost tier, and provider health.' },
  { icon: Database,  title: 'Persistent Memory Layer',      desc: 'Long-term memory, knowledge graphs, and vector search. Apps share context and compound intelligence over time.' },
  { icon: Bot,       title: 'Per-App Agent System',         desc: 'Every connected app gets a dedicated AI agent — its own persona, capability permissions, safety rules, and budget mode.' },
  { icon: Cpu,       title: 'Async Job Processing',         desc: 'Job queues for video generation, learning tasks, embeddings, and agent dispatch. Full retry and status tracking.' },
  { icon: Network,   title: 'Self-Healing Infrastructure',  desc: 'Circuit breakers, automatic failover, provider health checks, and alert routing. The system recovers without manual intervention.' },
  { icon: Shield,    title: 'Operator Dashboard',           desc: 'Full visibility into routing decisions, provider health, cost burn, alerts, jobs, and app performance — all in one command center.' },
]

const PRINCIPLES = [
  { icon: Zap,       title: 'Adaptive',   desc: 'Routes, scales, and reconfigures in real time based on demand, cost, and provider health.' },
  { icon: Shield,    title: 'Resilient',   desc: 'Self-healing by design. Failures are isolated, recovered from automatically, and learned from.' },
  { icon: Layers,    title: 'Minimal',     desc: 'No bloat. Every component earns its place. Complexity is hidden; simplicity is delivered.' },
  { icon: Brain,     title: 'Purposeful',  desc: 'Every model call, every data flow exists for a measurable reason. Intelligence serves function.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#030712]">
      <Header />

      {/* ── Hero ────────────────────── */}
      <section className="relative pt-40 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="ambient-drift absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[150px]" />
          <div className="ambient-drift absolute top-1/3 right-1/4 w-96 h-96 bg-violet-600/[0.04] rounded-full blur-[120px]" style={{ animationDelay: '-8s' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-blue-400">
              About AmarktAI
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.02] mb-8 tracking-tight text-white">
              The System Behind<br />
              <span className="gradient-text">The Intelligence.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              AmarktAI Network is not a single AI model, not a chatbot, and not a wrapper around someone else&apos;s API. It is a complete multi-app AI operating system — built to power, connect, and continuously improve multiple applications from one intelligence core.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Architecture ────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">Infrastructure</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              What Powers the System
            </h2>
          </FadeUp>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ARCHITECTURE.map((item, i) => (
              <FadeUp key={item.title} delay={i * 0.08}>
                <div className="card-premium p-6 h-full">
                  <item.icon className="h-5 w-5 text-blue-400 mb-4" />
                  <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Principles ──────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeUp className="text-center mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-amber-400">Philosophy</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Design Principles
            </h2>
          </FadeUp>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((item, i) => (
              <FadeUp key={item.title} delay={i * 0.08}>
                <div className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-white/[0.10]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <item.icon className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Built for Serious Operators.
          </h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">
            If you&apos;re building applications that need real intelligence infrastructure — this system was made for you.
          </p>
          <Link
            href="/contact"
            className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-0.5"
          >
            Request Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </FadeUp>
      </section>

      <Footer />
    </div>
  )
}
