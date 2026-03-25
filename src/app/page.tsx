'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Inbox,
  ScanSearch,
  GitBranch,
  Layers,
  GitMerge,
  CheckCircle2,
  ArrowRight,
  Network,
  TrendingUp,
  Split,
  ChevronRight,
  Shield,
  Cpu,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkCanvas from '@/components/NetworkCanvas'

// ─── How it works data ─────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { icon: Inbox,        label: 'App sends a task',            color: 'text-blue-400',   ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10' },
  { icon: ScanSearch,   label: 'AmarktAI analyzes request',   color: 'text-cyan-400',   ring: 'ring-cyan-500/30',   bg: 'bg-cyan-500/10' },
  { icon: GitBranch,    label: 'Best execution path selected', color: 'text-violet-400', ring: 'ring-violet-500/30', bg: 'bg-violet-500/10' },
  { icon: Layers,       label: 'Multiple layers activated',    color: 'text-purple-400', ring: 'ring-purple-500/30', bg: 'bg-purple-500/10' },
  { icon: GitMerge,     label: 'Outputs synthesized',          color: 'text-teal-400',   ring: 'ring-teal-500/30',   bg: 'bg-teal-500/10' },
  { icon: CheckCircle2, label: 'Best result returned',         color: 'text-emerald-400',ring: 'ring-emerald-500/30',bg: 'bg-emerald-500/10' },
]

// ─── Differentiators data ──────────────────────────────────────────────────

