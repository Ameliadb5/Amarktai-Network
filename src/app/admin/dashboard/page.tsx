'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  AppWindow,
  Sparkles,
  Brain,
  Archive,
  Server,
  Activity,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Database,
} from 'lucide-react'

interface DashboardData {
  metrics?: {
    totalProducts?: number
    totalIntegrations?: number
  }
  brainStats?: {
    totalRequests?: number
    successCount?: number
    avgLatencyMs?: number | null
  }
}

interface UsageData {
  totalRequests: number
  totalCostCents: number
  byProvider: Record<string, { requests: number; costCents: number }>
}

interface JobsData {
  queue?: {
    healthy?: boolean
    backendAvailable?: boolean
  }
}

interface ReadinessData {
  score?: number
  summary?: {
    failed?: number
    critical?: number
    warnings?: number
  }
}

const sections = [
  { href: '/admin/dashboard/workspace', label: 'Workspace', icon: Sparkles, desc: 'Run tasks, route models, and operate generation surfaces.' },
  { href: '/admin/dashboard/apps', label: 'Apps', icon: AppWindow, desc: 'Manage connected products and their AI runtime state.' },
  { href: '/admin/dashboard/models', label: 'Model Registry', icon: Brain, desc: 'Inspect available models, providers, and capabilities.' },
  { href: '/admin/dashboard/operations', label: 'Operations', icon: Server, desc: 'Provider health, budgets, readiness, and control actions.' },
  { href: '/admin/dashboard/artifacts', label: 'Artifacts', icon: Archive, desc: 'Review generated outputs across modalities.' },
  { href: '/admin/dashboard/events', label: 'Events', icon: Activity, desc: 'Inspect execution traces and operational event streams.' },
]

export default function DashboardOverview() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [jobs, setJobs] = useState<JobsData | null>(null)
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [dashRes, usageRes, jobsRes, readinessRes] = await Promise.allSettled([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/usage?platform=true&days=30'),
        fetch('/api/admin/jobs'),
        fetch('/api/admin/readiness'),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        setDashboard(await dashRes.value.json())
      }
      if (usageRes.status === 'fulfilled' && usageRes.value.ok) {
        const d = await usageRes.value.json()
        setUsage(d?.usage ?? null)
      }
      if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
        setJobs(await jobsRes.value.json())
      }
      if (readinessRes.status === 'fulfilled' && readinessRes.value.ok) {
        setReadiness(await readinessRes.value.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const success = dashboard?.brainStats?.successCount ?? 0
  const total = dashboard?.brainStats?.totalRequests ?? 0
  const successRate = total > 0 ? `${Math.round((success / total) * 100)}%` : '—'

  const topProvider = usage
    ? Object.entries(usage.byProvider)
        .sort((a, b) => b[1].requests - a[1].requests)[0]
    : null

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060d1b] p-6">
        <h1 className="text-2xl font-bold text-white">Operator Overview</h1>
        <p className="mt-1 text-sm text-slate-400">Live operational signal across routing, usage, readiness, and system queue health.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Connected Apps" value={dashboard?.metrics?.totalProducts ?? 0} source="/api/admin/dashboard" />
        <MetricCard label="Executed Requests" value={dashboard?.brainStats?.totalRequests ?? 0} source="/api/admin/dashboard" />
        <MetricCard label="Success Rate" value={successRate} source="/api/admin/dashboard" />
        <MetricCard label="Avg Latency" value={dashboard?.brainStats?.avgLatencyMs ? `${Math.round(dashboard.brainStats.avgLatencyMs)} ms` : '—'} source="/api/admin/dashboard" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Queue Health</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {jobs?.queue?.backendAvailable ? <Database className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            <span className="text-slate-200">{jobs?.queue?.backendAvailable ? 'Queue backend connected' : 'Queue backend unavailable'}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {jobs?.queue?.healthy ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            <span className="text-slate-300">{jobs?.queue?.healthy ? 'Queue status healthy' : 'Queue degraded'}</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Source: /api/admin/jobs</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Readiness</p>
          <p className="mt-2 text-2xl font-semibold text-white">{readiness?.score ?? '—'}</p>
          <p className="text-xs text-slate-400">Go-live readiness score</p>
          <div className="mt-3 text-xs text-slate-300 space-y-1">
            <p>Critical: {readiness?.summary?.critical ?? 0}</p>
            <p>Failed checks: {readiness?.summary?.failed ?? 0}</p>
            <p>Warnings: {readiness?.summary?.warnings ?? 0}</p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Source: /api/admin/readiness</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Usage (30d)</p>
          <p className="mt-2 text-2xl font-semibold text-white">{usage?.totalRequests ?? 0}</p>
          <p className="text-xs text-slate-400">Total metered requests</p>
          <p className="mt-3 text-sm text-slate-300">Cost: ${((usage?.totalCostCents ?? 0) / 100).toFixed(4)}</p>
          {topProvider && <p className="mt-1 text-xs text-slate-400">Top provider: {topProvider[0]} ({topProvider[1].requests} req)</p>}
          <p className="mt-3 text-[11px] text-slate-500">Source: /api/admin/usage</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="card-premium p-5">
            <section.icon className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-3 text-base font-semibold text-white">{section.label}</h2>
            <p className="mt-1 text-sm text-slate-400">{section.desc}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-300">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </Link>
        ))}
      </div>

      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 hover:text-white">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh overview
      </button>
    </div>
  )
}

function MetricCard({ label, value, source }: { label: string; value: string | number; source: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-[10px] text-slate-500">Source: {source}</p>
    </div>
  )
}
