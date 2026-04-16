'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight, Brain, Layers, ShieldCheck, Cpu,
  MessageSquare, Image as ImageIcon, Mic, Video,
  Lock, Network, Bot, GitBranch,
  Music, Code2, Sparkles, Zap, Eye,
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
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >{children}</motion.section>
  )
}

/* ── Data ──────────────────────────────────────────────── */
const POWER_DOMAINS = [
  { icon: MessageSquare, label: 'Conversational Intelligence', color: 'from-blue-500 to-blue-600' },
  { icon: ImageIcon,     label: 'Visual Creation',            color: 'from-pink-500 to-rose-600' },
  { icon: Mic,           label: 'Voice & Audio',              color: 'from-violet-500 to-purple-600' },
  { icon: Video,         label: 'Video Production',           color: 'from-cyan-500 to-teal-600' },
  { icon: Music,         label: 'Music Generation',           color: 'from-emerald-500 to-green-600' },
  { icon: Code2,         label: 'Code & App Building',        color: 'from-amber-500 to-orange-600' },
  { icon: Brain,         label: 'Research & Analysis',        color: 'from-indigo-500 to-blue-600' },
  { icon: Zap,           label: 'Workflow Automation',        color: 'from-rose-500 to-pink-600' },
]

const ARCHITECTURE = [
  { icon: Brain,       label: 'Central Super-Brain',          desc: 'One intelligence core. Context compounds across every app instead of resetting.', accent: 'blue' },
  { icon: Bot,         label: 'Dedicated App Agents',         desc: 'Each app gets its own AI agent with unique rules, persona, and voice.', accent: 'violet' },
  { icon: GitBranch,   label: 'Multi-Provider Routing',       desc: '13+ providers with real fallback chains. No single point of failure.', accent: 'cyan' },
  { icon: ShieldCheck, label: 'Operator-Grade Controls',      desc: 'Per-app budgets, safety filters, capability locks, and full audit trails.', accent: 'emerald' },
  { icon: Cpu,         label: 'Persistent Memory',            desc: 'Knowledge graphs, vector search, and cross-session context that learns.', accent: 'amber' },
  { icon: Lock,        label: 'Self-Healing Infrastructure',  desc: 'Circuit breakers, automatic failover, and provider health monitoring.', accent: 'rose' },
]

const DIFFERENTIATORS = [
  { title: 'Not a wrapper.',         desc: 'Every capability is orchestrated through a routing engine that picks the optimal provider, model, and execution strategy per request.' },
  { title: 'Not a single model.',    desc: 'OpenAI, Anthropic, Google, Groq, DeepSeek, Together, Replicate, HuggingFace — all competing to serve each task best.' },
  { title: 'Not a chatbot.',         desc: 'Image generation, voice synthesis, music composition, video production, code creation, research — all from one system.' },
  { title: 'Not temporary.',         desc: 'Persistent memory, knowledge graphs, and learning loops mean your apps get smarter the more they operate.' },
]

