'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Shield, Key, Globe, Database, Bell, Lock,
  RefreshCw, AlertCircle, CheckCircle,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

/* ─── Types ─── */

interface Provider {
  id: number | string
  providerKey: string
  displayName: string
  enabled: boolean
  maskedPreview: string
  healthStatus: string
  healthMessage: string
}

interface ReadinessReport {
  overallReady: boolean
  score: number
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  criticalFailures: number
  summary: string
}

interface MemoryStatus {
  available: boolean
  totalEntries: number
  appSlugs: string[]
  statusLabel: 'saving' | 'empty' | 'not_configured'
  error: string | null
}

interface HealingStatus {
  totalIssues: number
  criticalCount: number
  warningCount: number
  infoCount: number
  resolvedCount: number
  autoHealedCount: number
  healthScore: number
}

interface DashboardData {
  providers: Provider[] | null
  readiness: ReadinessReport | null
  memory: MemoryStatus | null
  healing: HealingStatus | null
}

/* ─── Helpers ─── */

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-rose-400'
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'error' }) {
  const colors = {
    ok: 'bg-emerald-400',
    warn: 'bg-amber-400',
    error: 'bg-rose-400',
  }
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />
}

function SectionShell({
  icon: Icon,
  color,
  title,
  description,
  loading,
  error,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>
  color: string
  title: string
  description: string
  loading: boolean
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4 hover:border-white/[0.1] transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

/* ─── Main ─── */

export default function AccessPage() {
  const [data, setData] = useState<DashboardData>({
    providers: null,
    readiness: null,
    memory: null,
    healing: null,
  })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string | null>>({
    providers: null,
    readiness: null,
    memory: null,
    healing: null,
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setErrors({ providers: null, readiness: null, memory: null, healing: null })

    const endpoints = [
      { key: 'providers', url: '/api/admin/providers' },
      { key: 'readiness', url: '/api/admin/readiness' },
      { key: 'memory', url: '/api/admin/memory' },
      { key: 'healing', url: '/api/admin/healing' },
    ] as const

    const results: Record<string, unknown> = {}
    const errs: Record<string, string | null> = {}

    await Promise.all(
      endpoints.map(async ({ key, url }) => {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          results[key] = await res.json()
          errs[key] = null
        } catch (e) {
          results[key] = null
          errs[key] = e instanceof Error ? e.message : 'Unknown error'
        }
      }),
    )

    setData({
      providers: results.providers as Provider[] | null,
      readiness: results.readiness as ReadinessReport | null,
      memory: results.memory as MemoryStatus | null,
      healing: results.healing as HealingStatus | null,
    })
    setErrors(errs)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const allLoaded = !loading

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Access</h1>
          <p className="text-sm text-slate-400 mt-1">
            Settings, admin controls, and system configuration
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Notice */}
      <motion.div
        variants={fadeUp}
        className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex items-start gap-3"
      >
        <Settings className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-white font-medium">Configuration Hub</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Live system configuration and access controls.
            Data refreshes automatically on page load.
          </p>
        </div>
      </motion.div>

      {/* Settings Grid */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* ── Admin Controls ── */}
        <SectionShell
          icon={Shield}
          color="text-blue-400"
          title="Admin Controls"
          description="Session management and admin access."
          loading={false}
          error={null}
        >
          <ul className="space-y-3">
            <li className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Session</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Authenticated
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Role</span>
              <span className="text-white font-medium">Admin</span>
            </li>
            <li className="pt-1">
              <a
                href="/api/admin/logout"
                className="inline-flex items-center gap-1.5 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
              >
                Sign out of admin session →
              </a>
            </li>
          </ul>
        </SectionShell>

        {/* ── API Keys & Secrets ── */}
        <SectionShell
          icon={Key}
          color="text-amber-400"
          title="API Keys & Secrets"
          description="Provider credentials and integration keys."
          loading={loading}
          error={errors.providers}
        >
          {data.providers && data.providers.length > 0 ? (
            <ul className="space-y-2.5">
              {data.providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate mr-2">{p.displayName}</span>
                  {p.maskedPreview ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                      <StatusDot status={p.healthStatus === 'healthy' ? 'ok' : 'warn'} />
                      {p.maskedPreview}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <StatusDot status="error" />
                      Not configured
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No providers configured.</p>
          )}
        </SectionShell>

        {/* ── Network Configuration ── */}
        <SectionShell
          icon={Globe}
          color="text-emerald-400"
          title="Network Configuration"
          description="System readiness and network health."
          loading={loading}
          error={errors.readiness}
        >
          {data.readiness && (
            <ul className="space-y-2.5">
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Readiness score</span>
                <span className={`font-mono font-semibold ${scoreColor(data.readiness.score)}`}>
                  {data.readiness.score}%
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Overall ready</span>
                <span className={data.readiness.overallReady ? 'text-emerald-400' : 'text-rose-400'}>
                  {data.readiness.overallReady ? 'Yes' : 'No'}
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Checks passed</span>
                <span className="text-white font-mono">{data.readiness.passed}/{data.readiness.totalChecks}</span>
              </li>
              {data.readiness.criticalFailures > 0 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Critical failures</span>
                  <span className="text-rose-400 font-mono">{data.readiness.criticalFailures}</span>
                </li>
              )}
              {data.readiness.warnings > 0 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Warnings</span>
                  <span className="text-amber-400 font-mono">{data.readiness.warnings}</span>
                </li>
              )}
            </ul>
          )}
        </SectionShell>

        {/* ── Data Management ── */}
        <SectionShell
          icon={Database}
          color="text-violet-400"
          title="Data Management"
          description="Memory storage and data lifecycle."
          loading={loading}
          error={errors.memory}
        >
          {data.memory && (
            <ul className="space-y-2.5">
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status</span>
                <span className={`flex items-center gap-1.5 ${data.memory.available ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <StatusDot status={data.memory.available ? 'ok' : 'error'} />
                  {data.memory.statusLabel === 'saving' ? 'Active' : data.memory.statusLabel === 'empty' ? 'Empty' : 'Not configured'}
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total entries</span>
                <span className="text-white font-mono">{data.memory.totalEntries.toLocaleString()}</span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Active apps</span>
                <span className="text-white font-mono">{data.memory.appSlugs.length}</span>
              </li>
              {data.memory.error && (
                <li className="flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {data.memory.error}
                </li>
              )}
            </ul>
          )}
        </SectionShell>

        {/* ── Notifications ── */}
        <SectionShell
          icon={Bell}
          color="text-rose-400"
          title="Notifications"
          description="Alert summary and healing status."
          loading={loading}
          error={errors.healing}
        >
          {data.healing && (
            <ul className="space-y-2.5">
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Health score</span>
                <span className={`font-mono font-semibold ${scoreColor(data.healing.healthScore)}`}>
                  {data.healing.healthScore}/100
                </span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total issues</span>
                <span className="text-white font-mono">{data.healing.totalIssues}</span>
              </li>
              {data.healing.criticalCount > 0 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Critical</span>
                  <span className="text-rose-400 font-mono">{data.healing.criticalCount}</span>
                </li>
              )}
              {data.healing.warningCount > 0 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Warnings</span>
                  <span className="text-amber-400 font-mono">{data.healing.warningCount}</span>
                </li>
              )}
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Resolved</span>
                <span className="text-emerald-400 font-mono">{data.healing.resolvedCount}</span>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Auto-healed</span>
                <span className="text-blue-400 font-mono">{data.healing.autoHealedCount}</span>
              </li>
            </ul>
          )}
        </SectionShell>

        {/* ── Security ── */}
        <SectionShell
          icon={Lock}
          color="text-cyan-400"
          title="Security"
          description="Content filtering and safety configuration."
          loading={false}
          error={null}
        >
          <ul className="space-y-2.5">
            <li className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Content filter</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Safety mode</span>
              <span className="text-white font-medium">Enabled</span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Audit logging</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            </li>
            {allLoaded && data.readiness && (
              <li className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Security checks</span>
                <span className={`font-mono ${data.readiness.overallReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.readiness.overallReady ? 'Passing' : 'Review needed'}
                </span>
              </li>
            )}
          </ul>
        </SectionShell>
      </motion.div>
    </motion.div>
  )
}
