'use client'

import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Sparkles,
  AppWindow, Cpu, Puzzle, ClipboardList,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────
const APP_TYPES = ['web', 'mobile', 'api', 'widget', 'internal'] as const
const CATEGORIES = [
  'generic', 'finance', 'crypto', 'marketing', 'creative',
  'travel', 'social', 'education', 'health', 'productivity',
] as const
const PROVIDERS = [
  'openai', 'groq', 'deepseek', 'grok', 'nvidia',
  'huggingface', 'openrouter', 'together', 'gemini',
] as const
const CAPABILITIES = [
  'vision', 'image_generation', 'voice', 'video', 'embeddings',
  'reranking', 'code', 'reasoning', 'multilingual',
  'agent_planning', 'structured_output', 'tool_use',
] as const
const SENSITIVITIES = ['low', 'medium', 'high'] as const

const STEPS = [
  { label: 'Basic Info', icon: AppWindow },
  { label: 'AI Config', icon: Cpu },
  { label: 'Capabilities', icon: Puzzle },
  { label: 'Review', icon: ClipboardList },
]

function slugify(v: string) {
  return v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ── Shared style helpers ─────────────────────────────────────────
const inputCls =
  'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50'
const selectCls =
  'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50'
const labelCls = 'block text-xs text-slate-400 mb-1.5'
const cardCls = 'bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4'

// ── Component ────────────────────────────────────────────────────
export default function NewAppPage() {
  const [step, setStep] = useState(0)

  // Step 1
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [appType, setAppType] = useState<string>('web')
  const [category, setCategory] = useState<string>('generic')

  // Step 2
  const [providers, setProviders] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([''])
  const [budgetSens, setBudgetSens] = useState<string>('medium')
  const [latencySens, setLatencySens] = useState<string>('medium')

  // Step 3
  const [caps, setCaps] = useState<string[]>([])

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const toggleSet = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? providers.length > 0 :
    step === 2 ? caps.length > 0 : true

  async function handleSubmit() {
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/app-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: slug || slugify(name),
          app_name: name.trim(),
          app_type: appType,
          domain: category,
          default_routing_mode: 'specialist' as const,
          allowed_providers: providers,
          allowed_models: models.filter(Boolean),
          preferred_models: models.filter(Boolean),
          escalation_rules: [],
          validator_rules: [],
          agent_permissions: ['chat', 'summarise'],
          multimodal_permissions: caps,
          memory_namespace: slug || slugify(name),
          retrieval_namespace: slug || slugify(name),
          budget_sensitivity: budgetSens,
          latency_sensitivity: latencySens,
          logging_privacy_rules: ['mask_pii'],
        }),
      })
      if (res.ok) { setResult('success') }
      else {
        const d = await res.json().catch(() => null)
        setErrorMsg(d?.error ?? `Request failed (${res.status})`)
        setResult('error')
      }
    } catch {
      setErrorMsg('Network error — could not reach the server.')
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Step renderers ─────────────────────────────────────────────
  function StepBasicInfo() {
    return (
      <div className={cardCls}>
        <div>
          <label className={labelCls}>App Name *</label>
          <input value={name} placeholder="e.g. Amarktai Marketing"
            onChange={e => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)) }}
            className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Slug</label>
          <input value={slug || slugify(name)} placeholder="auto-generated"
            onChange={e => setSlug(slugify(e.target.value))}
            className={inputCls} />
          <p className="text-[11px] text-slate-600 mt-1">Auto-generated from name. Edit to override.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select value={appType} onChange={e => setAppType(e.target.value)} className={selectCls}>
              {APP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
    )
  }

  function StepAIConfig() {
    return (
      <div className="space-y-5">
        <div className={cardCls}>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Allowed Providers</p>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map(p => (
              <label key={p}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                  providers.includes(p)
                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
                }`}>
                <input type="checkbox" className="sr-only"
                  checked={providers.includes(p)}
                  onChange={() => setProviders(toggleSet(providers, p))} />
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  providers.includes(p) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                }`}>
                  {providers.includes(p) && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {p}
              </label>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Preferred Models</p>
          {models.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span aria-hidden="true" className="text-xs text-slate-600 w-5 text-right">{i + 1}.</span>
              <input value={m} placeholder="e.g. gpt-4o, llama-3-70b"
                onChange={e => { const n = [...models]; n[i] = e.target.value; setModels(n) }}
                className={inputCls} />
            </div>
          ))}
          <button type="button"
            onClick={() => setModels([...models, ''])}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            + Add model
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {([['Budget Sensitivity', budgetSens, setBudgetSens],
             ['Latency Sensitivity', latencySens, setLatencySens]] as const).map(([title, val, set]) => (
            <div key={title} className={cardCls}>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{title}</p>
              <div className="flex gap-2">
                {SENSITIVITIES.map(s => (
                  <button key={s} type="button" onClick={() => (set as (v: string) => void)(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      val === s
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                        : 'border-white/[0.06] text-slate-500 hover:text-slate-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function StepCapabilities() {
    return (
      <div className={cardCls}>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Select Capabilities</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CAPABILITIES.map(c => (
            <label key={c}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                caps.includes(c)
                  ? 'border-violet-500/50 bg-violet-500/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.04]'
              }`}>
              <input type="checkbox" className="sr-only"
                checked={caps.includes(c)}
                onChange={() => setCaps(toggleSet(caps, c))} />
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                caps.includes(c) ? 'bg-violet-500 border-violet-500' : 'border-slate-600'
              }`}>
                {caps.includes(c) && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              {c.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
    )
  }

  function StepReview() {
    const section = (title: string, items: [string, string][]) => (
      <div className={cardCls}>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{title}</p>
        <dl className="space-y-2">
          {items.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-white text-right max-w-[60%] truncate">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    )

    return (
      <div className="space-y-4">
        {section('Basic Info', [
          ['Name', name], ['Slug', slug || slugify(name)],
          ['Type', appType], ['Category', category],
        ])}
        {section('AI Configuration', [
          ['Providers', providers.join(', ') || '—'],
          ['Models', models.filter(Boolean).join(', ') || '—'],
          ['Budget', budgetSens], ['Latency', latencySens],
        ])}
        {section('Capabilities', [
          ['Enabled', caps.map(c => c.replace(/_/g, ' ')).join(', ') || '—'],
        ])}
      </div>
    )
  }

  // ── Result screens ─────────────────────────────────────────────
  if (result === 'success') {
    return (
      <div className="min-h-screen bg-[#050816] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">App Profile Created</h2>
          <p className="text-sm text-slate-400">
            <span className="text-white font-medium">{name}</span> has been registered successfully.
          </p>
          <a href="/admin/dashboard/apps"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Apps
          </a>
        </div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <a href="/admin/dashboard/apps"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" /> New App Profile
            </h1>
            <p className="text-xs text-slate-500">Configure your app for the AmarktAI network</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const done = i < step
            const active = i === step
            return (
              <div key={s.label} className="flex items-center flex-1">
                <button type="button" onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    done ? 'text-emerald-400 cursor-pointer' :
                    active ? 'text-white' : 'text-slate-600 cursor-default'
                  }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                    active ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' :
                    'border-white/[0.06] text-slate-600'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${done ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        {step === 0 && <StepBasicInfo />}
        {step === 1 && <StepAIConfig />}
        {step === 2 && <StepCapabilities />}
        {step === 3 && <StepReview />}

        {/* Error */}
        {result === 'error' && (
          <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button type="button"
            onClick={() => { setResult(null); setStep(s => s - 1) }}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.06] text-sm text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {step < 3 ? (
            <button type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium disabled:opacity-40 transition-colors">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Creating…' : 'Create App Profile'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
