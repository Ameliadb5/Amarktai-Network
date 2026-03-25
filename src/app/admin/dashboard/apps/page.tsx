'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Pencil, Trash2, X, Loader2, Check, ChevronRight, ChevronLeft,
  Brain, Zap, MonitorDot, Globe, LayoutGrid, Search, RefreshCw,
  TrendingUp, Heart, BookOpen, Briefcase, Users, Megaphone, BarChart2, Shield, Sparkles,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────
interface AppRecord {
  id: number
  name: string
  slug: string
  category: string
  shortDescription: string
  longDescription: string
  status: string
  accessType: string
  featured: boolean
  primaryUrl: string
  hostedHere: boolean
  hostingScope: string
  subdomain: string
  customDomain: string
  environment: string
  publicVisibility: boolean
  monitoringEnabled: boolean
  integrationEnabled: boolean
  appType: string
  readyToDeploy: boolean
  aiEnabled: boolean
  connectedToBrain: boolean
  onboardingStatus: string
  onboardingCompletedAt: string | null
  appSecret: string
  customInstructions: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  integration: { healthStatus: string; lastHeartbeatAt: string | null } | null
}

const STATUS_LABELS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  live:            { label: 'Live',            dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  ready_to_deploy: { label: 'Ready to Deploy', dot: 'bg-blue-400',    text: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30' },
  invite_only:     { label: 'Invite Only',     dot: 'bg-violet-400',  text: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/30' },
  in_development:  { label: 'In Development',  dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  coming_soon:     { label: 'Coming Soon',     dot: 'bg-slate-400',   text: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30' },
  concept:         { label: 'Concept',         dot: 'bg-purple-400',  text: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/30' },
  offline:         { label: 'Offline',         dot: 'bg-slate-500',   text: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-500/30' },
}

const ONBOARDING_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  unconfigured: { label: 'Unconfigured', color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30' },
  discovered:   { label: 'Discovered',   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30' },
  configuring:  { label: 'Configuring',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  configured:   { label: 'Configured',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/30' },
  connected:    { label: 'Connected',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
}

function iconForCategory(category: string) {
  const lower = category.toLowerCase()
  if (lower.includes('finance') || lower.includes('crypto') || lower.includes('forex')) return TrendingUp
  if (lower.includes('social') || lower.includes('family')) return Users
  if (lower.includes('community') || lower.includes('faith')) return Heart
  if (lower.includes('education') || lower.includes('learn')) return BookOpen
  if (lower.includes('employment') || lower.includes('job')) return Briefcase
  if (lower.includes('marketing')) return Megaphone
  if (lower.includes('media')) return Globe
  if (lower.includes('security')) return Shield
  if (lower.includes('analytics') || lower.includes('web')) return BarChart2
  return Sparkles
}

// ── Empty form ───────────────────────────────────────────
const emptyForm = {
  name: '',
  slug: '',
  category: '',
  shortDescription: '',
  longDescription: '',
  status: 'in_development',
  accessType: 'public',
  featured: false,
  primaryUrl: '',
  hostedHere: false,
  hostingScope: 'external_domain',
  subdomain: '',
  customDomain: '',
  environment: 'development',
  publicVisibility: true,
  monitoringEnabled: false,
  integrationEnabled: false,
  appType: 'app',
  readyToDeploy: false,
  aiEnabled: false,
  connectedToBrain: false,
  onboardingStatus: 'unconfigured',
  onboardingCompletedAt: null as string | null,
  appSecret: '',
  customInstructions: '',
  sortOrder: 99,
}

type FormState = typeof emptyForm

// ── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, dot: 'bg-slate-400', text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Onboarding Badge ──────────────────────────────────────
function OnboardingBadge({ status }: { status: string }) {
  const cfg = ONBOARDING_LABELS[status] ?? ONBOARDING_LABELS.unconfigured
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ── Toggle ────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-blue-500' : 'bg-white/10'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}

// ── Field ─────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-600'
const selectCls = 'w-full px-3 py-2 bg-[#0B1020] border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500/50'

// ── Onboarding Wizard Modal ───────────────────────────────
const WIZARD_STEPS = ['App Basics', 'Network Role', 'AI & Monitoring', 'Review & Save']

interface WizardProps {
  initial: AppRecord | null
  onClose: () => void
  onSaved: () => void
}

function OnboardingWizard({ initial, onClose, onSaved }: WizardProps) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(() => initial ? {
    name: initial.name,
    slug: initial.slug,
    category: initial.category,
    shortDescription: initial.shortDescription,
    longDescription: initial.longDescription,
    status: initial.status,
    accessType: initial.accessType,
    featured: initial.featured,
    primaryUrl: initial.primaryUrl,
    hostedHere: initial.hostedHere,
    hostingScope: initial.hostingScope,
    subdomain: initial.subdomain,
    customDomain: initial.customDomain,
    environment: initial.environment,
    publicVisibility: initial.publicVisibility,
    monitoringEnabled: initial.monitoringEnabled,
    integrationEnabled: initial.integrationEnabled,
    appType: initial.appType,
    readyToDeploy: initial.readyToDeploy,
    aiEnabled: initial.aiEnabled,
    connectedToBrain: initial.connectedToBrain,
    onboardingStatus: initial.onboardingStatus,
    onboardingCompletedAt: initial.onboardingCompletedAt,
    appSecret: initial.appSecret,
    customInstructions: initial.customInstructions,
    sortOrder: initial.sortOrder,
  } : { ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const url = initial ? `/api/admin/products/${initial.id}` : '/api/admin/products'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          onboardingCompletedAt: form.onboardingStatus === 'connected' || form.onboardingStatus === 'configured'
            ? (form.onboardingCompletedAt ?? new Date().toISOString())
            : null,
        }),
      })
      if (res.ok) {
        onSaved()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="relative bg-[#080E1C] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" fill="white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white font-heading">
              {initial ? 'Configure App' : 'Register New App'}
            </h2>
            <p className="text-xs text-slate-500">{initial?.name ?? 'New application'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-white/5 flex items-center gap-2">
          {WIZARD_STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => { if (i <= step) setStep(i) }}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  i === step
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : i < step
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-slate-600'
                }`}
              >
                {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < WIZARD_STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="App Name *">
                    <input required value={form.name} onChange={e => set({ name: e.target.value })} className={inputCls} placeholder="e.g. Amarktai Crypto" />
                  </Field>
                  <Field label="Slug *">
                    <input required value={form.slug} onChange={e => set({ slug: e.target.value })} className={inputCls} placeholder="e.g. amarktai-crypto" />
                  </Field>
                </div>
                <Field label="Category">
                  <input value={form.category} onChange={e => set({ category: e.target.value })} className={inputCls} placeholder="e.g. Finance & AI" />
                </Field>
                <Field label="Short Description">
                  <textarea rows={2} value={form.shortDescription} onChange={e => set({ shortDescription: e.target.value })} className={`${inputCls} resize-none`} placeholder="One-line description for the public apps page" />
                </Field>
                <Field label="Full Description">
                  <textarea rows={3} value={form.longDescription} onChange={e => set({ longDescription: e.target.value })} className={`${inputCls} resize-none`} placeholder="Detailed description (optional)" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="App Type">
                    <select value={form.appType} onChange={e => set({ appType: e.target.value })} className={selectCls}>
                      <option value="app">App</option>
                      <option value="platform">Platform</option>
                      <option value="service">Service</option>
                      <option value="tool">Tool</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={e => set({ status: e.target.value })} className={selectCls}>
                      <option value="live">Live</option>
                      <option value="ready_to_deploy">Ready to Deploy</option>
                      <option value="invite_only">Invite Only</option>
                      <option value="in_development">In Development</option>
                      <option value="coming_soon">Coming Soon</option>
                      <option value="concept">Concept</option>
                      <option value="offline">Offline</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Access Type">
                    <select value={form.accessType} onChange={e => set({ accessType: e.target.value })} className={selectCls}>
                      <option value="public">Public</option>
                      <option value="invite">Invite Only</option>
                      <option value="private">Private</option>
                    </select>
                  </Field>
                  <Field label="Sort Order">
                    <input type="number" value={form.sortOrder} onChange={e => set({ sortOrder: parseInt(e.target.value) || 99 })} className={inputCls} />
                  </Field>
                </div>
                <Field label="Public URL">
                  <input value={form.primaryUrl} onChange={e => set({ primaryUrl: e.target.value })} className={inputCls} placeholder="https://app.domain.com" />
                </Field>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.featured} onChange={v => set({ featured: v })} />
                  <span className="text-sm text-slate-400">Featured app</span>
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <Toggle checked={form.publicVisibility} onChange={v => set({ publicVisibility: v })} />
                  <span className="text-sm text-slate-400">Publicly visible</span>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 text-sm text-blue-300">
                  Configure where this app is hosted and how it relates to the Amarktai network infrastructure.
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.hostedHere} onChange={v => set({ hostedHere: v })} />
                  <div>
                    <p className="text-sm text-white">Hosted on Amarktai infrastructure</p>
                    <p className="text-xs text-slate-500">Enable if this app runs on Amarktai VPS or subdomain</p>
                  </div>
                </div>
                <Field label="Hosting Scope">
                  <select value={form.hostingScope} onChange={e => set({ hostingScope: e.target.value })} className={selectCls}>
                    <option value="external_domain">External Domain</option>
                    <option value="subdomain">Amarktai Subdomain</option>
                    <option value="same_vps">Same VPS</option>
                    <option value="external_vps">External VPS</option>
                  </select>
                </Field>
                {form.hostedHere && form.hostingScope === 'subdomain' && (
                  <Field label="Subdomain">
                    <div className="flex items-center gap-0">
                      <input value={form.subdomain} onChange={e => set({ subdomain: e.target.value })} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-l-lg text-sm text-white focus:outline-none focus:border-blue-500/50" placeholder="crypto" />
                      <span className="px-3 py-2 bg-white/5 border border-l-0 border-white/10 rounded-r-lg text-sm text-slate-500">.amarktai.com</span>
                    </div>
                  </Field>
                )}
                {!form.hostedHere && (
                  <Field label="Custom Domain">
                    <input value={form.customDomain} onChange={e => set({ customDomain: e.target.value })} className={inputCls} placeholder="app.example.com" />
                  </Field>
                )}
                <Field label="Environment">
                  <select value={form.environment} onChange={e => set({ environment: e.target.value })} className={selectCls}>
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </Field>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.readyToDeploy} onChange={v => set({ readyToDeploy: v })} />
                  <div>
                    <p className="text-sm text-white">Ready to deploy</p>
                    <p className="text-xs text-slate-500">Mark when app is production-ready</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15 text-sm text-violet-300">
                  Configure how this app integrates with the Amarktai AI layer and monitoring systems.
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.aiEnabled} onChange={v => set({ aiEnabled: v })} />
                  <div>
                    <p className="text-sm text-white">AI Enabled</p>
                    <p className="text-xs text-slate-500">App uses Amarktai AI capabilities</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.connectedToBrain} onChange={v => set({ connectedToBrain: v })} />
                  <div>
                    <p className="text-sm text-white">Connected to Amarktai Brain</p>
                    <p className="text-xs text-slate-500">Routes AI tasks through the CNS</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.monitoringEnabled} onChange={v => set({ monitoringEnabled: v })} />
                  <div>
                    <p className="text-sm text-white">Monitoring Enabled</p>
                    <p className="text-xs text-slate-500">Track heartbeat, metrics, and events</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle checked={form.integrationEnabled} onChange={v => set({ integrationEnabled: v })} />
                  <div>
                    <p className="text-sm text-white">Integration Token</p>
                    <p className="text-xs text-slate-500">Enable API integration for this app</p>
                  </div>
                </div>
                <Field label="Custom Brain Instructions (optional)">
                  <textarea
                    rows={3}
                    value={form.customInstructions}
                    onChange={e => set({ customInstructions: e.target.value })}
                    className={`${inputCls} resize-none`}
                    placeholder="e.g. This app handles crypto trading. Prioritise market data queries..."
                  />
                </Field>
                <Field label="Onboarding Status">
                  <select value={form.onboardingStatus} onChange={e => set({ onboardingStatus: e.target.value })} className={selectCls}>
                    <option value="unconfigured">Unconfigured</option>
                    <option value="discovered">Discovered</option>
                    <option value="configuring">Configuring</option>
                    <option value="configured">Configured</option>
                    <option value="connected">Connected</option>
                  </select>
                </Field>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-sm text-emerald-300">
                  Review your configuration before saving to the registry.
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Name', value: form.name || '—' },
                    { label: 'Slug', value: form.slug || '—' },
                    { label: 'Category', value: form.category || '—' },
                    { label: 'Status', value: <StatusBadge status={form.status} /> },
                    { label: 'Onboarding', value: <OnboardingBadge status={form.onboardingStatus} /> },
                    { label: 'Public URL', value: form.primaryUrl || 'Not set' },
                    { label: 'Hosting', value: `${form.hostedHere ? 'Amarktai' : 'External'} · ${form.hostingScope.replace('_', ' ')}` },
                    { label: 'Environment', value: form.environment },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-sm text-white">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-xs text-slate-500">Flags</span>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {form.aiEnabled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25">AI</span>}
                      {form.monitoringEnabled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">Monitored</span>}
                      {form.connectedToBrain && <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">Brain</span>}
                      {form.readyToDeploy && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Ready</span>}
                      {form.featured && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">Featured</span>}
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex items-center gap-2">
            {step < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.slug}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save to Registry
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Quick Edit Modal (single field updates) ───────────────
interface QuickEditProps {
  app: AppRecord
  onClose: () => void
  onSaved: () => void
}

function QuickEditModal({ app, onClose, onSaved }: QuickEditProps) {
  const [form, setForm] = useState({
    name: app.name,
    slug: app.slug,
    category: app.category,
    shortDescription: app.shortDescription,
    status: app.status,
    featured: app.featured,
    primaryUrl: app.primaryUrl,
    sortOrder: app.sortOrder,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onSaved()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#0B1020] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white font-heading">Quick Edit</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Slug *">
              <input required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Short Description">
            <textarea rows={2} value={form.shortDescription} onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))} className={`${inputCls} resize-none`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={selectCls}>
                {Object.entries(STATUS_LABELS).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Public URL">
            <input value={form.primaryUrl} onChange={e => setForm(f => ({ ...f, primaryUrl: e.target.value }))} className={inputCls} placeholder="https://..." />
          </Field>
          <div className="flex items-center gap-3">
            <Toggle checked={form.featured} onChange={v => setForm(f => ({ ...f, featured: v }))} />
            <span className="text-sm text-slate-400">Featured</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 glass text-slate-400 text-sm rounded-xl hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function AppRegistryPage() {
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [wizardApp, setWizardApp] = useState<AppRecord | null | undefined>(undefined) // undefined = closed, null = new
  const [quickEditApp, setQuickEditApp] = useState<AppRecord | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => { fetchApps() }, [])

  const fetchApps = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products')
      const data = await res.json()
      setApps(Array.isArray(data) ? data : [])
    } catch {
      setApps([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this app from the registry?')) return
    setDeleting(id)
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    await fetchApps()
    setDeleting(null)
  }

  const filteredApps = apps.filter(a =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: apps.length,
    live: apps.filter(a => a.status === 'live').length,
    inDev: apps.filter(a => a.status === 'in_development').length,
    aiEnabled: apps.filter(a => a.aiEnabled).length,
    connected: apps.filter(a => a.onboardingStatus === 'connected').length,
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">App Registry</h1>
          <p className="text-sm text-slate-400 mt-1">Single source of truth for the Amarktai ecosystem</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={fetchApps}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWizardApp(null)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Register App
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Apps', value: stats.total, icon: LayoutGrid, color: 'text-blue-400' },
          { label: 'Live', value: stats.live, icon: Globe, color: 'text-emerald-400' },
          { label: 'In Development', value: stats.inDev, icon: Zap, color: 'text-amber-400' },
          { label: 'AI Enabled', value: stats.aiEnabled, icon: Brain, color: 'text-violet-400' },
          { label: 'Connected', value: stats.connected, icon: MonitorDot, color: 'text-cyan-400' },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-xl p-4 border border-white/5">
            <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
            <p className="text-2xl font-bold text-white">{loading ? '—' : stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps by name, slug, or category..."
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/5">
          <LayoutGrid className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">{search ? 'No apps match your search.' : 'No apps in the registry.'}</p>
          {!search && <p className="text-slate-600 text-sm mt-1">Click &ldquo;Register App&rdquo; to add the first app.</p>}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">App</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Onboarding</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Flags</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredApps.map((app, i) => {
                  const Icon = iconForCategory(app.category)
                  return (
                    <motion.tr
                      key={app.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{app.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{app.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-sm text-slate-400">{app.category || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <OnboardingBadge status={app.onboardingStatus} />
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        <div className="flex items-center gap-1.5">
                          {app.aiEnabled && (
                            <span title="AI Enabled">
                              <Brain className="w-3.5 h-3.5 text-violet-400" />
                            </span>
                          )}
                          {app.monitoringEnabled && (
                            <span title="Monitoring Enabled">
                              <MonitorDot className="w-3.5 h-3.5 text-blue-400" />
                            </span>
                          )}
                          {app.connectedToBrain && (
                            <span title="Brain Connected">
                              <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            </span>
                          )}
                          {app.readyToDeploy && (
                            <span title="Ready to Deploy">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                          )}
                          {app.featured && (
                            <span title="Featured">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setWizardApp(app)}
                            title="Full Configure"
                            className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setQuickEditApp(app)}
                            title="Quick Edit"
                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(app.id)}
                            disabled={deleting === app.id}
                            title="Remove from Registry"
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                          >
                            {deleting === app.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
            <span className="text-[11px] text-slate-600 font-mono">{filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''} in registry</span>
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      <AnimatePresence>
        {wizardApp !== undefined && (
          <OnboardingWizard
            initial={wizardApp}
            onClose={() => setWizardApp(undefined)}
            onSaved={() => { setWizardApp(undefined); fetchApps() }}
          />
        )}
      </AnimatePresence>

      {/* Quick Edit Modal */}
      <AnimatePresence>
        {quickEditApp && (
          <QuickEditModal
            app={quickEditApp}
            onClose={() => setQuickEditApp(null)}
            onSaved={() => { setQuickEditApp(null); fetchApps() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
