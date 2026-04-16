'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Building2, Handshake, TrendingUp, Users, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'

type FormState = 'idle' | 'loading' | 'success' | 'error'
type EnquiryType = 'investor' | 'client' | 'partnership' | 'enterprise' | 'careers' | 'other'

const ENQUIRY_TYPES: { value: EnquiryType; label: string }[] = [
  { value: 'investor', label: 'Investment & Funding' },
  { value: 'client', label: 'Product & Commercial' },
  { value: 'partnership', label: 'Strategic Partnership' },
  { value: 'enterprise', label: 'Enterprise Enquiry' },
  { value: 'careers', label: 'Join the Team' },
  { value: 'other', label: 'Other Enquiry' },
]

const inputCls = 'w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all'

const CONTACT_PILLARS = [
  { icon: TrendingUp, label: 'Investors', desc: 'Funding and growth conversations' },
  { icon: Building2, label: 'Enterprise', desc: 'Serious product deployments' },
  { icon: Handshake, label: 'Partnerships', desc: 'Strategic integrations' },
  { icon: Users, label: 'Careers', desc: 'Join the team' },
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

  return (
    <div className="min-h-screen bg-[#030712]">
      <Header />

      <section className="relative pt-40 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="ambient-drift absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-[150px]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left: Info */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.15em] text-blue-400">
                Get in Touch
              </p>
              <h1 className="font-heading text-4xl sm:text-5xl font-bold leading-[1.05] mb-6 tracking-tight text-white">
                Serious Enquiries<br />
                <span className="text-slate-400">Welcome.</span>
              </h1>
              <p className="text-slate-400 leading-relaxed mb-10 max-w-md">
                Amarktai Network is available by request. Whether you&apos;re looking to invest, partner, deploy, or join — start here.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {CONTACT_PILLARS.map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <item.icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Form */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
            >
              {state === 'success' ? (
                <div className="card-premium p-10 text-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Message Received</h3>
                  <p className="text-sm text-slate-400">Thank you. We will be in touch shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="card-premium p-8 space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name" required value={form.name} onChange={set('name')} className={inputCls} />
                    <input type="email" placeholder="Email" required value={form.email} onChange={set('email')} className={inputCls} />
                  </div>
                  <input type="text" placeholder="Organisation (optional)" value={form.organisation} onChange={set('organisation')} className={inputCls} />
                  <select value={form.enquiryType} onChange={set('enquiryType')} required className={`${inputCls} appearance-none`}>
                    <option value="" disabled>Select enquiry type</option>
                    {ENQUIRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <textarea placeholder="Tell us about your enquiry…" required rows={5} value={form.message} onChange={set('message')} className={`${inputCls} resize-none`} />
                  {state === 'error' && (
                    <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
                  )}
                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="group w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
                  >
                    {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
                    {state === 'loading' ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
