'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Plug, X, Loader2, CheckCircle, Copy,
  ChevronRight, ChevronLeft, Sparkles, Shield,
  Heart, Users, Megaphone, Plane, DollarSign, Code2, Layers,
  MessageSquare, Mic, Image, Video, Bot, Brain, GraduationCap, Boxes,
  Zap, Scale, Timer, Webhook, Terminal, Check, Globe,
} from 'lucide-react'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────
interface Integration {
  id: number
  productId: number
  integrationToken: string
  heartbeatEnabled: boolean
  metricsEnabled: boolean
  eventsEnabled: boolean
  vpsEnabled: boolean
  lastHeartbeatAt: string | null
  healthStatus: string
  uptime: number | null
  version: string
  environment: string
  createdAt: string
  product: {
    id: number
    name: string
    slug: string
    status: string
    hostedHere: boolean
    hostingScope: string
    subdomain: string
    customDomain: string
    primaryUrl: string
    monitoringEnabled: boolean
  }
}

interface Product {
  id: number
  name: string
  slug: string
  category: string
  status: string
  integration: null | { id: number; healthStatus: string }
}

// ── Constants ─────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'security', label: 'Security', icon: Shield, color: 'text-red-400' },
  { value: 'faith', label: 'Faith', icon: Heart, color: 'text-pink-400' },
  { value: 'social', label: 'Social', icon: Users, color: 'text-blue-400' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'text-orange-400' },
  { value: 'travel', label: 'Travel', icon: Plane, color: 'text-cyan-400' },
  { value: 'finance', label: 'Finance', icon: DollarSign, color: 'text-emerald-400' },
  { value: 'developer', label: 'Developer', icon: Code2, color: 'text-violet-400' },
  { value: 'general', label: 'General', icon: Layers, color: 'text-slate-400' },
] as const

const STATUSES = [
  { value: 'live', label: 'Live', dot: 'bg-emerald-400' },
  { value: 'invite_only', label: 'Invite Only', dot: 'bg-violet-400' },
  { value: 'in_development', label: 'In Development', dot: 'bg-amber-400' },
  { value: 'coming_soon', label: 'Coming Soon', dot: 'bg-slate-400' },
] as const

const CAPABILITIES = [
  { key: 'text_chat', label: 'Text Chat', icon: MessageSquare, desc: 'Real-time text conversations' },
  { key: 'voice', label: 'Voice', icon: Mic, desc: 'Voice input & synthesis' },
  { key: 'image_generation', label: 'Image Gen', icon: Image, desc: 'AI image generation' },
  { key: 'video_planning', label: 'Video Planning', icon: Video, desc: 'Video content planning' },
  { key: 'agent_access', label: 'Agent Access', icon: Bot, desc: 'Autonomous AI agents' },
  { key: 'memory', label: 'Memory', icon: Brain, desc: 'Persistent memory store' },
  { key: 'learning', label: 'Learning', icon: GraduationCap, desc: 'Adaptive learning' },
  { key: 'multimodal', label: 'Multimodal', icon: Boxes, desc: 'Multi-format processing' },
] as const

const PROVIDERS = [
  'openai', 'anthropic', 'google', 'mistral', 'cohere', 'meta', 'groq', 'together',
] as const

const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini'],
  anthropic: ['claude-3.5-sonnet', 'claude-3-haiku', 'claude-3-opus'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  mistral: ['mistral-large', 'mistral-medium', 'mistral-small'],
  cohere: ['command-r-plus', 'command-r'],
  meta: ['llama-3.1-70b', 'llama-3.1-8b'],
  groq: ['llama-3.1-70b-groq', 'mixtral-8x7b-groq'],
  together: ['mixtral-8x22b', 'llama-3.1-405b'],
}

const ROUTING_STRATEGIES = [
  { value: 'cost_optimized', label: 'Cost Optimized', icon: DollarSign, desc: 'Minimize cost per request' },
  { value: 'quality_first', label: 'Quality First', icon: Sparkles, desc: 'Best model for every request' },
  { value: 'balanced', label: 'Balanced', icon: Scale, desc: 'Balance cost and quality' },
  { value: 'speed_first', label: 'Speed First', icon: Timer, desc: 'Fastest response times' },
] as const

