'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, Brain, Layers, ShieldCheck, Cpu, Database,
  MessageSquare, Image as ImageIcon, Mic, Video, Search,
  Lock, Network, Bot, GitBranch, DollarSign,
  Workflow, Package, Music, Code2, Sparkles, FlaskConical,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LivingCore from '@/components/LivingCore'

/* ── Animated section wrapper ──────────────────────────── */
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      ref={ref} id={id}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={className}
    >{children}</motion.section>
  )
}

/* ── Data ──────────────────────────────────────────────── */
const CORE_PILLARS = [
  { icon: Brain,       label: 'Central Super-Brain',   desc: 'One intelligence core shared by every app. Context compounds instead of resetting.', color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { icon: Bot,         label: 'Per-App AI Agents',     desc: 'Each app gets a dedicated agent with its own rules, persona, safety config, and voice.', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { icon: GitBranch,   label: 'Multi-Provider Routing', desc: 'OpenAI, Groq, DeepSeek, Anthropic, Gemini, Together, HuggingFace, Replicate — real fallback chains.', color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { icon: DollarSign,  label: 'Budget-Aware Orchestration', desc: 'Per-app cost modes (low_cost → balanced → best_quality) that change the actual model selected.', color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { icon: Database,    label: 'Persistent Memory',     desc: 'Cross-session memory, knowledge graphs, and vector retrieval — apps that actually learn.', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { icon: ShieldCheck, label: 'Per-App Safety',        desc: 'Content filters, moderation, adult-gating, and capability restrictions — enforced per request.', color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
]

const CAPABILITIES = [
  { icon: MessageSquare, title: 'Chat & Reasoning',       desc: 'Multi-model conversational AI with reasoning escalation and consensus.', color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  { icon: ImageIcon,     title: 'Image Generation',       desc: 'DALL·E, FLUX, and HuggingFace — standard and specialist models.', color: 'text-pink-400',    bg: 'bg-pink-500/10 border-pink-500/20' },
  { icon: Mic,           title: 'Voice (STT & TTS)',      desc: 'Whisper transcription plus multi-provider text-to-speech.', color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  { icon: Video,         title: 'Video Generation',       desc: 'Async video jobs via Replicate with polling and webhooks.', color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { icon: Music,         title: 'Music Generation',       desc: 'Genre, mood, and style-aware music creation with artifact storage.', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { icon: Search,        title: 'Deep Research',          desc: 'Web crawling, synthesised answers, and source citations.', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  { icon: Cpu,           title: 'Agent Dispatch',         desc: '18 agent types dispatched sync or async via job queue.', color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20' },
  { icon: Lock,          title: 'Moderation & Safety',    desc: 'Dedicated moderation models enforce per-app content policies.', color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' },
]

const HOW_IT_WORKS = [
  { num: '01', icon: Network,    title: 'App Connects',          desc: 'Your app connects via SDK or API with a unique app key.' },
  { num: '02', icon: Bot,        title: 'Agent Configured',      desc: 'A dedicated AI agent is set up — capabilities, budget, safety rules, voice persona.' },
  { num: '03', icon: Cpu,        title: 'Context Analysed',      desc: "Your app's docs are crawled and indexed. The agent understands what your app does." },
  { num: '04', icon: GitBranch,  title: 'Requests Routed',       desc: 'Every request is classified and routed to the optimal provider and model.' },
  { num: '05', icon: Layers,     title: 'Intelligence Delivered', desc: 'Your app receives specialist responses tuned to its context, budget, and safety config.' },
]

const STUDIO_FEATURES = [
  { icon: FlaskConical, label: 'Test AI',         desc: 'Chat, code, image, voice, video, research — test any capability live.' },
  { icon: Layers,       label: 'Compare Models',  desc: 'Side-by-side model comparison on the same prompt.' },
  { icon: Code2,        label: 'Create App',      desc: 'AI-powered app scaffolding with refinement and GitHub export.' },
  { icon: ImageIcon,    label: 'Media Studio',    desc: 'Generate images, voice, video, and music in one place.' },
  { icon: Workflow,     label: 'Workflows',        desc: 'Pre-built AI workflow templates — run multi-step AI sequences.' },
  { icon: Package,      label: 'Artifacts',        desc: 'Browse, preview, and download everything the system has created.' },
]

/* ── Page ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white overflow-x-hidden">
      <Header />

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden">
        <LivingCore className="absolute inset-0 z-0 opacity-40" />
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-cyan-600/[0.08] blur-[100px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}>
            <p className="mb-5 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-400">
              Multi-App AI Operating System
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              One Brain.<br />
              <span className="gradient-text">Every App You Build.</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            AmarktAI Network is the central intelligence layer that powers multiple connected applications.
            Each app gets its own AI agent — with per-app rules, budget-aware routing, and persistent memory.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Request Access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white hover:-translate-y-0.5"
            >
              See How It Works
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Divider glow */}
      <div className="pointer-events-none relative h-0">
        <div className="absolute -top-32 left-0 right-0 h-64 bg-gradient-to-r from-transparent via-violet-900/[0.08] to-transparent" />
      </div>

      {/* ── WHAT IT IS ────────────────────────────────────── */}
      <Section id="what" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="mb-3 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-blue-400">
              Core Architecture
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What AmarktAI Network Is
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Not a wrapper. Not a single-model chatbot. A complete multi-app AI operating system.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_PILLARS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={`flex items-start gap-4 rounded-xl border p-5 ${item.bg} transition-colors hover:bg-white/[0.02]`}>
                  <div className="mt-0.5 shrink-0"><Icon className={`h-5 w-5 ${item.color}`} /></div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <Section id="how" className="relative py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-600/5 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="mb-3 inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
              5 Steps
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How It Works</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              From first connection to specialist AI responses — in five steps.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.num} className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="mt-3 text-xs font-mono font-bold text-slate-600">{step.num}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── CAPABILITIES ──────────────────────────────────── */}
      <Section id="capabilities" className="relative py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-violet-600/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="mb-3 inline-block rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-400">
              Full Stack
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What It Can Do</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Every capability routes to the correct model class. No fake labels. No text fallbacks for image requests.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon
              return (
                <div key={cap.title} className="rounded-xl border border-slate-800 bg-white/[0.02] p-5 transition-colors hover:border-slate-700">
                  <div className={`inline-flex rounded-lg border p-2 ${cap.bg}`}>
                    <Icon className={`h-4 w-4 ${cap.color}`} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-white">{cap.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{cap.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── STUDIO ────────────────────────────────────────── */}
      <Section id="studio" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="mb-3 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              <Sparkles className="w-3 h-3 inline-block align-text-bottom mr-1" />
              Built-In Studio
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Test, Create, and Build</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              One place to test AI capabilities, create media, compare models, build apps, and export to GitHub.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STUDIO_FEATURES.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-gradient-to-br from-white/[0.03] to-transparent p-5 transition-colors hover:border-slate-700">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-4 w-4 text-amber-400" />
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── WHY DIFFERENT ─────────────────────────────────── */}
      <Section id="why" className="relative py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-600/[0.04] blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why It&apos;s Different</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Not another API wrapper. A real multi-app AI operating system with operator-grade control.
            </p>
          </div>
          <div className="grid gap-px rounded-2xl border border-slate-800 overflow-hidden bg-slate-800/50">
            {[
              { icon: Bot,        title: 'App-specific agents',  desc: 'Each app gets its own AI agent — its own rules, persona, capabilities, and voice. Not a shared generic chatbot.' },
              { icon: GitBranch,  title: 'Real fallback chains',  desc: '13+ providers. When one fails, traffic routes to the next. No single-provider lock-in.' },
              { icon: Database,   title: 'Apps that remember',   desc: 'Persistent memory, knowledge graphs, and vector search. Context compounds across sessions.' },
              { icon: Lock,       title: 'Operator control',     desc: 'Full visibility: provider health, routing traces, budgets, alerts, jobs — all in one dashboard.' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex items-start gap-4 bg-[#0a0f1a] p-6">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <Section id="access" className="relative py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/[0.06] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="mb-4 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Request Access
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Connect?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            AmarktAI Network is currently available by request.
            Get in touch to discuss deployment and access for your applications.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Request Access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white hover:-translate-y-0.5"
            >
              Learn More
            </Link>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  )
}
