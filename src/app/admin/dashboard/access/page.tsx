'use client'

import { motion } from 'framer-motion'
import {
  Settings, Shield, Key, Globe, Database, Bell, Lock,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const sections = [
  {
    icon: Shield,
    color: 'text-blue-400',
    title: 'Admin Controls',
    description: 'User roles, permissions, and admin session management.',
    items: ['Admin role management', 'Session timeout configuration', 'Login security settings'],
  },
  {
    icon: Key,
    color: 'text-amber-400',
    title: 'API Keys & Secrets',
    description: 'Manage API keys, tokens, and integration secrets.',
    items: ['Brain API keys', 'Provider credentials', 'Integration tokens', 'Webhook secrets'],
  },
  {
    icon: Globe,
    color: 'text-emerald-400',
    title: 'Network Configuration',
    description: 'Domain settings, CORS, and network policies.',
    items: ['Allowed origins', 'Rate limiting', 'IP allowlists', 'CORS configuration'],
  },
  {
    icon: Database,
    color: 'text-violet-400',
    title: 'Data Management',
    description: 'Database, storage, and data lifecycle settings.',
    items: ['Memory retention policy', 'Event log retention', 'Cache configuration', 'Data export'],
  },
  {
    icon: Bell,
    color: 'text-rose-400',
    title: 'Notifications',
    description: 'Alert channels and notification preferences.',
    items: ['Alert thresholds', 'Notification channels', 'Escalation rules', 'Quiet hours'],
  },
  {
    icon: Lock,
    color: 'text-cyan-400',
    title: 'Security',
    description: 'Content filtering, safety, and compliance settings.',
    items: ['Content filter levels', 'Safety mode configuration', 'Audit logging', 'Compliance settings'],
  },
]

export default function AccessPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white font-heading">Access</h1>
        <p className="text-sm text-slate-400 mt-1">
          Settings, admin controls, and system configuration
        </p>
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
            System configuration controls will be fully available in Phase 2.
            Below is the planned settings structure.
          </p>
        </div>
      </motion.div>

      {/* Settings Grid */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div
              key={section.title}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 space-y-4 hover:border-white/[0.1] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center ${section.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </div>
              </div>

              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-400"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-slate-600 font-mono">
                  Coming in Phase 2
                </span>
              </div>
            </div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
