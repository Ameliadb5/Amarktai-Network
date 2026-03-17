'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring, useInView } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkCanvas from '@/components/NetworkCanvas'
import {
  TrendingUp, Globe, Heart, BookOpen, Briefcase, Users, Shield, Camera,
  Sparkles, ArrowRight, Lock, Zap, Star, Megaphone, BarChart2,
} from 'lucide-react'
import Link from 'next/link'

type AppStatus = 'invite_only' | 'in_development' | 'coming_soon' | 'live'
type Category = 'all' | 'finance' | 'community' | 'education' | 'employment' | 'social' | 'security' | 'marketing'

interface App {
  id: number
  name: string
  code: string
  category: string
  categoryKey: Category
  status: AppStatus
  featured: boolean
  Icon: React.ElementType
  gradient: string
  glowColor: string
  borderColor: string
  description: string
  longDescription: string
  tags: string[]
  href?: string
}

interface HeroStat {
  value: string
  label: string
  IconComp: React.ElementType | null
}

const SPRING_CONFIG = { stiffness: 300, damping: 30 }

const apps: App[] = [
  {
    id: 1,
    name: 'Amarktai Crypto',
    code: 'AMKN-001',
    category: 'Finance & AI',
    categoryKey: 'finance',
    status: 'invite_only',
    featured: true,
    Icon: TrendingUp,
    gradient: 'from-blue-900/40 to-cyan-950/40',
    glowColor: 'rgba(59,130,246,0.4)',
    borderColor: 'border-blue-500/30',
    description: 'Advanced cryptocurrency intelligence platform with real-time AI signals and portfolio analytics.',
    longDescription: 'Amarktai Crypto is an institutional-grade cryptocurrency intelligence platform. It delivers real-time AI-driven market signals, deep portfolio analytics, risk modeling, and on-chain data insights — all in one unified interface.',
    tags: ['AI Signals', 'Portfolio Analytics', 'Risk Modeling', 'On-Chain Data'],
  },
  {
    id: 2,
    name: 'Amarktai Forex',
    code: 'AMKN-002',
    category: 'Finance & AI',
    categoryKey: 'finance',
    status: 'invite_only',
    featured: true,
    Icon: Globe,
    gradient: 'from-cyan-900/40 to-teal-950/40',
    glowColor: 'rgba(34,211,238,0.4)',
    borderColor: 'border-cyan-500/30',
    description: 'Institutional-grade forex analysis powered by proprietary AI models and market intelligence.',
    longDescription: 'Amarktai Forex delivers deep forex market intelligence using proprietary AI models trained on decades of price data, sentiment analysis, and macro indicators. Built for serious traders and institutions.',
    tags: ['AI Models', 'Macro Intelligence', 'Sentiment Analysis', 'FX Signals'],
  },
  {
    id: 3,
    name: 'Faith Haven',
    code: 'AMKN-003',
    category: 'Community',
    categoryKey: 'community',
    status: 'in_development',
    featured: false,
    Icon: Heart,
    gradient: 'from-violet-900/40 to-purple-950/40',
    glowColor: 'rgba(139,92,246,0.4)',
    borderColor: 'border-violet-500/30',
    description: 'A digital sanctuary for faith communities to connect, grow, and build meaningful relationships.',
    longDescription: 'Faith Haven is a purpose-built digital space for faith communities. It offers spaces for prayer, discussion, events, and community building — all in a respectful, ad-free environment.',
    tags: ['Community', 'Events', 'Discussion', 'Prayer'],
  },
  {
    id: 4,
    name: 'Learn Digital',
    code: 'AMKN-004',
    category: 'Education',
    categoryKey: 'education',
    status: 'in_development',
    featured: false,
    Icon: BookOpen,
    gradient: 'from-emerald-900/40 to-teal-950/40',
    glowColor: 'rgba(16,185,129,0.4)',
    borderColor: 'border-emerald-500/30',
    description: 'Adaptive digital learning platform for the next generation of technology professionals.',
    longDescription: 'Learn Digital is an adaptive learning platform designed to produce the next generation of digital professionals. AI-personalized curricula, project-based learning, and industry mentorship.',
    tags: ['Adaptive Learning', 'AI Personalization', 'Mentorship', 'Certificates'],
  },
  {
    id: 5,
    name: 'Jobs SA',
    code: 'AMKN-005',
    category: 'Employment',
    categoryKey: 'employment',
    status: 'coming_soon',
    featured: false,
    Icon: Briefcase,
    gradient: 'from-amber-900/40 to-orange-950/40',
    glowColor: 'rgba(245,158,11,0.4)',
    borderColor: 'border-amber-500/30',
    description: 'South Africa-focused AI job matching platform connecting talent with opportunity.',
    longDescription: 'Jobs SA is an intelligent job matching platform focused on the South African market. AI matching connects candidates with roles where they will genuinely thrive, not just roles they qualify for.',
    tags: ['AI Matching', 'South Africa', 'Talent Network', 'Smart Search'],
  },
  {
    id: 6,
    name: 'Kinship',
    code: 'AMKN-006',
    category: 'Social',
    categoryKey: 'social',
    status: 'in_development',
    featured: false,
    Icon: Users,
    gradient: 'from-pink-900/40 to-rose-950/40',
    glowColor: 'rgba(236,72,153,0.4)',
    borderColor: 'border-pink-500/30',
    description: 'Community-driven platform fostering meaningful connections and shared experiences.',
    longDescription: 'Kinship is a community platform focused on quality of connection over quantity. Shared interests, local groups, and collaborative experiences form the foundation of genuine digital community.',
    tags: ['Community', 'Shared Interests', 'Local Groups', 'Real Connections'],
  },
  {
    id: 7,
    name: 'Amarktai Secure',
    code: 'AMKN-007',
    category: 'Security',
    categoryKey: 'security',
    status: 'coming_soon',
    featured: false,
    Icon: Shield,
    gradient: 'from-slate-800/60 to-slate-900/60',
    glowColor: 'rgba(100,116,139,0.4)',
    borderColor: 'border-slate-500/30',
    description: 'Enterprise-grade digital security and privacy tools for individuals and organizations.',
    longDescription: 'Amarktai Secure provides enterprise-grade security tools including encrypted communications, threat monitoring, identity protection, and compliance tools for organizations of all sizes.',
    tags: ['Encryption', 'Threat Detection', 'Identity Protection', 'Compliance'],
  },
  {
    id: 8,
    name: 'Crowd Lens',
    code: 'AMKN-008',
    category: 'Social',
    categoryKey: 'social',
    status: 'coming_soon',
    featured: false,
    Icon: Camera,
    gradient: 'from-indigo-900/40 to-blue-950/40',
    glowColor: 'rgba(99,102,241,0.4)',
    borderColor: 'border-indigo-500/30',
    description: 'Collaborative visual storytelling platform for communities and creators.',
    longDescription: 'Crowd Lens is a collaborative visual storytelling platform that combines the power of community with the art of photography and visual media. Events, stories, and moments — captured together.',
    tags: ['Visual Storytelling', 'Photography', 'Community Events', 'Collaboration'],
  },
  {
    id: 9,
    name: 'Amarktai Marketing',
    code: 'AMKN-009',
    category: 'Marketing & AI',
    categoryKey: 'marketing',
    status: 'coming_soon',
    featured: false,
    Icon: Megaphone,
    gradient: 'from-rose-900/40 to-pink-950/40',
    glowColor: 'rgba(244,63,94,0.4)',
    borderColor: 'border-rose-500/30',
    description: 'AI-powered marketing intelligence and automation for modern growth teams.',
    longDescription: 'Amarktai Marketing brings AI-driven campaign intelligence, audience segmentation, and automated growth workflows to teams that demand results. Built for performance marketers operating at scale.',
    tags: ['AI Campaigns', 'Audience Intelligence', 'Automation', 'Growth Analytics'],
  },
  {
    id: 10,
    name: 'EquiProfile',
    code: 'AMKN-010',
    category: 'Finance & Web',
    categoryKey: 'finance',
    status: 'live',
    featured: false,
    Icon: BarChart2,
    gradient: 'from-indigo-900/40 to-blue-950/40',
    glowColor: 'rgba(99,102,241,0.4)',
    borderColor: 'border-indigo-500/30',
    description: 'Professional equity profiling and financial intelligence for serious investors.',
    longDescription: 'EquiProfile delivers deep equity analysis and financial profiling tools for investors who demand precision. Comprehensive company profiles, financial metrics, and investment intelligence in one clean platform.',
    tags: ['Equity Analysis', 'Financial Profiles', 'Investment Intelligence', 'Market Data'],
    href: 'https://equiprofile.online',
  },
]

