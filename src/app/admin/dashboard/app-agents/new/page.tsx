'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Bot, Globe, Shield, MessageSquare,
  Loader2, Zap, Heart, BookOpen, Sparkles,
} from 'lucide-react'

/* ── Constants ─────────────────────────────────────────────── */
const APP_TYPES = [
  'general', 'finance', 'crypto', 'education', 'health', 'creative',
  'marketing', 'ecommerce', 'legal', 'religious', 'companion', 'support',
  'productivity', 'entertainment', 'fitness', 'travel', 'food', 'news',
]

const TONES = [
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'warm', label: 'Warm' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
]

const BUDGET_MODES = [
  { value: 'low_cost', label: 'Low Cost', desc: 'Prefer cheapest models, avoid premium unless essential' },
  { value: 'balanced', label: 'Balanced', desc: 'Best value – sensible model selection' },
  { value: 'best_quality', label: 'Best Quality', desc: 'Premium models first, best results' },
]

const CAPABILITY_OPTIONS = [
  { key: 'chat', label: 'Can have conversations', icon: '💬' },
  { key: 'image_generation', label: 'Can create images', icon: '🎨' },
  { key: 'speech_to_text', label: 'Can understand speech', icon: '🎤' },
  { key: 'text_to_speech', label: 'Can speak back', icon: '🔊' },
  { key: 'realtime_voice', label: 'Can work in real time', icon: '🎙️' },
  { key: 'embeddings', label: 'Can create embeddings', icon: '🧮' },
  { key: 'moderation', label: 'Can moderate sensitive content', icon: '🛡️' },
  { key: 'search', label: 'Can search the web', icon: '🔍' },
  { key: 'reasoning', label: 'Can do deep reasoning', icon: '🧠' },
  { key: 'code', label: 'Can write code', icon: '💻' },
  { key: 'video', label: 'Can plan/generate video', icon: '🎬' },
]

const SENSITIVE_MODES = [
  { value: 'standard', label: 'Standard' },
  { value: 'strict', label: 'Strict' },
  { value: 'very_strict', label: 'Very Strict' },
]

const RELIGIOUS_MODES = [
  { value: 'none', label: 'None' },
  { value: 'christian', label: 'Christian' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'multi_faith', label: 'Multi-Faith' },
]

