'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings2, Zap, FolderGit2, RefreshCw, CheckCircle, AlertCircle,
  ExternalLink, ShieldCheck, Key, ArrowRight, HardDrive, Loader2,
  Eye, EyeOff, Save, TestTube2, XCircle, ChevronDown, ChevronRight,
  Unlink,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface GenXConfig {
  configured: boolean
  maskedKey: string
  apiUrl: string
  source: 'database' | 'env' | 'none'
  updatedAt: string | null
}

interface GitHubConfig {
  configured: boolean
  maskedToken: string
  username: string | null
  defaultOwner: string
  lastValidatedAt: string | null
}

interface StorageConfig {
  driver: string
  bucket: string
  region: string
  endpoint: string
  accessKey: string
  r2PublicUrl: string
  configured: boolean
  source: string
}

interface AdultConfig {
  mode: string
  specialistEndpoint: string
  hasSpecialistKey: boolean
  maskedSpecialistKey: string
}

interface IntegrationsData {
  genx: GenXConfig
  github: GitHubConfig
  storage: StorageConfig
  adult: AdultConfig
}

interface TestResult {
  success: boolean
  error?: string
  [key: string]: unknown
}

// ── Fade animation ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [data, setData] = useState<IntegrationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/integrations')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      className="space-y-6 max-w-3xl"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1a2e] to-[#060d1b] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Settings</h1>
              </div>
              <p className="text-sm text-slate-400">Configure API keys, integrations, and system behaviour.</p>
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

      {error && (
        <motion.div variants={fadeUp} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : data ? (
        <>
          <GenXSection config={data.genx} onSaved={load} />
          <GitHubSection config={data.github} onSaved={load} />
          <StorageSection config={data.storage} onSaved={load} />
          <AdultSection config={data.adult} onSaved={load} />
          <FallbackProvidersSection />
        </>
      ) : null}
    </motion.div>
  )
}

// ── GenX Section ──────────────────────────────────────────────────────────────

