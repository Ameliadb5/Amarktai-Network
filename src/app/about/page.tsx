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
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >{children}</motion.div>
  )
}

const ARCHITECTURE = [
  { icon: GitBranch, title: 'Multi-Provider Orchestration', desc: '13+ AI providers with real fallback chains. Requests route to the optimal model based on capability, cost tier, and provider health — automatically.' },
  { icon: Database,  title: 'Persistent Memory Layer',      desc: 'Mem0 for long-term memory, Graphiti for knowledge graphs, Qdrant for vector search. Apps share context and learn from each other.' },
  { icon: Bot,       title: 'Per-App Agent System',         desc: 'Every connected app gets a dedicated AI agent. Its own persona, capability permissions, safety rules, voice settings, and budget mode.' },
  { icon: Cpu,       title: 'Async Job Processing',         desc: 'BullMQ-powered job queues for video generation, learning tasks, embeddings, and agent dispatch. Full retry and status tracking.' },
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
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ── Hero ────────────────────── */}
      <section className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="ambient-drift absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="ambient-drift absolute top-1/3 right-1/4 w-96 h-96 bg-violet-600/6 rounded-full blur-[100px]" style={{ animationDelay: '-8s' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}>
            <p className="mb-5 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-400">
              About AmarktAI
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight text-white">
              The System Behind<br />
              <span className="gradient-text">the System</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            AmarktAI Network is the central intelligence layer that orchestrates, monitors,
            and powers an entire ecosystem of connected applications.
          </motion.p>
        </div>
      </section>

      {/* ── Vision ────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-6">
              What we&apos;re building
            </h2>
            <div className="space-y-5 text-slate-400 leading-relaxed text-lg">
              <p>
                Most AI products operate in isolation — a chatbot here, an image tool there. Each duplicates infrastructure,
                loses context between sessions, and starts from zero every time.
              </p>
              <p>
                We&apos;re building <span className="text-white/80 font-medium">one intelligence layer</span> that sits beneath
                an entire ecosystem of applications. Every app connects to the same orchestration core. Insights from one domain
                sharpen performance in another. Context compounds instead of resetting.
              </p>
              <p>
                The result: a platform where each new application makes every existing one smarter.
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Architecture ────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A1020]/50 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <FadeUp className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-cyan-400 mb-5 border border-cyan-500/20">
              <Cpu className="w-3 h-3" />
              Core Architecture
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-4">
              How the intelligence layer works
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A purpose-built AI infrastructure — not a wrapper on a single model.
            </p>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ARCHITECTURE.map((a, i) => {
              const Icon = a.icon
              return (
                <FadeUp key={a.title} delay={i * 0.06}>
                  <div className="glass-card rounded-xl p-6 h-full border border-white/5">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400 border border-blue-500/20">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-heading font-semibold text-white mb-2 text-sm">{a.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{a.desc}</p>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Principles ────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-12">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white">
              Design Principles
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRINCIPLES.map((p, i) => (
              <FadeUp key={p.title} delay={i * 0.06}>
                <div className="glass-card rounded-xl p-6 h-full border border-white/5 text-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-4 text-blue-400 border border-blue-500/20">
                    <p.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Origin ────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A1020]/40 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <FadeUp>
            <div className="glass rounded-2xl p-10 sm:p-12 relative overflow-hidden border border-violet-500/15">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/8 via-transparent to-blue-600/8 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="relative z-10">
                <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-6">
                  Built from conviction
                </h2>
                <div className="space-y-4 text-slate-400 leading-relaxed">
                  <p>
                    AmarktAI started with a simple observation: the AI industry is building thousands of
                    disconnected products that each solve one problem in isolation. The real leverage is in
                    the <span className="text-white/80 font-medium">infrastructure between them</span>.
                  </p>
                  <p>
                    A focused team set out to build the shared intelligence layer — the orchestration core,
                    the memory, the connective tissue that turns individual applications into a compounding network.
                  </p>
                  <p>
                    We&apos;re not chasing hype cycles. We&apos;re engineering the foundation that makes
                    intelligent applications possible at scale.
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── CTA ────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <FadeUp>
            <div className="glass rounded-2xl p-10 relative overflow-hidden border border-blue-500/15">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 to-violet-600/8 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <div className="relative z-10">
                <h2 className="font-heading text-3xl font-extrabold text-white mb-4">
                  Join the Network
                </h2>
                <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                  Whether you want to collaborate, integrate, or learn more — we&apos;d love to hear from you.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contact" className="btn-primary group">
                    Request Access
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                  </Link>
                  <Link href="/apps" className="btn-ghost">
                    Explore the Ecosystem
                  </Link>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </div>
  )
}
