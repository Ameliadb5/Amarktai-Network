'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  MessageSquare, Paintbrush, Code2, Mic, Bot, Search,
  ArrowRight, Network,
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
    >
      {children}
    </motion.div>
  )
}

const APPS = [
  {
    suffix: 'Chat',
    icon: MessageSquare,
    description: 'Conversational AI with persistent memory, multi-model routing, and deep context awareness across sessions.',
    features: ['Multi-model selection', 'Persistent conversations', 'Context-aware responses', 'File & image understanding'],
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    suffix: 'Studio',
    icon: Paintbrush,
    description: 'Creative workspace for generating, editing, and iterating on visual content powered by the intelligence layer.',
    features: ['Image generation', 'Style transfer', 'Iterative editing', 'Brand-consistent output'],
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    suffix: 'Code',
    icon: Code2,
    description: 'AI-powered development environment with intelligent code generation, review, and refactoring.',
    features: ['Code generation', 'Automated review', 'Multi-language support', 'Codebase understanding'],
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    suffix: 'Voice',
    icon: Mic,
    description: 'Voice interface layer enabling natural speech interaction across the entire ecosystem.',
    features: ['Speech-to-text', 'Text-to-speech', 'Voice commands', 'Audio processing'],
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    suffix: 'Agents',
    icon: Bot,
    description: 'Autonomous AI agents dispatched across the ecosystem — each with specialised skills and objectives.',
    features: ['18 agent types', 'Async dispatch', 'Multi-step reasoning', 'Tool integration'],
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/10',
    gradient: 'from-cyan-500 to-teal-600',
  },
  {
    suffix: 'Research',
    icon: Search,
    description: 'Deep research engine with web crawling, source synthesis, and citation-backed analysis.',
    features: ['Web crawling', 'Source synthesis', 'Citation tracking', 'Knowledge extraction'],
    color: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/10',
    gradient: 'from-rose-500 to-pink-600',
  },
]

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-[#030712]">
      <Header />

      {/* ── Hero ──────────── */}
      <section className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="ambient-drift absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-600/[0.05] rounded-full blur-[150px]" />
          <div className="ambient-drift absolute bottom-0 left-1/3 w-96 h-96 bg-blue-600/[0.04] rounded-full blur-[120px]" style={{ animationDelay: '-10s' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">
              Ecosystem
            </p>
            <h1 className="font-heading text-5xl sm:text-6xl font-bold leading-[1.02] mb-8 tracking-tight text-white">
              One Brain.<br />
              <span className="gradient-text">Many Applications.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Every app in the ecosystem is powered by the same intelligence core — with its own agent, its own rules, and shared context that makes each one smarter.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Network Illustration ────── */}
      <section className="pb-8 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              {/* Center brain */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.10] flex items-center justify-center">
                <Network className="w-8 h-8 text-blue-400" />
              </div>
              {/* Orbiting apps */}
              {APPS.map((app, i) => {
                const angle = (i / APPS.length) * Math.PI * 2 - Math.PI / 2
                const radius = 140
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius
                return (
                  <div
                    key={app.suffix}
                    className={`absolute w-12 h-12 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-lg`}
                    style={{ left: `calc(50% + ${x}px - 24px)`, top: `calc(50% + ${y}px - 24px)` }}
                  >
                    <app.icon className="w-5 h-5 text-white" />
                  </div>
                )
              })}
              {/* Connection lines (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ left: '-116px', top: '-116px', width: '280px', height: '280px' }}>
                {APPS.map((_, i) => {
                  const angle = (i / APPS.length) * Math.PI * 2 - Math.PI / 2
                  const radius = 140
                  const x = 140 + Math.cos(angle) * radius
                  const y = 140 + Math.sin(angle) * radius
                  return <line key={i} x1="140" y1="140" x2={x} y2={y} stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
                })}
              </svg>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── App Grid ──────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {APPS.map((app, i) => (
            <FadeUp key={app.suffix} delay={i * 0.08}>
              <div className="card-premium p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`inline-flex rounded-xl bg-gradient-to-br ${app.gradient} p-2.5`}>
                    <app.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Amarkt<span className="text-blue-400">AI</span> {app.suffix}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-5 flex-1">{app.description}</p>
                <div className="flex flex-wrap gap-2">
                  {app.features.map(f => (
                    <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Every App. One Brain.
          </h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">
            The ecosystem grows. The intelligence compounds. Each new app makes every other app smarter.
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
