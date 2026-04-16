'use client'

import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  MessageSquare, Paintbrush, Code2, Mic, Bot, Search,
  ArrowRight, Brain, Film, Music, ShieldCheck,
  Workflow, Globe, BarChart3, Smartphone, BookOpen,
  FileText, Lightbulb, Headphones, Camera,
  type LucideIcon,
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

/* ── Ecosystem Data ─────────────────────────── */

interface EcoApp {
  name: string
  icon: LucideIcon
  description: string
  status: 'live' | 'building' | 'planned'
  gradient: string
}

interface EcoCategory {
  label: string
  description: string
  accent: string
  apps: EcoApp[]
}

const CATEGORIES: EcoCategory[] = [
  {
    label: 'Communication & Intelligence',
    description: 'Core conversation, reasoning, and research capabilities',
    accent: 'blue',
    apps: [
      { name: 'Chat', icon: MessageSquare, description: 'Multi-turn conversational AI with persistent memory and deep context awareness.', status: 'live', gradient: 'from-blue-500 to-blue-600' },
      { name: 'Research', icon: Search, description: 'Deep research engine with source synthesis and citation-backed analysis.', status: 'live', gradient: 'from-indigo-500 to-blue-600' },
      { name: 'Agents', icon: Bot, description: 'Autonomous AI agents — each with specialised skills, objectives, and tool access.', status: 'live', gradient: 'from-cyan-500 to-blue-600' },
      { name: 'Insights', icon: Lightbulb, description: 'Automated intelligence extraction and pattern recognition across data.', status: 'planned', gradient: 'from-sky-500 to-blue-600' },
    ],
  },
  {
    label: 'Creative & Media',
    description: 'Visual, audio, and video creation tools',
    accent: 'violet',
    apps: [
      { name: 'Studio', icon: Paintbrush, description: 'Creative workspace for generating, editing, and iterating on visual content.', status: 'live', gradient: 'from-violet-500 to-purple-600' },
      { name: 'Video', icon: Film, description: 'AI-driven video generation, editing, and transformation.', status: 'live', gradient: 'from-pink-500 to-rose-600' },
      { name: 'Music', icon: Music, description: 'Compose, produce, and master audio tracks with AI assistance.', status: 'live', gradient: 'from-fuchsia-500 to-purple-600' },
      { name: 'Camera', icon: Camera, description: 'Intelligent image processing, enhancement, and visual understanding.', status: 'planned', gradient: 'from-purple-500 to-violet-600' },
    ],
  },
  {
    label: 'Voice & Audio',
    description: 'Speech, voice, and audio processing',
    accent: 'amber',
    apps: [
      { name: 'Voice', icon: Mic, description: 'Full voice interface — speech-to-text, text-to-speech, and voice commands.', status: 'live', gradient: 'from-amber-500 to-orange-600' },
      { name: 'Podcast', icon: Headphones, description: 'AI-assisted podcast production, editing, and transcription.', status: 'planned', gradient: 'from-orange-500 to-amber-600' },
    ],
  },
  {
    label: 'Development & Automation',
    description: 'Build, ship, and automate with AI',
    accent: 'emerald',
    apps: [
      { name: 'Code', icon: Code2, description: 'AI-powered development with intelligent code generation, review, and refactoring.', status: 'live', gradient: 'from-emerald-500 to-green-600' },
      { name: 'Workflows', icon: Workflow, description: 'Chain tasks into intelligent automation pipelines across the ecosystem.', status: 'building', gradient: 'from-teal-500 to-emerald-600' },
      { name: 'Apps', icon: Smartphone, description: 'Scaffold and build entire applications from natural language descriptions.', status: 'planned', gradient: 'from-green-500 to-emerald-600' },
    ],
  },
  {
    label: 'Business & Analytics',
    description: 'Intelligence for business operations',
    accent: 'rose',
    apps: [
      { name: 'Analytics', icon: BarChart3, description: 'AI-powered analytics, reporting, and business intelligence.', status: 'planned', gradient: 'from-rose-500 to-pink-600' },
      { name: 'Content', icon: FileText, description: 'Long-form content creation, editing, and optimisation at scale.', status: 'planned', gradient: 'from-pink-500 to-rose-600' },
      { name: 'Portal', icon: Globe, description: 'Public-facing interfaces and client portals powered by the network.', status: 'planned', gradient: 'from-red-500 to-rose-600' },
    ],
  },
  {
    label: 'Trust & Governance',
    description: 'Safety, compliance, and operational controls',
    accent: 'slate',
    apps: [
      { name: 'Guard', icon: ShieldCheck, description: 'Content moderation, safety filters, and compliance enforcement.', status: 'live', gradient: 'from-slate-500 to-zinc-600' },
      { name: 'Docs', icon: BookOpen, description: 'Auto-generated documentation, knowledge bases, and learning resources.', status: 'planned', gradient: 'from-zinc-500 to-slate-600' },
    ],
  },
]

