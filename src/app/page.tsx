'use client'

import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  ArrowRight, Brain, Code2, Globe, Layers, Shield, Zap,
  Activity, ChevronRight, Sparkles, Cpu, Network, Rocket,
  Lock, Eye, BarChart3,
} from 'lucide-react'

/* ─── Data ─────────────────────────────────────────── */
const apps = [
  { name: 'Amarktai Crypto', category: 'Finance & AI', status: 'invite_only', description: 'Advanced cryptocurrency intelligence platform with real-time AI signals and portfolio analytics.', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/20', glow: 'group-hover:shadow-blue-500/20' },
  { name: 'Amarktai Forex', category: 'Finance & AI', status: 'invite_only', description: 'Institutional-grade forex analysis powered by proprietary AI models and market intelligence.', gradient: 'from-cyan-500/20 to-teal-500/20', border: 'border-cyan-500/20', glow: 'group-hover:shadow-cyan-500/20' },
  { name: 'Faith Haven', category: 'Community', status: 'in_development', description: 'A digital sanctuary for faith communities to connect, grow, and build meaningful relationships.', gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/20', glow: 'group-hover:shadow-violet-500/20' },
  { name: 'Learn Digital', category: 'Education', status: 'in_development', description: 'Adaptive learning platform for the next generation of technology professionals.', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/20', glow: 'group-hover:shadow-emerald-500/20' },
  { name: 'Jobs SA', category: 'Employment', status: 'coming_soon', description: 'South Africa-focused AI job matching platform connecting talent with opportunity.', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/20', glow: 'group-hover:shadow-amber-500/20' },
  { name: 'Kinship', category: 'Social', status: 'in_development', description: 'Community-driven platform fostering meaningful connections and shared experiences.', gradient: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/20', glow: 'group-hover:shadow-pink-500/20' },
]

const statusConfig: Record<string, { label: string; dotColor: string; textColor: string; bg: string }> = {
  invite_only: { label: 'Invite Only', dotColor: 'bg-blue-400', textColor: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  in_development: { label: 'In Dev', dotColor: 'bg-amber-400', textColor: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  coming_soon: { label: 'Coming Soon', dotColor: 'bg-slate-400', textColor: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  live: { label: 'Live', dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const capabilities = [
  { icon: Brain, title: 'AI Systems', description: 'End-to-end AI with real-time inference, model training, and intelligent automation.', accent: 'blue', glow: 'rgba(59,130,246,0.15)' },
  { icon: Code2, title: 'Applications', description: 'Precision-engineered web and mobile apps built for performance and scale.', accent: 'cyan', glow: 'rgba(34,211,238,0.15)' },
  { icon: Globe, title: 'Web Platforms', description: 'Full-stack PWAs that deliver seamless experiences across all devices.', accent: 'violet', glow: 'rgba(139,92,246,0.15)' },
  { icon: Layers, title: 'Infrastructure', description: 'Scalable cloud-native architectures designed for reliability and growth.', accent: 'teal', glow: 'rgba(6,182,212,0.15)' },
  { icon: Shield, title: 'Secure Systems', description: 'Security-first design embedded at every layer from architecture to deploy.', accent: 'blue', glow: 'rgba(59,130,246,0.15)' },
  { icon: Zap, title: 'Automation', description: 'Workflow automation and intelligent processing that multiplies productivity.', accent: 'violet', glow: 'rgba(139,92,246,0.15)' },
]

const reasons = [
  { icon: Cpu, title: 'AI-Native Architecture', desc: 'Intelligence is the foundation, not an add-on. Every system is built around AI from day one.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Network, title: 'Ecosystem Thinking', desc: 'We build interconnected platforms, not isolated apps — creating exponential network value.', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { icon: Rocket, title: 'Africa → World', desc: 'Proudly building from Africa for the global stage. The continent\'s future tech powerhouse.', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: Lock, title: 'Security First', desc: 'Privacy and security are foundational principles, not afterthought features.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

/* ─── Animated Particle Component ─────────────────── */
function Particle({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color }}
      animate={{
        y: [0, -30, 0],
        opacity: [0, 0.6, 0],
        scale: [0.5, 1, 0.5],
      }}
      transition={{ duration: 4 + delay, repeat: Infinity, delay: delay * 0.8, ease: 'easeInOut' }}
    />
  )
}

const particles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  color: ['rgba(59,130,246,0.7)', 'rgba(34,211,238,0.7)', 'rgba(139,92,246,0.7)', 'rgba(168,85,247,0.5)'][Math.floor(Math.random() * 4)],
  delay: Math.random() * 4,
}))

/* ─── Intelligence Feed Row ────────────────────────── */
function FeedRow({ label, value, type, confidence, i }: { label: string; value: string; type: string; confidence: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.1 }}
      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5 font-mono text-xs hover:border-blue-500/20 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-600">{label}:</span>
        <span className="text-cyan-400 group-hover:text-cyan-300 transition-colors">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-purple-500/70 text-[10px]">{type}</span>
        <span className="text-emerald-400 font-semibold">{confidence}</span>
      </div>
    </motion.div>
  )
}

/* ─── Main Component ───────────────────────────────── */
export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef })
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.6], [0, -60])
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 0.95])

  // Animated counter targets
  const COUNTER_TARGETS = { apps: 8, year: 2025 } as const

  // Animated counter hook
  const [counters, setCounters] = useState({ apps: 0, year: 0 })
  const statsRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef, { once: true })
  useEffect(() => {
    if (statsInView) {
      const timer = setInterval(() => {
        setCounters(prev => ({
          apps: Math.min(prev.apps + 1, COUNTER_TARGETS.apps),
          year: prev.year < COUNTER_TARGETS.year ? prev.year + 25 : COUNTER_TARGETS.year,
        }))
      }, 60)
      return () => clearInterval(timer)
    }
  }, [statsInView, COUNTER_TARGETS.apps, COUNTER_TARGETS.year])

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ─── HERO ─────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Deep background layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050816] via-[#080E1E] to-[#050816]" />
          {/* Aurora orbs */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600 rounded-full blur-[100px] pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-600 rounded-full blur-[140px] pointer-events-none"
          />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 grid-bg opacity-40" />

        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <Particle key={p.id} {...p} />
          ))}
        </div>

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-blue-400 mb-8 border border-blue-500/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
            </span>
            Building Africa&apos;s most advanced AI ecosystem
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl lg:text-8xl font-extrabold leading-[1.05] mb-6 tracking-tight"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            <span className="text-white">Intelligence</span>
            <br />
            <span className="gradient-text-aurora">Engineered</span>
            <br />
            <span className="text-white/70 font-light">for the Future</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Amarktai Network designs and develops AI systems, applications, and intelligent automation platforms that redefine what digital technology can accomplish.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/apps" className="btn-primary group">
              Explore the Ecosystem
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
            </Link>
            <Link href="/about" className="btn-ghost">
              Learn More
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            ref={statsRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-16 flex flex-wrap justify-center gap-8 sm:gap-16"
          >
            {[
              { value: `${counters.apps}+`, label: 'Applications' },
              { value: 'AI-First', label: 'Architecture' },
              { value: `${counters.year || '2025'}`, label: 'Launching' },
            ].map((stat) => (
              <div key={stat.label} className="text-center group">
                <div className="text-3xl font-extrabold gradient-text-blue-cyan counter" style={{ fontFamily: 'Space Grotesk' }}>{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1 tracking-wider uppercase">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-12 bg-gradient-to-b from-blue-500/60 to-transparent"
          />
          <span className="text-[10px] text-slate-600 tracking-widest uppercase">Scroll</span>
        </motion.div>
      </section>

      {/* ─── WHAT WE BUILD ─────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080E20]/40 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-cyan-400 mb-5 border border-cyan-500/20">
              <Zap className="w-3 h-3" />
              Full-Spectrum Capability
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              What We <span className="gradient-text">Build</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
              From AI model development to production-grade platforms, we engineer every layer of the digital stack with precision and intent.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="glass-card rounded-2xl p-6 group cursor-default ring-hover"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `radial-gradient(circle, ${cap.glow} 0%, transparent 70%)`,
                    border: `1px solid ${cap.glow.replace('0.15', '0.3')}`,
                  }}
                >
                  <cap.icon className="w-5 h-5 text-white" style={{ filter: `drop-shadow(0 0 6px ${cap.glow})` }} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>{cap.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{cap.description}</p>
                <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-blue-500/20 transition-all duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section divider */}
      <div className="section-divider mx-8 lg:mx-24" />

      {/* ─── WHY AMARKTAI ──────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-violet-400 mb-5 border border-violet-500/20">
              <Sparkles className="w-3 h-3" />
              Why Choose Us
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              The <span className="gradient-text-violet">Amarktai</span> Difference
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
              We don&apos;t build features. We engineer ecosystems. Here&apos;s why that changes everything.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reasons.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="glass-card rounded-2xl p-7 flex gap-5 ring-hover cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl ${r.bg} flex items-center justify-center flex-shrink-0 ${r.color}`}>
                  <r.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>{r.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{r.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTELLIGENCE LAYER ────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A1020]/60 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-5 border border-blue-500/20">
              <Brain className="w-3 h-3" />
              AI Intelligence Layer
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              Intelligence at the <span className="gradient-text">Core</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every platform we build is powered by a deep AI intelligence layer — not as an add-on, but as the foundational architecture.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Terminal feed */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="terminal"
            >
              <div className="terminal-header">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-slate-500 ml-2">amarktai.intelligence — live inference stream</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <span className="text-[10px] text-emerald-400">LIVE</span>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                {[
                  { label: 'market_signal', value: 'BULLISH_DIVERGENCE', type: 'CRYPTO', confidence: '94.2%' },
                  { label: 'risk_model', value: 'LOW_EXPOSURE', type: 'FOREX', confidence: '89.7%' },
                  { label: 'pattern_match', value: 'HEAD_AND_SHOULDERS', type: 'ANALYSIS', confidence: '91.3%' },
                  { label: 'sentiment', value: 'POSITIVE_TRENDING', type: 'NLP', confidence: '87.5%' },
                  { label: 'anomaly_detect', value: 'CLEAN_SIGNAL', type: 'MONITOR', confidence: '96.1%' },
                ].map((item, i) => (
                  <FeedRow key={item.label} {...item} i={i} />
                ))}
              </div>
            </motion.div>

            {/* Feature list */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-5 flex flex-col justify-center"
            >
              {[
                { title: 'Predictive Intelligence', desc: 'Models trained on real-world data deliver high-confidence predictions across financial, behavioral, and operational domains.', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { title: 'Real-Time Processing', desc: 'Sub-millisecond inference pipelines process live data streams and deliver actionable intelligence without delay.', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { title: 'Adaptive Systems', desc: 'Self-improving architectures that continuously refine their models based on new data and outcomes.', icon: Activity, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { title: 'Privacy-Preserving AI', desc: 'On-device inference and federated learning ensure user data never compromises model performance.', icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="flex gap-4 glass-card rounded-xl p-4 ring-hover group"
                >
                  <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>{item.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section divider */}
      <div className="section-divider mx-8 lg:mx-24" />

      {/* ─── APP ECOSYSTEM ─────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-start md:items-center justify-between mb-16 gap-6"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-5 border border-blue-500/20">
                <Globe className="w-3 h-3" />
                The Ecosystem
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                Applications Built for{' '}
                <span className="gradient-text">Impact</span>
              </h2>
              <p className="text-slate-400 mt-3 max-w-md">
                Eight platforms. One ecosystem. Infinite potential.
              </p>
            </div>
            <Link
              href="/apps"
              className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 group"
            >
              View full ecosystem
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {apps.map((app, i) => {
              const status = statusConfig[app.status]
              return (
                <motion.div
                  key={app.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className={`glass-card rounded-2xl p-5 flex flex-col gap-3 group ring-hover cursor-default bg-gradient-to-br ${app.gradient} border ${app.border} transition-all duration-300 group-hover:shadow-lg ${app.glow}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">{app.category}</span>
                      <h3 className="text-base font-semibold text-white mt-0.5" style={{ fontFamily: 'Space Grotesk' }}>{app.name}</h3>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${status.bg} ${status.textColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${app.status === 'live' ? 'animate-pulse-green' : ''}`} />
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">{app.description}</p>
                  <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:via-white/10 transition-all duration-500" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-mono">AMKN-{String(i + 1).padStart(3, '0')}</span>
                    {app.status === 'invite_only' && (
                      <Link href="/contact" className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                        Request access <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────── */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-blue-500/5 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-violet-500/8 rounded-full"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-12 sm:p-16 relative overflow-hidden border border-blue-500/15"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 via-violet-600/5 to-cyan-600/8 rounded-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="relative z-10">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex mb-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center glow-blue">
                  <Rocket className="w-7 h-7 text-white" />
                </div>
              </motion.div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                Ready to Build the Future?
              </h2>
              <p className="text-slate-400 mb-10 text-lg max-w-xl mx-auto">
                Get in touch to explore how Amarktai Network can power your next intelligent platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contact" className="btn-primary group">
                  Start the Conversation
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                </Link>
                <Link href="/apps" className="btn-ghost">
                  View the Ecosystem
                </Link>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
