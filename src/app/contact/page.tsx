'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import NetworkCanvas from '@/components/NetworkCanvas'
import {
  Send, CheckCircle, Loader2, ArrowRight, Zap,
  Mail, MessageSquare, Network, Globe, Users, Building2, ChevronDown,
} from 'lucide-react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const REASONS = [
  { value: 'partnership', label: 'Partnership Enquiry', icon: Building2 },
  { value: 'integration', label: 'Integration Request', icon: Network },
  { value: 'early-access', label: 'Early Access / Waitlist', icon: Zap },
  { value: 'general', label: 'General Enquiry', icon: MessageSquare },
  { value: 'other', label: 'Something Else', icon: Globe },
]

const PLATFORMS = [
  'Amarktai Crypto', 'Amarktai Forex', 'Faith Haven',
  'Learn Digital', 'Jobs SA', 'Kinship', 'Amarktai Secure', 'Crowd Lens',
]

const inputCls = `w-full px-4 py-3.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-slate-600
  focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all duration-200 font-[inherit]`

const selectCls = `${inputCls} cursor-pointer appearance-none`

export default function ContactPage() {
  const [state, setState] = useState<FormState>('idle')
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    reason: '',
    platform: '',
    message: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const isWaitlist = form.reason === 'early-access'
  const reasonLabel = REASONS.find(r => r.value === form.reason)?.label ?? form.reason

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('loading')
    try {
      if (isWaitlist) {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, interest: form.platform || 'All Platforms' }),
        })
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            companyOrProject: form.company,
            message: `[${reasonLabel}]\n\n${form.message}`,
          }),
        })
        if (!res.ok) throw new Error()
      }
      setState('success')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative pt-36 pb-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <NetworkCanvas className="opacity-30" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-600/6 rounded-full blur-[100px]" />
          <div className="absolute inset-0 grid-bg opacity-15" />
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-xs text-blue-400 font-medium"
          >
            <Mail className="w-3 h-3" /> Let&apos;s Connect
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-5 tracking-tight"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            <span className="text-white">Start the</span>{' '}
            <span className="gradient-text">Conversation</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="text-lg text-slate-400 max-w-xl mx-auto"
          >
            Whether you want to collaborate, join the waitlist, or simply say hello — every message gets a reply.
          </motion.p>
        </div>
      </section>

      {/* ── Form ─────────────────────────────────────── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 pb-32">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {state === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-3xl p-16 text-center relative overflow-hidden border border-emerald-500/15"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Space Grotesk' }}>
                  {isWaitlist ? "You're on the List" : "Message Sent"}
                </h2>
                <p className="text-slate-400 mb-8">
                  {isWaitlist
                    ? "We'll notify you when early access opens. Keep an eye on your inbox."
                    : "We typically respond within 24 hours. Looking forward to connecting."}
                </p>
                <button
                  onClick={() => { setState('idle'); setForm({ name: '', email: '', company: '', reason: '', platform: '', message: '' }) }}
                  className="btn-ghost text-sm"
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <div className="glass-card rounded-3xl p-8 sm:p-10 relative overflow-hidden border border-blue-500/12">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

                <div className="mb-8">
                  <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>Send us a message</h2>
                  <p className="text-sm text-slate-500">We respond to every enquiry within 24 hours.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">Full Name *</label>
                      <input required type="text" value={form.name} onChange={set('name')} placeholder="Your name" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">Email Address *</label>
                      <input required type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" className={inputCls} />
                    </div>
                  </div>

                  {/* Company */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Company or Project <span className="text-slate-700">(optional)</span></label>
                    <input type="text" value={form.company} onChange={set('company')} placeholder="e.g. Acme Corp, My Startup" className={inputCls} />
                  </div>

                  {/* Reason dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500">Reason for contacting *</label>
                    <div className="relative">
                      <select required value={form.reason} onChange={set('reason')} className={selectCls}>
                        <option value="" disabled className="bg-[#0A1020]">Select a reason...</option>
                        {REASONS.map(r => (
                          <option key={r.value} value={r.value} className="bg-[#0A1020]">{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Platform interest — only for waitlist */}
                  {isWaitlist && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="text-xs font-medium text-slate-500">Platform of Interest *</label>
                      <div className="relative">
                        <select required={isWaitlist} value={form.platform} onChange={set('platform')} className={selectCls}>
                          <option value="" disabled className="bg-[#0A1020]">Select a platform...</option>
                          {PLATFORMS.map(p => (
                            <option key={p} value={p} className="bg-[#0A1020]">{p}</option>
                          ))}
                          <option value="All Platforms" className="bg-[#0A1020]">All Platforms</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </motion.div>
                  )}

                  {/* Message — not required for waitlist */}
                  {!isWaitlist && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-1.5"
                    >
                      <label className="text-xs font-medium text-slate-500">Message *</label>
                      <textarea
                        required={!isWaitlist}
                        rows={5}
                        value={form.message}
                        onChange={set('message')}
                        placeholder="Tell us what you're working on or looking for..."
                        className={`${inputCls} resize-none`}
                      />
                    </motion.div>
                  )}

                  {state === 'error' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                      Something went wrong. Please try again.
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="btn-primary w-full justify-center disabled:opacity-50 text-sm"
                  >
                    {state === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isWaitlist ? (
                      <><Users className="w-4 h-4 relative z-10" />Join Waitlist</>
                    ) : (
                      <>Send Message <ArrowRight className="w-4 h-4 relative z-10" /></>
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>

          {/* Contact info strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-4 justify-center"
          >
            {[
              { icon: Send, label: 'Quick response', desc: 'Within 24 hours' },
              { icon: Globe, label: 'Global reach', desc: 'Serving worldwide' },
              { icon: Zap, label: 'AI-powered', desc: 'Smart routing' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5 px-4 py-2.5 glass rounded-xl border border-white/5">
                <item.icon className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-xs font-medium text-white">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
