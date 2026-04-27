'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings2, Zap, FolderGit2, RefreshCw, CheckCircle, AlertCircle,
  ShieldCheck, Key, Save, TestTube2, Eye, EyeOff, HardDrive,
  Cloud, Database, Loader2, XCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntegrationsData {
  genx: { configured: boolean; maskedKey: string; apiUrl: string }
  github: { configured: boolean; username: string | null; lastValidatedAt: string | null }
  storage: {
    driver: 'local' | 's3' | 'r2'
    bucket: string
    region: string
    endpoint: string
    accessKey: string
    secretKey: string
    publicUrl: string
    configured: boolean
  }
  adultProvider: { mode: 'genx' | 'specialist' | 'disabled'; endpoint: string; maskedKey: string }
  fallbackProviders: Record<string, { configured: boolean; maskedKey: string }>
}

// ── Animation ─────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
    : <span className="inline-block h-2 w-2 rounded-full bg-slate-600" />
}

function PasswordInput({
  value, onChange, placeholder, id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 pr-9 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function TextInput({
  value, onChange, placeholder, id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-cyan-500/50 focus:outline-none"
    />
  )
}

function SaveBtn({
  onClick, loading, label = 'Save',
}: {
  onClick: () => void
  loading?: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

function TestBtn({
  onClick, loading, label = 'Test',
}: {
  onClick: () => void
  loading?: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}

function TestResult({ result }: { result: { success: boolean; message: string } | null }) {
  if (!result) return null
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${result.success ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
      {result.success
        ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 shrink-0" />}
      {result.message}
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-400 mb-1">
      {children}
    </label>
  )
}

function SectionCard({
  icon, title, badge, children,
}: {
  icon: React.ReactNode
  title: string
  badge?: { label: string; color: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-center gap-2 mb-5">
        {icon}
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {badge && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [data, setData] = useState<IntegrationsData | null>(null)
  const [loading, setLoading] = useState(true)

  // GenX form state
  const [genxKey, setGenxKey] = useState('')
  const [genxUrl, setGenxUrl] = useState('https://query.genx.sh')
  const [genxSaving, setGenxSaving] = useState(false)
  const [genxTesting, setGenxTesting] = useState(false)
  const [genxTestResult, setGenxTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // GitHub form state
  const [ghToken, setGhToken] = useState('')
  const [ghSaving, setGhSaving] = useState(false)
  const [ghTesting, setGhTesting] = useState(false)
  const [ghTestResult, setGhTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Storage form state
  const [storageDriver, setStorageDriver] = useState<'local' | 's3' | 'r2'>('local')
  const [storageBucket, setStorageBucket] = useState('')
  const [storageRegion, setStorageRegion] = useState('')
  const [storageEndpoint, setStorageEndpoint] = useState('')
  const [storageAccessKey, setStorageAccessKey] = useState('')
  const [storageSecretKey, setStorageSecretKey] = useState('')
  const [storagePublicUrl, setStoragePublicUrl] = useState('')
  const [storageSaving, setStorageSaving] = useState(false)
  const [storageTesting, setStorageTesting] = useState(false)
  const [storageTestResult, setStorageTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Adult provider form state
  const [adultMode, setAdultMode] = useState<'genx' | 'specialist' | 'disabled'>('genx')
  const [adultEndpoint, setAdultEndpoint] = useState('')
  const [adultKey, setAdultKey] = useState('')
  const [adultSaving, setAdultSaving] = useState(false)
  const [adultTesting, setAdultTesting] = useState(false)
  const [adultTestResult, setAdultTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Fallback providers form state
  const [fallbackKeys, setFallbackKeys] = useState<Record<string, string>>({
    openai: '', gemini: '', huggingface: '', together: '',
  })
  const [fallbackSaving, setFallbackSaving] = useState<Record<string, boolean>>({})
  const [fallbackResults, setFallbackResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings/integrations')
      if (res.ok) {
        const d: IntegrationsData = await res.json()
        setData(d)
        setGenxUrl(d.genx.apiUrl || 'https://query.genx.sh')
        setStorageDriver(d.storage.driver)
        setStorageBucket(d.storage.bucket)
        setStorageRegion(d.storage.region)
        setStorageEndpoint(d.storage.endpoint)
        setStoragePublicUrl(d.storage.publicUrl)
        setAdultMode(d.adultProvider.mode)
        setAdultEndpoint(d.adultProvider.endpoint)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── GenX handlers ────────────────────────────────────────────────────────
  async function saveGenx() {
    setGenxSaving(true)
    try {
      const body: Record<string, unknown> = { genx: { apiUrl: genxUrl } }
      if (genxKey) (body.genx as Record<string, unknown>).apiKey = genxKey
      await fetch('/api/admin/settings/integrations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setGenxKey('')
      await load()
    } finally {
      setGenxSaving(false)
    }
  }

  async function testGenx() {
    setGenxTesting(true)
    setGenxTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-genx', { method: 'POST' })
      const d = await res.json()
      setGenxTestResult(d.success
        ? { success: true, message: `Connected — ${d.modelCount} models` }
        : { success: false, message: d.error ?? 'Connection failed' })
    } finally {
      setGenxTesting(false)
    }
  }

  // ── GitHub handlers ──────────────────────────────────────────────────────
  async function saveGitHub() {
    if (!ghToken) return
    setGhSaving(true)
    try {
      await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github: { accessToken: ghToken } }),
      })
      setGhToken('')
      await load()
    } finally {
      setGhSaving(false)
    }
  }

  async function testGitHub() {
    setGhTesting(true)
    setGhTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-github', { method: 'POST' })
      const d = await res.json()
      setGhTestResult(d.success
        ? { success: true, message: `Connected as @${d.username}${d.repoCount != null ? ` · ${d.repoCount} repos` : ''}` }
        : { success: false, message: d.error ?? 'Validation failed' })
    } finally {
      setGhTesting(false)
    }
  }

  // ── Storage handlers ─────────────────────────────────────────────────────
  async function saveStorage() {
    setStorageSaving(true)
    try {
      const storageBody: Record<string, unknown> = {
        driver: storageDriver,
        bucket: storageBucket,
        region: storageRegion,
        endpoint: storageEndpoint,
        publicUrl: storagePublicUrl,
      }
      if (storageAccessKey) storageBody.accessKey = storageAccessKey
      if (storageSecretKey) storageBody.secretKey = storageSecretKey
      await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage: storageBody }),
      })
      setStorageAccessKey('')
      setStorageSecretKey('')
      await load()
    } finally {
      setStorageSaving(false)
    }
  }

  async function testStorage() {
    setStorageTesting(true)
    setStorageTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-storage', { method: 'POST' })
      const d = await res.json()
      setStorageTestResult(d.success
        ? { success: true, message: d.note ?? `${d.driver} storage OK${d.persistent ? ' (persistent)' : ' (ephemeral)'}` }
        : { success: false, message: d.error ?? 'Storage test failed' })
    } finally {
      setStorageTesting(false)
    }
  }

  // ── Adult provider handlers ──────────────────────────────────────────────
  async function saveAdult() {
    setAdultSaving(true)
    try {
      const body: Record<string, unknown> = { mode: adultMode, endpoint: adultEndpoint }
      if (adultKey) body.apiKey = adultKey
      await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adultProvider: body }),
      })
      setAdultKey('')
      await load()
    } finally {
      setAdultSaving(false)
    }
  }

  async function testAdult() {
    setAdultTesting(true)
    setAdultTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-adult-provider', { method: 'POST' })
      const d = await res.json()
      setAdultTestResult(d.success
        ? { success: true, message: `Adult provider OK (mode: ${d.mode})` }
        : { success: false, message: d.error ?? 'Test failed' })
    } finally {
      setAdultTesting(false)
    }
  }

  // ── Fallback provider handlers ────────────────────────────────────────────
  async function saveFallback(providerKey: string) {
    const val = fallbackKeys[providerKey]
    if (!val) return
    setFallbackSaving(p => ({ ...p, [providerKey]: true }))
    try {
      await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fallbackProviders: { [providerKey]: val } }),
      })
      setFallbackKeys(p => ({ ...p, [providerKey]: '' }))
      setFallbackResults(p => ({ ...p, [providerKey]: { success: true, message: 'Saved' } }))
      await load()
    } catch {
      setFallbackResults(p => ({ ...p, [providerKey]: { success: false, message: 'Save failed' } }))
    } finally {
      setFallbackSaving(p => ({ ...p, [providerKey]: false }))
    }
  }

  const FALLBACK_META = [
    { key: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { key: 'gemini', label: 'Gemini', placeholder: 'AIza...' },
    { key: 'huggingface', label: 'HuggingFace', placeholder: 'hf_...' },
    { key: 'together', label: 'Together AI', placeholder: 'tog...' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Integrations &amp; API Keys</h1>
              </div>
              <p className="text-sm text-slate-400">Configure GenX AI, GitHub, artifact storage, adult provider, and fallback model keys.</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── GenX AI ─────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<Zap className="h-5 w-5 text-cyan-400" />}
          title="GenX AI"
          badge={data?.genx.configured
            ? { label: 'Configured', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
            : { label: 'Not configured', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
        >
          <div className="space-y-4">
            {data?.genx.maskedKey && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                <Key className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span className="text-slate-400 font-mono">{data.genx.maskedKey}</span>
                <StatusDot ok={data.genx.configured} />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="genx-key">API Key</FieldLabel>
                <PasswordInput id="genx-key" value={genxKey} onChange={setGenxKey} placeholder="Enter new key to update…" />
              </div>
              <div>
                <FieldLabel htmlFor="genx-url">API URL</FieldLabel>
                <TextInput id="genx-url" value={genxUrl} onChange={setGenxUrl} placeholder="https://query.genx.sh" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <SaveBtn onClick={saveGenx} loading={genxSaving} />
              <TestBtn onClick={testGenx} loading={genxTesting} label="Test Connection" />
              <a
                href="/admin/dashboard/genx-models"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                <Database className="h-3.5 w-3.5" />
                Sync Model Catalog
              </a>
            </div>
            <TestResult result={genxTestResult} />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── GitHub ──────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<FolderGit2 className="h-5 w-5 text-slate-300" />}
          title="GitHub"
          badge={data?.github.configured
            ? { label: `Connected${data.github.username ? ` · @${data.github.username}` : ''}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
            : { label: 'Not connected', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }}
        >
          <div className="space-y-4">
            {data?.github.configured && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">
                  Connected{data.github.username ? ` as @${data.github.username}` : ''}
                </span>
                {data.github.lastValidatedAt && (
                  <span className="text-xs text-slate-600 ml-2">
                    Last validated {new Date(data.github.lastValidatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
            {!data?.github.configured && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-slate-400">No GitHub token configured. Add a Personal Access Token below.</span>
              </div>
            )}
            <div>
              <FieldLabel htmlFor="gh-token">Personal Access Token</FieldLabel>
              <PasswordInput id="gh-token" value={ghToken} onChange={setGhToken} placeholder="ghp_..." />
              <p className="mt-1 text-xs text-slate-600">Requires <code className="text-slate-500">repo</code>, <code className="text-slate-500">workflow</code> scopes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SaveBtn onClick={saveGitHub} loading={ghSaving} label="Save Token" />
              <TestBtn onClick={testGitHub} loading={ghTesting} label="Test & Connect" />
            </div>
            <TestResult result={ghTestResult} />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Artifact Storage ─────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<HardDrive className="h-5 w-5 text-slate-400" />}
          title="Artifact Storage"
          badge={data
            ? data.storage.driver === 'local'
              ? { label: 'Local (ephemeral)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
              : data.storage.configured
                ? { label: `${data.storage.driver.toUpperCase()} — configured`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
                : { label: `${data.storage.driver.toUpperCase()} — incomplete`, color: 'text-red-400 bg-red-500/10 border-red-500/20' }
            : undefined}
        >
          <div className="space-y-4">
            {storageDriver === 'local' && (
              <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span><strong>Warning:</strong> Local storage is ephemeral. Files will be lost when the container restarts. Switch to S3 or R2 for persistent artifact storage.</span>
              </div>
            )}
            <div>
              <FieldLabel>Storage Driver</FieldLabel>
              <div className="flex gap-2">
                {(['local', 's3', 'r2'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setStorageDriver(d)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      storageDriver === d
                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                    }`}
                  >
                    {d === 'local' ? <HardDrive className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}
                    {d === 'local' ? 'Local' : d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {storageDriver !== 'local' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="s-bucket">Bucket</FieldLabel>
                  <TextInput id="s-bucket" value={storageBucket} onChange={setStorageBucket} placeholder="my-bucket" />
                </div>
                {storageDriver === 's3' && (
                  <div>
                    <FieldLabel htmlFor="s-region">Region</FieldLabel>
                    <TextInput id="s-region" value={storageRegion} onChange={setStorageRegion} placeholder="us-east-1" />
                  </div>
                )}
                <div>
                  <FieldLabel htmlFor="s-endpoint">Endpoint URL</FieldLabel>
                  <TextInput id="s-endpoint" value={storageEndpoint} onChange={setStorageEndpoint} placeholder="https://..." />
                </div>
                <div>
                  <FieldLabel htmlFor="s-access">Access Key</FieldLabel>
                  <PasswordInput id="s-access" value={storageAccessKey} onChange={setStorageAccessKey} placeholder={data?.storage.accessKey || 'Enter to update…'} />
                </div>
                <div>
                  <FieldLabel htmlFor="s-secret">Secret Key</FieldLabel>
                  <PasswordInput id="s-secret" value={storageSecretKey} onChange={setStorageSecretKey} placeholder={data?.storage.secretKey || 'Enter to update…'} />
                </div>
                <div>
                  <FieldLabel htmlFor="s-url">Public / Base URL</FieldLabel>
                  <TextInput id="s-url" value={storagePublicUrl} onChange={setStoragePublicUrl} placeholder="https://cdn.example.com" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <SaveBtn onClick={saveStorage} loading={storageSaving} />
              <TestBtn onClick={testStorage} loading={storageTesting} label="Test Storage" />
            </div>
            <TestResult result={storageTestResult} />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Adult Provider ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<ShieldCheck className="h-5 w-5 text-violet-400" />}
          title="Adult Provider"
          badge={data
            ? adultMode === 'disabled'
              ? { label: 'Disabled', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
              : adultMode === 'genx'
                ? { label: 'Via GenX', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }
                : { label: 'Specialist', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }
            : undefined}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>Mode</FieldLabel>
              <div className="flex gap-2">
                {(['genx', 'specialist', 'disabled'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setAdultMode(m)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                      adultMode === m
                        ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                        : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {adultMode === 'specialist' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="adult-ep">Endpoint URL</FieldLabel>
                  <TextInput id="adult-ep" value={adultEndpoint} onChange={setAdultEndpoint} placeholder="https://..." />
                </div>
                <div>
                  <FieldLabel htmlFor="adult-key">API Key</FieldLabel>
                  <PasswordInput id="adult-key" value={adultKey} onChange={setAdultKey} placeholder={data?.adultProvider.maskedKey || 'Enter API key…'} />
                </div>
              </div>
            )}

            {adultMode === 'genx' && (
              <p className="text-xs text-slate-500">Adult content will be routed through the configured GenX AI endpoint.</p>
            )}
            {adultMode === 'disabled' && (
              <p className="text-xs text-slate-500">Adult content generation is disabled. No adult content will be produced.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <SaveBtn onClick={saveAdult} loading={adultSaving} />
              <TestBtn onClick={testAdult} loading={adultTesting} label="Test" />
            </div>
            <TestResult result={adultTestResult} />
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Fallback Providers ──────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionCard
          icon={<Key className="h-5 w-5 text-slate-400" />}
          title="Fallback Providers"
          badge={{ label: `${Object.values(data?.fallbackProviders ?? {}).filter(v => v.configured).length} / ${FALLBACK_META.length} configured`, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
        >
          <p className="text-xs text-slate-500 mb-4">
            These keys are used only when GenX is unavailable or for specific capabilities.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FALLBACK_META.map(({ key: pk, label, placeholder }) => {
              const status = data?.fallbackProviders[pk]
              return (
                <div key={pk} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{label}</span>
                    <StatusDot ok={status?.configured ?? false} />
                  </div>
                  {status?.maskedKey && (
                    <p className="text-xs text-slate-500 font-mono">{status.maskedKey}</p>
                  )}
                  <PasswordInput
                    value={fallbackKeys[pk] ?? ''}
                    onChange={v => setFallbackKeys(prev => ({ ...prev, [pk]: v }))}
                    placeholder={placeholder}
                  />
                  <div className="flex items-center gap-2">
                    <SaveBtn onClick={() => saveFallback(pk)} loading={fallbackSaving[pk]} label="Save Key" />
                    {fallbackResults[pk] && (
                      <span className={`text-xs ${fallbackResults[pk].success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fallbackResults[pk].message}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </motion.div>
    </motion.div>
  )
}
