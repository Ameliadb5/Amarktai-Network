'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Github, RefreshCw, CheckCircle2, XCircle, ExternalLink,
  GitBranch, Upload, History, Save, Eye, EyeOff,
} from 'lucide-react'

interface GitHubConfig {
  configured: boolean
  username?: string
  accessTokenMasked?: string
  defaultOwner?: string
  lastValidatedAt?: string | null
}

interface PushLog {
  id: number
  projectId: number
  repoFullName: string
  branch: string
  commitSha: string | null
  commitUrl: string | null
  commitMessage: string
  filesChanged: number
  success: boolean
  error: string | null
  pushedAt: string
}

export default function DevWorkspacePage() {
  const [config, setConfig]     = useState<GitHubConfig | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [pushLog, setPushLog]   = useState<PushLog[]>([])
  const [logLoading, setLogLoading] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ username: '', accessToken: '', defaultOwner: '' })
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [validating, setValidating] = useState(false)
  const [validateResult, setValidateResult] = useState<{ valid: boolean; username: string | null; error: string | null } | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/github')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GitHub config')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPushLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await fetch('/api/admin/github/push')
      if (!res.ok) return
      const data = await res.json()
      setPushLog(data.log ?? [])
    } catch { /* non-fatal */ } finally {
      setLogLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadPushLog()
  }, [loadConfig, loadPushLog])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save GitHub config')
      setShowForm(false)
      setForm({ username: '', accessToken: '', defaultOwner: '' })
      await loadConfig()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    setValidateResult(null)
    try {
      const res = await fetch('/api/admin/github/validate', { method: 'POST' })
      const data = await res.json()
      setValidateResult(data)
      await loadConfig()
    } catch { /* non-fatal */ } finally {
      setValidating(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Github className="w-6 h-6 text-slate-300" />
            Developer Workspace
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            GitHub integration, project exports, and developer tooling. Admin-only.
          </p>
        </div>
        <button
          onClick={() => { loadConfig(); loadPushLog() }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* GitHub Connection Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl bg-white/3 border border-white/8"
      >
        <div className="flex items-center gap-3 mb-4">
          <Github className="w-5 h-5 text-slate-300" />
          <h2 className="font-bold text-white">GitHub Connection</h2>
          {config?.configured ? (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">Connected</span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-400 font-mono">Not configured</span>
          )}
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : config?.configured ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-28">Username:</span>
              <span className="text-white font-mono">{config.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-28">Access Token:</span>
              <span className="text-slate-400 font-mono">{config.accessTokenMasked}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 w-28">Default Owner:</span>
              <span className="text-white font-mono">{config.defaultOwner}</span>
            </div>
            {config.lastValidatedAt && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28">Last Validated:</span>
                <span className="text-slate-400">{new Date(config.lastValidatedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                {validating ? 'Validating…' : 'Re-validate Token'}
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition-colors"
              >
                Update Credentials
              </button>
            </div>
            {validateResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${validateResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {validateResult.valid
                  ? <><CheckCircle2 className="w-3 h-3" /> Token valid — authenticated as {validateResult.username}</>
                  : <><XCircle className="w-3 h-3" /> {validateResult.error}</>
                }
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-slate-400 text-sm mb-3">
              Connect GitHub with a Personal Access Token (PAT) to push playground projects to your repos.
              The token needs <code className="text-purple-400">repo</code> scope.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
            >
              <Github className="w-4 h-4" />
              Configure GitHub
            </button>
          </div>
        )}
      </motion.div>

      {/* Configure Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-white/3 border border-purple-500/20"
        >
          <h3 className="font-bold text-white mb-4">GitHub Credentials</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">GitHub Username</label>
                <input
                  type="text"
                  placeholder="your-username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Default Owner (org or username)</label>
                <input
                  type="text"
                  placeholder="your-org-or-username"
                  value={form.defaultOwner}
                  onChange={e => setForm(f => ({ ...f, defaultOwner: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Personal Access Token (PAT) *</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  required
                  placeholder="ghp_••••••••••••••••••••••••••••••"
                  value={form.accessToken}
                  onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Create at github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
                Grant <code className="text-purple-400">Contents: Read and write</code> on target repos.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save Credentials'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Push Log */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="font-bold text-white text-sm">GitHub Push Audit Log</h2>
          {logLoading && <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />}
        </div>

        {pushLog.length === 0 ? (
          <div className="p-6 rounded-xl bg-white/3 border border-white/8 text-center text-slate-600 text-sm">
            No push history yet. Use the Projects page to push a project to GitHub.
          </div>
        ) : (
          <div className="space-y-2">
            {pushLog.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`p-3 rounded-xl border text-sm ${
                  entry.success
                    ? 'bg-white/3 border-white/8'
                    : 'bg-red-500/5 border-red-500/15'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.success
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  }
                  <span className="text-white font-mono text-xs">{entry.repoFullName}</span>
                  <GitBranch className="w-3 h-3 text-slate-500" />
                  <span className="text-purple-400 font-mono text-xs">{entry.branch}</span>
                  <span className="text-slate-500 text-xs ml-auto">{new Date(entry.pushedAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-400 text-xs mt-1 truncate">{entry.commitMessage}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                  <span><Upload className="w-2.5 h-2.5 inline mr-0.5" />{entry.filesChanged} file(s)</span>
                  {entry.commitUrl && (
                    <a
                      href={entry.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-purple-400 hover:text-purple-300"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      View commit
                    </a>
                  )}
                  {!entry.success && entry.error && (
                    <span className="text-red-400">Error: {entry.error}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
