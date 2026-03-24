'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring, useInView } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkCanvas from '@/components/NetworkCanvas'
import {
  TrendingUp, Globe, Heart, BookOpen, Briefcase, Users, Megaphone, BarChart2,
  Sparkles, ArrowRight, Lock, Zap, Brain, Shield, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { STATUS_CONFIG, type AmarktaiApp } from '@/lib/apps'

// ── Icon lookup (derived from category) ─────────────────────
function iconForCategory(category: string): LucideIcon {
  const lower = category.toLowerCase()
  if (lower.includes('finance') || lower.includes('crypto') || lower.includes('forex')) return TrendingUp
  if (lower.includes('social') || lower.includes('family')) return Users
  if (lower.includes('community') || lower.includes('faith')) return Heart
  if (lower.includes('education') || lower.includes('learn')) return BookOpen
  if (lower.includes('employment') || lower.includes('job')) return Briefcase
  if (lower.includes('marketing')) return Megaphone
  if (lower.includes('media')) return Globe
  if (lower.includes('security')) return Shield
  if (lower.includes('analytics') || lower.includes('web')) return BarChart2
  return Sparkles
}

// ── Visual config per app (deterministic from index) ─────
const GRADIENTS = [
  { gradient: 'from-blue-900/40 to-cyan-950/40', glow: 'rgba(59,130,246,0.4)', border: 'border-blue-500/30' },
  { gradient: 'from-cyan-900/40 to-teal-950/40', glow: 'rgba(34,211,238,0.4)', border: 'border-cyan-500/30' },
  { gradient: 'from-violet-900/40 to-purple-950/40', glow: 'rgba(139,92,246,0.4)', border: 'border-violet-500/30' },
  { gradient: 'from-emerald-900/40 to-teal-950/40', glow: 'rgba(16,185,129,0.4)', border: 'border-emerald-500/30' },
  { gradient: 'from-amber-900/40 to-orange-950/40', glow: 'rgba(245,158,11,0.4)', border: 'border-amber-500/30' },
  { gradient: 'from-pink-900/40 to-rose-950/40', glow: 'rgba(236,72,153,0.4)', border: 'border-pink-500/30' },
  { gradient: 'from-rose-900/40 to-pink-950/40', glow: 'rgba(244,63,94,0.4)', border: 'border-rose-500/30' },
  { gradient: 'from-indigo-900/40 to-blue-950/40', glow: 'rgba(99,102,241,0.4)', border: 'border-indigo-500/30' },
]

function getVisual(index: number) {
  return GRADIENTS[index % GRADIENTS.length]
}

const SPRING_CONFIG = { stiffness: 300, damping: 30 }

// ── App Card ─────────────────────────────────────────────
function AppCard({ app, index }: { app: AmarktaiApp; index: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), SPRING_CONFIG)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), SPRING_CONFIG)
  const glowX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])
  const glowY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])

  const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG['in_development']
  const visual = getVisual(index)
  const Icon = iconForCategory(app.category)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div
      ref={wrapperRef}
      style={{ perspective: '900px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.07 }}
        whileHover={{ y: -12 }}
        className={`glass-card relative overflow-hidden rounded-2xl border ${visual.border} bg-gradient-to-br ${visual.gradient} flex flex-col group cursor-default p-6 min-h-[340px]`}
        style={{
          rotateX,
          rotateY,
          boxShadow: `0 4px 32px ${visual.glow.replace(/[\d.]+\)$/, '0.12)')}, 0 0 0 1px ${visual.glow.replace(/[\d.]+\)$/, '0.08)')}`,
        }}
      >
        {/* Mouse-follow spotlight */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${glowX} ${glowY}, ${visual.glow} 0%, transparent 65%)`,
          }}
        />

        {/* Shimmer top border */}
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
          <div
            className="absolute inset-y-0 w-2/3 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out"
            style={{
              background: `linear-gradient(90deg, transparent, ${visual.glow.replace(/[\d.]+\)$/, '1)')}, transparent)`,
            }}
          />
        </div>

        {/* Corner radial glow */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none blur-3xl"
          style={{ background: visual.glow.replace(/[\d.]+\)$/, '0.8)') }}
        />

        {/* Icon */}
        <div className="relative z-10 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${visual.glow.replace(/[\d.]+\)$/, '0.55)')}, ${visual.glow.replace(/[\d.]+\)$/, '0.12)')} 55%, transparent 75%)`,
              boxShadow: `0 0 32px ${visual.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            <Icon className="w-7 h-7 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Status row */}
        <div className="relative z-10 flex items-center justify-end mb-2">
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.bg} ${status.textColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
            {status.label}
          </span>
        </div>

        {/* Name */}
        <h3
          className="relative z-10 text-xl font-extrabold text-white leading-tight mb-1"
          style={{ fontFamily: 'Space Grotesk' }}
        >
          {app.name}
        </h3>

        {/* Category */}
        <p className="relative z-10 text-xs text-slate-500 font-medium tracking-wide mb-4">{app.category}</p>

        {/* Description */}
        <p className="relative z-10 text-sm text-slate-400 leading-relaxed flex-1">{app.shortDescription}</p>

        {/* Indicators */}
        <div className="relative z-10 flex flex-wrap gap-1.5 mt-4">
          {app.aiEnabled && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono tracking-wide">
              AI Enabled
            </span>
          )}
          {app.monitoringEnabled && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono tracking-wide">
              Monitored
            </span>
          )}
          {app.connectedToBrain && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono tracking-wide">
              Brain Connected
            </span>
          )}
        </div>

        {/* CTAs */}
        {app.status === 'invite_only' && !app.primaryUrl && (
          <div className="relative z-10 pt-4 mt-4 border-t border-white/[0.08]">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-white transition-colors duration-200 group/cta"
            >
              <span>Request Access</span>
              <ArrowRight className="w-4 h-4 group-hover/cta:translate-x-1 transition-transform duration-200" />
            </Link>
          </div>
        )}
        {app.primaryUrl && (
          <div className="relative z-10 pt-4 mt-4 border-t border-white/[0.08]">
            <a
              href={app.primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${app.name} (opens in new window)`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-white transition-colors duration-200 group/cta"
            >
              <span>Visit Site</span>
              <ArrowRight className="w-4 h-4 group-hover/cta:translate-x-1 transition-transform duration-200" />
            </a>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Section heading ──────────────────────────────────────
function SectionHeading({ label, color = 'blue' }: { label: string; color?: 'blue' | 'violet' | 'amber' | 'emerald' }) {
  const colors = {
    blue: { line: 'from-blue-500', text: 'text-blue-400', trail: 'from-blue-500/20' },
    violet: { line: 'from-violet-500', text: 'text-violet-400', trail: 'from-violet-500/20' },
    amber: { line: 'from-amber-500', text: 'text-amber-400', trail: 'from-amber-500/20' },
    emerald: { line: 'from-emerald-500', text: 'text-emerald-400', trail: 'from-emerald-500/20' },
  }
  const c = colors[color]
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className={`w-6 h-px bg-gradient-to-r ${c.line} to-transparent`} />
      <p className={`text-xs font-bold ${c.text} tracking-[0.2em] uppercase`}>{label}</p>
      <div className={`flex-1 h-px bg-gradient-to-r ${c.trail} to-transparent`} />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-6 min-h-[340px] animate-pulse">
      <div className="w-16 h-16 rounded-2xl bg-white/5 mb-5" />
      <div className="h-4 bg-white/5 rounded w-2/3 mb-3" />
      <div className="h-3 bg-white/5 rounded w-1/3 mb-4" />
      <div className="h-3 bg-white/5 rounded w-full mb-2" />
      <div className="h-3 bg-white/5 rounded w-4/5" />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────
export default function AppsPage() {
  const ctaRef = useRef<HTMLDivElement>(null)
  const ctaInView = useInView(ctaRef, { once: true })

  const [apps, setApps] = useState<AmarktaiApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/apps')
      .then(res => res.json())
      .then(data => {
        setApps(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error('[/apps] Failed to fetch registry:', err)
        setApps([])
      })
      .finally(() => setLoading(false))
  }, [])

  const liveApps = apps.filter(a => a.status === 'live')
  const inviteApps = apps.filter(a => a.status === 'invite_only')
  const readyApps = apps.filter(a => a.status === 'ready_to_deploy')
  const devApps = apps.filter(a => ['in_development', 'coming_soon'].includes(a.status))
  const totalCount = apps.length

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ── Hero: Ecosystem Overview ── */}
      <section className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <NetworkCanvas className="opacity-50" />
          <div className="absolute inset-0 grid-bg opacity-25" />
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-cyan-600/6 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-xs font-semibold text-blue-400 mb-8 border border-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Connected by One Vision · AI-Powered Network
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="text-6xl sm:text-7xl lg:text-8xl font-extrabold leading-[1.0] mb-6 tracking-tight"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            <span className="text-white">The</span>
            <br />
            <span className="gradient-text">Ecosystem</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="text-xl text-slate-400 max-w-2xl mx-auto mb-14 leading-relaxed"
          >
            {loading ? (
              <span className="inline-block w-64 h-6 bg-white/5 rounded animate-pulse" />
            ) : (
              <>
                {totalCount} interconnected {totalCount === 1 ? 'platform' : 'platforms'}. Each built to dominate its domain.
                All powered by the same AI intelligence layer.
              </>
            )}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <div className="flex items-center gap-2.5 glass px-5 py-3 rounded-xl border border-white/[0.08]">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-2xl font-extrabold gradient-text-blue-cyan">{loading ? '—' : totalCount}</span>
              <span className="text-sm text-slate-400">Platforms</span>
            </div>
            <div className="flex items-center gap-2.5 glass px-5 py-3 rounded-xl border border-white/[0.08]">
              <span className="text-2xl font-extrabold gradient-text-blue-cyan">1</span>
              <span className="text-sm text-slate-400">Network</span>
            </div>
            <div className="flex items-center gap-2.5 glass px-5 py-3 rounded-xl border border-white/[0.08]">
              <span className="text-2xl font-extrabold gradient-text-blue-cyan">AI</span>
              <span className="text-sm text-slate-400">Powered</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Loading Skeletons ── */}
      {loading && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Live Now ── */}
      {!loading && liveApps.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            <SectionHeading label="Live Now" color="emerald" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveApps.map((app, i) => (
                <AppCard key={app.id} app={app} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Ready to Deploy ── */}
      {!loading && readyApps.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            <SectionHeading label="Ready to Deploy" color="blue" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {readyApps.map((app, i) => (
                <AppCard key={app.id} app={app} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Invite Only ── */}
      {!loading && inviteApps.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            <SectionHeading label="Invite Only" color="violet" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {inviteApps.map((app, i) => (
                <AppCard key={app.id} app={app} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── In Development ── */}
      {!loading && devApps.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto">
            <SectionHeading label="In Development" color="amber" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {devApps.map((app, i) => (
                <AppCard key={app.id} app={app} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && apps.length === 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-7xl mx-auto text-center py-20">
            <Sparkles className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500">The ecosystem is loading. Check back soon.</p>
          </div>
        </section>
      )}

      {/* ── Why Apps Connect Through Amarktai AI ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="glass rounded-3xl p-12 relative overflow-hidden border border-violet-500/15 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-blue-600/10 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-600/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-500/40">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h2
                className="text-3xl sm:text-4xl font-extrabold text-white mb-4"
                style={{ fontFamily: 'Space Grotesk' }}
              >
                Why Apps Connect Through{' '}
                <span className="gradient-text">Amarktai AI</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                Every platform in the ecosystem feeds into one shared intelligence layer.
                Insights from finance sharpen marketing. Community signals inform employment matching.
                The network gets smarter with every app that connects — creating compounding value no standalone product can match.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div ref={ctaRef} className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={ctaInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="glass rounded-3xl p-12 relative overflow-hidden border border-blue-500/15 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-violet-600/10 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/40 glow-blue">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2
                className="text-4xl font-extrabold text-white mb-4"
                style={{ fontFamily: 'Space Grotesk' }}
              >
                Ready to join
                <br />
                <span className="gradient-text">the network?</span>
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                Some apps in the ecosystem are in active development or invite-only access. Get in touch to learn more or request early access.
              </p>
              <Link href="/contact" className="btn-primary group inline-flex">
                Apply for Access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
