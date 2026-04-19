'use client'

/**
 * GitHubTab — GitHub deployment prep inside Build Studio.
 * Uses the existing /api/admin/github endpoints.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, CheckCircle, AlertCircle, ExternalLink,
  FolderGit2, RefreshCw, Rocket,
} from 'lucide-react'

interface RepoInfo { name: string; fullName: string; url: string; defaultBranch: string }
interface GitHubStatus { connected: boolean; user?: string; repos?: RepoInfo[]; error?: string }

export default function GitHubTab() {
  const [status, setStatus] = useState<GitHubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; commitUrl?: string; error?: string } | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [branch, setBranch] = useState<string>('build-studio/output')
  const [exportNotes, setExportNotes] = useState<string>('# Workspace Export\n\nGenerated from Amarktai Workspace.\n')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [valRes, repoRes] = await Promise.all([
        fetch('/api/admin/github/validate'),
        fetch('/api/admin/github/repos'),
      ])
      const valData = valRes.ok ? await valRes.json() : { valid: false }
      const repoData = repoRes.ok ? await repoRes.json() : { repos: [] }
      setStatus({
        connected: valData.valid ?? false,
        user: valData.user,
        repos: repoData.repos ?? [],
        error: valData.error,
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to check GitHub') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const pushToGitHub = useCallback(async () => {
    if (!selectedRepo) return
    setPushing(true); setPushResult(null)
    try {
      const res = await fetch('/api/admin/github/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 0,
          repoFullName: selectedRepo,
          branch,
          commitMessage: `Workspace export — ${new Date().toISOString()}`,
          files: [
            {
              path: `workspace/exports/workspace-export-${Date.now()}.md`,
              content: exportNotes,
            },
          ],
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Push failed: HTTP ${res.status}` }))
        setPushResult({ success: false, error: errData.error ?? `Push failed: HTTP ${res.status}` })
        return
      }
      const data = await res.json().catch(() => ({ success: false, error: 'Invalid response from server' }))
      setPushResult(data)
    } catch (e) { setPushResult({ success: false, error: e instanceof Error ? e.message : 'Push failed' }) } finally { setPushing(false) }
  }, [selectedRepo, branch, exportNotes])

  if (loading) {
    return <div className="flex items-center gap-2 py-16 justify-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Checking GitHub connection…</div>
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400">
        Push generated app code to GitHub. Requires GITHUB_TOKEN to be configured.
      </div>

      {error && <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}

      {/* Connection status */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          {status?.connected ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
          <span className="text-sm font-medium text-white">{status?.connected ? 'GitHub Connected' : 'GitHub Not Connected'}</span>
          {status?.user && <span className="text-xs text-slate-500">({status.user})</span>}
          <button onClick={load} className="ml-auto text-xs text-slate-500 hover:text-white"><RefreshCw className="w-3 h-3" /></button>
        </div>
        {!status?.connected && (
          <div className="text-xs text-slate-400">
            Set <code className="px-1 py-0.5 rounded bg-white/[0.05] text-blue-400">GITHUB_TOKEN</code> in your environment to enable GitHub integration.
          </div>
        )}
      </div>

      {/* Push form */}
      {status?.connected && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-4">
          <div className="text-sm font-medium text-white flex items-center gap-2"><FolderGit2 className="w-4 h-4 text-blue-400" /> Push to Repository</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
              <option value="">Select repository…</option>
              {status.repos?.map(r => <option key={r.fullName} value={r.fullName}>{r.fullName}</option>)}
            </select>
            <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch name"
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40" />
          </div>
          <textarea
            value={exportNotes}
            onChange={(e) => setExportNotes(e.target.value)}
            rows={5}
            placeholder="Export notes/spec to commit"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
          />
          <button onClick={pushToGitHub} disabled={pushing || !selectedRepo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-40 transition-colors">
            {pushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            {pushing ? 'Pushing…' : 'Push to GitHub'}
          </button>
          {pushResult && (
            <div className={`text-xs rounded-lg p-3 ${pushResult.success ? 'bg-emerald-500/5 text-emerald-300' : 'bg-red-500/5 text-red-300'}`}>
              {pushResult.success ? (
                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Pushed successfully{pushResult.commitUrl && <a href={pushResult.commitUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />View commit</a>}</span>
              ) : (
                <span>{pushResult.error ?? 'Push failed'}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
