'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  MessageSquare,
  ImageIcon,
  Mic,
  Video,
  Bot,
  Workflow,
  Archive,
  Database,
  Zap,
  FolderGit2,
  Rocket,
  AppWindow,
  Settings2,
  ChevronRight,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const capabilities = [
  { icon: MessageSquare, label: 'Chat & Reasoning',    desc: 'Task-aware routing across language models.' },
  { icon: ImageIcon,     label: 'Image Generation',    desc: 'High-fidelity visuals with provider fallback.' },
  { icon: Mic,           label: 'Voice Stack',          desc: 'STT, TTS, and persona-aware voice flows.' },
  { icon: Video,         label: 'Video Pipelines',      desc: 'Queue-backed generation under one surface.' },
  { icon: Bot,           label: 'App Agents',           desc: 'App-scoped agents with policy and memory.' },
  { icon: Workflow,      label: 'Workflows',            desc: 'Chain multimodal tasks for production ops.' },
  { icon: Archive,       label: 'Artifacts',            desc: 'Stored outputs across image, audio, code.' },
  { icon: Database,      label: 'Memory Layer',         desc: 'Cross-session context where configured.' },
  { icon: FolderGit2,    label: 'GitHub Workspace',     desc: 'Edit, push, PR, and deploy from operator console.' },
  { icon: Rocket,        label: 'Deployments',          desc: 'Workflow runs and deploy triggers in one view.' },
  { icon: AppWindow,     label: 'App Management',       desc: 'Configure, monitor, and iterate AI apps.' },
  { icon: Settings2,     label: 'Operator Controls',    desc: 'Providers, keys, policies — all in one place.' },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Task arrives',
    body: 'An app or operator sends a task through one API gateway with app identity and capability context.',
    color: 'text-cyan-400',
  },
  {
    step: '02',
    title: 'GenX routes',
    body: 'GenX — the primary AI execution layer — selects the optimal model path based on capability, quality, and cost.',
    color: 'text-blue-400',
  },
  {
    step: '03',
    title: 'Controlled execution',
    body: 'Execution runs with policy layers, memory hooks, and provider fallback logic attached.',
    color: 'text-violet-400',
  },
  {
    step: '04',
    title: 'Output & trace',
    body: 'Artifacts, events, and usage traces surface in the operator console for inspection and iteration.',
    color: 'text-emerald-400',
  },
]

