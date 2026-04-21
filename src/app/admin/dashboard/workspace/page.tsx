'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { FlaskConical, Rocket, ImageIcon, Mic, Film, Music, Layers, Workflow, GitBranch, Bot, HelpCircle, RefreshCw } from 'lucide-react'

const TestAITab = dynamic(() => import('../build-studio/tabs/TestAITab'), { ssr: false })
const CreateAppTab = dynamic(() => import('../build-studio/tabs/CreateAppTab'), { ssr: false })
const AppBuilderTab = dynamic(() => import('../build-studio/tabs/AppBuilderTab'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('../build-studio/tabs/CreatorStudioTab'), { ssr: false })
const WorkflowBuilderTab = dynamic(() => import('../build-studio/tabs/WorkflowBuilderTab'), { ssr: false })
const GitHubTab = dynamic(() => import('../build-studio/tabs/GitHubTab'), { ssr: false })
const CompareTab = dynamic(() => import('../build-studio/tabs/CompareTab'), { ssr: false })
const OnboardingAssistantTab = dynamic(() => import('../build-studio/tabs/OnboardingAssistantTab'), { ssr: false })
const AIPartnerWidget = dynamic(() => import('@/components/AIPartnerWidget'), { ssr: false })

type TabKey = 'test-ai' | 'build-app' | 'images' | 'voice' | 'video' | 'music' | 'compare' | 'workflows' | 'export' | 'onboard'

const tabs: { key: TabKey; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { key: 'test-ai', label: 'Test AI', icon: FlaskConical },
  { key: 'build-app', label: 'Build App', icon: Rocket },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'video', label: 'Video', icon: Film },
  { key: 'music', label: 'Music', icon: Music },
  { key: 'compare', label: 'Compare', icon: Layers },
  { key: 'workflows', label: 'Workflows', icon: Workflow },
  { key: 'export', label: 'Export', icon: GitBranch },
  { key: 'onboard', label: 'Onboard App', icon: HelpCircle },
]

interface UsageSummary {
  totalRequests: number
  totalCostCents: number
  byCapability: Record<string, { requests: number; costCents: number }>
  byProvider: Record<string, { requests: number; costCents: number }>
}

export default function WorkspacePage() {
  const [active, setActive] = useState<TabKey>('test-ai')
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [partnerOpen, setPartnerOpen] = useState(false)

  const loadUsage = useCallback(() => {
    setLoadingUsage(true)
    fetch('/api/admin/usage?appSlug=workspace&days=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setUsage(d?.usage ?? null) })
      .catch(() => { setUsage(null) })
      .finally(() => { setLoadingUsage(false) })
  }, [])

  useEffect(() => { loadUsage() }, [loadUsage])

  // Top capabilities by cost for the breakdown display
  const topCapabilities = usage
    ? Object.entries(usage.byCapability)
        .filter(([, v]) => v.costCents > 0)
        .sort((a, b) => b[1].costCents - a[1].costCents)
        .slice(0, 5)
    : []

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1226] to-[#050a17] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Workspace</h1>
            <p className="mt-1 text-sm text-slate-400">Central operator hub for testing AI, building apps, generating media, comparing outputs, and preparing export.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadUsage}
              disabled={loadingUsage}
              title="Refresh usage stats"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setPartnerOpen(o => !o)}
              title="Toggle AI Partner"
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                partnerOpen
                  ? 'border-blue-400/40 bg-blue-400/10 text-blue-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="h-4 w-4" />
              AI Partner
            </button>
          </div>
        </div>

        {/* Budget / usage summary */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <span>
              Requests (30d):&nbsp;
              <span className="text-white font-medium">{usage?.totalRequests ?? 0}</span>
            </span>
            <span>
              Est. cost (30d):&nbsp;
              <span className={`font-medium ${(usage?.totalCostCents ?? 0) > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                ${((usage?.totalCostCents ?? 0) / 100).toFixed(4)}
              </span>
            </span>
          </div>

          {/* Per-capability breakdown — only show when there is real data */}
          {topCapabilities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {topCapabilities.map(([cap, v]) => (
                <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400">
                  {cap.replace(/_/g, ' ')}: <span className="text-white">${(v.costCents / 100).toFixed(4)}</span>
                  {' · '}{v.requests} req
                </span>
              ))}
            </div>
          )}

          {usage && usage.totalRequests > 0 && usage.totalCostCents === 0 && (
            <p className="text-[11px] text-amber-400">
              Requests recorded but cost shows $0.0000 — this may mean all calls failed or ran before cost metering was active.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActive(tab.key)} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition ${active === tab.key ? 'border-cyan-400/40 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'}`}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {active === 'test-ai' && <TestAITab />}
        {active === 'build-app' && (
          <div className="space-y-5">
            <AppBuilderTab />
            <CreateAppTab />
          </div>
        )}
        {active === 'images' && <CreatorStudioTab initialMode="image" />}
        {active === 'voice' && <CreatorStudioTab initialMode="voice" />}
        {active === 'video' && <CreatorStudioTab initialMode="video" />}
        {active === 'music' && <CreatorStudioTab initialMode="music" />}
        {active === 'compare' && <CompareTab />}
        {active === 'workflows' && <WorkflowBuilderTab />}
        {active === 'export' && <GitHubTab />}
        {active === 'onboard' && <OnboardingAssistantTab />}
      </motion.div>

      {/* AI Partner floating widget */}
      <AIPartnerWidget open={partnerOpen} onClose={() => setPartnerOpen(false)} />
    </div>
  )
}