const EXAMPLE_APPS = [
  { name: 'Secure', slug: 'secure', category: 'security', status: 'live', icon: Shield },
  { name: 'FaithHaven', slug: 'faithhaven', category: 'faith', status: 'live', icon: Heart },
  { name: 'Friends', slug: 'friends', category: 'social', status: 'live', icon: Users },
  { name: 'Marketing', slug: 'marketing', category: 'marketing', status: 'invite_only', icon: Megaphone },
  { name: 'Travel', slug: 'travel', category: 'travel', status: 'in_development', icon: Plane },
]

const STEP_LABELS = ['Create App', 'Capabilities', 'Routing & Budget', 'Integration']

// ── Wizard state ──────────────────────────────────────────────────
interface WizardState {
  name: string
  slug: string
  description: string
  category: string
  status: string
  capabilities: string[]
  providers: string[]
  preferredModels: string[]
  routingStrategy: string
  monthlyBudget: number
  budgetThreshold: number
  fallbackProvider: string
  webhookUrl: string
  environment: string
}

const initialWizard: WizardState = {
  name: '',
  slug: '',
  description: '',
  category: 'general',
  status: 'in_development',
  capabilities: ['text_chat'],
  providers: ['openai'],
  preferredModels: ['gpt-4o-mini'],
  routingStrategy: 'balanced',
  monthlyBudget: 500,
  budgetThreshold: 80,
  fallbackProvider: 'anthropic',
  webhookUrl: '',
  environment: 'production',
}

// ── Health helpers ─────────────────────────────────────────────────
const healthBadge = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'unhealthy': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
}

const healthDot = (status: string) => {
  switch (status) {
    case 'healthy': return 'bg-emerald-400'
    case 'unhealthy': return 'bg-red-400'
    default: return 'bg-slate-500'
  }
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'live': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'invite_only': return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
    case 'in_development': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
}

