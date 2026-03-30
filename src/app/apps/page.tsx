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
      transition={{ duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
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
    description: 'Conversational AI assistant with persistent memory, multi-model routing, and deep context awareness across sessions.',
    features: ['Multi-model selection', 'Persistent conversations', 'Context-aware responses', 'File & image understanding'],
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
  },
  {
    suffix: 'Studio',
    icon: Paintbrush,
    description: 'Creative workspace for generating, editing, and iterating on visual content powered by the intelligence layer.',
    features: ['Image generation', 'Style transfer', 'Iterative editing', 'Brand-consistent output'],
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
  },
  {
    suffix: 'Code',
    icon: Code2,
    description: 'AI-powered development environment with intelligent code generation, review, and refactoring capabilities.',
    features: ['Code generation', 'Automated review', 'Multi-language support', 'Codebase understanding'],
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  {
    suffix: 'Voice',
    icon: Mic,
    description: 'Voice interface layer enabling natural speech interaction across the entire ecosystem of applications.',
    features: ['Speech-to-text', 'Text-to-speech', 'Voice commands', 'Real-time transcription'],
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
  },
  {
    suffix: 'Agents',
    icon: Bot,
    description: 'Autonomous task execution framework that plans, delegates, and completes multi-step workflows independently.',
    features: ['Task planning', 'Tool integration', 'Autonomous execution', 'Progress reporting'],
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/10',
  },
  {
    suffix: 'Search',
    icon: Search,
    description: 'Intelligent search across documents, data, and the web — returning synthesised answers, not just links.',
    features: ['Semantic search', 'Source synthesis', 'Document indexing', 'Real-time web results'],
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/10',
  },
]

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-600/6 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight text-white"
          >
            The <span className="gradient-text">Ecosystem</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Connected applications powered by one shared intelligence layer.
            Every app in the Amarkt<span className="text-blue-400">AI</span> Network
            makes every other app smarter.
          </motion.p>
        </div>
      </section>

      {/* ── App Grid ─────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {APPS.map((app, i) => (
              <FadeUp key={app.suffix} delay={i * 0.06}>
                <div
                  className={`glass-card rounded-2xl p-6 h-full border ${app.border} transition-colors duration-200 hover:border-opacity-60`}
                >
                  <div className={`w-11 h-11 rounded-xl ${app.bg} flex items-center justify-center mb-5 ${app.color}`}>
                    <app.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-white mb-2">
                    Amarkt<span className="text-blue-400">AI</span> {app.suffix}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    {app.description}
                  </p>
                  <ul className="space-y-1.5">
                    {app.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`w-1 h-1 rounded-full ${app.bg} ${app.color} flex-shrink-0`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Network Effect ───────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A1020]/40 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <FadeUp>
            <div className="glass rounded-3xl p-10 sm:p-14 relative overflow-hidden border border-blue-500/15">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-transparent to-violet-600/8 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-6 border border-blue-500/20">
                  <Network className="w-3 h-3" />
                  Network Effect
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-6">
                  Smarter together
                </h2>
                <div className="space-y-4 text-slate-400 leading-relaxed">
                  <p>
                    Every application in the ecosystem connects to the same orchestration core —
                    the Amarkt<span className="text-blue-400">AI</span> intelligence layer. This means
                    context, memory, and learned behaviour are shared across applications.
                  </p>
                  <p>
                    A conversation in Chat can inform a workflow in Agents. Patterns discovered
                    by Search can sharpen results in Studio. Code context can enhance Voice
                    interactions. Each app contributes signal back to the network.
                  </p>
                  <p>
                    The result is <span className="text-white/80 font-medium">compounding intelligence</span> —
                    a system that gets measurably better with every application and every interaction
                    added to the network.
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <FadeUp>
            <div className="glass rounded-3xl p-12 relative overflow-hidden border border-violet-500/15">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/8 to-blue-600/8 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="relative z-10">
                <h2 className="font-heading text-4xl font-extrabold text-white mb-4">
                  Explore the Intelligence
                </h2>
                <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                  Learn more about the system architecture and principles behind the
                  Amarkt<span className="text-blue-400">AI</span> Network.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/about" className="btn-primary group">
                    About the Network
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                  </Link>
                  <Link href="/contact" className="btn-ghost">
                    Get in Touch
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
