'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Inbox,
  ScanSearch,
  GitBranch,
  Layers,
  GitMerge,
  CheckCircle2,
  ArrowRight,
  Zap,
  Network,
  TrendingUp,
  Split,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkCanvas from '@/components/NetworkCanvas'

// ─── Execution flow data ────────────────────────────────────────────────────

const STEP_DURATION_MS = 1200

const EXECUTION_STEPS = [
  'AmarktAI analyzing request...',
  'AmarktAI building execution path...',
  'AmarktAI executing across multiple intelligence layers...',
  'AmarktAI merging outputs...',
  'AmarktAI generating final result...',
]

const STEP_COLORS = [
  'text-blue-400',
  'text-cyan-400',
  'text-violet-400',
  'text-purple-400',
  'text-teal-400',
]

const STEP_DOT_COLORS = [
  'bg-blue-400',
  'bg-cyan-400',
  'bg-violet-400',
  'bg-purple-400',
  'bg-teal-400',
]

// ─── How it works data ─────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { icon: Inbox,        label: 'Request received',        color: 'text-blue-400',   ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10' },
  { icon: ScanSearch,   label: 'Intent analyzed',          color: 'text-cyan-400',   ring: 'ring-cyan-500/30',   bg: 'bg-cyan-500/10' },
  { icon: GitBranch,    label: 'Execution path selected',  color: 'text-violet-400', ring: 'ring-violet-500/30', bg: 'bg-violet-500/10' },
  { icon: Layers,       label: 'Multiple layers activated', color: 'text-purple-400', ring: 'ring-purple-500/30', bg: 'bg-purple-500/10' },
  { icon: GitMerge,     label: 'Outputs synthesized',       color: 'text-teal-400',   ring: 'ring-teal-500/30',   bg: 'bg-teal-500/10' },
  { icon: CheckCircle2, label: 'Result returned',           color: 'text-emerald-400',ring: 'ring-emerald-500/30',bg: 'bg-emerald-500/10' },
]

// ─── Differentiators data ──────────────────────────────────────────────────