// ── Card wrapper ──────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl ${className}`}>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function AppOnboardingPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [wizard, setWizard] = useState<WizardState>(initialWizard)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdToken, setCreatedToken] = useState('')
  const [copiedField, setCopiedField] = useState('')

  const reload = useCallback(async () => {
    const [ints, prods] = await Promise.all([
      fetch('/api/admin/integrations').then((r) => r.json()),
      fetch('/api/admin/products').then((r) => r.json()),
    ])
    setIntegrations(Array.isArray(ints) ? ints : [])
    setProducts(Array.isArray(prods) ? prods : [])
  }, [])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const updateWizard = <K extends keyof WizardState>(key: K, val: WizardState[K]) =>
    setWizard((prev) => ({ ...prev, [key]: val }))

  const toggleArray = (key: 'capabilities' | 'providers' | 'preferredModels', val: string) => {
    setWizard((prev) => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] }
    })
  }

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Available models based on selected providers
  const availableModels = useMemo(
    () => wizard.providers.flatMap((p) => MODELS[p] ?? []),
    [wizard.providers]
  )

  // Onboard the app: create product + integration
  const handleOnboard = async () => {
    if (!wizard.name.trim()) { setError('App name is required'); return }
    setSaving(true)
    setError('')
    try {
      // Step 1: Create the product
      const prodRes = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: wizard.name,
          slug: wizard.slug || autoSlug(wizard.name),
          category: wizard.category,
          status: wizard.status,
          description: wizard.description,
          aiEnabled: wizard.capabilities.length > 0,
          onboardingStatus: 'configuring',
        }),
      })
      if (!prodRes.ok) {
        const data = await prodRes.json()
        setError(data.error || 'Failed to create app')
        return
      }
      const product = await prodRes.json()

      // Step 2: Create integration
      const intRes = await fetch('/api/admin/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          heartbeatEnabled: true,
          metricsEnabled: true,
          eventsEnabled: true,
          vpsEnabled: false,
          environment: wizard.environment,
        }),
      })
      if (intRes.ok) {
        const created = await intRes.json()
        setCreatedToken(created.integrationToken ?? '')
        await reload()
        setStep(3) // Move to integration details step
      } else {
        const data = await intRes.json()
        setError(data.error || 'App created but integration failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const resetWizard = () => {
    setWizard(initialWizard)
    setStep(0)
    setError('')
    setCreatedToken('')
    setWizardOpen(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this integration? The token will stop working.')) return
    await fetch(`/api/admin/integrations/${id}`, { method: 'DELETE' })
    await reload()
  }

  // Derived data for the table
  const onboardedApps = useMemo(() => {
    return integrations.map((int) => ({
      ...int,
      productData: products.find((p) => p.id === int.productId),
    }))
  }, [integrations, products])

  // Masked token display
  const maskToken = (token: string) =>
    token.length > 14 ? `${token.slice(0, 8)}${'•'.repeat(20)}${token.slice(-4)}` : token

  const generatedEndpoint = wizard.slug
    ? `https://api.amarktai.com/v1/apps/${wizard.slug}`
    : 'https://api.amarktai.com/v1/apps/<slug>'

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">App Onboarding</h1>
          <p className="text-sm text-slate-400 mt-1">
            Onboard new apps into the AmarktAI Network with AI capabilities, routing, and integrations.
          </p>
        </div>
        <button
          onClick={() => { resetWizard(); setWizardOpen(true) }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Onboard New App
        </button>
      </div>

      {/* Ready Apps Examples */}
      <div className="grid grid-cols-5 gap-3">
        {EXAMPLE_APPS.map((app) => {
          const Icon = app.icon
          const existing = products.find((p) => p.slug === app.slug)
          return (
            <Card key={app.slug} className="p-4 group hover:border-white/[0.12] transition-colors cursor-pointer"
              >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{app.name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{app.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${existing ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="text-[11px] text-slate-500">
                  {existing ? 'Onboarded' : 'Ready'}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Wizard Panel */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              {/* Progress bar */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white font-heading">Onboarding Wizard</h2>
                  <button onClick={resetWizard} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-2">
                  {STEP_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => i < step && setStep(i)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          i === step
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : i < step
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20'
                            : 'bg-white/[0.03] text-slate-500 border border-white/[0.06]'
                        }`}
                      >
                        {i < step ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px]">
                            {i + 1}
                          </span>
                        )}
                        {label}
                      </button>
                      {i < STEP_LABELS.length - 1 && (
                        <div className={`flex-1 h-px ${i < step ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step content */}
              <div className="px-6 pb-6">
                <AnimatePresence mode="wait">
                  {/* Step 1: Create App */}
                  {step === 0 && (
                    <motion.div
                      key="step-0"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">App Name *</label>
                          <input
                            type="text"
                            value={wizard.name}
                            onChange={(e) => {
                              updateWizard('name', e.target.value)
                              updateWizard('slug', autoSlug(e.target.value))
                            }}
                            placeholder="My Amazing App"
                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">Slug</label>
                          <input
                            type="text"
                            value={wizard.slug}
                            onChange={(e) => updateWizard('slug', e.target.value)}
                            placeholder="my-amazing-app"
                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
                        <textarea
                          value={wizard.description}
                          onChange={(e) => updateWizard('description', e.target.value)}
                          placeholder="Brief description of what this app does…"
                          rows={2}
                          className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">Category</label>
                        <div className="grid grid-cols-4 gap-2">
                          {CATEGORIES.map((cat) => {
                            const Icon = cat.icon
                            const selected = wizard.category === cat.value
                            return (
                              <button
                                key={cat.value}
                                type="button"
                                onClick={() => updateWizard('category', cat.value)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                                  selected
                                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                    : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12] hover:text-slate-300'
                                }`}
                              >
                                <Icon className={`w-3.5 h-3.5 ${selected ? 'text-blue-400' : cat.color}`} />
                                {cat.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">Status</label>
                        <div className="flex gap-2">
                          {STATUSES.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => updateWizard('status', s.value)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                                wizard.status === s.value
                                  ? 'bg-blue-500/15 border-blue-500/30 text-white'
                                  : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Configure Capabilities */}
                  {step === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">AI Capabilities</label>
                        <div className="grid grid-cols-4 gap-2">
                          {CAPABILITIES.map((cap) => {
                            const Icon = cap.icon
                            const active = wizard.capabilities.includes(cap.key)
                            return (
                              <button
                                key={cap.key}
                                type="button"
                                onClick={() => toggleArray('capabilities', cap.key)}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                  active
                                    ? 'bg-blue-500/10 border-blue-500/25 text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                                }`}
                              >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                                <div>
                                  <p className="text-xs font-medium">{cap.label}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{cap.desc}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">Allowed Providers</label>
                        <div className="flex flex-wrap gap-2">
                          {PROVIDERS.map((p) => {
                            const active = wizard.providers.includes(p)
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => toggleArray('providers', p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                                  active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                    : 'bg-white/[0.02] text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
                                }`}
                              >
                                {active && <span className="mr-1.5">✓</span>}
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">Preferred Models</label>
                        <div className="flex flex-wrap gap-2">
                          {availableModels.map((m) => {
                            const active = wizard.preferredModels.includes(m)
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => toggleArray('preferredModels', m)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                                  active
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                                    : 'bg-white/[0.02] text-slate-500 border-white/[0.06] hover:border-white/[0.12]'
                                }`}
                              >
                                {m}
                              </button>
                            )
                          })}
                          {availableModels.length === 0 && (
                            <p className="text-xs text-slate-600 italic">Select providers above to see available models</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Routing & Budget */}
                  {step === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      <div>
                        <label className="text-xs text-slate-400 mb-2 block">Default Routing Strategy</label>
                        <div className="grid grid-cols-4 gap-2">
                          {ROUTING_STRATEGIES.map((rs) => {
                            const Icon = rs.icon
                            const active = wizard.routingStrategy === rs.value
                            return (
                              <button
                                key={rs.value}
                                type="button"
                                onClick={() => updateWizard('routingStrategy', rs.value)}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                  active
                                    ? 'bg-blue-500/10 border-blue-500/25 text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/[0.12]'
                                }`}
                              >
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                                <div>
                                  <p className="text-xs font-medium">{rs.label}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{rs.desc}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">Monthly Budget ($)</label>
                          <input
                            type="number"
                            value={wizard.monthlyBudget}
                            onChange={(e) => updateWizard('monthlyBudget', Number(e.target.value))}
                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">Alert Threshold (%)</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={wizard.budgetThreshold}
                            onChange={(e) => updateWizard('budgetThreshold', Number(e.target.value))}
                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">Fallback Provider</label>
                          <select
                            value={wizard.fallbackProvider}
                            onChange={(e) => updateWizard('fallbackProvider', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors capitalize"
                          >
                            {PROVIDERS.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Budget visualization */}
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">Budget Utilization Preview</span>
                          <span className="text-xs text-slate-500">${wizard.monthlyBudget}/mo</span>
                        </div>
                        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                            style={{ width: `${wizard.budgetThreshold}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-600">$0</span>
                          <span className="text-[10px] text-amber-400/60">
                            Alert at ${Math.round(wizard.monthlyBudget * wizard.budgetThreshold / 100)}
                          </span>
                          <span className="text-[10px] text-slate-600">${wizard.monthlyBudget}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Integration Details */}
                  {step === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5"
                    >
                      {createdToken ? (
                        <>
                          {/* Token display */}
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                              <span className="text-sm font-semibold text-emerald-400">App Onboarded Successfully</span>
                            </div>
                            <label className="text-xs text-slate-400 mb-1 block">Integration Token</label>
                            <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                              <code className="text-xs text-cyan-400 font-mono flex-1 truncate">
                                {maskToken(createdToken)}
                              </code>
                              <button
                                onClick={() => copyText(createdToken, 'token')}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                              >
                                {copiedField === 'token' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-[10px] text-amber-400/70 mt-2">⚠ Copy this token now. It will be masked after you leave this page.</p>
                          </div>

                          {/* API endpoint */}
                          <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">API Endpoint</label>
                            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                              <Globe className="w-3.5 h-3.5 text-slate-500" />
                              <code className="text-xs text-slate-300 font-mono flex-1">{generatedEndpoint}</code>
                              <button
                                onClick={() => copyText(generatedEndpoint, 'endpoint')}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                              >
                                {copiedField === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Webhook */}
                          <div>
                            <label className="text-xs text-slate-400 mb-1.5 block flex items-center gap-1.5">
                              <Webhook className="w-3 h-3" /> Webhook URL (optional)
                            </label>
                            <input
                              type="url"
                              value={wizard.webhookUrl}
                              onChange={(e) => updateWizard('webhookUrl', e.target.value)}
                              placeholder="https://your-app.com/webhooks/amarktai"
                              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                            />
                          </div>

                          {/* Code examples */}
                          <div>
                            <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1.5">
                              <Terminal className="w-3 h-3" /> Integration Code
                            </label>
                            <div className="bg-[#0a0e1a] border border-white/[0.06] rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">cURL</span>
                                <button
                                  onClick={() => copyText(
                                    `curl -X POST ${generatedEndpoint}/chat \\\n  -H "Authorization: Bearer ${createdToken.slice(0, 8)}..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Hello", "model": "${wizard.preferredModels[0] || 'gpt-4o-mini'}"}'`,
                                    'code'
                                  )}
                                  className="text-slate-500 hover:text-white transition-colors"
                                >
                                  {copiedField === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                              <pre className="p-4 text-xs text-slate-400 font-mono overflow-x-auto leading-relaxed">
{`curl -X POST ${generatedEndpoint}/chat \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello",
    "model": "${wizard.preferredModels[0] || 'gpt-4o-mini'}"
  }'`}
                              </pre>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <Plug className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                          <p className="text-sm text-slate-400">Complete the previous steps, then click &quot;Create &amp; Integrate&quot; to generate your integration token.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                {error && (
                  <div className="mt-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => step > 0 ? setStep(step - 1) : resetWizard()}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {step === 0 ? 'Cancel' : 'Back'}
                  </button>

                  {step < 2 ? (
                    <button
                      onClick={() => setStep(step + 1)}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : step === 2 ? (
                    <button
                      onClick={handleOnboard}
                      disabled={saving || !wizard.name.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Create &amp; Integrate
                    </button>
                  ) : (
                    <button
                      onClick={resetWizard}
                      className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Done
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarded Apps Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-bold text-white font-heading">Onboarded Apps</h3>
          <p className="text-xs text-slate-500 mt-0.5">Apps integrated into the AmarktAI Network with active tokens</p>
        </div>

        {loading ? (
          <div className="flex justify-center h-32 items-center">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : onboardedApps.length === 0 ? (
          <div className="p-12 text-center">
            <Plug className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No onboarded apps yet. Use the wizard above to onboard your first app.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {onboardedApps.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Health dot + name */}
                <div className="flex items-center gap-3 min-w-[180px]">
                  <div className={`w-2 h-2 rounded-full ${healthDot(app.healthStatus)}`} />
                  <div>
                    <p className="text-sm font-semibold text-white">{app.product.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{app.product.slug}</p>
                  </div>
                </div>

                {/* Status */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] border capitalize flex-shrink-0 ${statusBadge(app.product.status)}`}>
                  {app.product.status.replace(/_/g, ' ')}
                </span>

                {/* Health */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] border capitalize flex-shrink-0 ${healthBadge(app.healthStatus)}`}>
                  {app.healthStatus}
                </span>

                {/* Feeds */}
                <div className="flex gap-1.5 flex-1">
                  {[
                    { key: 'heartbeatEnabled' as const, label: 'HB' },
                    { key: 'metricsEnabled' as const, label: 'MET' },
                    { key: 'eventsEnabled' as const, label: 'EVT' },
                  ].map(({ key, label }) => (
                    <span
                      key={key}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        app[key]
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-white/[0.03] text-slate-600'
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Last heartbeat */}
                <span className="text-[10px] text-slate-500 min-w-[100px] text-right">
                  {app.lastHeartbeatAt
                    ? format(new Date(app.lastHeartbeatAt), 'MMM d, HH:mm')
                    : 'No heartbeat'}
                </span>

                {/* Environment */}
                <span className="text-[10px] text-slate-600 capitalize min-w-[60px]">{app.environment}</span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(app.id)}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove integration"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