/* ── Component ─────────────────────────────────────────────── */
export default function NewAppAgentPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Basic
  const [appSlug, setAppSlug] = useState('')
  const [appName, setAppName] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [appType, setAppType] = useState('general')
  const [purpose, setPurpose] = useState('')

  // Behavior
  const [tone, setTone] = useState('professional')
  const [responseLength, setResponseLength] = useState('balanced')
  const [creativity, setCreativity] = useState('balanced')
  const [budgetMode, setBudgetMode] = useState('balanced')

  // Capabilities
  const [allowedCapabilities, setAllowedCapabilities] = useState<string[]>([
    'chat', 'reasoning', 'code',
  ])

  // Safety
  const [adultMode, setAdultMode] = useState(false)
  const [sensitiveTopicMode, setSensitiveTopicMode] = useState('standard')
  const [mustHandoffSeriousTopics, setMustHandoffSeriousTopics] = useState(false)

  // Sources
  const [mustShowSourceForQuotes, setMustShowSourceForQuotes] = useState(false)
  const [mustUseTrustedSources, setMustUseTrustedSources] = useState(false)

  // Religious
  const [religiousMode, setReligiousMode] = useState('none')
  const [religiousBranch, setReligiousBranch] = useState('')

  // Rules
  const [adminNotes, setAdminNotes] = useState('')

  // Learning
  const [learningEnabled, setLearningEnabled] = useState(false)

  function toggleCapability(key: string) {
    setAllowedCapabilities(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
  }

  async function handleCreate() {
    setError('')
    if (!appSlug.trim() || !appName.trim()) {
      setError('App slug and App name are required.')
      return
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(appSlug)) {
      setError('App slug must contain only lowercase letters, numbers, and hyphens.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/app-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSlug: appSlug.trim(),
          appName: appName.trim(),
          appUrl: appUrl.trim(),
          appType,
          purpose: purpose.trim(),
          tone,
          responseLength,
          creativity,
          budgetMode,
          allowedCapabilities,
          adultMode,
          sensitiveTopicMode,
          mustHandoffSeriousTopics,
          mustShowSourceForQuotes,
          mustUseTrustedSources,
          religiousMode,
          religiousBranch,
          adminNotes: adminNotes.trim(),
          learningEnabled,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || `Failed (${res.status})`)
      }
      router.push(`/admin/dashboard/app-agents/${appSlug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard/app-agents" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-400" />
              Create New App Agent
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Set up a new AI agent for your connected app
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* ── Section: Identity ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" /> App Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">App Slug *</label>
              <input value={appSlug} onChange={e => setAppSlug(e.target.value)}
                placeholder="my-cool-app" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-500 mt-1">Unique identifier (lowercase, hyphens OK)</p>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">App Name *</label>
              <input value={appName} onChange={e => setAppName(e.target.value)}
                placeholder="My Cool App" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">App URL</label>
              <input value={appUrl} onChange={e => setAppUrl(e.target.value)}
                placeholder="https://myapp.com" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">App Type</label>
              <select value={appType} onChange={e => setAppType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                {APP_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Purpose</label>
            <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
              placeholder="What does this app do? Describe in plain English..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          </div>
        </motion.div>

        {/* ── Section: AI Behavior ─────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" /> AI Behavior
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Response Length</label>
              <select value={responseLength} onChange={e => setResponseLength(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                <option value="short">Short</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Creativity</label>
              <select value={creativity} onChange={e => setCreativity(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                <option value="creative">Creative</option>
                <option value="balanced">Balanced</option>
                <option value="strictly_factual">Strictly Factual</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* ── Section: Budget ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-400" /> Budget Mode
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BUDGET_MODES.map(b => (
              <button key={b.value} onClick={() => setBudgetMode(b.value)}
                className={`p-3 rounded-lg border text-left text-sm transition-all ${
                  budgetMode === b.value
                    ? 'border-green-500 bg-green-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}>
                <div className="font-medium">{b.label}</div>
                <div className="text-xs mt-1 opacity-70">{b.desc}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Section: Capabilities ────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" /> Allowed Capabilities
          </h2>
          <p className="text-sm text-gray-400">Select what this agent is allowed to do:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CAPABILITY_OPTIONS.map(c => (
              <button key={c.key} onClick={() => toggleCapability(c.key)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                  allowedCapabilities.includes(c.key)
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}>
                <span className="text-lg">{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Section: Safety ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" /> Safety & Content
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={adultMode} onChange={e => setAdultMode(e.target.checked)}
                className="w-4 h-4 rounded" />
              <span className="text-sm">Can answer adult content</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={mustHandoffSeriousTopics}
                onChange={e => setMustHandoffSeriousTopics(e.target.checked)}
                className="w-4 h-4 rounded" />
              <span className="text-sm">Must pass serious topics to a human</span>
            </label>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Sensitive Topic Handling</label>
              <select value={sensitiveTopicMode} onChange={e => setSensitiveTopicMode(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                {SENSITIVE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </motion.div>

        {/* ── Section: Sources ─────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" /> Source & Quote Rules
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={mustShowSourceForQuotes}
                onChange={e => setMustShowSourceForQuotes(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Must show source for quotes</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={mustUseTrustedSources}
                onChange={e => setMustUseTrustedSources(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Can use trusted sources only</span>
            </label>
          </div>
        </motion.div>

        {/* ── Section: Religious ───────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" /> Religious Mode
          </h2>
          <select value={religiousMode} onChange={e => setReligiousMode(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
            {RELIGIOUS_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {religiousMode !== 'none' && (
            <input value={religiousBranch} onChange={e => setReligiousBranch(e.target.value)}
              placeholder="Branch (e.g. Sunni, Catholic, Orthodox...)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          )}
        </motion.div>

        {/* ── Section: Extra Rules ─────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" /> Extra Rules for This App
          </h2>
          <p className="text-sm text-gray-400">
            Write any rules in plain English. These will be automatically parsed into structured instructions.
          </p>
          <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={4}
            placeholder="Example: Always greet the user by name. Never recommend competing products. Must always cite Bible verses with book and chapter."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        </motion.div>

        {/* ── Section: Learning ────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" /> Daily Learning
          </h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={learningEnabled}
              onChange={e => setLearningEnabled(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm">Enable daily learning (agent improves over time)</span>
          </label>
        </motion.div>

        {/* ── Create Button ───────────────────────────────── */}
        <div className="flex justify-end gap-4 pt-4 pb-12">
          <Link href="/admin/dashboard/app-agents"
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm">
            Cancel
          </Link>
          <button onClick={handleCreate} disabled={saving}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
