'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Volume2,
  Smartphone,
  Mail,
  Shield,
  BellOff,
  RefreshCw,
  Zap,
} from 'lucide-react'

interface HealingIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  action: string
  affectedResource: string
  detectedAt: string
  autoHealed: boolean
}

interface HealingResponse {
  healthScore: number
  issues: HealingIssue[]
}

const severityLegend = [
  {
    level: 'Critical',
    color: 'bg-red-500',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/20',
    description: 'Immediate action required — system failures, security breaches',
    icon: AlertCircle,
  },
  {
    level: 'Warning',
    color: 'bg-amber-500',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    description: 'Attention needed — degraded performance, threshold alerts',
    icon: AlertTriangle,
  },
  {
    level: 'Info',
    color: 'bg-blue-500',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    description: 'General updates — deployments, config changes, status reports',
    icon: Info,
  },
]

const notificationChannels = [
  { name: 'Push Notifications', icon: Smartphone, status: 'Coming soon' },
  { name: 'Voice Alerts', icon: Volume2, status: 'Coming soon' },
  { name: 'Email Digest', icon: Mail, status: 'Coming soon' },
]

const SEVERITY_ICONS = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

export default function AlertsPage() {
  const [issues, setIssues] = useState<HealingIssue[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/healing')
      if (res.ok) {
        const data: HealingResponse = await res.json()
        setIssues(data.issues ?? [])
      }
    } catch {
      // Healing API may not be reachable — that's ok
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const totalCount = issues.length

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white font-heading">
              Alerts & Notifications
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Aggregated alerts from self-healing engine and system monitors
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Explanation Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5 border border-blue-500/10"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-heading">
              Centralized Alert Hub
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              Alerts are sourced from the self-healing engine, provider health
              checks, budget monitors, and content moderation events. Critical
              issues require immediate attention.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Severity Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-sm font-semibold text-white mb-3 font-heading">
          Alert Severity Levels
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {severityLegend.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.level}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className={`glass rounded-2xl p-4 border ${item.borderColor}`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <Icon className={`w-4 h-4 ${item.textColor}`} />
                  <span className={`text-sm font-semibold ${item.textColor}`}>
                    {item.level}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Alert Feed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white font-heading">
            Alert Feed
          </h2>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {warningCount} Warning
              </span>
            )}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
              <Bell className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                {totalCount} Alert{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading alerts...</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4">
              <BellOff className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-sm text-slate-400">All systems healthy — no alerts</p>
            <p className="text-xs text-slate-600 mt-1.5 max-w-md">
              Alerts will appear here when the self-healing engine detects
              provider failures, budget overages, or content violations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, i) => {
              const SevIcon = SEVERITY_ICONS[issue.severity]
              const colorClass = SEVERITY_COLORS[issue.severity]
              return (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`rounded-xl border p-4 ${colorClass.split(' ').slice(1).join(' ')} bg-white/[0.02]`}
                >
                  <div className="flex items-start gap-3">
                    <SevIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass.split(' ')[0]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{issue.title}</span>
                        {issue.autoHealed && (
                          <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Auto-healed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{issue.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                        <span>Resource: {issue.affectedResource}</span>
                        <span>Action: {issue.action}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Notification Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <h2 className="text-sm font-semibold text-white mb-3 font-heading">
          Notification Channels
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {notificationChannels.map((channel, i) => {
            const Icon = channel.icon
            return (
              <motion.div
                key={channel.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="glass rounded-2xl p-4 border border-white/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">{channel.name}</p>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                        {channel.status}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-5 rounded-full bg-slate-800 border border-slate-700">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-600 mt-[2px] ml-[2px]" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
