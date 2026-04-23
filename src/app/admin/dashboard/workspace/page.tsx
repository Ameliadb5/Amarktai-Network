'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  FlaskConical,
  Rocket,
  ImageIcon,
  Mic,
  Film,
  Music,
  Layers,
  Workflow,
  RefreshCw,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import type { AssistantAction } from '@/components/AIPartnerWidget'

const TestAITab = dynamic(() => import('../build-studio/tabs/TestAITab'), { ssr: false })
const CreateAppTab = dynamic(() => import('../build-studio/tabs/CreateAppTab'), { ssr: false })
const AppBuilderTab = dynamic(() => import('../build-studio/tabs/AppBuilderTab'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('../build-studio/tabs/CreatorStudioTab'), { ssr: false })
const WorkflowBuilderTab = dynamic(() => import('../build-studio/tabs/WorkflowBuilderTab'), { ssr: false })
const CompareTab = dynamic(() => import('../build-studio/tabs/CompareTab'), { ssr: false })
const AIPartnerWidget = dynamic(() => import('@/components/AIPartnerWidget'), { ssr: false })

type TabKey = 'test-ai' | 'build-app' | 'images' | 'voice' | 'video' | 'music' | 'compare' | 'workflows'

const tabs: { key: TabKey; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { key: 'test-ai', label: 'Run Tasks', icon: FlaskConical },
  { key: 'build-app', label: 'Build Apps', icon: Rocket },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'video', label: 'Video', icon: Film },
  { key: 'music', label: 'Music', icon: Music },
  { key: 'compare', label: 'Compare', icon: Layers },
  { key: 'workflows', label: 'Workflows', icon: Workflow },
]

interface UsageSummary {
  totalRequests: number
  totalCostCents: number
  byCapability: Record<string, { requests: number; costCents: number }>
  byProvider: Record<string, { requests: number; costCents: number }>
}

const SECTION_TO_TAB: Record<string, TabKey> = {
  'test-ai': 'test-ai',
  test: 'test-ai',
  'build-app': 'build-app',
  build: 'build-app',
  images: 'images',
  image: 'images',
  voice: 'voice',
  video: 'video',
  music: 'music',
  compare: 'compare',
  models: 'compare',
  workflows: 'workflows',
}

const normalizeCapabilityName = (value: string) => value.replace(/_/g, ' ')

export default function WorkspacePage() {
  const router = useRouter()
  const [active, setActive] = useState<TabKey>('test-ai')
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [partnerOpen, setPartnerOpen] = useState(false)

  const handleAction = useCallback((action: AssistantAction) => {
    if (action.type === 'navigate_to') {
      const section = action.payload?.section ?? ''
      const tabKey = SECTION_TO_TAB[section]
      if (tabKey) {
        setActive(tabKey)
        return
      }
      const routes: Record<string, string> = {
        apps: '/admin/dashboard/apps',
        brain: '/admin/dashboard/intelligence',
        intelligence: '/admin/dashboard/intelligence',
        artifacts: '/admin/dashboard/artifacts',
        budget: '/admin/dashboard/operations',
        operations: '/admin/dashboard/operations',
        onboarding: '/admin/dashboard/onboarding',
        events: '/admin/dashboard/events',
        providers: '/admin/dashboard/operations',
        models: '/admin/dashboard/models',
      }
      if (routes[section]) router.push(routes[section])
    } else if (action.type === 'show_artifacts') {
      router.push('/admin/dashboard/artifacts')
    } else if (action.type === 'check_budget') {
      router.push('/admin/dashboard/operations')
    } else if (action.type === 'start_onboarding') {
      router.push('/admin/dashboard/onboarding')
    } else if (action.type === 'generate_image') {
      setActive('images')
    } else if (action.type === 'run_test') {
      setActive('test-ai')
    }
  }, [router])

  const loadUsage = useCallback(() => {
    setLoadingUsage(true)
    fetch('/api/admin/usage?appSlug=workspace&days=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setUsage(d?.usage ?? null) })
      .catch(() => { setUsage(null) })
      .finally(() => { setLoadingUsage(false) })
  }, [])

  useEffect(() => { loadUsage() }, [loadUsage])

  const topCapabilities = usage
    ? Object.entries(usage.byCapability)
        .filter(([, v]) => v.requests > 0)
        .sort((a, b) => b[1].requests - a[1].requests)
        .slice(0, 4)
    : []

  const topProviders = usage
    ? Object.entries(usage.byProvider)
        .filter(([, v]) => v.requests > 0)
        .sort((a, b) => b[1].requests - a[1].requests)
        .slice(0, 3)
    : []

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1226] to-[#050a17] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Workspace Control Room</h1>
            <p className="mt-1 text-sm text-slate-400">Run tasks, build apps, generate outputs, compare models, and orchestrate workflows from one operator surface.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadUsage}
              disabled={loadingUsage}
              title="Refresh usage stats"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setPartnerOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${partnerOpen ? 'border-blue-400/40 bg-blue-400/10 text-blue-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
            >
              {partnerOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              AI Buddy
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Requests (30d)" value={usage?.totalRequests ?? 0} />
          <SummaryCard label="Cost (30d)" value={`$${((usage?.totalCostCents ?? 0) / 100).toFixed(4)}`} />
          <SummaryCard label="Top capability" value={topCapabilities[0] ? normalizeCapabilityName(topCapabilities[0][0]) : '—'} />
          <SummaryCard label="Top provider" value={topProviders[0] ? topProviders[0][0] : '—'} />
        </div>

        {(topCapabilities.length > 0 || topProviders.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {topCapabilities.map(([cap, v]) => (
              <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-300">
                {normalizeCapabilityName(cap)} · {v.requests} req
              </span>
            ))}
            {topProviders.map(([provider, v]) => (
              <span key={provider} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                {provider} · {v.requests} req
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition ${active === tab.key ? 'border-cyan-400/40 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${partnerOpen ? 'xl:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}>
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
        </motion.div>

        {partnerOpen && (
          <aside className="h-[calc(100vh-220px)] min-h-[620px]">
            <AIPartnerWidget
              open={partnerOpen}
              variant="panel"
              onClose={() => setPartnerOpen(false)}
              onAction={handleAction}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