function GenXSection({ config, onSaved }: { config: GenXConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(!config.configured)
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState(config.apiUrl)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genx: { apiKey: apiKey || undefined, apiUrl: apiUrl || undefined } }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveMsg(`Error: ${d.error ?? 'Save failed'}`)
      } else {
        setSaveMsg('Saved')
        setApiKey('')
        onSaved()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-genx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey || undefined, apiUrl: apiUrl || undefined }),
      })
      setTestResult(await res.json())
    } finally {
      setTesting(false)
    }
  }

  const badge = config.configured
    ? { label: `Configured · ${config.source}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : { label: 'Not configured', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }

  return (
    <motion.div variants={fadeUp}>
      <SectionCard
        icon={<Zap className="h-5 w-5 text-cyan-400" />}
        title="GenX AI"
        badge={badge}
        open={open}
        onToggle={() => setOpen(v => !v)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            GenX is the primary AI execution layer. All workspace tasks, image generation, TTS, and code assistance route through GenX.
          </p>

          {config.configured && !open && (
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              {config.apiUrl && <span className="font-mono bg-white/5 px-2 py-1 rounded">{config.apiUrl}</span>}
              {config.maskedKey && <span className="font-mono bg-white/5 px-2 py-1 rounded">{config.maskedKey}</span>}
            </div>
          )}

          {open && (
            <div className="space-y-3">
              <Field label="API URL">
                <input
                  type="url"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder="https://query.genx.sh"
                  className={inputCls}
                />
              </Field>

              <Field label="API Key">
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={config.maskedKey ? `Current: ${config.maskedKey}` : 'sk-…'}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {config.maskedKey && <p className="text-[10px] text-slate-600 mt-1">Leave blank to keep existing key</p>}
              </Field>

              {testResult && (
                <TestResultBanner result={testResult} extra={
                  testResult.success
                    ? `${testResult.modelCount} models · ${testResult.latencyMs}ms`
                    : undefined
                } />
              )}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={saving} className={btnPrimary}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button onClick={test} disabled={testing} className={btnSecondary}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  Test connection
                </button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          <Link href="/admin/dashboard/genx-models" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 mt-1">
            View model catalog <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </SectionCard>
    </motion.div>
  )
}

// ── GitHub Section ────────────────────────────────────────────────────────────

function GitHubSection({ config, onSaved }: { config: GitHubConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(!config.configured)
  const [token, setToken] = useState('')
  const [defaultOwner, setDefaultOwner] = useState(config.defaultOwner)
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github: { token: token || undefined, defaultOwner } }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveMsg(`Error: ${d.error ?? 'Save failed'}`)
      } else {
        setSaveMsg('Saved')
        setToken('')
        onSaved()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || undefined }),
      })
      setTestResult(await res.json())
    } finally {
      setTesting(false)
    }
  }

  const badge = config.configured && config.username
    ? { label: `@${config.username}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : config.configured
    ? { label: 'Configured', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : { label: 'Not connected', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }

  return (
    <motion.div variants={fadeUp}>
      <SectionCard
        icon={<FolderGit2 className="h-5 w-5 text-slate-300" />}
        title="GitHub"
        badge={badge}
        open={open}
        onToggle={() => setOpen(v => !v)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Personal Access Token (PAT) for repo import, file editing, push, PR creation, and workflow_dispatch deploys. Token must have <code className="text-slate-400">repo</code> and <code className="text-slate-400">workflow</code> scopes.
          </p>

          {config.configured && !open && (
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              {config.maskedToken && <span className="font-mono bg-white/5 px-2 py-1 rounded">{config.maskedToken}</span>}
              {config.username && <span>@{config.username}</span>}
              {config.lastValidatedAt && (
                <span className="text-slate-600">Validated {new Date(config.lastValidatedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {open && (
            <div className="space-y-3">
              <Field label="Personal Access Token">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder={config.maskedToken ? `Current: ${config.maskedToken}` : 'ghp_…'}
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {config.maskedToken && <p className="text-[10px] text-slate-600 mt-1">Leave blank to keep existing token</p>}
              </Field>

              <Field label="Default Owner (optional)">
                <input
                  type="text"
                  value={defaultOwner}
                  onChange={e => setDefaultOwner(e.target.value)}
                  placeholder="your-github-username"
                  className={inputCls}
                />
              </Field>

              {testResult && (
                <TestResultBanner result={testResult} extra={
                  testResult.success && testResult.username
                    ? `@${testResult.username} · ${testResult.repoCount ?? 0} repos · ${testResult.latencyMs}ms`
                    : undefined
                } />
              )}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={saving} className={btnPrimary}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button onClick={test} disabled={testing} className={btnSecondary}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  Test token
                </button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          {config.configured && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1">
              {['Repo import', 'Branch browsing', 'File push', 'PR creation', 'Deploy dispatch'].map(cap => (
                <span key={cap} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">{cap}</span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </motion.div>
  )
}

// ── Storage Section ───────────────────────────────────────────────────────────

function StorageSection({ config, onSaved }: { config: StorageConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [driver, setDriver] = useState(config.driver || 'local')
  const [bucket, setBucket] = useState(config.bucket)
  const [region, setRegion] = useState(config.region)
  const [endpoint, setEndpoint] = useState(config.endpoint)
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [r2PublicUrl, setR2PublicUrl] = useState(config.r2PublicUrl)
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage: {
            driver,
            bucket: bucket || undefined,
            region: region || undefined,
            endpoint: endpoint || undefined,
            accessKey: accessKey || undefined,
            secretKey: secretKey || undefined,
            r2PublicUrl: r2PublicUrl || undefined,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveMsg(`Error: ${d.error ?? 'Save failed'}`)
      } else {
        setSaveMsg('Saved')
        setSecretKey('')
        onSaved()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver, bucket, region, endpoint, accessKey, secretKey, r2PublicUrl }),
      })
      setTestResult(await res.json())
    } finally {
      setTesting(false)
    }
  }

  const isCloud = driver === 's3' || driver === 'r2'
  const badge = driver === 'local'
    ? { label: 'Local (ephemeral)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
    : config.configured
    ? { label: `${driver.toUpperCase()} · configured`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : { label: `${driver.toUpperCase()} · not configured`, color: 'text-red-400 bg-red-500/10 border-red-500/20' }

  return (
    <motion.div variants={fadeUp}>
      <SectionCard
        icon={<HardDrive className="h-5 w-5 text-slate-400" />}
        title="Artifact Storage"
        badge={badge}
        open={open}
        onToggle={() => setOpen(v => !v)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Where generated artifacts (images, audio, video, code) are stored. Local storage is ephemeral — use S3 or R2 for persistence.
          </p>

          {open && (
            <div className="space-y-3">
              <Field label="Storage Driver">
                <select
                  value={driver}
                  onChange={e => setDriver(e.target.value)}
                  className={inputCls}
                >
                  <option value="local">Local filesystem (ephemeral)</option>
                  <option value="s3">Amazon S3 / S3-compatible</option>
                  <option value="r2">Cloudflare R2</option>
                </select>
              </Field>

              {driver === 'local' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Local storage is ephemeral. Artifacts will be lost on redeploy. Configure S3 or R2 for persistent storage.
                </div>
              )}

              {isCloud && (
                <>
                  <Field label="Bucket">
                    <input type="text" value={bucket} onChange={e => setBucket(e.target.value)} placeholder="my-artifacts-bucket" className={inputCls} />
                  </Field>
                  {driver === 's3' && (
                    <>
                      <Field label="Region">
                        <input type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="us-east-1" className={inputCls} />
                      </Field>
                      <Field label="Endpoint (optional — for S3-compatible stores)">
                        <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://minio.example.com" className={inputCls} />
                      </Field>
                    </>
                  )}
                  {driver === 'r2' && (
                    <Field label="R2 Public URL">
                      <input type="text" value={r2PublicUrl} onChange={e => setR2PublicUrl(e.target.value)} placeholder="https://pub-xxx.r2.dev" className={inputCls} />
                    </Field>
                  )}
                  <Field label="Access Key ID">
                    <input type="text" value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder={config.accessKey || 'AKIA…'} className={inputCls} />
                  </Field>
                  <Field label="Secret Access Key">
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                        placeholder="Leave blank to keep existing secret"
                        className={`${inputCls} pr-10`}
                      />
                      <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                </>
              )}

              {testResult && (
                <TestResultBanner result={testResult} extra={
                  testResult.success
                    ? `${(testResult.driver as string ?? '').toUpperCase()} · ${testResult.bucket ?? ''} · ${testResult.latencyMs ?? 0}ms`
                    : (testResult.warning as string | undefined)
                } />
              )}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={saving} className={btnPrimary}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button onClick={test} disabled={testing} className={btnSecondary}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  Test storage
                </button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </motion.div>
  )
}

// ── Adult Mode Section ────────────────────────────────────────────────────────

function AdultSection({ config, onSaved }: { config: AdultConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(config.mode || 'disabled')
  const [specialistEndpoint, setSpecialistEndpoint] = useState(config.specialistEndpoint)
  const [specialistKey, setSpecialistKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adult: {
            mode,
            specialistEndpoint: specialistEndpoint || undefined,
            specialistKey: specialistKey || undefined,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveMsg(`Error: ${d.error ?? 'Save failed'}`)
      } else {
        setSaveMsg('Saved')
        setSpecialistKey('')
        onSaved()
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/settings/test-adult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, endpoint: specialistEndpoint, apiKey: specialistKey }),
      })
      setTestResult(await res.json())
    } finally {
      setTesting(false)
    }
  }

  const badge = mode === 'disabled'
    ? { label: 'Disabled', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
    : mode === 'genx'
    ? { label: 'Via GenX', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }
    : { label: 'Specialist provider', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' }

  return (
    <motion.div variants={fadeUp}>
      <SectionCard
        icon={<ShieldCheck className="h-5 w-5 text-violet-400" />}
        title="Adult Content Mode"
        badge={badge}
        open={open}
        onToggle={() => setOpen(v => !v)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Adult content generation is off by default. Enable only after verifying compliance with applicable content policies.
          </p>

          {open && (
            <div className="space-y-3">
              <Field label="Mode">
                <select value={mode} onChange={e => setMode(e.target.value)} className={inputCls}>
                  <option value="disabled">Disabled (default)</option>
                  <option value="genx">GenX (if GenX supports adult content)</option>
                  <option value="specialist">Specialist provider</option>
                </select>
              </Field>

              {mode === 'genx' && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-violet-300">
                  Requires <code className="text-violet-200">GENX_ADULT_CONTENT_SUPPORTED=true</code> in your environment and a GenX deployment that supports adult content.
                </div>
              )}

              {mode === 'specialist' && (
                <>
                  <Field label="Specialist Endpoint">
                    <input
                      type="url"
                      value={specialistEndpoint}
                      onChange={e => setSpecialistEndpoint(e.target.value)}
                      placeholder="https://your-adult-provider.com/v1/generate"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Specialist API Key">
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={specialistKey}
                        onChange={e => setSpecialistKey(e.target.value)}
                        placeholder={config.hasSpecialistKey ? `Current: ${config.maskedSpecialistKey}` : 'API key…'}
                        className={`${inputCls} pr-10`}
                      />
                      <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {config.hasSpecialistKey && <p className="text-[10px] text-slate-600 mt-1">Leave blank to keep existing key</p>}
                  </Field>
                </>
              )}

              {testResult && (
                <TestResultBanner result={testResult} extra={
                  testResult.message as string | undefined
                } />
              )}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={saving} className={btnPrimary}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
                <button onClick={test} disabled={testing} className={btnSecondary}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  Test
                </button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </motion.div>
  )
}

// ── Fallback Providers Section ────────────────────────────────────────────────

function FallbackProvidersSection() {
  return (
    <motion.div variants={fadeUp}>
      <SectionCard
        icon={<Key className="h-5 w-5 text-slate-400" />}
        title="Fallback &amp; Specialist Providers"
        badge={{ label: 'Fallback only', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }}
        open={false}
        onToggle={() => {}}
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            These providers are only used when GenX is unavailable or for specialist capabilities (e.g. ElevenLabs TTS, Firecrawl web crawl). Configure them in the Integrations page.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {['Firecrawl', 'Mem0', 'Graphiti', 'LiteLLM', 'PostHog', 'LangGraph', 'Qdrant', 'HuggingFace'].map(p => (
              <span key={p} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">{p}</span>
            ))}
          </div>
          <Link href="/admin/dashboard/integrations" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
            Manage integration keys <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </SectionCard>
    </motion.div>
  )
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, badge, open, onToggle, children,
}: {
  icon: React.ReactNode
  title: string
  badge?: { label: string; color: string }
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-5 text-left hover:bg-white/[0.01] transition-colors"
      >
        {icon}
        <h2 className="text-base font-semibold text-white flex-1">{title}</h2>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
        )}
        {open
          ? <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-white/[0.06] pt-4">
          {children}
        </div>
      )}
      {!open && (
        <div className="px-5 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function TestResultBanner({ result, extra }: { result: TestResult; extra?: string }) {
  return (
    <div className={`rounded-xl border p-3 text-xs flex items-start gap-2 ${
      result.success
        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
        : 'border-red-500/20 bg-red-500/5 text-red-400'
    }`}>
      {result.success
        ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
        : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
      <div>
        <span>{result.success ? 'Connected' : (result.error as string | undefined) ?? 'Failed'}</span>
        {extra && <span className="ml-2 text-inherit opacity-70">{extra}</span>}
      </div>
    </div>
  )
}

// ── Style constants ────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 font-mono'

const btnPrimary =
  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-colors disabled:opacity-50'

const btnSecondary =
  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 border border-white/10 bg-white/5 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50'

// Unused import suppression
void Unlink

