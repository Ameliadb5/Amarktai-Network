'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  Layers,
  DollarSign,
  ShieldCheck,
  Cpu,
  ScanSearch,
  Database,
  TrendingUp,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Video,
  Search,
  Lock,
  Zap,
  Network,
  Bot,
  GitBranch,
  RefreshCw,
  Inbox,
  Settings2,
  BadgeCheck,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LivingCore from '@/components/LivingCore'
import EcosystemNetwork from '@/components/EcosystemNetwork'

function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

const WHAT_IT_IS = [
  { icon: Brain,       text: 'One central AI brain shared by every connected application.',               color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { icon: Bot,         text: 'Per-app agents that understand each app\'s purpose, rules, and context.',  color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { icon: GitBranch,   text: 'Budget-aware routing to the best model for every request.',                color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { icon: Database,    text: 'Persistent memory and retrieval across conversations and sessions.',       color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { icon: RefreshCw,   text: 'Continuous learning — the system improves from every interaction.',        color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  { icon: ShieldCheck, text: 'Per-app safety rules, policies, and moderation built in.',                color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20' },
]

const CAPABILITIES = [
  { icon: MessageSquare, title: 'Chat & Reasoning',       desc: 'Multi-model conversational AI with full context, reasoning escalation, and consensus validation.',     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',    card: 'bg-blue-500/[0.04]' },
  { icon: ImageIcon,     title: 'Image Generation',       desc: 'DALL·E, FLUX, and HuggingFace image models — standard and specialist — with budget-aware selection.',  color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20',    card: 'bg-pink-500/[0.04]' },
  { icon: Mic,           title: 'Voice — STT & TTS',      desc: 'Whisper STT and multi-provider TTS (Groq, OpenAI, Gemini) with emotion-aware voice personas per app.', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20',card: 'bg-violet-500/[0.04]' },
  { icon: Video,         title: 'Video Generation',       desc: 'Async video job queue via Replicate — budget-aware provider selection, status polling, webhooks.',     color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',    card: 'bg-cyan-500/[0.04]' },
  { icon: Search,        title: 'Search & Research',      desc: 'Deep research with web crawling via Firecrawl, synthesised answers, and source citations.',           color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20',card: 'bg-emerald-500/[0.04]' },
  { icon: Database,      title: 'Embeddings & Retrieval', desc: 'Semantic search over app knowledge via Qdrant. Embedding-capable models only — no text fallback.',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  card: 'bg-amber-500/[0.04]' },
  { icon: ShieldCheck,   title: 'Moderation',             desc: 'Content moderation via dedicated moderation models. Policy output flows into app safety enforcement.', color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20',    card: 'bg-rose-500/[0.04]' },
  { icon: TrendingUp,    title: 'Continuous Learning',    desc: 'Routing outcomes, error rates, and usage patterns feed back into the system — it gets smarter daily.', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20',card: 'bg-indigo-500/[0.04]' },
  { icon: Cpu,           title: 'Agent Dispatch',         desc: '18 agent types (analyst, researcher, coder, planner, moderator…) dispatched sync or async via BullMQ.', color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',  card: 'bg-slate-500/[0.04]' },
]

const HOW_IT_WORKS_STEPS = [
  { icon: Network,    num: '01', title: 'App Connects',          desc: 'Your application connects to the network via the SDK or API with a unique app key.' },
  { icon: Bot,        num: '02', title: 'Agent Created',         desc: 'A dedicated AI agent is configured for your app — capability permissions, budget mode, safety rules, voice persona.' },
  { icon: ScanSearch, num: '03', title: 'Context Analysed',      desc: "Your app's website and docs are crawled and indexed. The agent understands what your app does." },
  { icon: GitBranch,  num: '04', title: 'Requests Routed',       desc: 'Every request is classified by type and complexity, then routed to the optimal provider and model.' },
  { icon: Layers,     num: '05', title: 'App Gets Intelligence', desc: 'Your app receives specialist AI responses — tuned to its context, budget, and safety configuration.' },
]

const APP_TYPES = [
  { label: 'Religious & Faith',        desc: 'Spiritual guidance apps powered by context-aware AI with moderation and safe-mode defaults.' },
  { label: 'Equestrian & Horses',       desc: 'Specialist knowledge for training, health, and equestrian community platforms.' },
  { label: 'Pets & Animals',           desc: 'Veterinary Q&A, breed intelligence, and community apps with trusted, fact-grounded answers.' },
  { label: 'AI Companions',            desc: 'Long-term conversational companions with persistent memory and persona-driven voice.' },
  { label: 'Security & Monitoring',    desc: 'Anomaly detection, alert triage, and intelligent reporting with moderation and safety guardrails.' },
  { label: 'Business & Productivity',  desc: 'Research, drafting, analysis, and workflow automation for serious business tools.' },
  { label: 'Education & Community',    desc: 'Learning platforms with retrieval-augmented answers, moderation, and adaptive responses.' },
  { label: 'Creative & Media',         desc: 'Image, voice, and video generation for content studios, creative tools, and media platforms.' },
]

const DIFFERENTIATORS = [
  { icon: Bot,        title: 'App-Specific Agents',        desc: 'Every connected app gets its own AI agent — its own rules, its own persona, its own capability set. Not a shared generic chatbot.' },
  { icon: DollarSign, title: 'Budget-Aware Orchestration', desc: 'low_cost → balanced → best_quality — per-app budget modes that change the actual model and provider selected, not just a label.' },
  { icon: GitBranch,  title: 'Multi-Provider Routing',     desc: 'OpenAI, Groq, DeepSeek, Anthropic, Gemini, Together, HuggingFace, Replicate — real fallback chains, not single-provider lock-in.' },
  { icon: Lock,       title: 'Per-App Safety & Policy',    desc: 'Content filters, capability restrictions, moderation mode, and adult-content policy — configured per app, enforced at every request.' },
  { icon: Database,   title: 'Memory + Retrieval',         desc: 'Persistent memory via Mem0, knowledge graphs via Graphiti, vector search via Qdrant — apps that actually remember and learn.' },
  { icon: Settings2,  title: 'Central Operator Control',   desc: 'Jobs queue, alerts engine, diagnostics, provider health, budget tracking — full operator visibility in one dashboard.' },
]

const OPERATOR_CONTROLS = [
  { icon: Inbox,      label: 'Job Queue',      desc: 'Video, learning, embedding, and agent jobs — queued, monitored, retried via BullMQ.' },
  { icon: BadgeCheck, label: 'System Alerts',  desc: 'Real-time alerts for provider failures, routing failures, and budget overruns.' },
  { icon: TrendingUp, label: 'Diagnostics',    desc: 'Per-request routing trace — provider chosen, model chosen, cost tier, why candidates were rejected.' },
  { icon: Zap,        label: 'Health Status',  desc: 'Provider health, integration status, readiness checks — all surfaced to the operator.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white overflow-x-hidden">
      <Header />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <LivingCore className="absolute inset-0 z-0 opacity-40" />
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute right-1/4 top-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/4 h-80 w-80 rounded-full bg-cyan-600/[0.08] blur-[100px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}>
            <p className="mb-5 inline-block rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-400">
              The AI Intelligence Layer
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              One Brain.
              <br />
              <span className="gradient-text">Every App You Build.</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            AmarktAI Network is the central intelligence layer powering multiple connected applications.
            Each app gets its own AI agent — with specialist capabilities, per-app rules, budget-aware routing,
            and persistent memory — all managed from one operator dashboard.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Enter Platform <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white hover:-translate-y-0.5"
            >
              Get in Touch
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Divider glow */}
      <div className="pointer-events-none relative h-0">
        <div className="absolute -top-32 left-0 right-0 h-64 bg-gradient-to-r from-transparent via-violet-900/[0.08] to-transparent" />
      </div>

      {/* ── What It Is ─────────────────────────────────────────────── */}
      <Section id="what" className="py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            What AmarktAI Network Actually Is
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Not a wrapper. Not a single-model chatbot. A full intelligence infrastructure that multiple apps share.
          </p>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_IT_IS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.text} className={`flex items-start gap-4 rounded-xl border p-5 ${item.bg}`}>
                  <div className={`mt-0.5 flex-shrink-0`}><Icon className={`h-5 w-5 ${item.color}`} /></div>
                  <p className="text-sm font-medium leading-relaxed text-slate-200">{item.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <Section id="how" className="relative py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-600/5 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            From first connection to specialist AI responses — in five steps.
          </p>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS_STEPS.map((step) => {
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

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <Section id="capabilities" className="relative py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-violet-600/5 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Full Capability Stack
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Every capability routes strictly to the right model class. No text fallbacks for image requests. No fake capability labels.
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon
              return (
                <div key={cap.title} className={`rounded-xl border border-slate-800 ${cap.card} p-6 transition-colors hover:border-slate-700`}>
                  <div className={`inline-flex rounded-lg border p-2 ${cap.bg}`}>
                    <Icon className={`h-5 w-5 ${cap.color}`} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{cap.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{cap.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── App Types ──────────────────────────────────────────────── */}
      <Section id="apps" className="py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Types of Apps It Powers
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Any application that needs specialist, context-aware AI can connect to the network.
          </p>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {APP_TYPES.map((app) => (
              <div key={app.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                <p className="text-sm font-semibold text-white">{app.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{app.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Ecosystem ──────────────────────────────────────────────── */}
      <Section id="ecosystem" className="py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            One Network. Every Application.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Routing patterns, model performance, and usage signals compound across the entire ecosystem.
            Every app benefits from what the others learn.
          </p>
          <div className="mx-auto mt-12 h-[420px] w-full max-w-xl">
            <EcosystemNetwork className="h-full w-full" />
          </div>
        </div>
      </Section>

      {/* ── Why Different ──────────────────────────────────────────── */}
      <Section id="why" className="relative py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-600/[0.04] blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Why It&apos;s Different
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Not another API wrapper. Not a single-model SaaS. A real operator-grade intelligence infrastructure.
          </p>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Operator Controls ──────────────────────────────────────── */}
      <Section id="operator" className="py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Full Operator Visibility
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Complete transparency into what the system is doing — right now, and historically.
          </p>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OPERATOR_CONTROLS.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <Section id="access" className="relative py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/[0.06] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to Connect?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            One intelligence layer. Every application you build from here forward.
            Access the platform or get in touch to discuss deployment.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Enter Platform <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-slate-300 transition-all hover:border-white/20 hover:text-white hover:-translate-y-0.5"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  )
}
