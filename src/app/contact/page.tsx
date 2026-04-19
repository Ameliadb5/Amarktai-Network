'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Cpu, Sparkles } from 'lucide-react'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', org: '', type: '', message: '' })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          companyOrProject: form.org,
          message: `[${form.type || 'ACCESS'}] ${form.message}`,
        }),
      })
      if (!res.ok) throw new Error('request failed')
      setOk(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Header />
      <main className="px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <section>
            <p className="text-label text-blue-300">Controlled Access</p>
            <h1 className="text-headline mt-4">Request operator access to Amarktai Network.</h1>
            <p className="mt-5 max-w-xl text-slate-300">
              Share your product objective and deployment context. We onboard teams where the platform can create real strategic leverage.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: ShieldCheck, text: 'Private onboarding, not open-signup access.' },
                { icon: Cpu, text: 'Multi-app operator environments only.' },
                { icon: Sparkles, text: 'Capability packs enabled per approved use case.' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <item.icon className="h-4 w-4 text-cyan-300" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card-premium p-7">
            {ok ? (
              <div className="py-14 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
                <h2 className="mt-4 text-xl font-semibold">Request received</h2>
                <p className="mt-2 text-sm text-slate-400">Our team will review your access request and respond directly.</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" type="email" placeholder="Work email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" placeholder="Company / project" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} />
                <select className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">Select request type</option>
                  <option>Enterprise access</option>
                  <option>Partnership</option>
                  <option>Integrator onboarding</option>
                  <option>Investment conversation</option>
                </select>
                <textarea className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" rows={5} placeholder="Describe your use case" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                {error && <p className="text-xs text-red-300">Unable to submit right now. Please retry.</p>}
                <button disabled={loading} className="btn-primary w-full justify-center" type="submit">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Send Request
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
