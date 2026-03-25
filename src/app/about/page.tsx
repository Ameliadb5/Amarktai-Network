'use client'

import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Brain, Target, Globe, Zap, Shield, Users, ArrowRight, Network, Cpu, Layers, Sparkles } from 'lucide-react'
import Link from 'next/link'

const values = [
  { icon: Brain, title: 'Intelligence First', description: 'AI is not an afterthought. Every system, product, and platform we build has intelligence embedded at its core architecture.', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: Target, title: 'Precision Engineering', description: 'We obsess over the details. From database schemas to pixel-perfect UIs, precision defines everything we ship.', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { icon: Globe, title: 'Global Precision', description: 'Engineered to a premium global standard. We solve hard, real problems and export that intelligence globally.', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { icon: Zap, title: 'Speed & Scale', description: 'We move fast without breaking things. Our architecture is designed for rapid iteration and infinite scale.', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { icon: Shield, title: 'Security by Default', description: 'Privacy and security are not features — they are foundational principles baked into every system we design.', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Users, title: 'Community Impact', description: 'Technology should uplift communities. Every product we build is designed to create meaningful impact at scale.', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
]

const milestones = [
  { year: '2022', title: 'Foundation', description: 'Amarktai Network conceived as a vision to build a world-class AI technology ecosystem.', icon: Sparkles, color: 'from-blue-500 to-cyan-500' },
  { year: '2023', title: 'Architecture Phase', description: 'Deep research phase. Designing the intelligence layer, system architecture, and product roadmap.', icon: Brain, color: 'from-cyan-500 to-violet-500' },
  { year: '2024', title: 'Development Sprint', description: 'Full-scale development begins. Crypto and Forex enter closed beta. Core platform built.', icon: Cpu, color: 'from-violet-500 to-purple-500' },
  { year: '2025', title: 'Platform Operational', description: 'Core platform architecture operational. First connected apps going live.', icon: Zap, color: 'from-purple-500 to-blue-500' },
  { year: '2026', title: 'CNS Phase', description: 'AI orchestration, multi-model routing, and shared intelligence layer in active development.', icon: Network, color: 'from-blue-500 to-cyan-500' },
]

export default function AboutPage() {
  const pillars = [
    { icon: Cpu, title: 'AI Orchestration Layer', desc: 'Multi-model orchestration, shared memory, real-time monitoring, and automation — the shared intelligence layer powering every connected app.' },
    { icon: Network, title: 'Connected Ecosystem', desc: `A growing network of connected apps, all sharing one intelligence layer — each platform feeds data and context back into the CNS.` },
    { icon: Layers, title: 'Full-Stack Ownership', desc: 'We own every layer: from model routing to UI polish. No handoffs. No compromises.' },
  ]

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-[80px]" />
          <div className="absolute inset-0 grid-bg opacity-30" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-6 border border-blue-500/20"
          >
            <Sparkles className="w-3 h-3" />
            Our Story
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            <span className="text-white">We Build</span>
            <br />
            <span className="gradient-text">Intelligence</span>
            <br />
            <span className="text-white/70 font-light">Systems</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Amarktai Network is the shared intelligence layer and AI operating layer for all connected apps — the brain that orchestrates, monitors, and powers an entire ecosystem of intelligent platforms.
          </motion.p>
        </div>
      </section>

      {/* Who We Are */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-cyan-400 mb-6 border border-cyan-500/20">
                <Globe className="w-3 h-3" />
                Who We Are
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6" style={{ fontFamily: 'Space Grotesk' }}>
                The{' '}
                <span className="gradient-text-blue-cyan">Central Nervous System</span>{' '}
                of the Ecosystem
              </h2>
              <p className="text-slate-400 leading-relaxed mb-5">
                Amarktai Network is the central nervous system for AI operations across every connected app in our ecosystem. We handle multi-model orchestration, shared memory, real-time monitoring, and intelligent automation — so each app operates with the full power of the network behind it.
              </p>
              <p className="text-slate-400 leading-relaxed mb-8">
                Engineered to a premium global standard. We are not building another AI wrapper — we are building the operations platform that makes a growing constellation of intelligent apps think, learn, and act as one.
              </p>
              <Link href="/apps" className="btn-primary group inline-flex">
                View the Ecosystem
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              {pillars.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="glass-card rounded-xl p-5 flex gap-4 ring-hover"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-400 border border-blue-500/20">
                    <p.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>{p.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A1020]/50 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-violet-400 mb-5 border border-violet-500/20">
              <Target className="w-3 h-3" />
              Our Journey
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              How We Got <span className="gradient-text-violet">Here</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-violet-500/50 to-transparent" />

            <div className="space-y-12">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative flex flex-col sm:flex-row gap-6 items-start ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}
                >
                  {/* Dot */}
                  <div className={`absolute left-8 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br ${m.color} border-2 border-[#050816] shadow-lg z-10 mt-5`} />

                  {/* Content */}
                  <div className={`ml-16 sm:ml-0 sm:w-[calc(50%-2.5rem)] ${i % 2 === 0 ? 'sm:mr-10' : 'sm:ml-10'}`}>
                    <div className="glass-card rounded-2xl p-6 ring-hover">
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gradient-to-r ${m.color} opacity-90 text-white text-xs font-bold mb-3`}>
                        {m.year}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>{m.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{m.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-5 border border-blue-500/20">
              <Brain className="w-3 h-3" />
              How We Think
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              Our <span className="gradient-text">Core Values</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              These are not corporate buzzwords. These are the real principles that guide every decision we make.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={`glass-card rounded-2xl p-6 ring-hover border ${v.border} cursor-default`}
              >
                <div className={`w-11 h-11 rounded-xl ${v.bg} flex items-center justify-center mb-4 ${v.color}`}>
                  <v.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>{v.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{v.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
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
              <h2 className="text-4xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk' }}>
                Join the Network
              </h2>
              <p className="text-slate-400 mb-8">
                Whether you want to collaborate, invest, or simply learn more about what we&apos;re building — we&apos;d love to hear from you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contact" className="btn-primary group">
                  Get in Touch
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
                </Link>
                <Link href="/apps" className="btn-ghost">
                  Explore Apps
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
