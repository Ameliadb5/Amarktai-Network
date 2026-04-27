'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Rocket, RefreshCw, CheckCircle, AlertCircle, Clock,
  XCircle, ExternalLink, GitBranch, FolderGit2, Play,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface RepoInfo {
  name: string
  fullName: string
  url: string
  defaultBranch: string
}

interface DeployRun {
  id: number
  status: string
  conclusion: string | null
  headBranch: string
  runNumber: number
  htmlUrl: string
  createdAt: string
  workflowId?: string
}

interface GitHubStatus {
  valid: boolean
  username: string | null
  error?: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const RUN_STATUS: Record<string, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; label: string }> = {
  completed_success:   { icon: CheckCircle, color: 'text-emerald-400', label: 'Success'    },
  completed_failure:   { icon: XCircle,     color: 'text-red-400',     label: 'Failed'     },
  completed_cancelled: { icon: XCircle,     color: 'text-slate-500',   label: 'Cancelled'  },
  in_progress:         { icon: Clock,       color: 'text-amber-400',   label: 'Running…'   },
  queued:              { icon: Clock,       color: 'text-slate-400',   label: 'Queued'     },
  waiting:             { icon: Clock,       color: 'text-slate-400',   label: 'Waiting'    },
  unknown:             { icon: AlertCircle, color: 'text-slate-500',   label: 'Unknown'    },
}

function getRunKey(run: DeployRun): string {
  if (run.status === 'completed') return `completed_${run.conclusion ?? 'unknown'}`
  return run.status ?? 'unknown'
}

