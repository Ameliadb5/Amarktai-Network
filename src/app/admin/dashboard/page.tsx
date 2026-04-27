'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  AppWindow,
  Sparkles,
  Zap,
  Archive,
  Rocket,
  Settings2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  GitBranch,
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

interface GenXStatusData {
  configured: boolean
  available: boolean
  apiUrl: string | null
  modelCount: number
  adultCapability?: { supported: boolean }
}

interface GitHubStatusData {
  valid: boolean
  username?: string | null
}

const sections = [
  { href: '/admin/dashboard/workspace',   label: 'Workspace',     icon: Sparkles,  desc: 'AI developer cockpit — prompt, generate, edit code, and deploy.' },
  { href: '/admin/dashboard/apps',        label: 'Apps & Agents', icon: AppWindow, desc: 'Manage connected apps and their AI agent configuration.' },
  { href: '/admin/dashboard/genx-models', label: 'GenX Models',   icon: Zap,       desc: 'GenX catalog, model capabilities, and execution layer status.' },
  { href: '/admin/dashboard/artifacts',   label: 'Artifacts',     icon: Archive,   desc: 'Review generated text, image, audio, video, and code outputs.' },
  { href: '/admin/dashboard/deployments', label: 'Deployments',   icon: Rocket,    desc: 'GitHub Actions workflow runs, deploy status, and logs.' },
  { href: '/admin/dashboard/settings',    label: 'Settings',      icon: Settings2, desc: 'Configure GenX API, GitHub integration, and provider keys.' },
]

export default function DashboardOverview() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [genxStatus, setGenxStatus] = useState<GenXStatusData | null>(null)
  const [githubStatus, setGithubStatus] = useState<GitHubStatusData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [dashRes, genxRes, ghRes] = await Promise.allSettled([
        fetch('/api/admin/dashboard'),
        fetch('/api/admin/genx/status'),
        fetch('/api/admin/github/validate'),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        setDashboard(await dashRes.value.json())
      }
      if (genxRes.status === 'fulfilled' && genxRes.value.ok) {
        setGenxStatus(await genxRes.value.json())
      }
      if (ghRes.status === 'fulfilled' && ghRes.value.ok) {
        setGithubStatus(await ghRes.value.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const success = dashboard?.brainStats?.successCount ?? 0
  const total = dashboard?.brainStats?.totalRequests ?? 0
  const successRate = total > 0 ? `${Math.round((success / total) * 100)}%` : '—'

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#101a34] to-[#060d1b] p-6">
        <h1 className="text-2xl font-bold text-white">Operator Console</h1>
        <p className="mt-1 text-sm text-slate-400">Amarktai Network — AI execution, GitHub workflow, and deployment control.</p>
      </div>

      {/* Real metrics from brain stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Connected Apps"    value={dashboard?.metrics?.totalProducts ?? 0} />
        <MetricCard label="Executed Requests" value={dashboard?.brainStats?.totalRequests ?? 0} />
        <MetricCard label="Success Rate"      value={successRate} />
        <MetricCard label="Avg Latency"       value={dashboard?.brainStats?.avgLatencyMs ? `${Math.round(dashboard.brainStats.avgLatencyMs)} ms` : '—'} />
      </div>

      {/* Integration status */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* GenX status */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">GenX AI Layer</p>
          <div className="mt-3 flex items-center gap-2">
            {genxStatus?.available
              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
              : <AlertCircle className="h-4 w-4 text-amber-400" />}
            <span className="text-sm text-slate-200">
              {genxStatus?.available ? 'Connected' : genxStatus?.configured ? 'Configured — unreachable' : 'Not configured'}
            </span>
          </div>
          {genxStatus?.apiUrl && (
            <p className="mt-2 text-xs text-slate-500 font-mono">{genxStatus.apiUrl}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
            {genxStatus?.modelCount != null && (
              <span>{genxStatus.modelCount} models</span>
            )}
            {genxStatus?.adultCapability?.supported && (
              <span className="text-violet-400">Adult capability enabled</span>
            )}
          </div>
          <Link href="/admin/dashboard/genx-models" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            View catalog <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* GitHub status */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">GitHub Integration</p>
          <div className="mt-3 flex items-center gap-2">
            {githubStatus?.valid
              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
              : <AlertCircle className="h-4 w-4 text-amber-400" />}
            <span className="text-sm text-slate-200">
              {githubStatus?.valid
                ? `Connected${githubStatus.username ? ` as ${githubStatus.username}` : ''}`
                : 'Not connected'}
            </span>
          </div>
          {githubStatus?.valid && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <GitBranch className="h-3 w-3" />
              <span>Repo import, code edit, push, and deploy available</span>
            </div>
          )}
          <Link href="/admin/dashboard/deployments" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            View deployments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Navigation section cards */}
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
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}
