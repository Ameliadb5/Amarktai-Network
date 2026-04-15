'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Building2, Handshake, TrendingUp, Users, Mail, ArrowRight } from 'lucide-react'

type FormState = 'idle' | 'loading' | 'success' | 'error'
type EnquiryType = 'investor' | 'client' | 'partnership' | 'enterprise' | 'careers' | 'other'

const ENQUIRY_TYPES: { value: EnquiryType; label: string; description: string }[] = [
  { value: 'investor', label: 'Investment & Funding', description: 'Capital partnerships, funding discussions, and investor relations' },
  { value: 'client', label: 'Product & Commercial', description: 'Deploying or licensing the intelligence layer for your business' },
  { value: 'partnership', label: 'Strategic Partnership', description: 'Technical integrations, co-development, and ecosystem partnerships' },
  { value: 'enterprise', label: 'Enterprise Enquiry', description: 'Large-scale deployment, custom requirements, and system integrations' },
  { value: 'careers', label: 'Join the Team', description: "Working with us — engineering, product, operations, and beyond" },
  { value: 'other', label: 'Other Serious Enquiry', description: "Anything substantive that doesn't fit the above" },
]

const inputCls = 'w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all'
const selectCls = 'w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none'

const CONTACT_PILLARS = [
  { icon: TrendingUp, label: 'Investors', desc: 'Funding, equity, and growth conversations' },
  { icon: Building2, label: 'Enterprise', desc: 'Serious product and system deployments' },
  { icon: Handshake, label: 'Partnerships', desc: 'Strategic and technical integrations' },
  { icon: Users, label: 'Careers', desc: 'Join the team building the intelligence layer' },
]

export default function ContactPage() {
  const [state, setState] = useState<FormState>('idle')
  const [form, setForm] = useState({
    name: '',
    email: '',
    organisation: '',
    enquiryType: '' as EnquiryType | '',
    message: '',
  })

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          companyOrProject: form.organisation,
          message: `[${form.enquiryType?.toUpperCase()}] ${form.message}`,
        }),
      })
      if (!res.ok) throw new Error()
      setState('success')
    } catch {
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setForm({ name: '', email: '', organisation: '', enquiryType: '', message: '' })
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white overflow-x-hidden">
      <Header />

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/[0.06] blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-blue-600/5 blur-[120px]" />
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-36 pb-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Request Access</p>
          <h1 className="font-heading text-5xl sm:text-6xl font-extrabold tracking-tight mb-5">
            Get in <span className="gradient-text">Touch</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            AmarktAI Network is currently available by request.
            Whether you&apos;re building, investing, partnering, or looking to join — we want to hear from you.
          </p>
        </motion.div>

        {/* Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-12 grid grid-cols-2 gap-3 max-w-xl mx-auto sm:grid-cols-4"
        >
          {CONTACT_PILLARS.map((p) => (
            <div key={p.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-4 text-center">
              <p.icon className="mx-auto mb-2 h-5 w-5 text-blue-400" />
              <p className="text-xs font-semibold text-white">{p.label}</p>
              <p className="mt-1 text-[11px] text-slate-500 leading-snug">{p.desc}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Form */}
      <section className="relative z-10 px-4 sm:px-6 pb-32">
        <div className="max-w-xl mx-auto">
          {state === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-emerald-500/20 bg-white/[0.03] p-10 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-heading text-2xl font-bold mb-2">Message Received</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                Thank you for reaching out. We review every enquiry and will respond to yours directly.
              </p>
              <button onClick={reset} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Send another message
              </button>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Email *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@company.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Organisation <span className="text-slate-700">(optional)</span></label>
                <input
                  type="text"
                  value={form.organisation}
                  onChange={set('organisation')}
                  placeholder="Company, fund, or project name"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Nature of Enquiry *</label>
                <div className="relative">
                  <select
                    required
                    value={form.enquiryType}
                    onChange={set('enquiryType')}
                    className={selectCls}
                  >
                    <option value="" disabled className="bg-[#0a0f1a]">Select the type of enquiry</option>
                    {ENQUIRY_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-[#0a0f1a]">{t.label}</option>
                    ))}
                  </select>
                  <ArrowRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-600" />
                </div>
                {form.enquiryType && (
                  <p className="text-xs text-slate-600 pl-1">
                    {ENQUIRY_TYPES.find(t => t.value === form.enquiryType)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Message *</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Tell us what you are working on, what you are looking for, or how you would like to connect..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {state === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>Something went wrong. Please check your connection and try again.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full py-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-0.5"
              >
                {state === 'loading' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>Send Enquiry <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-700">
                We respond to every serious enquiry. Expect a reply within 1–2 business days.
              </p>
            </motion.form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
