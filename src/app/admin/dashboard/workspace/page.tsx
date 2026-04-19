'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { FlaskConical, Rocket, ImageIcon, Mic, Film, Music, Layers, Workflow, GitBranch } from 'lucide-react'

const TestAITab = dynamic(() => import('../build-studio/tabs/TestAITab'), { ssr: false })
const CreateAppTab = dynamic(() => import('../build-studio/tabs/CreateAppTab'), { ssr: false })
const AppBuilderTab = dynamic(() => import('../build-studio/tabs/AppBuilderTab'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('../build-studio/tabs/CreatorStudioTab'), { ssr: false })
const WorkflowBuilderTab = dynamic(() => import('../build-studio/tabs/WorkflowBuilderTab'), { ssr: false })
const GitHubTab = dynamic(() => import('../build-studio/tabs/GitHubTab'), { ssr: false })
const CompareTab = dynamic(() => import('../build-studio/tabs/CompareTab'), { ssr: false })

type TabKey = 'test-ai' | 'build-app' | 'images' | 'voice' | 'video' | 'music' | 'compare' | 'workflows' | 'export'

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
]

export default function WorkspacePage() {
  const [active, setActive] = useState<TabKey>('test-ai')
  const [usage, setUsage] = useState<{ totalRequests: number; totalCostCents: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/usage?appSlug=workspace&days=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) {
          setUsage(d?.usage ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setUsage(null)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1226] to-[#050a17] p-6">
        <h1 className="text-2xl font-bold text-white">Workspace</h1>
        <p className="mt-1 text-sm text-slate-400">Central operator hub for testing AI, building apps, generating media, comparing outputs, and preparing export.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <span>Workspace requests (30d): <span className="text-white">{usage?.totalRequests ?? 0}</span></span>
          <span>Workspace est. cost (30d): <span className="text-white">${(((usage?.totalCostCents ?? 0) / 100)).toFixed(2)}</span></span>
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
      </motion.div>
    </div>
  )
}