/* ── Page ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden">
      <Header />

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative flex min-h-[100vh] items-center justify-center overflow-hidden">
        {/* Living neural network background */}
        <LivingCore className="absolute inset-0 z-0 opacity-30" />

        {/* Ambient glow layers */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <div className="absolute right-1/4 top-1/5 h-[500px] w-[500px] rounded-full bg-violet-600/[0.08] blur-[150px] ambient-drift" />
          <div className="absolute bottom-1/4 left-1/5 h-[400px] w-[400px] rounded-full bg-blue-600/[0.06] blur-[120px] ambient-drift" style={{ animationDelay: '-6s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-cyan-500/[0.04] blur-[100px] animate-breathe" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-medium tracking-wide text-slate-300">AI Operating System</span>
            </div>
            <h1 className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              One Brain.<br />
              <span className="gradient-text">Infinite Power.</span>
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl"
          >
            AmarktAI Network is the intelligence layer behind multiple connected applications.
            One system that creates, reasons, sees, speaks, composes, codes, and builds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Request Access
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#what"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-8 py-4 text-sm font-medium text-slate-300 transition-all hover:border-white/[0.15] hover:text-white hover:-translate-y-0.5"
            >
              <Eye className="h-4 w-4" />
              Explore the System
            </Link>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712] to-transparent z-20" />
      </section>

      {/* ── POWER DOMAINS — What it can do ────────────────── */}
      <Section id="power" className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Eight Domains.<br />
              <span className="text-slate-400">One System.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-slate-500">
              Every creative and operational capability — orchestrated through one intelligence core.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
            {POWER_DOMAINS.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className={`inline-flex rounded-xl bg-gradient-to-br ${item.color} p-2.5 mb-4`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Divider ──────────────────────────────────────── */}
      <div className="section-divider mx-auto max-w-4xl" />

      {/* ── WHAT IT IS — Architecture ────────────────────── */}
      <Section id="what" className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-blue-400">
              Architecture
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Built Different.<br />
              <span className="text-slate-400">By Design.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-slate-500">
              Not a wrapper around one API. A full multi-provider AI operating system with persistent intelligence, per-app agents, and operator-grade infrastructure.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ARCHITECTURE.map((item, i) => {
              const Icon = item.icon
              const accentMap: Record<string, string> = {
                blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              }
              const classes = accentMap[item.accent] ?? accentMap.blue
              const [textColor, bgColor] = [classes.split(' ')[0], classes.split(' ').slice(1).join(' ')]
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className={`card-premium p-6`}
                >
                  <div className={`inline-flex rounded-lg border p-2 ${bgColor} mb-4`}>
                    <Icon className={`h-4 w-4 ${textColor}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{item.label}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── WHY DIFFERENT ─────────────────────────────────── */}
      <Section id="why" className="relative py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-blue-600/[0.04] blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="text-center mb-16">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">
              Philosophy
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              This Is Not<br />
              <span className="text-slate-400">Another AI Tool.</span>
            </h2>
          </div>
          <div className="space-y-4">
            {DIFFERENTIATORS.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-white/[0.10] hover:bg-white/[0.03]"
              >
                <div className="shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.06]">
                    <span className="text-sm font-bold text-blue-400">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Divider ──────────────────────────────────────── */}
      <div className="section-divider mx-auto max-w-4xl" />

      {/* ── THE OPERATOR VIEW ─────────────────────────────── */}
      <Section id="operator" className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-amber-400">
                Control
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                One Command Center.<br />
                <span className="text-slate-400">Total Visibility.</span>
              </h2>
              <p className="mt-5 text-slate-400 leading-relaxed">
                The operator dashboard puts everything in one place — system health, app status, AI activity, provider routing, cost tracking, alerts, and the full creation studio.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  { icon: Sparkles, text: 'Create with every AI modality in one studio' },
                  { icon: Network,  text: 'Monitor provider health and routing in real time' },
                  { icon: Layers,   text: 'Manage apps, agents, and capabilities from one surface' },
                  { icon: Lock,     text: 'Full audit trail of every AI decision' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <item.icon className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-sm text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              {/* Stylized dashboard preview */}
              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0d1424] to-[#030712] p-6 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                  <span className="ml-3 text-[10px] text-slate-600 font-mono">AmarktAI Command Center</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'System Health', value: '97%', color: 'text-emerald-400' },
                    { label: 'Active Apps', value: '6', color: 'text-blue-400' },
                    { label: 'AI Requests', value: '12.4k', color: 'text-violet-400' },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                      <p className={`text-lg font-bold font-mono mt-1 ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {['chat → openai/gpt-4o → 340ms → ✓', 'image → replicate/flux → 2.1s → ✓', 'code → anthropic/claude → 890ms → ✓'].map(line => (
                    <div key={line} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[11px] font-mono text-slate-400">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Floating glow */}
              <div className="absolute -z-10 inset-0 rounded-2xl bg-blue-500/5 blur-3xl" />
            </div>
          </div>
        </div>
      </Section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <Section id="access" className="relative py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/[0.05] blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-blue-400">
            Controlled Access
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            This System Is Not<br />
            <span className="text-slate-400">Open to Everyone.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-slate-400 leading-relaxed">
            AmarktAI Network is built for serious operators. If you&apos;re building apps that need real intelligence infrastructure — get in touch.
          </p>
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-0.5"
            >
              Request Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-8 py-4 text-sm font-medium text-slate-300 transition-all hover:border-white/[0.15] hover:text-white hover:-translate-y-0.5"
            >
              Learn About the System
            </Link>
          </div>
        </div>
      </Section>

      <Footer />
    </div>
  )
}
