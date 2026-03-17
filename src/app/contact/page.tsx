'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  Mail, MessageSquare, ArrowRight, CheckCircle, Loader2,
  Zap, Network, Globe, Sparkles,
} from 'lucide-react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const reasons = [
  { icon: Zap, title: 'Partnership Enquiry', desc: 'Explore technology or business partnerships with Amarktai Network.' },
  { icon: Network, title: 'Integration Request', desc: 'Connect your platform to the Amarktai intelligence layer.' },
  { icon: Globe, title: 'Invitation Access', desc: 'Apply for early access to Amarktai Crypto or Forex.' },
  { icon: MessageSquare, title: 'General Enquiry', desc: 'Any other questions about what we\'re building.' },
]

export default function ContactPage() {
  const [contactState, setContactState] = useState<FormState>('idle')
  const [waitlistState, setWaitlistState] = useState<FormState>('idle')
  const [contactForm, setContactForm] = useState({ name: '', email: '', companyOrProject: '', message: '' })
  const [waitlistForm, setWaitlistForm] = useState({ name: '', email: '', interest: '' })

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setContactState('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })
      if (res.ok) {
        setContactState('success')
        setContactForm({ name: '', email: '', companyOrProject: '', message: '' })
      } else {
        setContactState('error')
      }
    } catch {
      setContactState('error')
    }
  }

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistState('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waitlistForm),
      })
      if (res.ok) {
        setWaitlistState('success')
        setWaitlistForm({ name: '', email: '', interest: '' })
      } else {
        setWaitlistState('error')
      }
    } catch {
      setWaitlistState('error')
    }
  }

  const inputClass = "w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all duration-200"

  return (
    <div className="min-h-screen bg-[#050816]">
      <Header />

      {/* Hero */}
      <section className="relative pt-40 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-violet-600/6 rounded-full blur-[80px]" />
          <div className="absolute inset-0 grid-bg opacity-20" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs text-blue-400 mb-6 border border-blue-500/20"
          >
            <Sparkles className="w-3 h-3" />
            Let&apos;s Connect
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] mb-5"
            style={{ fontFamily: 'Space Grotesk' }}
          >
            <span className="text-white">Start a</span>{' '}
            <span className="gradient-text">Conversation</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-slate-400 max-w-xl mx-auto"
          >
            Whether you want to collaborate, request access, or simply say hello — we respond to every message.
          </motion.p>
        </div>
      </section>

      {/* Reason chips */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {reasons.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass-card rounded-xl p-4 text-center ring-hover cursor-default"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-3 text-blue-400">
                  <r.icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>{r.title}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Forms */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden border border-blue-500/15">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Send a Message</h2>
                  <p className="text-xs text-slate-500">We typically respond within 24 hours</p>
                </div>
              </div>

              {contactState === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4 border border-emerald-500/30">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>Message Sent</h3>
                  <p className="text-sm text-slate-400">We&apos;ll be in touch shortly.</p>
                  <button
                    onClick={() => setContactState('idle')}
                    className="mt-5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Send another →
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Name</label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@company.com"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Company or Project</label>
                    <input
                      type="text"
                      value={contactForm.companyOrProject}
                      onChange={e => setContactForm(f => ({ ...f, companyOrProject: e.target.value }))}
                      placeholder="Optional"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={contactForm.message}
                      onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us what you&apos;re working on or looking for..."
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  {contactState === 'error' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                      Something went wrong. Please try again.
                    </motion.p>
                  )}
                  <button
                    type="submit"
                    disabled={contactState === 'loading'}
                    className="btn-primary w-full justify-center disabled:opacity-50"
                  >
                    {contactState === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Send Message <ArrowRight className="w-4 h-4 relative z-10" /></>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          {/* Waitlist Form */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="glass-card rounded-2xl p-8 relative overflow-hidden border border-violet-500/15">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="flex items-center gap-3 mb-7">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-400 border border-violet-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Join the Waitlist</h2>
                  <p className="text-xs text-slate-500">Get early access when we launch</p>
                </div>
              </div>

              {waitlistState === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-violet-500/15 flex items-center justify-center mb-4 border border-violet-500/30">
                    <CheckCircle className="w-7 h-7 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>You&apos;re on the List</h3>
                  <p className="text-sm text-slate-400">We&apos;ll notify you when access opens.</p>
                  <button
                    onClick={() => setWaitlistState('idle')}
                    className="mt-5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Register another →
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Name</label>
                    <input
                      type="text"
                      required
                      value={waitlistForm.name}
                      onChange={e => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={waitlistForm.email}
                      onChange={e => setWaitlistForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@company.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Area of Interest</label>
                    <select
                      value={waitlistForm.interest}
                      onChange={e => setWaitlistForm(f => ({ ...f, interest: e.target.value }))}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="" className="bg-[#0A1020]">Select a platform...</option>
                      <option value="crypto" className="bg-[#0A1020]">Amarktai Crypto</option>
                      <option value="forex" className="bg-[#0A1020]">Amarktai Forex</option>
                      <option value="faith-haven" className="bg-[#0A1020]">Faith Haven</option>
                      <option value="learn-digital" className="bg-[#0A1020]">Learn Digital</option>
                      <option value="jobs-sa" className="bg-[#0A1020]">Jobs SA</option>
                      <option value="kinship" className="bg-[#0A1020]">Kinship</option>
                      <option value="secure" className="bg-[#0A1020]">Amarktai Secure</option>
                      <option value="crowd-lens" className="bg-[#0A1020]">Crowd Lens</option>
                      <option value="all" className="bg-[#0A1020]">All Platforms</option>
                    </select>
                  </div>
                  <div className="glass rounded-xl p-4 border border-violet-500/15">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      By joining the waitlist, you&apos;ll receive priority access notifications and early feature previews. We don&apos;t spam — only meaningful updates.
                    </p>
                  </div>
                  {waitlistState === 'error' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                      Something went wrong. Please try again.
                    </motion.p>
                  )}
                  <button
                    type="submit"
                    disabled={waitlistState === 'loading'}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20"
                  >
                    {waitlistState === 'loading' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Join Waitlist <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
