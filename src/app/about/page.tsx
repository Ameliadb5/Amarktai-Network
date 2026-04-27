'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Zap, GitBranch, Database, Bot, ShieldCheck, Layers,
  ArrowRight, MessageSquare, AppWindow, ChevronRight,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const pillars = [
  {
    icon: Zap,
    title: 'GenX Execution Layer',
    desc: 'The primary AI execution brain. Every request routes through GenX, which selects the best model for the task, capability class, and cost tier.',
    accent: 'text-cyan-400',
  },
  {
    icon: GitBranch,
    title: 'Provider Orchestration',
    desc: 'Adaptive routing across multiple AI providers with fallback logic, capability matching, and policy-controlled cost management.',
    accent: 'text-blue-400',
  },
  {
    icon: Database,
    title: 'Memory & Context',
    desc: 'Cross-session retrieval and context persistence for apps that need intelligent continuity across requests.',
    accent: 'text-violet-400',
  },
  {
    icon: Bot,
    title: 'App Agent Runtime',
    desc: 'App-scoped agents with dedicated behavior constraints, capability policies, and per-app model selection.',
    accent: 'text-emerald-400',
  },
  {
    icon: ShieldCheck,
    title: 'Policy & Governance',
    desc: 'Provider keys, capability restrictions, adult content controls, and execution policies built into the orchestration core.',
    accent: 'text-amber-400',
  },
  {
    icon: Layers,
    title: 'Unified Operator Surface',
    desc: 'Website, API, and admin console all map to one underlying operating model — one place to build, test, and deploy.',
    accent: 'text-rose-400',
  },
]

const routingFlow = [
  { label: 'App sends task',            detail: 'Task type, app identity, and capability context attached.' },
  { label: 'GenX classifies',          detail: 'Routes to best model tier: best / balanced / cheap / fixed.' },
  { label: 'Policy check',             detail: 'Capability permissions, adult flags, fallback rules evaluated.' },
  { label: 'Execution',                detail: 'Model called with memory hooks and runtime observability.' },
  { label: 'Output + artifact',        detail: 'Response stored as artifact with provider/model metadata.' },
  { label: 'Operator trace',           detail: 'Events, usage, and artifacts visible in the operator console.' },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.48, delay },
})

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-label text-cyan-300"
          >
            Architecture
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-display mt-4 max-w-5xl"
          >
            Amarkt<span className="text-blue-400">AI</span> Network is an AI orchestration infrastructure layer — not an assistant, not a wrapper.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-6 max-w-3xl text-lg text-slate-300"
          >
            It routes AI tasks through GenX — the primary execution engine — which selects the right model, applies policies, handles fallback, and returns structured output. Built for operators running multiple AI products, not for one-off prompting.
          </motion.p>
        </div>
      </section>

      {/* ── Architecture pillars ─────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp()}>
            <p className="text-label text-blue-300">Core architecture</p>
            <h2 className="text-headline mt-3">Six layers that make the system work.</h2>
          </motion.div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                {...fadeUp(i * 0.07)}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                <p.icon className={`h-5 w-5 ${p.accent}`} />
                <h3 className="mt-4 text-base font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Routing flow — horizontal visual ─────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp()}>
            <p className="text-label text-violet-300">Execution flow</p>
            <h2 className="text-headline mt-3">How a task moves through the system.</h2>
          </motion.div>

          <div className="mt-10 flex flex-col gap-0">
            {routingFlow.map((step, i) => (
              <motion.div
                key={step.label}
                {...fadeUp(i * 0.07)}
                className="relative flex items-start gap-5 py-4"
              >
                {/* Connector line */}
                {i < routingFlow.length - 1 && (
                  <div className="absolute left-[14px] top-9 h-full w-px bg-gradient-to-b from-white/20 to-transparent" />
                )}
                {/* Step index */}
                <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[11px] font-bold text-slate-400">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{step.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differentiators split panel ───────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <motion.div
            {...fadeUp()}
            className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-[#061828] to-[#040d1a] p-7"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-cyan-400" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-400">GenX first</p>
            </div>
            <h2 className="text-lg font-semibold text-white">Not a chatbot wrapper.</h2>
            <p className="mt-2 text-sm text-slate-400">GenX routes to the best model for each task. You are not locked to one provider. Policy, fallback, and cost logic are built in — not bolted on.</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" /> Multi-provider, not single-model dependent</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" /> Cost-tier model selection (best / balanced / cheap)</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" /> Automatic fallback when GenX is unreachable</li>
            </ul>
          </motion.div>

          <motion.div
            {...fadeUp(0.1)}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7"
          >
            <div className="flex items-center gap-2 mb-4">
              <AppWindow className="h-4 w-4 text-violet-400" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-400">Operator control</p>
            </div>
            <h2 className="text-lg font-semibold text-white">Built for product operators.</h2>
            <p className="mt-2 text-sm text-slate-400">Not a prompt playground. The operator console manages apps, agents, artifacts, GitHub repos, deployments, and provider configuration from one interface.</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-violet-400 shrink-0" /> Multiple app surfaces under one routing brain</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-violet-400 shrink-0" /> Workspace → GitHub → deploy in one flow</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 text-violet-400 shrink-0" /> Artifacts, events, and traces in one view</li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          {...fadeUp(0.15)}
          className="mx-auto mt-10 max-w-6xl rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">For builders running production AI workloads.</h2>
            <p className="mt-1 text-sm text-slate-400">Request access for teams that need orchestration quality, reliability, and real operational visibility.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/apps" className="btn-ghost whitespace-nowrap">
              <MessageSquare className="h-4 w-4" /> Capabilities
            </Link>
            <Link href="/contact" className="btn-primary whitespace-nowrap">
              Request Access <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