const statusConfig: Record<AppStatus, { label: string; dotColor: string; textColor: string; bg: string }> = {
  invite_only: { label: 'Invite Only', dotColor: 'bg-blue-400', textColor: 'text-blue-400', bg: 'border-blue-500/30 bg-blue-500/10' },
  in_development: { label: 'In Development', dotColor: 'bg-amber-400', textColor: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
  coming_soon: { label: 'Coming Soon', dotColor: 'bg-slate-400', textColor: 'text-slate-400', bg: 'border-slate-500/30 bg-slate-500/10' },
  live: { label: 'Live', dotColor: 'bg-emerald-400', textColor: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
}

const categoryFilters: { key: Category; label: string }[] = [
  { key: 'all', label: 'All Apps' },
  { key: 'finance', label: 'Finance & AI' },
  { key: 'community', label: 'Community' },
  { key: 'education', label: 'Education' },
  { key: 'employment', label: 'Employment' },
  { key: 'social', label: 'Social' },
  { key: 'security', label: 'Security' },
  { key: 'marketing', label: 'Marketing' },
]

const heroStats: HeroStat[] = [
  { value: '10+', label: 'Platforms', IconComp: Zap },
  { value: '1', label: 'Network', IconComp: null },
  { value: 'AI', label: 'Powered', IconComp: null },
]

function AppCard({ app, featured = false, index }: { app: App; featured?: boolean; index: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), SPRING_CONFIG)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), SPRING_CONFIG)
  const glowX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])
  const glowY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])
  const status = statusConfig[app.status]

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
        layout
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -8 }}
        transition={{ duration: 0.5, delay: index * 0.07 }}
        whileHover={{ y: -12 }}
        className={`glass-card relative overflow-hidden rounded-2xl border ${app.borderColor} bg-gradient-to-br ${app.gradient} flex flex-col group cursor-default ${featured ? 'p-8 min-h-[440px]' : 'p-6 min-h-[380px]'}`}
        style={{
          rotateX,
          rotateY,
          boxShadow: `0 4px 32px ${app.glowColor.replace(/[\d.]+\)$/, '0.12)')}, 0 0 0 1px ${app.glowColor.replace(/[\d.]+\)$/, '0.08)')}`,
        }}
      >
        {/* Mouse-follow spotlight */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${glowX} ${glowY}, ${app.glowColor} 0%, transparent 65%)`,
          }}
        />

        {/* Shimmer top border */}
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl">
          <div
            className="absolute inset-y-0 w-2/3 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out"
            style={{
              background: `linear-gradient(90deg, transparent, ${app.glowColor.replace(/[\d.]+\)$/, '1)')}, transparent)`,
            }}
          />
        </div>

        {/* Corner radial glow */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-25 transition-opacity duration-500 pointer-events-none blur-3xl"
          style={{ background: app.glowColor.replace(/[\d.]+\)$/, '0.8)') }}
        />

        {/* Featured badge */}
        {featured && (
          <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 text-[10px] font-bold text-blue-300 tracking-widest uppercase">
            <Star className="w-2.5 h-2.5 fill-current" />
            Featured
          </div>
        )}

        {/* Large icon */}
        <div className="relative z-10 mb-5">
          <div
            className={`${featured ? 'w-20 h-20' : 'w-16 h-16'} rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500`}
            style={{
              background: `radial-gradient(circle at 35% 35%, ${app.glowColor.replace(/[\d.]+\)$/, '0.55)')}, ${app.glowColor.replace(/[\d.]+\)$/, '0.12)')} 55%, transparent 75%)`,
              boxShadow: `0 0 ${featured ? '48px' : '32px'} ${app.glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            <app.Icon className={`${featured ? 'w-9 h-9' : 'w-7 h-7'} text-white drop-shadow-lg`} />
          </div>
        </div>

        {/* Code + status row */}
        <div className="relative z-10 flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase">{app.code}</span>
          <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${status.bg} ${status.textColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
            {status.label}
          </span>
        </div>

        {/* App name */}
        <h3
          className={`relative z-10 ${featured ? 'text-2xl' : 'text-xl'} font-extrabold text-white leading-tight mb-1`}
          style={{ fontFamily: 'Space Grotesk' }}
        >
          {app.name}
        </h3>

        {/* Category */}
        <p className="relative z-10 text-xs text-slate-500 font-medium tracking-wide mb-4">{app.category}</p>

        {/* Description */}
        <p className="relative z-10 text-sm text-slate-400 leading-relaxed flex-1">{app.description}</p>

        {/* Tags */}
        <div className="relative z-10 flex flex-wrap gap-1.5 mt-4">
          {app.tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 font-mono tracking-wide"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Request access / visit CTA */}
        {app.status === 'invite_only' && !app.href && (
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
        {app.href && (
          <div className="relative z-10 pt-4 mt-4 border-t border-white/[0.08]">
            <a
              href={app.href}
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

export default function AppsPage() {
  const [filter, setFilter] = useState<Category>('all')
  const ctaRef = useRef<HTMLDivElement>(null)
  const ctaInView = useInView(ctaRef, { once: true })

  const featuredApps = apps.filter(a => a.featured)
  const regularApps = apps.filter(a => !a.featured)

  const showFeaturedRow = filter === 'all'
  const gridApps = filter === 'all' ? regularApps : apps.filter(a => a.categoryKey === filter)

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ── Hero ── */}
      <section className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <NetworkCanvas className="opacity-50" />
          <div className="absolute inset-0 grid-bg opacity-25" />
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-cyan-600/6 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-xs font-semibold text-blue-400 mb-8 border border-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Connected by One Vision · AI-Powered Network
          </motion.div>

          {/* Title */}
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

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="text-xl text-slate-400 max-w-2xl mx-auto mb-14 leading-relaxed"
          >
            Eight interconnected platforms. Each built to dominate its domain. All powered by the same AI intelligence layer.
          </motion.p>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            {heroStats.map((stat, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 glass px-5 py-3 rounded-xl border border-white/[0.08]"
              >
                {stat.IconComp && <stat.IconComp className="w-4 h-4 text-blue-400" />}
                <span className="text-2xl font-extrabold gradient-text-blue-cyan">{stat.value}</span>
                <span className="text-sm text-slate-400">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Filter tabs ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-2 justify-center"
          >
            {categoryFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  filter === f.key
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                    : 'glass text-slate-400 hover:text-white border border-white/[0.08] hover:border-blue-500/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Apps grid ── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-28">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Featured row */}
          <AnimatePresence mode="popLayout">
            {showFeaturedRow && (
              <motion.div
                key="featured-section"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-px bg-gradient-to-r from-blue-500 to-transparent" />
                  <p className="text-xs font-bold text-blue-400 tracking-[0.2em] uppercase">Featured Platforms</p>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {featuredApps.map((app, i) => (
                    <AppCard key={app.id} app={app} featured index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Regular grid */}
          {gridApps.length > 0 && (
            <div>
              {showFeaturedRow && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-6 h-px bg-gradient-to-r from-slate-600 to-transparent" />
                  <p className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase">All Platforms</p>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-600/20 to-transparent" />
                </div>
              )}
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {gridApps.map((app, i) => (
                    <AppCard key={app.id} app={app} index={i} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          )}

          {gridApps.length === 0 && !showFeaturedRow && (
            <div className="text-center py-24">
              <p className="text-slate-500 text-sm">No platforms in this category yet.</p>
            </div>
          )}
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
                Amarktai Crypto and Forex are invite-only during the closed access phase. Apply to join the early network and gain priority access.
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
