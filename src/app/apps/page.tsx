'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  TrendingUp, BookOpen, Briefcase, Heart, Users, Shield, Camera, Lock,
  ChevronRight, Sparkles, Globe, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

type AppStatus = 'invite_only' | 'in_development' | 'coming_soon' | 'live'
type Category = 'all' | 'finance' | 'community' | 'education' | 'employment' | 'social' | 'security'

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
}

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
    gradient: 'from-blue-600/20 to-cyan-500/15',
    glowColor: 'rgba(59,130,246,0.3)',
    borderColor: 'border-blue-500/25',
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
    gradient: 'from-cyan-600/20 to-teal-500/15',
    glowColor: 'rgba(34,211,238,0.3)',
    borderColor: 'border-cyan-500/25',
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
    gradient: 'from-violet-600/20 to-purple-500/15',
    glowColor: 'rgba(139,92,246,0.3)',
    borderColor: 'border-violet-500/25',
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
    gradient: 'from-emerald-600/20 to-teal-500/15',
    glowColor: 'rgba(16,185,129,0.3)',
    borderColor: 'border-emerald-500/25',
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
    gradient: 'from-amber-600/20 to-orange-500/15',
    glowColor: 'rgba(245,158,11,0.3)',
    borderColor: 'border-amber-500/25',
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
    gradient: 'from-pink-600/20 to-rose-500/15',
    glowColor: 'rgba(236,72,153,0.3)',
    borderColor: 'border-pink-500/25',
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
    gradient: 'from-slate-600/20 to-gray-500/15',
    glowColor: 'rgba(100,116,139,0.3)',
    borderColor: 'border-slate-500/25',
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
    gradient: 'from-indigo-600/20 to-blue-500/15',
    glowColor: 'rgba(99,102,241,0.3)',
    borderColor: 'border-indigo-500/25',
    description: 'Collaborative visual storytelling platform for communities and creators.',
    longDescription: 'Crowd Lens is a collaborative visual storytelling platform that combines the power of community with the art of photography and visual media. Events, stories, and moments — captured together.',
    tags: ['Visual Storytelling', 'Photography', 'Community Events', 'Collaboration'],
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
]

function AppCard({ app, i }: { app: App; i: number }) {
  const [expanded, setExpanded] = useState(false)
  const status = statusConfig[app.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, delay: i * 0.06 }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className={`glass-card rounded-2xl p-6 flex flex-col gap-4 cursor-pointer border ${app.borderColor} bg-gradient-to-br ${app.gradient} group transition-all duration-300`}
      style={{ boxShadow: expanded ? `0 12px 40px ${app.glowColor}` : undefined }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10"
            style={{ background: `radial-gradient(circle, ${app.glowColor} 0%, transparent 70%)` }}
          >
            <app.Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">{app.code}</p>
            <h3 className="text-base font-semibold text-white" style={{ fontFamily: 'Space Grotesk' }}>{app.name}</h3>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${status.bg} ${status.textColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} ${app.status === 'live' ? 'animate-pulse-green' : ''}`} />
          {status.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 leading-relaxed">{app.description}</p>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-white/5">
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{app.longDescription}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {app.tags.map(tag => (
                  <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/8 font-mono">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <span className="text-xs text-slate-600 font-mono">{app.category}</span>
        <div className="flex items-center gap-3">
          {app.status === 'invite_only' && (
            <Link
              href="/contact"
              onClick={e => e.stopPropagation()}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              Request Access <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
            {expanded ? 'Less' : 'More'} →
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export default function AppsPage() {
  const [filter, setFilter] = useState<Category>('all')

  const filtered = filter === 'all' ? apps : apps.filter(a => a.categoryKey === filter)

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* Hero */}
      <section className="relative pt-40 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-[80px]" />
          <div className="absolute inset-0 grid-bg opacity-20" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-6 border border-blue-500/20"
          >
            <Sparkles className="w-3 h-3" />
            8 Platforms · 1 Network
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            <span className="text-white">The</span>{' '}
            <span className="gradient-text">Ecosystem</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Eight interconnected platforms. Each built to dominate its domain. All powered by the same AI intelligence layer.
          </motion.p>
        </div>
      </section>

      {/* Filter */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-2 justify-center"
          >
            {categoryFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === f.key
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : 'glass text-slate-400 hover:text-white hover:border-blue-500/30 border border-white/8'
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Apps Grid */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-7xl mx-auto">
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((app, i) => (
                <AppCard key={app.id} app={app} i={i} />
              ))}
            </AnimatePresence>
          </motion.div>

          {filtered.length === 0 && (
            <div className="text-center py-24">
              <p className="text-slate-500">No apps in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl p-12 relative overflow-hidden border border-blue-500/15"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 to-violet-600/8" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-5 glow-blue">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3" style={{ fontFamily: 'Space Grotesk' }}>
                Request Invitation Access
              </h2>
              <p className="text-slate-400 mb-8">
                Amarktai Crypto and Forex are invite-only during the closed access phase. Apply to join the early network.
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
