'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Sparkles,
  Building2,
  Briefcase,
} from 'lucide-react'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    org: '',
    role: '',
    volume: '',
    type: '',
    message: '',
  })

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
          message: `[${form.type || 'ACCESS'} | ${form.role} | ${form.volume}] ${form.message}`,
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
      <main className="px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1.1fr]">
          <section>
            <p className="text-label text-blue-300">Controlled onboarding</p>
            <h1 className="text-headline mt-4">Request operator access to Amarktai Network.</h1>
            <p className="mt-5 max-w-xl text-slate-300">
              Access is reviewed for teams building serious AI products where orchestration quality, reliability, and cost control matter.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: ShieldCheck, text: 'Private onboarding, not open-signup onboarding.' },
                { icon: Cpu, text: 'Configured around production capabilities and deployment realities.' },
                { icon: Sparkles, text: 'Capability and provider access scoped per approved use case.' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <item.icon className="h-4 w-4 text-cyan-300" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p className="font-semibold text-white">Best fit profiles</p>
              <ul className="mt-3 space-y-2">
                <li className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-300" /> Product organizations operating multiple AI features.</li>
                <li className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-violet-300" /> Builders/integrators requiring provider routing + operational control.</li>
              </ul>
            </div>
          </section>

          <section className="card-premium p-7">
            {ok ? (
              <div className="py-14 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
                <h2 className="mt-4 text-xl font-semibold">Request received</h2>
                <p className="mt-2 text-sm text-slate-400">Our team will review your onboarding request and respond directly.</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-slate-400">
                    Full name
                    <input aria-label="Full name" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Work email
                    <input aria-label="Work email" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" type="email" placeholder="Work email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                </div>

                <label className="block text-xs text-slate-400">
                  Company / project
                  <input aria-label="Company or project" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" placeholder="Company / project" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} />
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-xs text-slate-400">
                    Role
                    <select aria-label="Role" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="">Select role</option>
                      <option>Founder / Executive</option>
                      <option>Product / Engineering Lead</option>
                      <option>Operator / AI Team</option>
                      <option>Integrator / Agency</option>
                    </select>
                  </label>

                  <label className="block text-xs text-slate-400">
                    AI volume
                    <select aria-label="AI volume" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" required value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })}>
                      <option value="">Select volume</option>
                      <option>Exploring (pre-scale)</option>
                      <option>Low production</option>
                      <option>Medium production</option>
                      <option>High-volume production</option>
                    </select>
                  </label>

                  <label className="block text-xs text-slate-400">
                    Request type
                    <select aria-label="Request type" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      <option value="">Select request type</option>
                      <option>Enterprise access</option>
                      <option>Product integration</option>
                      <option>Partnership</option>
                      <option>Strategic conversation</option>
                    </select>
                  </label>
                </div>

                <label className="block text-xs text-slate-400">
                  Use case and current stack
                  <textarea aria-label="Use case description" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" rows={6} placeholder="Describe current AI workflows, goals, and required capabilities" required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </label>

                {error && <p className="text-xs text-red-300">Unable to submit right now. Please retry.</p>}
                <button disabled={loading} className="btn-primary w-full justify-center" type="submit">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Send Access Request
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
