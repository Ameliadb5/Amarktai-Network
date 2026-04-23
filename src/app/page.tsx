'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Brain, Cpu, ImageIcon, Mic, Video, Music, Code2, Workflow, Layers, Shield, Sparkles } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const capabilities = [
  { icon: ImageIcon, label: 'Images' },
  { icon: Mic, label: 'Voice' },
  { icon: Video, label: 'Video' },
  { icon: Music, label: 'Music' },
  { icon: Code2, label: 'Code' },
  { icon: Workflow, label: 'Workflows' },
]

const difference = [
  'One super-brain routes every request across providers and modalities.',
  'One operator workspace controls app creation, experimentation, and deployment.',
  'One intelligence layer compounds memory across all connected apps.',
]

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030712] text-white">
      <Header />

      <section className="relative isolate flex min-h-[96vh] items-center overflow-hidden px-4 pt-32 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-90" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="text-label mb-6 text-cyan-300">Amarktai Network · AI Operating System</p>
          <h1 className="text-display max-w-4xl">
            The command network behind
            <span className="gradient-text"> next-generation AI products.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Amarktai Network unifies creation, automation, and app operations through one intelligent core. Build, route, analyze, and deploy from a controlled operator surface.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary">Request Access <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/admin/login" className="btn-ghost">Enter Operator Dashboard</Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-label text-blue-400">What Amarktai Network is</p>
            <h2 className="text-headline mt-3">A multi-app intelligence core.</h2>
            <p className="mt-5 text-slate-400">
              Not a chatbot shell. Not a one-model wrapper. Amarktai Network is a full AI operating system for teams running multiple products, agents, workflows, and multimodal pipelines.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { icon: Brain, label: 'Unified Core' },
                { icon: Cpu, label: 'Adaptive Routing' },
                { icon: Layers, label: 'App Agents' },
                { icon: Shield, label: 'Operator Controls' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  <item.icon className="mb-2 h-4 w-4 text-cyan-300" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 justify-self-center w-full max-w-[480px]">
            {[
              { icon: ImageIcon, label: 'Image Generation', color: 'text-pink-400' },
              { icon: Mic, label: 'Voice & TTS', color: 'text-cyan-400' },
              { icon: Video, label: 'Video Pipeline', color: 'text-violet-400' },
              { icon: Music, label: 'Music Studio', color: 'text-amber-400' },
              { icon: Code2, label: 'Code Intelligence', color: 'text-blue-400' },
              { icon: Workflow, label: 'Workflows', color: 'text-emerald-400' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
                <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                <span className="text-sm text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-label text-violet-300">Capability Matrix</p>
          <h2 className="text-headline mt-3">Create, operate, and automate across every medium.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <motion.div key={cap.label} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="card-premium p-5">
                <cap.icon className="h-5 w-5 text-blue-300" />
                <p className="mt-3 text-sm font-semibold">{cap.label}</p>
                <p className="mt-1 text-xs text-slate-400">Powered by one orchestrated intelligence layer.</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1226] to-[#040916] p-10">
          <p className="text-label text-amber-300">Why it is different</p>
          <h2 className="text-headline mt-3">Built for operators, not prompt tourists.</h2>
          <div className="mt-8 space-y-3">
            {difference.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/apps" className="btn-ghost">Explore Ecosystem</Link>
            <Link href="/contact" className="btn-primary">Request Controlled Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