const DIFFERENTIATORS = [
  {
    icon: Split,
    title: 'Multi-Layer Execution',
    body: "When you send a request, AmarktAI doesn't use one model. It fans out across multiple intelligence layers simultaneously, then synthesizes the strongest output.",
    accent: 'from-blue-500/20 to-cyan-500/10',
    glow: 'hover:shadow-blue-500/10',
    border: 'hover:border-blue-500/30',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: GitBranch,
    title: 'Adaptive Decision Making',
    body: 'AmarktAI selects which layers to activate based on request complexity. Simple tasks route fast. Complex tasks trigger full multi-layer orchestration.',
    accent: 'from-violet-500/20 to-purple-500/10',
    glow: 'hover:shadow-violet-500/10',
    border: 'hover:border-violet-500/30',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Continuous Improvement',
    body: 'Every execution updates the shared context layer. AmarktAI grows more precise with each interaction across the entire ecosystem.',
    accent: 'from-teal-500/20 to-cyan-500/10',
    glow: 'hover:shadow-teal-500/10',
    border: 'hover:border-teal-500/30',
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10',
  },
  {
    icon: Network,
    title: 'Cross-App Intelligence',
    body: "Intelligence doesn't stay in one app. Insights and context flow across the entire connected ecosystem, making every app smarter.",
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
  const [query, setQuery] = useState('')
  const [executing, setExecuting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearTimers() {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
  }

  function handleExecute(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || executing) return

    clearTimers()
    setExecuting(true)
    setCurrentStep(1)
    setCompletedSteps([])
    setDone(false)

    // Advance steps: step i completes after i * STEP_DURATION_MS, next step starts immediately after
    for (let i = 1; i <= EXECUTION_STEPS.length; i++) {
      const completeAt = i * STEP_DURATION_MS
      timerRefs.current.push(
        setTimeout(() => {
          setCompletedSteps(prev => [...prev, i])
          if (i < EXECUTION_STEPS.length) {
            setCurrentStep(i + 1)
          }
        }, completeAt)
      )
    }

    // All done
    timerRefs.current.push(
      setTimeout(() => {
        setCurrentStep(0)
        setDone(true)
      }, EXECUTION_STEPS.length * STEP_DURATION_MS + 200)
    )

    // Reset
    timerRefs.current.push(
      setTimeout(() => {
        setExecuting(false)
        setCurrentStep(0)
        setCompletedSteps([])
        setDone(false)
        setQuery('')
      }, EXECUTION_STEPS.length * STEP_DURATION_MS + 4200)
    )
  }

  useEffect(() => () => clearTimers(), [])

  const showFlow = executing || done

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
              interactive={executing || done}
              activationStep={currentStep}
            />
          </div>

          {/* Dark overlay */}
          <div className="absolute inset-0 z-10 bg-[#050816]/60" />

          {/* Radial vignette so edges feel contained */}
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
              AmarktAI · Live System
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
              The intelligence layer that thinks across multiple dimensions simultaneously.
            </motion.p>

            {/* Input form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              onSubmit={handleExecute}
              className="w-full max-w-2xl"
            >
              <div className="relative flex items-center glass rounded-2xl border border-blue-500/20 overflow-hidden focus-within:border-blue-500/50 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.12)] transition-all duration-300">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={executing}
                  placeholder="Ask AmarktAI anything..."
                  className="flex-1 bg-transparent px-6 py-5 text-base text-white placeholder:text-slate-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                />
                <div className="pr-3">
                  <button
                    type="submit"
                    disabled={!query.trim() || executing}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none relative z-10"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Execute
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.form>

            {/* Execution flow */}
            <AnimatePresence>
              {showFlow && (
                <motion.div
                  key="execution-flow"
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-2xl glass rounded-2xl border border-slate-700/50 p-5 text-left space-y-3 overflow-hidden"
                >
                  {EXECUTION_STEPS.map((step, i) => {
                    const stepNum = i + 1
                    const isComplete = completedSteps.includes(stepNum)
                    const isActive = currentStep === stepNum && !isComplete
                    const isPending = !isComplete && !isActive
                    const shouldShowStep = isActive || isComplete || (executing && stepNum <= currentStep)

                    return (
                      <AnimatePresence key={step}>
                        {shouldShowStep && (
                          <motion.div
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35 }}
                            className={`flex items-center gap-3 text-sm font-mono transition-opacity duration-300 ${isPending ? 'opacity-30' : 'opacity-100'}`}
                          >
                            {/* Status indicator */}
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                              {isComplete ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                                >
                                  <Check className="w-4 h-4 text-emerald-400" />
                                </motion.div>
                              ) : isActive ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              ) : (
                                <span className={`w-2 h-2 rounded-full ${STEP_DOT_COLORS[i]}`} />
                              )}
                            </div>

                            {/* Step text */}
                            <span className={isComplete ? 'text-slate-400 line-through' : isActive ? STEP_COLORS[i] : 'text-slate-500'}>
                              {step}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )
                  })}

                  {/* Done message */}
                  <AnimatePresence>
                    {done && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="pt-2 border-t border-slate-700/50 flex items-center gap-2 text-sm font-mono text-emerald-400"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Execution complete. AmarktAI is ready.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

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
                How AmarktAI Works
              </h2>
            </FadeUp>

            {/* Flow row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.label} className="flex flex-col md:flex-row items-center gap-3 md:gap-0">
                  <FadeUp delay={i * 0.1} className="flex flex-col items-center">
                    {/* Step card */}
                    <div className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl glass-card ring-1 ${step.ring} w-[140px]`}>
                      <div className={`p-3 rounded-xl ${step.bg}`}>
                        <step.icon className={`w-6 h-6 ${step.color}`} strokeWidth={1.5} />
                      </div>
                      <p className="text-xs text-center text-slate-300 leading-snug font-medium">
                        {step.label}
                      </p>
                      {/* Step number */}
                      <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[#050816] border border-slate-700 text-[10px] text-slate-500 font-mono flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
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
          </div>
        </section>

        {/* ── HOW IT THINKS DIFFERENTLY ─────────────────────────────────── */}
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
                How AmarktAI Thinks Differently
              </h2>
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DIFFERENTIATORS.map((card, i) => (
                <FadeUp key={card.title} delay={i * 0.12}>
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
              System online
            </p>
            <h2 className="font-heading text-4xl md:text-5xl font-bold gradient-text">
              Experience AmarktAI
            </h2>
            <p className="text-slate-400 text-lg">
              The system is running. Interact with it above.
            </p>
            <Link href="/contact" className="btn-primary group">
              Connect with the Team
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </FadeUp>
        </section>

      </main>

      <Footer />
    </>
  )
}

