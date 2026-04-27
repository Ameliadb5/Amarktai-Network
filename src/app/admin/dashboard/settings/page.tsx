'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings2, Zap, FolderGit2, RefreshCw, CheckCircle, AlertCircle,
  ExternalLink, ShieldCheck, Key, ArrowRight,
} from 'lucide-react'

interface GenXStatus {
  configured: boolean
  available: boolean
  error: string | null
  apiUrl: string | null
  modelCount: number
  adultCapability: { supported: boolean; reason: string | null }
}

interface GitHubStatus {
  valid: boolean
  username: string | null
  error?: string
}

interface Integration {
  key: string
  displayName: string
  configured: boolean
  maskedKey: string
  source: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function SettingsPage() {
  const [genx, setGenx] = useState<GenXStatus | null>(null)
  const [github, setGithub] = useState<GitHubStatus | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [genxRes, ghRes, intgRes] = await Promise.allSettled([
        fetch('/api/admin/genx/status'),
        fetch('/api/admin/github/validate'),
        fetch('/api/admin/integration-keys'),
      ])
      if (genxRes.status === 'fulfilled' && genxRes.value.ok) setGenx(await genxRes.value.json())
      if (ghRes.status === 'fulfilled' && ghRes.value.ok) setGithub(await ghRes.value.json())
      if (intgRes.status === 'fulfilled' && intgRes.value.ok) {
        const d = await intgRes.value.json()
        setIntegrations(d.integrations ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const fallbackProviders = integrations.filter(i => i.key !== 'github' && i.key !== 'genx')
  const configuredFallbacks = fallbackProviders.filter(i => i.configured)

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Settings</h1>
              </div>
              <p className="text-sm text-slate-400">Configuration status for GenX AI, GitHub integration, and provider keys.</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* GenX AI */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<Zap className="h-5 w-5 text-cyan-400" />}
          title="GenX AI Layer"
          badge={genx?.available ? { label: 'Online', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
            : genx?.configured ? { label: 'Configured — unreachable', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
            : { label: 'Not configured', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {genx?.available
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />}
              <span className="text-sm text-slate-300">
                {loading ? 'Checking…'
                  : genx?.available ? `Connected · ${genx.modelCount} models in catalog`
                  : genx?.configured ? (genx.error ?? 'Configured but unreachable')
                  : 'Set GENX_API_URL and GENX_API_KEY environment variables to enable GenX'}
              </span>
            </div>
            {genx?.apiUrl && (
              <div className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span className="text-xs text-slate-500 font-mono">{genx.apiUrl}</span>
              </div>
            )}
            {genx?.adultCapability?.supported && (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="text-xs text-slate-400">Adult content capability enabled</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <p>Configure via environment variables: <code className="text-slate-400 bg-white/5 px-1 py-0.5 rounded">GENX_API_URL</code> and <code className="text-slate-400 bg-white/5 px-1 py-0.5 rounded">GENX_API_KEY</code></p>
            </div>
            <a
              href="/admin/dashboard/genx-models"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              View model catalog <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </SectionCard>
      </motion.div>

      {/* GitHub */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<FolderGit2 className="h-5 w-5 text-slate-300" />}
          title="GitHub Integration"
          badge={github?.valid
            ? { label: `Connected${github.username ? ` · @${github.username}` : ''}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
            : { label: 'Not connected', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {github?.valid
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                : <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />}
              <span className="text-sm text-slate-300">
                {loading ? 'Checking…'
                  : github?.valid
                    ? `Connected as @${github.username} — repo import, code edit, push, PR, and deploy enabled`
                    : (github?.error ?? 'Add a GitHub personal access token to enable repo workflow')}
              </span>
            </div>
            {github?.valid && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">Repo listing</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">Branch browsing</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">File push</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">PR creation</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">workflow_dispatch deploy</span>
              </div>
            )}
            <a
              href="/admin/dashboard/integrations"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              Manage GitHub token in Integrations <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </SectionCard>
      </motion.div>

      {/* Fallback / Specialist Providers */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<Key className="h-5 w-5 text-slate-400" />}
          title="Fallback &amp; Specialist Providers"
          badge={{ label: `${configuredFallbacks.length} configured`, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              These providers are only used when GenX is unavailable or for specialist capabilities not covered by GenX (e.g. ElevenLabs TTS, specific image providers).
            </p>
            {fallbackProviders.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fallbackProviders.map(p => (
                  <div key={p.key} className={`rounded-xl border p-3 text-xs ${p.configured ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-transparent opacity-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{p.displayName}</span>
                      {p.configured
                        ? <span className="text-emerald-400">●</span>
                        : <span className="text-slate-600">○</span>}
                    </div>
                    <span className="text-slate-500">{p.configured ? 'Configured' : 'Not set'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No provider keys loaded yet.</p>
            )}
            <a
              href="/admin/dashboard/integrations"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
            >
              Manage all integration keys <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </SectionCard>
      </motion.div>

      {/* Adult Content */}
      {genx && (
        <motion.div variants={fadeUp}>
          <SectionCard
            icon={<ShieldCheck className="h-5 w-5 text-violet-400" />}
            title="Adult Capability"
            badge={genx.adultCapability?.supported
              ? { label: 'Enabled via GenX', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }
              : { label: 'Not available', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
          >
            <p className="text-xs text-slate-500">
              {genx.adultCapability?.supported
                ? `Adult content generation is available through the GenX AI layer. ${genx.adultCapability.reason ?? ''}`
                : 'Adult content capability is not available from the configured GenX endpoint. No adult content will be generated.'}
            </p>
          </SectionCard>
        </motion.div>
      )}
    </motion.div>
  )
}

function SectionCard({
  icon, title, badge, children,
}: {
  icon: React.ReactNode
  title: string
  badge?: { label: string; color: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {badge && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
        )}
      </div>
      {children}
    </div>
  )
}