const DIFFERENTIATORS = [
  {
    icon: Split,
    title: 'Multi-Model Orchestration',
    body: "When a connected app sends a task, AmarktAI doesn't rely on a single model. It orchestrates across multiple AI providers simultaneously, synthesises the strongest result, and discards weaker outputs — automatically.",
    accent: 'from-blue-500/20 to-cyan-500/10',
    glow: 'hover:shadow-blue-500/10',
    border: 'hover:border-blue-500/30',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: GitBranch,
    title: 'App-Aware Intelligence',
    body: 'Every connected app has its own profile, context, and instructions inside AmarktAI. The system knows which app is sending each request and adapts execution — routing, model selection, and output format — accordingly.',
    accent: 'from-violet-500/20 to-purple-500/10',
    glow: 'hover:shadow-violet-500/10',
    border: 'hover:border-violet-500/30',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: Cpu,
    title: 'Centralised AI Control',
    body: 'One dashboard. Every provider, every model, every app request — monitored and controlled from a single pane. No fragmented API keys scattered across apps. One intelligence layer, centralised authority.',
    accent: 'from-cyan-500/20 to-teal-500/10',
    glow: 'hover:shadow-cyan-500/10',
    border: 'hover:border-cyan-500/30',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Self-Improving Execution',
    body: 'Every execution feeds back into the shared context layer. Confidence scores, execution paths, and outcome signals accumulate — AmarktAI grows more precise with each request across every connected app.',
    accent: 'from-teal-500/20 to-cyan-500/10',
    glow: 'hover:shadow-teal-500/10',
    border: 'hover:border-teal-500/30',
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10',
  },
  {
    icon: Shield,
    title: 'Self-Healing Architecture',
    body: 'If a provider goes down or degrades, AmarktAI detects it, reroutes automatically, and continues execution without disruption. No manual failover. The system corrects itself.',
    accent: 'from-emerald-500/20 to-teal-500/10',
    glow: 'hover:shadow-emerald-500/10',
    border: 'hover:border-emerald-500/30',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: Network,
    title: 'Ecosystem-Wide Intelligence',
    body: "Intelligence doesn't stay siloed in one app. Context, patterns, and knowledge propagate across every connected app in the ecosystem — each new app makes the entire network smarter.",
    accent: 'from-purple-500/20 to-violet-500/10',
    glow: 'hover:shadow-purple-500/10',
    border: 'hover:border-purple-500/30',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <div className="scanline" />
      <Header />

      <main className="min-h-screen bg-[#050816] text-[#F8FAFC]">

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

          {/* NetworkCanvas fills the hero area */}
          <div className="absolute inset-0 z-0">
            <NetworkCanvas
              className="w-full h-full"
              interactive
              activationStep={3}
            />
          </div>

          {/* Dark overlay */}
          <div className="absolute inset-0 z-10 bg-[#050816]/60" />

          {/* Radial vignette */}
          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,transparent_30%,#050816_100%)]" />

          {/* Content */}
          <div className="relative z-20 w-full max-w-3xl mx-auto px-6 flex flex-col items-center text-center gap-8">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass border border-blue-500/20 text-xs font-mono tracking-widest uppercase text-blue-300"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
              </span>
              The Intelligence Layer · Live
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="font-heading text-[clamp(4rem,14vw,9rem)] font-bold leading-none tracking-tight"
            >
              <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="text-[clamp(1rem,2.5vw,1.25rem)] text-slate-300 max-w-2xl leading-relaxed"
            >
              The intelligence layer that routes, coordinates, and powers every connected app in the Amarktai Network ecosystem.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-3"
            >
              <Link href="/apps" className="btn-primary group">
                Explore the Ecosystem
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/about"
                className="px-6 py-3 text-sm font-semibold text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-200 flex items-center gap-2"
              >
                How it Works
                <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65 }}
              className="flex flex-wrap items-center justify-center gap-6 pt-4"
            >
              {[
                { value: 'Multi-Model', label: 'Orchestration' },
                { value: '5+', label: 'Connected Apps' },
                { value: '∞', label: 'Execution Paths' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-white font-heading">{stat.value}</span>
                  <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">{stat.label}</span>
                </div>
              ))}
            </motion.div>

          </div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
          >
            <span className="text-xs text-slate-600 font-mono tracking-widest uppercase">Scroll</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-px h-8 bg-gradient-to-b from-blue-500/40 to-transparent"
            />
          </motion.div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
        <section className="relative py-32 px-6 overflow-hidden">
          <div className="section-divider mb-24" />

          <div className="max-w-6xl mx-auto">
            <FadeUp className="text-center mb-20">
              <p className="text-xs font-mono tracking-widest uppercase text-blue-400/70 mb-4">
                System architecture
              </p>
              <h2 className="font-heading text-4xl md:text-5xl font-bold gradient-text-blue-cyan">
                How <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span> Works
              </h2>
              <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
                Every connected app sends tasks to AmarktAI. The system analyzes, routes, executes across multiple models, and returns the best possible result — automatically.
              </p>
            </FadeUp>

            {/* Flow row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.label} className="flex flex-col md:flex-row items-center gap-3 md:gap-0">
                  <FadeUp delay={i * 0.1} className="flex flex-col items-center">
                    {/* Step card */}
                    <motion.div
                      whileHover={{ scale: 1.06, y: -4 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl glass-card ring-1 ${step.ring} w-[160px]`}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
                        className={`p-3.5 rounded-xl ${step.bg}`}
                      >
                        <step.icon className={`w-6 h-6 ${step.color}`} strokeWidth={1.5} />
                      </motion.div>
                      <p className="text-xs text-center text-slate-300 leading-snug font-medium">
                        {step.label}
                      </p>
                      {/* Step number */}
                      <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#050816] border border-slate-700 text-[10px] text-slate-500 font-mono flex items-center justify-center">
                        {i + 1}
                      </span>
                    </motion.div>
                  </FadeUp>

                  {/* Arrow between steps */}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <FadeUp delay={i * 0.1 + 0.05} className="md:mx-2 flex md:block justify-center">
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                      >
                        <ArrowRight className="w-5 h-5 text-slate-600 rotate-90 md:rotate-0" strokeWidth={1.5} />
                      </motion.div>
                    </FadeUp>
                  )}
                </div>
              ))}
            </div>

            {/* Supporting quote */}
            <FadeUp delay={0.6} className="mt-20 text-center">
              <blockquote className="max-w-2xl mx-auto">
                <p className="text-lg md:text-xl text-slate-300 font-heading leading-relaxed italic">
                  &ldquo;AmarktAI doesn&apos;t just answer questions. It routes, validates, synthesises, and delivers — across every layer of intelligence, for every connected app.&rdquo;
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="w-8 h-px bg-blue-500/50" />
                  <span className="text-xs text-slate-500 font-mono tracking-widest uppercase">Multi-Model · Adaptive · Always On</span>
                  <span className="w-8 h-px bg-blue-500/50" />
                </div>
              </blockquote>
            </FadeUp>
          </div>
        </section>

        {/* ── WHAT MAKES AMARKTAI DIFFERENT ─────────────────────────────── */}
        <section className="relative py-32 px-6 overflow-hidden">
          <div className="section-divider mb-24" />

          {/* Background grid */}
          <div className="absolute inset-0 grid-bg-fine opacity-40 pointer-events-none" />

          <div className="max-w-6xl mx-auto">
            <FadeUp className="text-center mb-20">
              <p className="text-xs font-mono tracking-widest uppercase text-violet-400/70 mb-4">
                Cognitive architecture
              </p>
              <h2 className="font-heading text-4xl md:text-5xl font-bold gradient-text">
                What Makes <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span> Different
              </h2>
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DIFFERENTIATORS.map((card, i) => (
                <FadeUp key={card.title} delay={i * 0.08}>
                  <div
                    className={`relative h-full glass-card rounded-2xl p-8 border border-slate-700/40 ${card.border} shadow-xl ${card.glow} hover:shadow-2xl transition-all duration-400 group overflow-hidden`}
                  >
                    {/* Gradient wash */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none`} />

                    <div className="relative z-10 flex flex-col gap-5 h-full">
                      <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                        <card.icon className={`w-6 h-6 ${card.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <h3 className="font-heading text-xl font-semibold text-white">
                        {card.title}
                      </h3>
                      <p className="text-slate-400 leading-relaxed text-sm flex-1">
                        {card.body}
                      </p>
                      <div className={`flex items-center gap-1.5 text-xs font-mono ${card.iconColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                        <span>Learn more</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────────────────────────── */}
        <section className="relative py-32 px-6">
          <div className="section-divider mb-24" />

          <FadeUp className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
            <p className="text-xs font-mono tracking-widest uppercase text-emerald-400/70">
              Ecosystem online
            </p>
            <h2 className="font-heading text-4xl md:text-5xl font-bold gradient-text">
              Join the Ecosystem
            </h2>
            <p className="text-slate-400 text-lg max-w-md leading-relaxed">
              Explore the connected apps powered by{' '}
              <span className="text-white font-semibold">Amarkt</span><span className="text-blue-400 font-semibold">AI</span>{' '}
              — and see what the intelligence layer makes possible.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link href="/apps" className="btn-primary group">
                Explore Apps
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="px-6 py-3 text-sm font-semibold text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white hover:border-white/20 transition-all duration-200"
              >
                Contact the Team
              </Link>
            </div>
          </FadeUp>
        </section>

      </main>

      <Footer />
    </>
  )
}