/** Animated "dashboard preview" — minimal CSS art representing the console */
function DashboardPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050d1e] shadow-2xl">
      {/* Fake title bar */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-3 text-[10px] text-slate-600 font-mono">AmarktAI Network — Workspace</span>
      </div>
      {/* Fake sidebar + main */}
      <div className="flex h-56 gap-0">
        {/* Sidebar */}
        <div className="w-32 shrink-0 border-r border-white/[0.07] px-2 py-3 space-y-0.5">
          {['Workspace','Apps & Agents','GenX Models','Artifacts','Deployments','Settings'].map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className={`rounded-lg px-2 py-1.5 text-[10px] ${i === 0 ? 'bg-cyan-400/10 text-cyan-300' : 'text-slate-600'}`}
            >
              {item}
            </motion.div>
          ))}
        </div>
        {/* Main area */}
        <div className="flex-1 overflow-hidden p-4 space-y-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="h-2 w-32 rounded bg-white/10"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="h-14 w-full rounded-lg border border-white/[0.06] bg-white/[0.03]"
          />
          <div className="grid grid-cols-3 gap-1.5">
            {[0,1,2].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 + i * 0.1 }}
                className="h-16 rounded-lg border border-white/[0.06] bg-white/[0.02]"
              />
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="h-2 w-20 rounded bg-cyan-400/20"
          />
        </div>
      </div>
    </div>
  )
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
})

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030712] text-white">
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[88vh] items-center overflow-hidden px-4 pt-24 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-90" />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-label mb-5 text-cyan-300"
          >
            Amarkt<span className="text-blue-400">AI</span> Network · GenX-powered AI orchestration
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-display max-w-5xl"
          >
            The AI execution layer for{' '}
            <span className="gradient-text">real products</span>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg text-slate-300"
          >
            Amarkt<span className="text-blue-400">AI</span> Network routes your AI tasks through GenX — selecting the best model, 
            provider, and execution path. One console for chat, image, video, voice, code, 
            agents, GitHub, and deployments.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/contact" className="btn-primary">
              Request Operator Access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/apps" className="btn-ghost">
              Explore Capabilities
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── How it works — horizontal flow ──────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp()}>
            <p className="text-label text-blue-300">How it works</p>
            <h2 className="text-headline mt-3 max-w-3xl">
              GenX is the execution brain. Every request routes through it.
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((s, i) => (
              <motion.div key={s.step} {...fadeUp(i * 0.08)}>
                <div className="relative pl-4 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-gradient-to-b before:from-white/20 before:to-transparent">
                  <p className={`text-[11px] font-bold tracking-[0.14em] uppercase ${s.color}`}>{s.step}</p>
                  <h3 className="mt-2 text-base font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard preview + differentiators — split panel ────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: dashboard preview */}
            <motion.div {...fadeUp()}>
              <DashboardPreview />
            </motion.div>
            {/* Right: content */}
            <motion.div {...fadeUp(0.1)} className="space-y-6">
              <div>
                <p className="text-label text-violet-300">Operator console</p>
                <h2 className="text-headline mt-3">
                  One workspace for the full AI development lifecycle.
                </h2>
                <p className="mt-4 text-slate-400">
                  Build apps, test models, edit code in GitHub repos, run agents, review generated
                  artifacts, and trigger deployments — all from the same operator surface.
                </p>
              </div>
              <ul className="space-y-3">
                {[
                  { color: 'bg-cyan-400',   text: 'AI task panel with GenX as default execution layer' },
                  { color: 'bg-blue-400',   text: 'GitHub repo editing, commit, PR, and deploy triggers' },
                  { color: 'bg-violet-400', text: 'App agent configuration and monitoring' },
                  { color: 'bg-emerald-400', text: 'Artifact library — text, image, audio, video, code' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                    {item.text}
                  </li>
                ))}
              </ul>
              <Link href="/contact" className="btn-primary inline-flex">
                Request access <ChevronRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Capability grid ───────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp()}>
            <p className="text-label text-amber-300">Full capability surface</p>
            <h2 className="text-headline mt-3 max-w-3xl">
              One orchestration layer. Twelve production capabilities.
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.label}
                {...fadeUp(i * 0.03)}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                <cap.icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-300 group-hover:text-cyan-300 transition-colors" />
                <div>
                  <p className="text-sm font-medium text-white">{cap.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{cap.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GenX callout — horizontal accent ─────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            {...fadeUp()}
            className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#061424] via-[#07192e] to-[#07152a] px-8 py-10"
          >
            {/* Subtle glow */}
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-cyan-400" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-400">GenX — Primary AI Layer</span>
                </div>
                <h2 className="text-xl font-semibold text-white max-w-xl">
                  Every AI request routes through GenX. It picks the best model, applies policies, handles fallback, and returns a clean execution result.
                </h2>
                <p className="mt-3 text-sm text-slate-400 max-w-lg">
                  No vendor lock. No single-model dependency. GenX connects to the model catalog and routes by capability, cost tier, and task context — with fallback to specialist providers when needed.
                </p>
              </div>
              <div className="shrink-0 flex flex-wrap gap-2">
                {['best', 'balanced', 'cheap', 'fixed'].map(tier => (
                  <span key={tier} className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-1.5 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
                    {tier}
                  </span>
                ))}
                <p className="w-full text-[10px] text-slate-600 mt-1">Model policy tiers</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── GitHub-to-Deploy flow visual ──────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <motion.div {...fadeUp()} className="space-y-5">
              <div>
                <p className="text-label text-emerald-300">GitHub workflow</p>
                <h2 className="text-headline mt-3">
                  From code edit to deployed branch — without leaving the console.
                </h2>
                <p className="mt-4 text-slate-400">
                  Connect your GitHub repos, browse file trees, let GenX generate or refactor code, review diffs, push branches, create PRs, and trigger workflow_dispatch deploys — all from the Workspace panel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Connect repo', 'Browse files', 'Edit with AI', 'Review diff', 'Commit + push', 'Trigger deploy'].map((step, i) => (
                  <motion.span
                    key={step}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300"
                  >
                    <span className="text-emerald-400 font-bold">{i + 1}.</span> {step}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Flow diagram — CSS */}
            <motion.div {...fadeUp(0.1)}>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-3">
                {[
                  { label: 'GitHub Repo',        color: 'border-slate-600/60  bg-slate-700/20',  dot: 'bg-slate-400' },
                  { label: 'AI Code Edit (GenX)', color: 'border-blue-500/30   bg-blue-500/[0.05]', dot: 'bg-blue-400' },
                  { label: 'Diff Review',         color: 'border-violet-500/30 bg-violet-500/[0.05]', dot: 'bg-violet-400' },
                  { label: 'Commit + PR',         color: 'border-emerald-500/30 bg-emerald-500/[0.05]', dot: 'bg-emerald-400' },
                  { label: 'Workflow Deploy',     color: 'border-cyan-500/30   bg-cyan-500/[0.05]', dot: 'bg-cyan-400' },
                ].map((row, i, arr) => (
                  <div key={row.label} className="relative">
                    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-slate-300 ${row.color}`}>
                      <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                      {row.label}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-700" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            {...fadeUp()}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1226] to-[#040916] p-10 text-center"
          >
            <h2 className="text-headline">
              Not a chatbot. Not a demo wrapper. An AI operating layer.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-slate-400">
              Request controlled access for teams building production AI products that need orchestration quality, reliability, and full operator visibility.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/apps" className="btn-ghost">View Capabilities</Link>
              <Link href="/contact" className="btn-primary">
                Request Operator Access <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
