'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Rocket,
  Search, Fingerprint, Cpu, ShieldCheck, Eye,
  AlertTriangle, Brain, Zap, Globe, ChevronDown,
} from 'lucide-react'
// Constants
const PROVIDERS = [
  'openai', 'groq', 'deepseek', 'grok', 'nvidia',
  'huggingface', 'openrouter', 'together', 'gemini',
] as const
const CAPABILITIES = [
  'chat', 'code', 'image_generation', 'video', 'voice', 'retrieval',
  'agents', 'reasoning', 'embeddings', 'structured_output', 'tool_use',
  'multilingual', 'agent_planning',
] as const
const CATEGORIES = [
  'generic', 'finance', 'crypto', 'marketing', 'creative',
  'travel', 'social', 'education', 'health', 'productivity',
  'support', 'companion', 'dating', 'media', 'developer',
] as const
const SAFETY_MODES = ['strict', 'standard', 'relaxed', 'adult_gated'] as const
const MEMORY_MODES = ['full', 'session', 'minimal', 'none'] as const
const STEPS = [
  { label: 'Discovery', icon: Search, color: 'violet' },
  { label: 'Identity', icon: Fingerprint, color: 'blue' },
  { label: 'AI Config', icon: Cpu, color: 'cyan' },
  { label: 'Capabilities', icon: ShieldCheck, color: 'amber' },
  { label: 'Deploy', icon: Rocket, color: 'emerald' },
]

interface DiscoveryResult {
  detectedCategory: string
  detectedFeatures: string[]
  inferredAiNeeds: string[]
  riskLevel: string
  confidence: number
  realtimeNeeded: boolean
  capabilityGaps: string[]
  warnings: string[]
  proposedConfig: {
    providers: string[]
    models: string[]
    budget: { daily: number; monthly: number }
    capabilityPackId: string
    safetyMode: string
    memoryMode: string
  }
}

interface CapabilityPack {
  id: string
  name: string
  description: string
  capabilities: string[]
  allowedProviders: string[]
  recommendedModels: string[]
  safetyLevel: string
  defaultBudget: { daily: number; monthly: number }
  memoryStrategy: string
  realtimeRequired: boolean
}