const STATUS_CONFIG = {
  live:     { label: 'Live',     dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  building: { label: 'Building', dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/10' },
  planned:  { label: 'Planned',  dot: 'bg-slate-500',   text: 'text-slate-500',   bg: 'bg-slate-500/10' },
}

const ACCENT_MAP: Record<string, string> = {
  blue: 'text-blue-400 border-blue-500/20',
  violet: 'text-violet-400 border-violet-500/20',
  amber: 'text-amber-400 border-amber-500/20',
  emerald: 'text-emerald-400 border-emerald-500/20',
  rose: 'text-rose-400 border-rose-500/20',
  slate: 'text-slate-400 border-slate-500/20',
}

/* ── Page ──────────────────────────────────── */

export default function EcosystemPage() {
  const [filter, setFilter] = useState<'all' | 'live' | 'building' | 'planned'>('all')

  const totalApps = CATEGORIES.reduce((a, c) => a + c.apps.length, 0)
  const liveApps = CATEGORIES.reduce((a, c) => a + c.apps.filter(app => app.status === 'live').length, 0)

  return (
    <div className="min-h-screen bg-[#030712]">
      <Header />

      {/* ── Hero ──────────── */}
      <section className="relative pt-40 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
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
              One Platform.<br />
              <span className="gradient-text">Infinite Possibilities.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Every application in the Amarktai ecosystem is powered by a shared intelligence core — with its own agent, its own rules, and context that compounds across the entire network.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ─────── */}
      <section className="pb-12 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-5xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: `${totalApps}`, label: 'Ecosystem Apps', color: 'text-blue-400' },
              { value: `${liveApps}`, label: 'Live Now', color: 'text-emerald-400' },
              { value: `${CATEGORIES.length}`, label: 'Categories', color: 'text-violet-400' },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 text-center">
                <p className={`text-3xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ── Filter Tabs ───── */}
      <section className="pb-4 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2">
            {(['all', 'live', 'building', 'planned'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {f === 'all' ? 'All Apps' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ── Categorized App Grid ───── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          {CATEGORIES.map((category, catIndex) => {
            const filteredApps = filter === 'all' ? category.apps : category.apps.filter(a => a.status === filter)
            if (filteredApps.length === 0) return null
            const accentClasses = ACCENT_MAP[category.accent] ?? ACCENT_MAP.blue
            const [accentText] = accentClasses.split(' ')

            return (
              <FadeUp key={category.label} delay={catIndex * 0.08}>
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1 h-6 rounded-full bg-gradient-to-b ${category.apps[0] ? category.apps[0].gradient : 'from-blue-500 to-blue-600'}`} />
                    <h2 className={`text-lg font-bold tracking-tight ${accentText}`}>{category.label}</h2>
                  </div>
                  <p className="text-sm text-slate-500 ml-[19px]">{category.description}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {filteredApps.map((app, i) => {
                      const status = STATUS_CONFIG[app.status]
                      const Icon = app.icon
                      return (
                        <motion.div
                          key={app.name}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3, delay: i * 0.04 }}
                          className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                        >
                          {/* Status indicator */}
                          <div className="flex items-center justify-between mb-4">
                            <div className={`inline-flex rounded-xl bg-gradient-to-br ${app.gradient} p-2.5 shadow-lg`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              {status.label}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white mb-1.5">
                            Amarktai {app.name}
                          </h3>
                          <p className="text-[12px] text-slate-400 leading-relaxed">{app.description}</p>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </FadeUp>
            )
          })}
        </div>
      </section>

      {/* ── Network Vision ──── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#0d1424]/80 to-[#030712] p-10 sm:p-14 text-center relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[120px]" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center mb-6">
                <Brain className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                The Network Effect
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto leading-relaxed mb-8">
                Every new app added to the ecosystem makes every existing app smarter. Shared memory, cross-app context, and compounding intelligence — this is what sets Amarktai Network apart.
              </p>
              <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
                {[
                  { value: 'Shared', label: 'Memory' },
                  { value: 'Cross-App', label: 'Context' },
                  { value: 'Compound', label: 'Intelligence' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-sm font-bold text-blue-400">{item.value}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── CTA ───────────── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8">
        <FadeUp className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Built to Grow With You.
          </h2>
          <p className="text-slate-400 mb-10 max-w-xl mx-auto">
            The ecosystem is expanding. Whether you need one app or thirty, Amarktai Network scales — and every addition strengthens the whole.
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
