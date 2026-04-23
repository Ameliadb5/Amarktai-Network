'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  Cpu,
  GitBranch,
  Layers,
  MessageSquare,
  ImageIcon,
  Camera,
  Mic,
  Music,
  Video,
  Bot,
  Workflow,
  Archive,
  Database,
  Plug,
  BarChart3,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkPulseBackground from '@/components/visual/NetworkPulseBackground'

const capabilityGrid = [
  { icon: MessageSquare, title: 'Chat Intelligence', detail: 'Task-aware language routing and execution across providers.' },
  { icon: ImageIcon, title: 'Image Generation', detail: 'High-fidelity visual pipelines with provider fallback.' },
  { icon: Camera, title: 'Adult Image Mode', detail: 'Controlled, policy-governed adult generation capability.' },
  { icon: Mic, title: 'Voice Stack', detail: 'Speech-to-Text (STT), Text-to-Speech (TTS), and persona-aware voice flows.' },
  { icon: Music, title: 'Music Studio', detail: 'AI-assisted composition with generated assets and track artifacts.' },
  { icon: Video, title: 'Video Pipelines', detail: 'Queue-backed generation and planning under one control surface.' },
  { icon: Bot, title: 'App Agents', detail: 'App-scoped agents with routing, memory, and policy context.' },
  { icon: Workflow, title: 'Workflows', detail: 'Chain multimodal tasks into repeatable production operations.' },
  { icon: Archive, title: 'Artifacts', detail: 'Stored output library across image, audio, video, and code.' },
  { icon: Database, title: 'Memory Layer', detail: 'Cross-session intelligence continuity where configured.' },
  { icon: GitBranch, title: 'Routing Brain', detail: 'Provider/model selection by task, cost, and capability fit.' },
  { icon: Plug, title: 'Integrations', detail: 'External service keys, providers, and app connectivity controls.' },
]

const operationFlow = [
  {
    title: '1. Request arrives',
    body: 'A product or operator submits a task through one API surface with app identity and context.',
  },
  {
    title: '2. Routing engine evaluates',
    body: 'The orchestration layer selects provider/model path based on capability, quality, latency, and cost logic.',
  },
  {
    title: '3. Controlled execution',
    body: 'Execution runs with policy layers, memory hooks, and runtime observability attached.',
  },
  {
    title: '4. Output and telemetry',
    body: 'Artifacts, events, and usage traces return to the operator console for inspection and iteration.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030712] text-white">
      <Header />

      <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden px-4 pt-28 sm:px-6 lg:px-8">
        <NetworkPulseBackground className="opacity-90" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-label mb-6 text-cyan-300">Amarktai Network · Multi-Provider AI Operating System</p>
            <h1 className="text-display max-w-5xl">
              Operate AI like
              <span className="gradient-text"> infrastructure</span>, not a chat toy.
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-slate-300">
              Amarktai Network is the routing brain and operator workspace for real AI products: one capability engine for chat,
              image, adult image, voice, music, video, app agents, workflows, artifacts, memory, and integrations.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-primary">Request Operator Access <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/admin/login" className="btn-ghost">Open Dashboard</Link>
            </div>
          </div>

          <div className="card-premium p-6 lg:p-7">
            <p className="text-label text-violet-300">Operator Signal</p>
            <h2 className="mt-3 text-xl font-semibold">Built for teams running production AI workloads.</h2>
            <div className="mt-5 space-y-3">
              {[
                'Provider/model routing instead of single-model lock-in',
                'Shared memory and artifact surfaces across app ecosystem',
                'Operational visibility for events, budgets, and readiness',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-label text-blue-300">What the platform does</p>
          <h2 className="text-headline mt-3 max-w-4xl">One orchestration core powering many real AI products.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Brain, title: 'Central Intelligence Core', desc: 'Runs task interpretation, model strategy, and execution governance.' },
              { icon: Cpu, title: 'Multi-Provider Execution', desc: 'Routes to the best available provider/model path per workload.' },
              { icon: Layers, title: 'Unified Operator Workspace', desc: 'Build, test, compare, and ship from one system control room.' },
              { icon: BarChart3, title: 'Operational Traceability', desc: 'Observe usage, artifacts, readiness, and event streams with context.' },
            ].map((item) => (
              <div key={item.title} className="card-premium p-5">
                <item.icon className="h-5 w-5 text-cyan-300" />
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-label text-amber-300">How routing works</p>
          <h2 className="text-headline mt-3">A task-driven orchestration loop, not a static chatbot chain.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {operationFlow.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="card-premium p-5"
              >
                <h3 className="text-sm font-semibold text-cyan-200">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-label text-violet-300">Capability grid</p>
          <h2 className="text-headline mt-3">Truthful capability surface across creation, execution, and operations.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilityGrid.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="card-premium p-5"
              >
                <cap.icon className="h-5 w-5 text-blue-300" />
                <h3 className="mt-3 text-sm font-semibold">{cap.title}</h3>
                <p className="mt-2 text-xs text-slate-400">{cap.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1226] to-[#040916] p-8">
            <p className="text-label text-emerald-300">Why this is different</p>
            <h2 className="mt-3 text-2xl font-semibold">Designed as a routing and operations system, not a chat UI wrapper.</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li>• Multi-provider intelligence instead of one-model dependency.</li>
              <li>• Capability-aware orchestration across modalities and task classes.</li>
              <li>• Operator-grade control surfaces for apps, agents, artifacts, and spend.</li>
              <li>• Revenue-facing platform architecture for multiple products.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-label text-cyan-300">Built for real apps</p>
            <h2 className="mt-3 text-2xl font-semibold">Use Amarktai Network when your team needs reliable AI operations at scale.</h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li>• Product teams shipping multiple AI-enabled applications.</li>
              <li>• Builders who need routing, memory, and outputs in one place.</li>
              <li>• Operators managing quality, cost, and execution readiness.</li>
              <li>• Integrators connecting app ecosystems to one AI command layer.</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/apps" className="btn-ghost">Explore Capabilities</Link>
              <Link href="/contact" className="btn-primary">Request Controlled Access <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