function slugify(v: string) {
  return v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
// Shared styles
const glass = 'bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl'
const inputCls =
  'w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all'
const labelCls = 'block text-xs font-medium text-slate-400 mb-1.5 tracking-wide'
const stepVariants = {
  enter: { opacity: 0, x: 40, filter: 'blur(4px)' },
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, x: -40, filter: 'blur(4px)' },
}
// Pill toggle component
function PillToggle({ value, active, onToggle, accent = 'violet' }: {
  value: string; active: boolean; onToggle: () => void; accent?: string
}) {
  const ac: Record<string, [string, string]> = {
    violet: ['border-violet-500/50 bg-violet-500/10 text-violet-300', 'bg-violet-500 border-violet-500'],
    blue: ['border-blue-500/50 bg-blue-500/10 text-blue-300', 'bg-blue-500 border-blue-500'],
    amber: ['border-amber-500/50 bg-amber-500/10 text-amber-300', 'bg-amber-500 border-amber-500'],
    emerald: ['border-emerald-500/50 bg-emerald-500/10 text-emerald-300', 'bg-emerald-500 border-emerald-500'],
    cyan: ['border-cyan-500/50 bg-cyan-500/10 text-cyan-300', 'bg-cyan-500 border-cyan-500'],
  }
  return (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-all duration-200 ${
      active ? ac[accent][0] : 'border-white/[0.06] bg-white/[0.02] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
    }`}>
      <input type="checkbox" className="sr-only" checked={active} onChange={onToggle} />
      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
        active ? ac[accent][1] : 'border-slate-600'
      }`}>
        {active && <Check className="w-2.5 h-2.5 text-white" />}
      </span>
      {value.replace(/_/g, ' ')}
    </label>
  )
}
// Main component
export default function NewAppPage() {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  // Step 0 – Discovery
  const [appName, setAppName] = useState('')
  const [appUrl, setAppUrl] = useState('')
  const [docsUrl, setDocsUrl] = useState('')
  const [description, setDescription] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [capPack, setCapPack] = useState<CapabilityPack | null>(null)
  const [discoveryError, setDiscoveryError] = useState('')
  const [discoveryAccepted, setDiscoveryAccepted] = useState(false)
  // Step 1 – Identity
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('generic')
  // Step 2 – AI Config
  const [providers, setProviders] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([''])
  const [budgetDaily, setBudgetDaily] = useState(5000)
  const [budgetMonthly, setBudgetMonthly] = useState(100000)
  const [safetyMode, setSafetyMode] = useState('standard')
  const [memoryMode, setMemoryMode] = useState('session')
  // Step 3 – Capabilities
  const [caps, setCaps] = useState<string[]>([])
  const [safeMode, setSafeMode] = useState(true)
  const [adultMode, setAdultMode] = useState(false)
  const [realtime, setRealtime] = useState(false)
  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const toggle = useCallback((arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v], [])
  const goTo = useCallback((target: number) => {
    setDirection(target > step ? 1 : -1)
    setStep(target)
  }, [step])
  // Discovery API call
  async function runDiscovery() {
    setDiscovering(true)
    setDiscoveryError('')
    setDiscovery(null)
    setCapPack(null)
    try {
      const res = await fetch('/api/admin/app-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: appName.trim(),
          url: appUrl.trim(),
          docsUrl: docsUrl.trim() || undefined,
          description: description.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? `Analysis failed (${res.status})`)
      }
      const data = await res.json()
      setDiscovery(data.discovery)
      setCapPack(data.capabilityPack ?? null)
      // Pre-fill downstream steps from discovery
      const disc = data.discovery as DiscoveryResult
      const pack = data.capabilityPack as CapabilityPack | null
      setCategory(disc.detectedCategory || 'generic')
      setProviders(disc.proposedConfig.providers)
      setModels(disc.proposedConfig.models.length ? disc.proposedConfig.models : [''])
      setBudgetDaily(disc.proposedConfig.budget.daily)
      setBudgetMonthly(disc.proposedConfig.budget.monthly)
      setSafetyMode(disc.proposedConfig.safetyMode)
      setMemoryMode(disc.proposedConfig.memoryMode)
      setRealtime(disc.realtimeNeeded)
      if (pack) setCaps(pack.capabilities)
      if (disc.proposedConfig.safetyMode === 'adult_gated') {
        setSafeMode(false)
        setAdultMode(true)
      }
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  function acceptDiscovery() {
    setDiscoveryAccepted(true)
    if (!slug) setSlug(slugify(appName))
  }
  // Deploy API call
  async function handleDeploy() {
    setSubmitting(true)
    setResult(null)
    setErrorMsg('')
    const appId = slug || slugify(appName)
    try {
      const res = await fetch('/api/admin/app-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_name: appName.trim(),
          app_type: 'web',
          domain: category,
          default_routing_mode: 'specialist',
          allowed_providers: providers,
          allowed_models: models.filter(Boolean),
          preferred_models: models.filter(Boolean),
          escalation_rules: [],
          validator_rules: [],
          agent_permissions: caps.filter(c =>
            ['chat', 'code', 'agents', 'reasoning', 'agent_planning', 'tool_use'].includes(c)
          ),
          multimodal_permissions: caps.filter(c =>
            ['image_generation', 'video', 'voice', 'embeddings'].includes(c)
          ),
          memory_namespace: appId,
          retrieval_namespace: appId,
          budget_sensitivity: budgetMonthly > 50000 ? 'low' : budgetMonthly > 10000 ? 'medium' : 'high',
          latency_sensitivity: realtime ? 'high' : 'medium',
          logging_privacy_rules: ['mask_pii'],
          safe_mode: safeMode,
          adult_mode: adultMode,
          monthly_budget_usd: budgetMonthly / 100,
          enabled_capabilities: caps,
        }),
      })
      if (res.ok) { setResult('success') }
      else {
        const d = await res.json().catch(() => null)
        setErrorMsg(d?.error ?? `Deploy failed (${res.status})`)
        setResult('error')
      }
    } catch {
      setErrorMsg('Network error \u2014 could not reach the Amarktai brain.')
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }
  // Step validation
  const canNext =
    step === 0 ? appName.trim().length > 0 && discoveryAccepted :
    step === 1 ? appName.trim().length > 0 :
    step === 2 ? providers.length > 0 :
    step === 3 ? caps.length > 0 : true
  // Success screen
  if (result === 'success') {
    return (
      <div className="flex items-center justify-center p-6 min-h-[70vh]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Rocket className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">App Profile Deployed</h2>
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{appName}</span> is now connected to the Amarktai brain.
          </p>
          {capPack && <p className="text-xs text-violet-400">Capability Pack: {capPack.name}</p>}
          <a href="/admin/dashboard/apps"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] text-white text-sm font-medium transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to App Registry
          </a>
        </motion.div>
      </div>
    )
  }
  // Step content renderers

  function StepDiscovery() {
    return (
      <div className="space-y-5">
        <div className={`${glass} p-6 space-y-5`}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI-Powered App Analysis</h3>
              <p className="text-xs text-slate-500">Tell us about your app &mdash; the brain will configure itself</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>App Name *</label>
              <input value={appName} placeholder="e.g. Amarktai Marketing"
                onChange={e => setAppName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>App URL *</label>
              <input value={appUrl} placeholder="https://your-app.com"
                onChange={e => setAppUrl(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Docs URL <span className="text-slate-600">(optional)</span></label>
            <input value={docsUrl} placeholder="https://docs.your-app.com"
              onChange={e => setDocsUrl(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description <span className="text-slate-600">(optional)</span></label>
            <textarea value={description} placeholder="Briefly describe what this app does and who it serves&hellip;"
              onChange={e => setDescription(e.target.value)} rows={3}
              className={`${inputCls} resize-none`} />
          </div>
          <button type="button" onClick={runDiscovery}
            disabled={!appName.trim() || !appUrl.trim() || discovering}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-sm font-semibold text-white disabled:opacity-40 disabled:pointer-events-none transition-all">
            {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {discovering ? 'Analyzing\u2026' : 'Analyze App'}
          </button>
        </div>
        {discoveryError && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{discoveryError}
          </motion.div>
        )}
        {discovery && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className={`${glass} p-6 space-y-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Discovery Results
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium">
                {Math.round(discovery.confidence * 100)}% confidence
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-slate-500 mb-1">Category</p>
                <p className="text-white font-medium capitalize">{discovery.detectedCategory}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-slate-500 mb-1">Risk Level</p>
                <p className={`font-medium capitalize ${
                  discovery.riskLevel === 'low' ? 'text-emerald-400' :
                  discovery.riskLevel === 'medium' ? 'text-amber-400' :
                  discovery.riskLevel === 'high' ? 'text-orange-400' : 'text-red-400'
                }`}>{discovery.riskLevel}</p>
              </div>
              {capPack && (
                <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                  <p className="text-slate-500 mb-1">Capability Pack</p>
                  <p className="text-violet-300 font-medium">{capPack.name}</p>
                </div>
              )}
            </div>
            {discovery.detectedFeatures.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Detected Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {discovery.detectedFeatures.map(f => (
                    <span key={f} className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/15 text-xs text-blue-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {discovery.inferredAiNeeds.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Inferred AI Needs</p>
                <div className="flex flex-wrap gap-1.5">
                  {discovery.inferredAiNeeds.map(n => (
                    <span key={n} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-xs text-cyan-300">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {discovery.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-1.5">
                {discovery.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}
                  </p>
                ))}
              </div>
            )}
            {!discoveryAccepted && (
              <button type="button" onClick={acceptDiscovery}
                className="w-full py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all">
                <Check className="w-4 h-4 inline mr-2" />Accept &amp; Continue
              </button>
            )}
            {discoveryAccepted && (
              <p className="text-xs text-emerald-400 text-center font-medium">{'\u2713'} Discovery accepted &mdash; proceed to next step</p>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  function StepIdentity() {
    return (
      <div className="space-y-5">
        <div className={`${glass} p-6 space-y-5`}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">App Identity</h3>
              <p className="text-xs text-slate-500">Define how this app appears in the network</p>
            </div>
          </div>
          <div>
            <label className={labelCls}>App Name</label>
            <input value={appName} onChange={e => setAppName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Slug</label>
            <input value={slug || slugify(appName)} placeholder="auto-generated"
              onChange={e => setSlug(slugify(e.target.value))} className={inputCls} />
            <p className="text-[11px] text-slate-600 mt-1.5">Used as namespace across memory, retrieval, and routing layers.</p>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value)}
                className={`${inputCls} appearance-none pr-10`}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className={`${inputCls} resize-none`}
              placeholder="Brief description for the app registry&hellip;" />
          </div>
        </div>
        {capPack && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`${glass} p-5 space-y-3`}>
            <p className="text-xs font-medium text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Matched Capability Pack
            </p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-white font-semibold">{capPack.name}</p>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                {capPack.id}
              </span>
            </div>
            <p className="text-xs text-slate-400">{capPack.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {capPack.capabilities.map(c => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-violet-500/10 text-[11px] text-violet-300 border border-violet-500/15">
                  {c.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    )
  }

  function StepAIConfig() {
    return (
      <div className="space-y-5">
        <div className={`${glass} p-6 space-y-5`}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Providers</h3>
              <p className="text-xs text-slate-500">Select which providers this app can route through</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVIDERS.map(p => (
              <PillToggle key={p} value={p} accent="cyan" active={providers.includes(p)}
                onToggle={() => setProviders(toggle(providers, p))} />
            ))}
          </div>
        </div>
        <div className={`${glass} p-6 space-y-4`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Preferred Models</p>
          {models.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-600 w-5 text-right shrink-0">{i + 1}.</span>
              <input value={m} placeholder="e.g. gpt-4o, llama-3-70b"
                onChange={e => { const n = [...models]; n[i] = e.target.value; setModels(n) }}
                className={inputCls} />
            </div>
          ))}
          <button type="button" onClick={() => setModels([...models, ''])}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">+ Add model</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`${glass} p-5 space-y-3`}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Budget (USD cents)</p>
            <div>
              <label className="text-[11px] text-slate-500">Daily</label>
              <input type="number" value={budgetDaily} onChange={e => setBudgetDaily(Number(e.target.value))}
                min={0} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">Monthly</label>
              <input type="number" value={budgetMonthly} onChange={e => setBudgetMonthly(Number(e.target.value))}
                min={0} className={inputCls} />
            </div>
            <p className="text-[11px] text-slate-600">{'\u2248'} ${(budgetMonthly / 100).toFixed(2)}/mo</p>
          </div>
          <div className="space-y-4">
            <div className={`${glass} p-5 space-y-3`}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Safety Mode</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SAFETY_MODES.map(s => (
                  <button key={s} type="button" onClick={() => setSafetyMode(s)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      safetyMode === s
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                        : 'border-white/[0.06] text-slate-500 hover:text-slate-300'
                    }`}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className={`${glass} p-5 space-y-3`}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Memory Mode</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MEMORY_MODES.map(m => (
                  <button key={m} type="button" onClick={() => setMemoryMode(m)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      memoryMode === m
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                        : 'border-white/[0.06] text-slate-500 hover:text-slate-300'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function StepCapabilities() {
    return (
      <div className="space-y-5">
        <div className={`${glass} p-6 space-y-5`}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Capabilities</h3>
              <p className="text-xs text-slate-500">Toggle what this app can do through the brain</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAPABILITIES.map(c => (
              <PillToggle key={c} value={c} accent="amber" active={caps.includes(c)}
                onToggle={() => setCaps(toggle(caps, c))} />
            ))}
          </div>
        </div>
        <div className={`${glass} p-6 space-y-4`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Safety &amp; Content Flags</p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-sm text-white">Safe Mode</p>
                  <p className="text-[11px] text-slate-500">Enforce strict content safety filters</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${safeMode ? 'bg-emerald-500' : 'bg-white/10'}`}
                onClick={() => { setSafeMode(!safeMode); if (!safeMode) setAdultMode(false) }}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${safeMode ? 'translate-x-4' : ''}`} />
              </div>
            </label>
            <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-red-400" />
                <div>
                  <p className="text-sm text-white">Adult Mode <span className="text-[10px] text-red-400 font-semibold ml-1">18+</span></p>
                  <p className="text-[11px] text-slate-500">Allow non-harmful adult content</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${adultMode ? 'bg-red-500' : 'bg-white/10'} ${safeMode ? 'opacity-30 pointer-events-none' : ''}`}
                onClick={() => !safeMode && setAdultMode(!adultMode)}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${adultMode ? 'translate-x-4' : ''}`} />
              </div>
            </label>
            {adultMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Adult mode requires explicit 18+ verification. This app will be flagged for compliance review.
              </motion.div>
            )}
            <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-all">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-sm text-white">Realtime Streaming</p>
                  <p className="text-[11px] text-slate-500">Enable low-latency streaming connections</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${realtime ? 'bg-amber-500' : 'bg-white/10'}`}
                onClick={() => setRealtime(!realtime)}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${realtime ? 'translate-x-4' : ''}`} />
              </div>
            </label>
          </div>
        </div>
        {discovery && discovery.capabilityGaps.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Capability Gaps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {discovery.capabilityGaps.map(g => (
                <span key={g} className="px-2 py-0.5 rounded-md bg-amber-500/10 text-[11px] text-amber-300 border border-amber-500/15">
                  {g.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">These capabilities are needed but not yet available on the platform.</p>
          </motion.div>
        )}
      </div>
    )
  }

  function StepDeploy() {
    const appId = slug || slugify(appName)
    const section = (title: string, icon: React.ReactNode, items: [string, string | React.ReactNode][]) => (
      <div className={`${glass} p-5 space-y-3`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5">{icon}{title}</p>
        <dl className="space-y-2">
          {items.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <dt className="text-slate-500">{k}</dt><dd className="text-white text-right max-w-[65%] truncate">{v || '\u2014'}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
    return (
      <div className="space-y-4">
        {section('Identity', <Fingerprint className="w-3.5 h-3.5" />, [
          ['Name', appName], ['Slug', appId], ['Category', category],
        ])}
        {section('AI Configuration', <Cpu className="w-3.5 h-3.5" />, [
          ['Providers', providers.join(', ')],
          ['Models', models.filter(Boolean).join(', ')],
          ['Budget', `$${(budgetDaily / 100).toFixed(2)}/day \u00b7 $${(budgetMonthly / 100).toFixed(2)}/mo`],
          ['Safety', safetyMode.replace(/_/g, ' ')],
          ['Memory', memoryMode],
        ])}
        {section('Capabilities', <ShieldCheck className="w-3.5 h-3.5" />, [
          ['Enabled', caps.map(c => c.replace(/_/g, ' ')).join(', ')],
          ['Safe Mode', safeMode ? 'On' : 'Off'],
          ['Adult Mode', adultMode ? 'On' : 'Off'],
          ['Realtime', realtime ? 'Enabled' : 'Disabled'],
        ])}
        {discovery && discovery.warnings.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Warnings
            </p>
            {discovery.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300/80">{w}</p>
            ))}
          </div>
        )}
        {discovery && discovery.capabilityGaps.length > 0 && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 space-y-2">
            <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Capability Gaps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {discovery.capabilityGaps.map(g => (
                <span key={g} className="px-2 py-0.5 rounded-md bg-red-500/10 text-[11px] text-red-300 border border-red-500/15">
                  {g.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const STEP_RENDERERS = [StepDiscovery, StepIdentity, StepAIConfig, StepCapabilities, StepDeploy]
  // Main render
  return (
    <div className="text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/admin/dashboard/apps"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-violet-400" /> Smart App Onboarding
            </h1>
            <p className="text-xs text-slate-500">Connect a new app to the Amarktai brain</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="space-y-3">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500"
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }} />
          </div>
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <button key={s.label} type="button" onClick={() => done && goTo(i)}
                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-all ${
                    done ? 'text-emerald-400 cursor-pointer' :
                    active ? 'text-white' : 'text-slate-600 cursor-default'
                  }`}>
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                    done ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                    active ? 'bg-violet-500/15 border-violet-500/30 text-violet-400' :
                    'border-white/[0.06] text-slate-600'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        {/* Step content with animation */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={step} custom={direction} variants={stepVariants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}>
            {STEP_RENDERERS[step]()}
          </motion.div>
        </AnimatePresence>
        {/* Error */}
        {result === 'error' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{errorMsg}
          </motion.div>
        )}
        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.06] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-all">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          {step < 4 ? (
            <button type="button" onClick={() => goTo(step + 1)} disabled={!canNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-sm text-white font-semibold disabled:opacity-40 disabled:pointer-events-none transition-all">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleDeploy} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-sm text-white font-semibold disabled:opacity-40 transition-all shadow-lg shadow-emerald-500/10">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {submitting ? 'Deploying\u2026' : 'Deploy App Profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
