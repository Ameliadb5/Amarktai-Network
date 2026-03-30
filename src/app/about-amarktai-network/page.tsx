'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  Brain, Network, Layers, ArrowRight, Users, TrendingUp, Globe, Cpu,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const PILLARS = [
  {
    icon: Network,
    title: 'A Network, Not a Tool',
    desc: 'AmarktAI is not a single product. It is a connected ecosystem where each application shares a common intelligence layer — and every new connection makes the whole network smarter.',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: Brain,
    title: 'Intelligence as Infrastructure',
    desc: 'We treat AI intelligence the way the internet treated data: as shared infrastructure. Routing, memory, learning, and orchestration are centralised so applications can focus on what they do best.',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    icon: Layers,
    title: 'Built for Scale',
    desc: 'The architecture is designed to grow. More applications, more users, more data — each addition strengthens the network. The system is deliberately engineered to compound in value over time.',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Compounding by Design',
    desc: 'Context, performance data, and learned behaviour accumulate across the entire ecosystem. A lesson learned in one application immediately improves every other. Intelligence compounds.',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
]

const LONG_TERM = [
  { label: 'Ecosystem Growth', desc: 'A growing suite of connected applications across financial intelligence, productivity, creative tools, communication, and beyond.' },
  { label: 'Infrastructure Layer', desc: 'The intelligence layer as a platform — enabling third-party applications to connect to the network and share in its compounding capabilities.' },
  { label: 'Enterprise Deployment', desc: 'Private, dedicated network deployments for large organisations that require the full power of the intelligence layer within their own infrastructure.' },
  { label: 'Global Reach', desc: 'Multi-region architecture, multi-language intelligence, and multi-model orchestration designed to serve markets worldwide.' },
]

export default function AboutAmarktaiNetworkPage() {
  return (
    <div className="min-h-screen bg-[#050816] text-white overflow-x-hidden">
      <Header />

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-0 top-1/4 h-[600px] w-[400px] rounded-full bg-blue-600/5 blur-[140px]" />
        <div className="absolute right-0 bottom-1/4 h-[500px] w-[400px] rounded-full bg-violet-600/5 blur-[140px]" />
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-40 pb-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/[0.08] text-xs text-blue-400 mb-6">
            <Globe className="w-3 h-3" />
            About AmarktAI Network
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
            Building the Intelligence
            <br />
            <span className="gradient-text">Layer of the Future</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            AmarktAI Network is a technology company building the shared intelligence infrastructure
            for a connected ecosystem of AI-powered applications. We are not building products in isolation —
            we are building the layer beneath them.
          </p>
        </motion.div>
      </section>

      {/* Who We Are */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-6">
              Who We Are
            </h2>
            <div className="space-y-5 text-slate-400 leading-relaxed text-lg">
              <p>
                AmarktAI Network is a focused technology company. We are building the infrastructure that
                makes intelligent, connected applications possible at scale.
              </p>
              <p>
                Our core team combines deep experience in AI systems architecture, product engineering,
                and platform development. We move with conviction, not hype. Every decision is made in
                service of the long-term vision: a network of intelligent applications that compound in
                value over time.
              </p>
              <p>
                We are early but deliberate. The architecture is already in production. The network is
                already growing. We are building the foundation that serious products will run on.
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* What We Are Building */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-4">
              What We Are Building
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              The core of AmarktAI Network is a central intelligence orchestration layer — and around it,
              a growing ecosystem of connected applications.
            </p>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {PILLARS.map((p, i) => (
              <FadeUp key={p.title} delay={i * 0.08}>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 h-full hover:border-white/[0.12] transition-colors">
                  <div className={`inline-flex w-11 h-11 items-center justify-center rounded-xl border mb-4 ${p.color}`}>
                    <p.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-white mb-2">{p.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <div className="rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-cyan-900/10 via-transparent to-blue-900/10 p-10 sm:p-14 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.08] text-xs text-cyan-400 mb-6">
                  <Cpu className="w-3 h-3" />
                  Why the Network Matters
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-6">
                  The problem we are solving
                </h2>
                <div className="space-y-4 text-slate-400 leading-relaxed">
                  <p>
                    The AI industry is generating thousands of disconnected tools. Each one solves a narrow
                    problem in isolation — duplicating infrastructure, losing context between sessions, and
                    failing to learn from adjacent systems.
                  </p>
                  <p>
                    The real opportunity is in the <span className="text-white/80 font-medium">connective tissue between them</span>:
                    a shared intelligence layer where memory, routing, and learning are centralised and
                    compounded across every application in the ecosystem.
                  </p>
                  <p>
                    That is what AmarktAI Network is. Not another AI product — the infrastructure layer
                    that makes a generation of AI products possible.
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Long-Term Direction */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.08] text-xs text-violet-400 mb-5">
              <TrendingUp className="w-3 h-3" />
              Long-Term Direction
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white">
              Where we are going
            </h2>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {LONG_TERM.map((item, i) => (
              <FadeUp key={item.label} delay={i * 0.07}>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 border-l-2 border-l-violet-500/50">
                  <h3 className="font-heading font-semibold text-white mb-2">{item.label}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Careers */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-900/[0.08] via-transparent to-transparent p-10 sm:p-14 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] text-xs text-emerald-400 mb-6">
                  <Users className="w-3 h-3" />
                  Careers
                </div>
                <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white mb-5">
                  Join the team
                </h2>
                <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
                  We are looking for people who want to work on something that matters at the infrastructure
                  level. Engineering, product, design, operations — if you are serious about AI and want
                  to build the layer beneath the applications, we want to hear from you.
                </p>
                <p className="text-slate-500 text-sm mb-8">
                  We do not post job boards. We review every serious application personally.
                </p>
                <Link href="/contact" className="btn-primary group inline-flex">
                  Express Interest
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* CTA — Investors & Business */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="rounded-3xl border border-blue-500/15 bg-gradient-to-br from-blue-900/[0.08] via-transparent to-violet-900/[0.08] p-10 sm:p-14 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="font-heading text-3xl font-extrabold text-white mb-4">
                    Investors & Business Enquiries
                  </h2>
                  <p className="text-slate-400 leading-relaxed mb-6">
                    We are open to conversations with serious investors, strategic partners, and enterprise
                    clients who understand the infrastructure opportunity in AI. If you are building or
                    funding the next generation of intelligent systems, reach out.
                  </p>
                  <Link href="/contact" className="btn-primary group inline-flex">
                    Start a Conversation
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {[
                    'Investment & funding discussions',
                    'Enterprise licensing and deployment',
                    'Strategic technology partnerships',
                    'Product integration opportunities',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-slate-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </div>
  )
}
