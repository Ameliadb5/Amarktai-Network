'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Code2, Palette, Workflow, BookOpen, GitBranch,
  Layers,
} from 'lucide-react'

/* ── Lazy tab imports via dynamic rendering ─────────────────── */
import dynamic from 'next/dynamic'

const TestAITab = dynamic(() => import('./tabs/TestAITab'), { ssr: false })
const CreateAppTab = dynamic(() => import('./tabs/CreateAppTab'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('./tabs/CreatorStudioTab'), { ssr: false })
const WorkflowBuilderTab = dynamic(() => import('./tabs/WorkflowBuilderTab'), { ssr: false })
const SkillLibraryTab = dynamic(() => import('./tabs/SkillLibraryTab'), { ssr: false })
const GitHubTab = dynamic(() => import('./tabs/GitHubTab'), { ssr: false })
const CompareTab = dynamic(() => import('./tabs/CompareTab'), { ssr: false })

/* ── Tab config ─────────────────────────────────────────────── */

const TABS = [
  { key: 'test-ai',        label: 'Test AI',        icon: FlaskConical },
  { key: 'compare',        label: 'Compare',        icon: Layers },
  { key: 'create-app',     label: 'Create App',     icon: Code2 },
  { key: 'creator-studio', label: 'Creator Studio', icon: Palette },
  { key: 'workflows',      label: 'Workflows',      icon: Workflow },
  { key: 'skills',         label: 'Skill Library',  icon: BookOpen },
  { key: 'github',         label: 'GitHub',         icon: GitBranch },
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
        <h1 className="text-2xl font-bold text-white">Build Studio</h1>
        <p className="text-sm text-slate-400 mt-1">
          Test AI capabilities, create apps, build workflows, and deploy — all in one place.
        </p>
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={fadeUp} className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/[0.06]">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium whitespace-nowrap rounded-t-lg transition-all duration-200
                ${active
                  ? 'text-white bg-blue-500/10 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                }`}
            >
              <tab.icon className={`w-4 h-4 ${active ? 'text-blue-400' : ''}`} />
              {tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* Tab content */}
      <motion.div variants={fadeUp}>
        {activeTab === 'test-ai'        && <TestAITab />}
        {activeTab === 'compare'        && <CompareTab />}
        {activeTab === 'create-app'     && <CreateAppTab />}
        {activeTab === 'creator-studio' && <CreatorStudioTab />}
        {activeTab === 'workflows'      && <WorkflowBuilderTab />}
        {activeTab === 'skills'         && <SkillLibraryTab />}
        {activeTab === 'github'         && <GitHubTab />}
      </motion.div>
    </motion.div>
  )
}