export default function DeploymentsPage() {
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null)
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [workflowId, setWorkflowId] = useState('deploy.yml')
  const [runs, setRuns] = useState<DeployRun[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployBranch, setDeployBranch] = useState('')
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const [valRes, repoRes] = await Promise.allSettled([
        fetch('/api/admin/github/validate'),
        fetch('/api/admin/github/repos'),
      ])
      if (valRes.status === 'fulfilled' && valRes.value.ok) {
        setGhStatus(await valRes.value.json())
      }
      if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
        const data = await repoRes.value.json()
        const list: RepoInfo[] = Array.isArray(data.repos)
          ? data.repos.map((r: { name?: string; fullName?: string; full_name?: string; url?: string; html_url?: string; defaultBranch?: string; default_branch?: string }) => ({
              name: r.name ?? '',
              fullName: r.fullName ?? r.full_name ?? '',
              url: r.url ?? r.html_url ?? '',
              defaultBranch: r.defaultBranch ?? r.default_branch ?? 'main',
            }))
          : []
        setRepos(list)
        // Only pre-fill repo selection when nothing is selected yet
        if (list.length > 0) {
          setSelectedRepo(prev => prev || list[0].fullName)
        }
      }
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const loadRuns = useCallback(async (repo?: string, workflow?: string) => {
    const r = repo ?? selectedRepo
    const w = workflow ?? workflowId
    if (!r) return
    setLoadingRuns(true)
    try {
      const res = await fetch(`/api/admin/github/deploy?repo=${encodeURIComponent(r)}&workflowId=${encodeURIComponent(w)}&limit=15`)
      if (res.ok) {
        const data = await res.json()
        setRuns(Array.isArray(data.runs) ? data.runs : [])
      } else {
        setRuns([])
      }
    } catch {
      setRuns([])
    } finally {
      setLoadingRuns(false)
    }
  }, [selectedRepo, workflowId])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => {
    if (selectedRepo) loadRuns(selectedRepo, workflowId)
  }, [selectedRepo, workflowId, loadRuns])

  const triggerDeploy = useCallback(async () => {
    if (!selectedRepo || !workflowId) return
    if (!confirm(`Trigger workflow "${workflowId}" on ${selectedRepo}? This will start a real deployment.`)) return
    setDeploying(true)
    setDeployResult(null)
    try {
      const res = await fetch('/api/admin/github/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: selectedRepo, workflowId, branch: deployBranch || undefined }),
      })
      const data = await res.json()
      setDeployResult({ success: data.success ?? res.ok, message: data.message ?? (res.ok ? 'Workflow triggered' : data.error ?? 'Failed') })
      if (data.success ?? res.ok) {
        setTimeout(() => loadRuns(selectedRepo, workflowId), 3000)
      }
    } catch (e) {
      setDeployResult({ success: false, message: e instanceof Error ? e.message : 'Request failed' })
    } finally {
      setDeploying(false)
    }
  }, [selectedRepo, workflowId, deployBranch, loadRuns])

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
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-6 w-6 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white">Deployments</h1>
              </div>
              <p className="text-sm text-slate-400">GitHub Actions workflow runs, deploy status, and manual deploy triggers.</p>
            </div>
            <button
              onClick={() => { loadStatus(); if (selectedRepo) loadRuns() }}
              disabled={loadingStatus}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-400 hover:text-white disabled:opacity-40 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* GitHub connection status */}
      <motion.div variants={fadeUp}>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2">
            {ghStatus?.valid
              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
              : <AlertCircle className="h-4 w-4 text-amber-400" />}
            <span className="text-sm text-slate-200">
              {loadingStatus
                ? 'Checking GitHub…'
                : ghStatus?.valid
                  ? `GitHub connected${ghStatus.username ? ` · @${ghStatus.username}` : ''}`
                  : 'GitHub not connected — configure token in Settings'}
            </span>
          </div>
        </div>
      </motion.div>

      {ghStatus?.valid && (
        <>
          {/* Controls */}
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Repository</label>
              <div className="relative">
                <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <select
                  value={selectedRepo}
                  onChange={e => setSelectedRepo(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/40 min-w-[220px]"
                >
                  {repos.length === 0
                    ? <option value="">No repos found</option>
                    : repos.map(r => <option key={r.fullName} value={r.fullName} className="bg-[#0a0f1a] text-white">{r.fullName}</option>)
                  }
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Workflow file</label>
              <input
                type="text"
                value={workflowId}
                onChange={e => setWorkflowId(e.target.value)}
                className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/40 w-36 font-mono"
                placeholder="deploy.yml"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Branch (optional)</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={deployBranch}
                  onChange={e => setDeployBranch(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/40 w-36"
                  placeholder="main"
                />
              </div>
            </div>
            <button
              onClick={triggerDeploy}
              disabled={deploying || !selectedRepo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40 transition-all text-sm"
            >
              <Play className="h-3.5 w-3.5" />
              {deploying ? 'Triggering…' : 'Trigger Deploy'}
            </button>
            <button
              onClick={() => loadRuns()}
              disabled={loadingRuns || !selectedRepo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white disabled:opacity-40 transition-all text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRuns ? 'animate-spin' : ''}`} />
              Load runs
            </button>
          </motion.div>

          {/* Deploy result */}
          {deployResult && (
            <motion.div variants={fadeUp}>
              <div className={`rounded-xl border p-3 text-sm ${deployResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                {deployResult.success ? <CheckCircle className="inline h-4 w-4 mr-1.5" /> : <AlertCircle className="inline h-4 w-4 mr-1.5" />}
                {deployResult.message}
              </div>
            </motion.div>
          )}

          {/* Workflow runs */}
          <motion.div variants={fadeUp} className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Recent runs{selectedRepo ? ` · ${selectedRepo}` : ''}{workflowId ? ` · ${workflowId}` : ''}
            </h2>
            {loadingRuns ? (
              <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading workflow runs…
              </div>
            ) : runs.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <Rocket className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No workflow runs found.</p>
                <p className="text-xs text-slate-500 mt-1">Select a repo and workflow file, then click &quot;Load runs&quot;.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="text-left px-4 py-3">Run</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Branch</th>
                      <th className="text-left px-4 py-3">Started</th>
                      <th className="text-left px-4 py-3">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => {
                      const key = getRunKey(run)
                      const meta = RUN_STATUS[key] ?? RUN_STATUS.unknown
                      const Icon = meta.icon
                      return (
                        <tr key={run.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{run.runNumber}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs ${meta.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <GitBranch className="h-3 w-3" />
                              {run.headBranch}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3">
                            {run.htmlUrl && (
                              <a
                                href={run.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                              >
                                <ExternalLink className="h-3 w-3" /> Logs
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}

      {!ghStatus?.valid && !loadingStatus && (
        <motion.div variants={fadeUp}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-medium">GitHub not connected</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Add a GitHub personal access token to enable repo access and deploy triggers.</p>
            <a href="/admin/dashboard/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 text-sm transition-all">
              Configure in Settings
            </a>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
