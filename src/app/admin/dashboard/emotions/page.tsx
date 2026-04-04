'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Heart, Brain, TrendingUp, TrendingDown, Minus, Activity,
  Users, BarChart3, Smile, Frown, Meh, AlertTriangle, Zap,
  RefreshCw, BookOpen, Sparkles,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────── */
interface DashboardData {
  totalAnalyses: number
  averageConfidence: number
  emotionDistribution: Record<string, number>
  activeProfiles: number
  learningSignals: number
  systemMood: string
  driftSummary: {
    improving: number
    declining: number
    unstable: number
    stable: number
  }
}

/* ── Helpers ───────────────────────────────────────────────────── */
const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const EMOTION_COLORS: Record<string, string> = {
  joy: 'text-yellow-400',
  sadness: 'text-blue-400',
  anger: 'text-red-400',
  fear: 'text-purple-400',
  surprise: 'text-orange-400',
  disgust: 'text-green-400',
  trust: 'text-cyan-400',
  anticipation: 'text-indigo-400',
  frustration: 'text-rose-400',
  confusion: 'text-amber-400',
  excitement: 'text-pink-400',
  neutral: 'text-slate-400',
}

const MOOD_ICONS: Record<string, typeof Smile> = {
  joy: Smile,
  excitement: Sparkles,
  sadness: Frown,
  anger: AlertTriangle,
  frustration: Frown,
  neutral: Meh,
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ── Card wrapper ──────────────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-5 ${className}`}>
      {children}
    </div>
  )
}

/* ── Stat pill ─────────────────────────────────────────────────── */
function Stat({ label, value, icon: Icon, color = 'text-white' }: {
  label: string
  value: string | number
  icon: typeof Heart
  color?: string
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-white/[0.04] ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-white font-mono">{value}</p>
        </div>
      </div>
    </Card>
  )
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function EmotionsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/emotions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success === false) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-6 h-6 text-pink-400 animate-spin" />
        <span className="ml-3 text-sm text-slate-500">Loading emotional intelligence…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={load} className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const MoodIcon = MOOD_ICONS[data.systemMood] ?? Meh
  const moodColor = EMOTION_COLORS[data.systemMood] ?? 'text-slate-400'

  const driftTotal = data.driftSummary.improving + data.driftSummary.declining +
    data.driftSummary.unstable + data.driftSummary.stable

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="space-y-6">

      {/* Header */}
      <motion.div variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" /> Emotional Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time emotion detection, personality adaptation &amp; learning</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </motion.div>

      {/* Top stats */}
      <motion.div variants={fadeIn} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Total Analyses" value={data.totalAnalyses.toLocaleString()} icon={BarChart3} color="text-blue-400" />
        <Stat label="Avg Confidence" value={`${Math.round(data.averageConfidence * 100)}%`} icon={Zap} color="text-yellow-400" />
        <Stat label="Active Profiles" value={data.activeProfiles} icon={Users} color="text-cyan-400" />
        <Stat label="Learning Signals" value={data.learningSignals} icon={BookOpen} color="text-indigo-400" />
        <Stat label="System Mood" value={capitalize(data.systemMood)} icon={MoodIcon} color={moodColor} />
        <Stat label="Drift Tracked" value={driftTotal} icon={Activity} color="text-emerald-400" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emotion Distribution */}
        <motion.div variants={fadeIn}>
          <Card>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Emotion Distribution
            </h2>
            {Object.keys(data.emotionDistribution).length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">No emotion data yet — run analyses first</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(data.emotionDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, weight]) => (
                    <div key={emotion} className="flex items-center gap-3">
                      <span className={`text-xs w-24 truncate ${EMOTION_COLORS[emotion] ?? 'text-slate-400'}`}>
                        {capitalize(emotion)}
                      </span>
                      <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-violet-500 rounded-full transition-all"
                          style={{ width: `${Math.round(weight * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono w-10 text-right">
                        {Math.round(weight * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Drift Overview */}
        <motion.div variants={fadeIn}>
          <Card>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Emotional Drift
            </h2>
            {driftTotal === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">No drift data — profiles build over time</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <DriftCard label="Improving" count={data.driftSummary.improving} total={driftTotal} icon={TrendingUp} color="text-emerald-400" bgColor="bg-emerald-400/10" />
                <DriftCard label="Declining" count={data.driftSummary.declining} total={driftTotal} icon={TrendingDown} color="text-red-400" bgColor="bg-red-400/10" />
                <DriftCard label="Unstable" count={data.driftSummary.unstable} total={driftTotal} icon={AlertTriangle} color="text-amber-400" bgColor="bg-amber-400/10" />
                <DriftCard label="Stable" count={data.driftSummary.stable} total={driftTotal} icon={Minus} color="text-slate-400" bgColor="bg-slate-400/10" />
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Models & Pipeline info */}
      <motion.div variants={fadeIn}>
        <Card>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" /> System Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <InfoBlock label="Primary Model" value="roberta-base-go_emotions" />
            <InfoBlock label="Secondary Model" value="emotion-english-distilroberta-base" />
            <InfoBlock label="Fallback Model" value="bert-base-uncased-emotion" />
            <InfoBlock label="Detection Target" value="< 300 ms" />
            <InfoBlock label="Emotion Types" value="12 types" />
            <InfoBlock label="Personality Types" value="8 adaptive modes" />
            <InfoBlock label="Drift Window" value="10 interactions" />
            <InfoBlock label="Memory Limit" value="100 per user" />
            <InfoBlock label="Pipeline" value="detect → memory → personality → modulate" />
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

/* ── Sub-components ────────────────────────────────────────────── */

function DriftCard({ label, count, total, icon: Icon, color, bgColor }: {
  label: string; count: number; total: number; icon: typeof TrendingUp; color: string; bgColor: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className={`rounded-xl p-3 ${bgColor} border border-white/[0.04]`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-white font-mono">{count}</span>
        <span className="text-[10px] text-slate-500">({pct}%)</span>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white font-mono">{value}</p>
    </div>
  )
}
