'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AppWindow, Brain, Server, Sparkles, Archive, RefreshCw } from 'lucide-react'

interface OverviewData {
  metrics?: {
    totalProducts?: number
    totalIntegrations?: number
    totalContacts?: number
    totalWaitlist?: number
  }
  brainStats?: {
    totalRequests?: number
    successCount?: number
    avgLatencyMs?: number | null
  }
}

const sections = [
  { href: '/admin/dashboard/apps', label: 'Apps', icon: AppWindow, desc: 'Manage connected apps and agent assignments.' },
  { href: '/admin/dashboard/workspace', label: 'Workspace', icon: Sparkles, desc: 'Main operator work area for creation and testing.' },
  { href: '/admin/dashboard/intelligence', label: 'Intelligence', icon: Brain, desc: 'Routing, memory, learning, and capability layers.' },
  { href: '/admin/dashboard/artifacts', label: 'Artifacts', icon: Archive, desc: 'All generated outputs — images, audio, video, code.' },
  { href: '/admin/dashboard/operations', label: 'Operations', icon: Server, desc: 'Providers, models, budgets, and health monitoring.' },
]

export default function DashboardOverview() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dashboard')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060d1b] p-6">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">Amarktai Network operator command center with high-signal section access.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Connected Apps', value: data?.metrics?.totalProducts ?? 0 },
          { label: 'Integrations', value: data?.metrics?.totalIntegrations ?? 0 },
          { label: 'Total Requests', value: data?.brainStats?.totalRequests ?? 0 },
          { label: 'Avg Latency', value: data?.brainStats?.avgLatencyMs ? `${Math.round(data.brainStats.avgLatencyMs)} ms` : '—' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="card-premium p-5">
            <section.icon className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 text-base font-semibold text-white">{section.label}</h2>
            <p className="mt-1 text-sm text-slate-400">{section.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-300">Open section <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </div>

      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:text-white">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh overview
      </button>
    </div>
  )
}
