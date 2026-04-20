'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Server, Activity, Settings, Mic, ArrowRight } from 'lucide-react'

const tabs = [
  {
    key: 'operations',
    label: 'Operations',
    route: '/admin/dashboard/operations',
    icon: Server,
    desc: 'Providers, models, budgets, alerts, and readiness.',
    links: [
      { label: 'Operations', href: '/admin/dashboard/operations' },
    ],
  },
  {
    key: 'events',
    label: 'Events',
    route: '/admin/dashboard/events',
    icon: Activity,
    desc: 'Operational event timelines and diagnostics.',
    links: [
      { label: 'Events', href: '/admin/dashboard/events' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/admin/dashboard/access',
    icon: Settings,
    desc: 'Access controls and platform configuration.',
    links: [
      { label: 'Access & Settings', href: '/admin/dashboard/access' },
    ],
  },
  {
    key: 'voice-access',
    label: 'Voice Access',
    route: '/admin/dashboard/system/voice-access',
    icon: Mic,
    desc: 'Voice assistant config, wake phrase, login bridge, and enrollment.',
    links: [
      { label: 'Voice Access Setup', href: '/admin/dashboard/system/voice-access' },
      { label: 'Voice Login Bridge', href: '/admin/voice-login' },
    ],
  },
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
        <div className="flex items-center gap-3 mb-3">
          <tab.icon className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">{tab.label}</h2>
        </div>
        <p className="text-sm text-slate-400">{tab.desc}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {tab.links.map(l => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-all">
              {l.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
