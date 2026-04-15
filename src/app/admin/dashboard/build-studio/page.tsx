'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Code2, Workflow, GitBranch,
  Layers, ImageIcon, Mic, Film, Music,
} from 'lucide-react'

/* ── Lazy tab imports ────────────────────────────────────────── */
import dynamic from 'next/dynamic'

const TestAITab = dynamic(() => import('./tabs/TestAITab'), { ssr: false })
const CreateAppTab = dynamic(() => import('./tabs/CreateAppTab'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('./tabs/CreatorStudioTab'), { ssr: false })
const WorkflowBuilderTab = dynamic(() => import('./tabs/WorkflowBuilderTab'), { ssr: false })
const GitHubTab = dynamic(() => import('./tabs/GitHubTab'), { ssr: false })
const CompareTab = dynamic(() => import('./tabs/CompareTab'), { ssr: false })

/* ── Tab config ──────────────────────────────────────────────── */

const TABS = [
  { key: 'test-ai',     label: 'Test AI',       icon: FlaskConical, desc: 'Test any AI capability live', color: 'text-blue-400' },
  { key: 'create-app',  label: 'Create App',    icon: Code2,        desc: 'AI-powered app scaffolding', color: 'text-emerald-400' },
  { key: 'images',      label: 'Images',        icon: ImageIcon,    desc: 'Generate images with AI', color: 'text-pink-400' },
  { key: 'voice',       label: 'Voice',         icon: Mic,          desc: 'Text-to-speech & speech-to-text', color: 'text-violet-400' },
  { key: 'video',       label: 'Video',         icon: Film,         desc: 'Generate video content', color: 'text-cyan-400' },
  { key: 'music',       label: 'Music',         icon: Music,        desc: 'Create music & audio', color: 'text-amber-400' },
  { key: 'compare',     label: 'Compare',       icon: Layers,       desc: 'Side-by-side model comparison', color: 'text-indigo-400' },
  { key: 'workflows',   label: 'Workflows',     icon: Workflow,     desc: 'Multi-step AI sequences', color: 'text-rose-400' },
  { key: 'export',      label: 'Export',        icon: GitBranch,    desc: 'GitHub export & deploy', color: 'text-slate-400' },
] as const

type TabKey = (typeof TABS)[number]['key']

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

export default function BuildStudioPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('test-ai')

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading tracking-tight">Studio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Your unified workspace. Test AI, create apps, generate media, compare models, and export.
        </p>
      </motion.div>

      {/* Tab bar — redesigned with visual emphasis */}
      <motion.div variants={fadeUp} className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              title={tab.desc}
              className={`group flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap rounded-xl transition-all duration-200
                ${active
                  ? 'text-white bg-white/[0.06] border border-white/[0.10] shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                }`}
            >
              <tab.icon className={`w-4 h-4 ${active ? tab.color : 'group-hover:text-white'}`} />
              {tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* Tab content */}
      <motion.div variants={fadeUp}>
        {activeTab === 'test-ai'     && <TestAITab />}
        {activeTab === 'compare'     && <CompareTab />}
        {activeTab === 'create-app'  && <CreateAppTab />}
        {activeTab === 'images'      && <CreatorStudioTab initialMode="image" />}
        {activeTab === 'voice'       && <CreatorStudioTab initialMode="voice" />}
        {activeTab === 'video'       && <CreatorStudioTab initialMode="video" />}
        {activeTab === 'music'       && <CreatorStudioTab initialMode="music" />}
        {activeTab === 'workflows'   && <WorkflowBuilderTab />}
        {activeTab === 'export'      && <GitHubTab />}
      </motion.div>
    </motion.div>
  )
}
