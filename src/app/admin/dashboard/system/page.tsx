'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Server, Activity, Settings, Mic, ArrowRight } from 'lucide-react'

const tabs = [
  { key: 'operations', label: 'Operations', route: '/admin/dashboard/operations', icon: Server, desc: 'Providers, models, budgets, alerts, and readiness.' },
  { key: 'events', label: 'Events', route: '/admin/dashboard/events', icon: Activity, desc: 'Operational event timelines and diagnostics.' },
  { key: 'settings', label: 'Settings', route: '/admin/dashboard/access', icon: Settings, desc: 'Access controls and platform configuration.' },
  { key: 'voice-access', label: 'Voice Access', route: '/admin/dashboard/system/voice-access', icon: Mic, desc: 'Future login-ready voice enrollment and microphone states.' },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function SystemHubPage() {
  const [active, setActive] = useState<TabKey>('operations')
  const tab = tabs.find(t => t.key === active) ?? tabs[0]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0f162c] to-[#070d1a] p-6">
        <h1 className="text-2xl font-bold text-white">System</h1>
        <p className="mt-1 text-sm text-slate-400">Infrastructure controls, operational observability, and security setup.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setActive(item.key)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${active === item.key ? 'border-cyan-400/40 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      <div className="card-premium p-6">
        <h2 className="text-lg font-semibold text-white">{tab.label}</h2>
        <p className="mt-2 text-sm text-slate-400">{tab.desc}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Condensed operator-critical controls</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Clear status, errors, and next actions</div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">Future-ready voice access integration path</div>
        </div>
        <Link href={tab.route} className="btn-primary mt-5 inline-flex">Open {tab.label} <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  )
}
