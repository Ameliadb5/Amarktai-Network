'use client'

/**
 * Workspace Cockpit — Phase 3A
 *
 * Unified step-based workflow replacing the old disconnected tab layout.
 * Connected to real backend routes — no fake buttons.
 *
 * Modes:
 *   build     Pull a repo, browse files, ask AI to fix/add/improve, review diff, apply, commit, push
 *   review    Browse a repo, select files, get AI code review
 *   refactor  Select files, ask AI to refactor
 *   new-app   Link to the create-app wizard
 *   deploy    Deploy to VPS via direct deploy endpoint
 *   monitor   Link to Monitor page
 *   media     Generate images, audio, video, music
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Eye, Repeat2, PlusCircle, Rocket, Activity, ImageIcon,
  RefreshCw, GitBranch, Search, Check, X, Loader2, CheckCircle,
  AlertCircle, Diff, Send, Upload, FolderOpen, File,
  Wrench, PanelRightClose, PanelRightOpen, ArrowRight, ExternalLink,
} from 'lucide-react'
import type { AssistantAction } from '@/components/AIPartnerWidget'

const AIPartnerWidget = dynamic(() => import('@/components/AIPartnerWidget'), { ssr: false })
const CreatorStudioTab = dynamic(() => import('../build-studio/tabs/CreatorStudioTab'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkspaceMode = 'build' | 'review' | 'refactor' | 'new-app' | 'deploy' | 'monitor' | 'media'
type SourceType = 'public-url' | 'connected-repo'

interface TreeEntry { path: string; sha: string; size: number }
interface FileContext { path: string; content: string; language?: string }
interface FileChange { path: string; language?: string; linesAdded: number }

interface DiffResult {
  success: boolean
  changesetId?: string
  summary?: string
  filesChanged?: FileChange[]
  fileCount?: number
  unifiedDiff?: string
  riskNotes?: string
  verifyCommands?: string[]
  resolvedModel?: string
  latencyMs?: number
  error?: string
}

interface ApplyResult {
  success: boolean
  status?: string
  artifactId?: string
  commitSha?: string
  pushError?: string
  filesApplied?: number
  error?: string
}

interface DeployResult {
  success: boolean
  planned?: boolean
  logId?: string
  status?: string
  logOutput?: string
  deployMode?: string
  steps?: Array<{ name: string; status: string; output: string }>
  error?: string
}

const MODES: Array<{ key: WorkspaceMode; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; description: string }> = [
  { key: 'build',    label: 'Build / Fix Code', icon: Code2,      description: 'Pull a repo, select files, let AI fix or improve code, review the diff, commit and push.' },
  { key: 'review',   label: 'Review Code',      icon: Eye,        description: 'Browse a repo and ask AI to review selected files for bugs, security, or style.' },
  { key: 'refactor', label: 'Refactor',         icon: Repeat2,    description: 'Select files and ask AI to refactor, clean up, or restructure code.' },
  { key: 'new-app',  label: 'Create New App',   icon: PlusCircle, description: 'Create a new app with repo linking, agent config, and deploy target setup.' },
  { key: 'deploy',   label: 'Deploy',           icon: Rocket,     description: 'Deploy an app to your VPS via Webdock or record a planned deploy.' },
  { key: 'monitor',  label: 'Monitor',          icon: Activity,   description: 'Real-time server, app health, AI engine, and storage metrics.' },
  { key: 'media',    label: 'Generate Media',   icon: ImageIcon,  description: 'Generate images, audio, video, and music via configured AI providers.' },
]

// ── Step dot ──────────────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold border transition-colors ${
      done   ? 'border-emerald-500 bg-emerald-500 text-white'     :
      active ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'     :
               'border-white/10 bg-white/[0.03] text-slate-600'
    }`}>
      {done ? <Check className="h-3 w-3" /> : n}
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ step, label, active, done, children }: {
  step: number; label: string; active: boolean; done: boolean; children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border border-white/10 overflow-hidden transition-opacity ${active ? 'opacity-100' : 'opacity-50'}`}>
      <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] ${done ? 'bg-emerald-500/5' : 'bg-white/[0.02]'}`}>
        <StepDot n={step} active={active && !done} done={done} />
        <h2 className="text-sm font-semibold text-white">{label}</h2>
        {done && <CheckCircle className="ml-auto h-4 w-4 text-emerald-400" />}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Tree file row ─────────────────────────────────────────────────────────────

const BINARY_EXTS = new Set(['png','jpg','jpeg','gif','ico','woff','woff2','ttf','eot','otf','pdf','zip','gz','mp4','mp3','webm','wav','svg'])

function TreeNode({ entry, selected, onToggle }: { entry: TreeEntry; selected: boolean; onToggle: (path: string) => void }) {
  const ext = (entry.path.split('.').pop() ?? '').toLowerCase()
  const isBinary = BINARY_EXTS.has(ext)
  return (
    <div
      onClick={() => !isBinary && onToggle(entry.path)}
      className={`flex items-center gap-2 py-1 px-2 rounded-lg text-sm transition cursor-pointer ${
        isBinary ? 'opacity-30 cursor-not-allowed' :
        selected  ? 'bg-cyan-400/10 text-white border border-cyan-400/20' :
                   'text-slate-400 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {selected ? <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0" /> : <File className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
      <span className="truncate font-mono text-[12px]">{entry.path}</span>
      {isBinary && <span className="ml-auto text-[10px] text-slate-600">binary</span>}
    </div>
  )
}

// ── Diff viewer ────────────────────────────────────────────────────────────────

function DiffViewer({ diff, summary, riskNotes, verifyCommands, model, latencyMs }: {
  diff: string; summary?: string; riskNotes?: string; verifyCommands?: string[]; model?: string; latencyMs?: number
}) {
  const lines = diff.split('\n')
  return (
    <div className="space-y-3">
      {summary && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Summary</p>
          <p className="text-sm text-white">{summary}</p>
        </div>
      )}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="border-b border-white/10 px-3 py-2 flex items-center gap-2">
          <Diff className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400 uppercase tracking-widest">Unified Diff</span>
          {model && <span className="ml-auto text-[10px] text-slate-600">{model}{latencyMs ? ` · ${latencyMs}ms` : ''}</span>}
        </div>
        <pre className="max-h-[380px] overflow-auto bg-[#050a17] p-3 text-[11px] font-mono leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={
              line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400' :
              line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' :
              line.startsWith('@@') ? 'text-blue-400' :
              line.startsWith('---') || line.startsWith('+++') ? 'text-slate-400' :
              'text-slate-500'
            }>{line}</div>
          ))}
        </pre>
      </div>
      {riskNotes && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-400 mb-1">Risk Notes</p>
          <p className="text-sm text-amber-200">{riskNotes}</p>
        </div>
      )}
      {verifyCommands && verifyCommands.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold text-slate-400 mb-1.5">Verify Commands</p>
          {verifyCommands.map((cmd, i) => (
            <code key={i} className="block text-[12px] font-mono text-cyan-300">$ {cmd}</code>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main cockpit ──────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const [mode, setMode]               = useState<WorkspaceMode>('build')
  const [source, setSource]           = useState<SourceType>('public-url')
  const [partnerOpen, setPartnerOpen] = useState(false)

  // Source
  const [publicUrl, setPublicUrl]           = useState('')
  const [selectedRepo, setSelectedRepo]     = useState('')
  const [connectedRepos, setConnectedRepos] = useState<Array<{ fullName: string; name: string }>>([])
  const [loadingRepos, setLoadingRepos]     = useState(false)

  // Branch + tree
  const [branches, setBranches]         = useState<Array<{ name: string }>>([])
  const [branch, setBranch]             = useState('main')
  const [treeEntries, setTreeEntries]   = useState<TreeEntry[]>([])
  const [loadingTree, setLoadingTree]   = useState(false)
  const [treeError, setTreeError]       = useState<string | null>(null)
  const [treeFilter, setTreeFilter]     = useState('')
  const [repoFullName, setRepoFullName] = useState('')

  // File selection
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [fileContexts, setFileContexts]   = useState<FileContext[]>([])
  const [loadingFiles, setLoadingFiles]   = useState(false)

  // Instruction + diff
  const instructionRef               = useRef<HTMLTextAreaElement>(null)
  const [instruction, setInstruction] = useState('')
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffResult, setDiffResult]   = useState<DiffResult | null>(null)
  const [diffError, setDiffError]     = useState<string | null>(null)

  // Apply
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyResult, setApplyResult]   = useState<ApplyResult | null>(null)

  // Deploy
  const [deploySlug, setDeploySlug]         = useState('')
  const [deployBranch, setDeployBranch]     = useState('main')
  const [deployConfirm, setDeployConfirm]   = useState(false)
  const [deployLoading, setDeployLoading]   = useState(false)
  const [deployResult, setDeployResult]     = useState<DeployResult | null>(null)

  // ── Load connected repos ──────────────────────────────────────────────────

  const loadConnectedRepos = useCallback(async () => {
    setLoadingRepos(true)
    try {
      const res = await fetch('/api/admin/github/repos')
      if (res.ok) {
        type RepoRow = { full_name?: string; fullName?: string; name: string }
        const d = await res.json() as { repos?: RepoRow[] }
        setConnectedRepos((d.repos ?? []).map((r: RepoRow) => ({
          fullName: r.full_name ?? r.fullName ?? r.name,
          name: r.name,
        })))
      }
    } catch { /* no token */ }
    setLoadingRepos(false)
  }, [])

  useEffect(() => {
    if (source === 'connected-repo') loadConnectedRepos()
  }, [source, loadConnectedRepos])

  // ── Load file tree ────────────────────────────────────────────────────────

  const loadTree = useCallback(async () => {
    const repoTarget = source === 'public-url' ? publicUrl : selectedRepo
    if (!repoTarget) return

    setLoadingTree(true)
    setTreeError(null)
    setTreeEntries([])
    setSelectedPaths(new Set())
    setFileContexts([])
    setDiffResult(null)
    setApplyResult(null)

    try {
      let endpoint: string
      if (source === 'public-url') {
        endpoint = `/api/admin/github/import-public?url=${encodeURIComponent(publicUrl)}&branch=${encodeURIComponent(branch)}`
      } else {
        endpoint = `/api/admin/github/tree?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(branch)}&recursive=true`
      }

      const res = await fetch(endpoint)
      type TreeRes = { files?: TreeEntry[]; error?: string; repo?: { fullName: string; defaultBranch: string } }
      const d = await res.json() as TreeRes

      if (!res.ok) {
        setTreeError(d.error ?? 'Failed to load file tree')
        return
      }

      setTreeEntries(d.files ?? [])
      if (d.repo) {
        setRepoFullName(d.repo.fullName)
        if (source === 'public-url') setBranch(d.repo.defaultBranch)
      } else if (source === 'connected-repo') {
        setRepoFullName(selectedRepo)
      }
    } catch (e) {
      setTreeError(e instanceof Error ? e.message : 'Failed to load tree')
    } finally {
      setLoadingTree(false)
    }
  }, [source, publicUrl, selectedRepo, branch])

  // ── Load branches ─────────────────────────────────────────────────────────

  const loadBranches = useCallback(async (repo: string) => {
    try {
      const res = await fetch(`/api/admin/github/branches?repo=${encodeURIComponent(repo)}`)
      if (res.ok) {
        type BranchRes = { branches?: Array<{ name: string }> }
        const d = await res.json() as BranchRes
        setBranches(d.branches ?? [])
      }
    } catch { /* ignore */ }
  }, [])

  // ── Toggle file ───────────────────────────────────────────────────────────

  const toggleFile = useCallback(async (path: string) => {
    const next = new Set(selectedPaths)
    if (next.has(path)) {
      next.delete(path)
      setSelectedPaths(next)
      setFileContexts(prev => prev.filter(f => f.path !== path))
      return
    }
    if (next.size >= 20) { alert('Maximum 20 files'); return }
    next.add(path)
    setSelectedPaths(next)

    setLoadingFiles(true)
    try {
      const repo = repoFullName || selectedRepo
      const res = await fetch(`/api/admin/github/file?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`)
      if (res.ok) {
        type FileRes = { content?: string; encoding?: string }
        const d = await res.json() as FileRes
        const raw = d.content ?? ''
        const content = d.encoding === 'base64' ? atob(raw.replace(/\n/g, '')) : raw
        const ext = path.split('.').pop() ?? ''
        setFileContexts(prev => [...prev.filter(f => f.path !== path), { path, content, language: ext }])
      }
    } catch { /* ignore */ }
    setLoadingFiles(false)
  }, [selectedPaths, repoFullName, selectedRepo, branch])

  // ── Generate diff ─────────────────────────────────────────────────────────

  const generateDiff = useCallback(async () => {
    if (!instruction.trim() || fileContexts.length === 0) return
    setDiffLoading(true)
    setDiffError(null)
    setDiffResult(null)
    setApplyResult(null)

    try {
      const res = await fetch('/api/admin/workspace/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          files: fileContexts,
          repoFullName: repoFullName || selectedRepo,
          branch,
        }),
      })
      const d = await res.json() as DiffResult
      if (d.success) setDiffResult(d)
      else setDiffError(d.error ?? 'Diff generation failed')
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setDiffLoading(false)
    }
  }, [instruction, fileContexts, repoFullName, selectedRepo, branch])

  // ── Apply ─────────────────────────────────────────────────────────────────

  const applyChangeset = useCallback(async (push: boolean) => {
    if (!diffResult?.changesetId) return
    setApplyLoading(true)
    try {
      const res = await fetch('/api/admin/workspace/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changesetId: diffResult.changesetId,
          push,
          commitMessage: `AI changeset: ${(diffResult.summary ?? '').slice(0, 72)}`,
        }),
      })
      const d = await res.json() as ApplyResult
      setApplyResult(d)
    } catch (e) {
      setApplyResult({ success: false, error: e instanceof Error ? e.message : 'Apply failed' })
    } finally {
      setApplyLoading(false)
    }
  }, [diffResult])

  // ── Deploy ────────────────────────────────────────────────────────────────

  const runDeploy = useCallback(async () => {
    if (!deploySlug || !deployConfirm) return
    setDeployLoading(true)
    setDeployResult(null)
    try {
      const res = await fetch('/api/admin/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appSlug: deploySlug, branch: deployBranch, confirmed: true }),
      })
      const d = await res.json() as DeployResult
      setDeployResult(d)
    } catch (e) {
      setDeployResult({ success: false, error: e instanceof Error ? e.message : 'Deploy failed' })
    } finally {
      setDeployLoading(false)
    }
  }, [deploySlug, deployBranch, deployConfirm])

  // ── AI Buddy ──────────────────────────────────────────────────────────────

  const handleAction = useCallback((action: AssistantAction) => {
    if (action.type !== 'navigate_to') return
    const s = action.payload?.section ?? ''
    const MAP: Record<string, WorkspaceMode> = {
      github: 'build', build: 'build', deploy: 'deploy',
      monitor: 'monitor', images: 'media', media: 'media',
    }
    if (MAP[s]) setMode(MAP[s])
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────

  const repoTarget   = source === 'public-url' ? publicUrl : selectedRepo
  const hasSource    = !!repoTarget
  const hasTree      = treeEntries.length > 0
  const hasFiles     = fileContexts.length > 0
  const hasDiff      = !!diffResult?.unifiedDiff
  const hasApplied   = !!applyResult?.success
  const isBuildMode  = ['build', 'review', 'refactor'].includes(mode)
  const filteredTree = treeFilter
    ? treeEntries.filter(e => e.path.toLowerCase().includes(treeFilter.toLowerCase()))
    : treeEntries

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[600px] gap-4">
      <div className="flex flex-1 flex-col gap-4 min-w-0 overflow-y-auto pr-1">

        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1226] to-[#050a17] p-5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">Workspace Cockpit</h1>
              <p className="text-sm text-slate-400 mt-0.5">Step-based development and deployment workflow.</p>
            </div>
            <button
              onClick={() => setPartnerOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all ${partnerOpen ? 'border-blue-400/40 bg-blue-400/10 text-blue-300' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
            >
              {partnerOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              AI Buddy
            </button>
          </div>
        </div>

        {/* Step 1: Mode */}
        <Section step={1} label="Select Mode" active done={false}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setDiffResult(null); setApplyResult(null); setDeployResult(null) }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                    mode === m.key
                      ? 'border-cyan-400/40 bg-cyan-400/5 text-white'
                      : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${mode === m.key ? 'text-cyan-400' : ''}`} />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{m.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Build / Review / Refactor flow ─────────────────────────────── */}
        {isBuildMode && (
          <>
            {/* Step 2: Source */}
            <Section step={2} label="Select Source" active={true} done={hasSource && hasTree}>
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'public-url' as SourceType,     label: 'Public GitHub URL' },
                    { key: 'connected-repo' as SourceType, label: 'Connected Repo (requires token)' },
                  ]).map(s => (
                    <button
                      key={s.key}
                      onClick={() => { setSource(s.key); setSelectedRepo(''); setTreeEntries([]) }}
                      className={`px-3 py-1.5 rounded-xl border text-sm transition ${source === s.key ? 'border-cyan-400/40 bg-cyan-400/10 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {source === 'public-url' && (
                  <div className="flex gap-2">
                    <input
                      value={publicUrl}
                      onChange={e => setPublicUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                    />
                    <button
                      onClick={loadTree}
                      disabled={!publicUrl || loadingTree}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-slate-300 hover:text-white disabled:opacity-40 transition"
                    >
                      {loadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                      Import
                    </button>
                  </div>
                )}

                {source === 'connected-repo' && (
                  <div className="flex gap-2 flex-wrap items-center">
                    {loadingRepos ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : connectedRepos.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No repos found.{' '}
                        <Link href="/admin/dashboard/settings" className="text-cyan-400 hover:underline">Configure GitHub token in Settings</Link>.
                      </p>
                    ) : (
                      <select
                        value={selectedRepo}
                        onChange={e => { setSelectedRepo(e.target.value); setBranches([]); setTreeEntries([]) }}
                        className="rounded-xl border border-white/10 bg-[#0a1226] px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/40"
                      >
                        <option value="">Select repo…</option>
                        {connectedRepos.map(r => (
                          <option key={r.fullName} value={r.fullName}>{r.fullName}</option>
                        ))}
                      </select>
                    )}
                    {selectedRepo && (
                      <button
                        onClick={() => { loadBranches(selectedRepo); loadTree() }}
                        disabled={loadingTree}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-slate-300 hover:text-white disabled:opacity-40 transition"
                      >
                        {loadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Load Files
                      </button>
                    )}
                  </div>
                )}

                {treeError && (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {treeError}
                  </div>
                )}

                {hasTree && (
                  <div className="flex items-center gap-2 pt-1">
                    <GitBranch className="h-4 w-4 text-slate-500 shrink-0" />
                    {branches.length > 0 ? (
                      <select
                        value={branch}
                        onChange={e => setBranch(e.target.value)}
                        className="rounded-xl border border-white/10 bg-[#0a1226] px-3 py-1.5 text-sm text-white focus:outline-none"
                      >
                        {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-slate-300">{branch}</span>
                    )}
                    <span className="text-xs text-slate-500">{treeEntries.length} files</span>
                    {repoFullName && <span className="text-xs text-slate-600">·{repoFullName}</span>}
                  </div>
                )}
              </div>
            </Section>

            {/* Step 3: File browser */}
            {hasTree && (
              <Section step={3} label={`Browse &amp; Select Files  (${selectedPaths.size} selected)`} active done={hasFiles}>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    value={treeFilter}
                    onChange={e => setTreeFilter(e.target.value)}
                    placeholder="Filter files…"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-0.5 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  {filteredTree.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500">No files match.</p>
                  ) : (
                    filteredTree.map(entry => (
                      <TreeNode
                        key={entry.path}
                        entry={entry}
                        selected={selectedPaths.has(entry.path)}
                        onToggle={toggleFile}
                      />
                    ))
                  )}
                </div>
                {loadingFiles && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>}
                {hasFiles && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {fileContexts.map(f => (
                      <span key={f.path} className="text-[10px] bg-cyan-400/10 border border-cyan-400/20 rounded px-2 py-0.5 text-cyan-300 font-mono">
                        {f.path.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Step 4: AI instruction */}
            {hasFiles && (
              <Section step={4} label="Give AI Instruction" active done={hasDiff}>
                <div className="space-y-2">
                  <textarea
                    ref={instructionRef}
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    rows={4}
                    placeholder={
                      mode === 'review'   ? 'e.g. "Review for security issues, bugs, and performance problems."' :
                      mode === 'refactor' ? 'e.g. "Refactor to use async/await. Extract utility functions."' :
                                           'e.g. "Add input validation to the login endpoint. Return 400 if email is missing."'
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={generateDiff}
                      disabled={!instruction.trim() || diffLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 disabled:opacity-40 transition"
                    >
                      {diffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {mode === 'review' ? 'Review Code' : 'Generate Changes'}
                    </button>
                    {diffLoading && <span className="text-xs text-slate-400">Analyzing {fileContexts.length} file(s)…</span>}
                  </div>
                  {diffError && (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {diffError}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Step 5: Review diff */}
            {hasDiff && diffResult && (
              <Section step={5} label={`Review Changes — ${diffResult.fileCount ?? diffResult.filesChanged?.length ?? 0} file(s)`} active done={hasApplied}>
                <DiffViewer
                  diff={diffResult.unifiedDiff!}
                  summary={diffResult.summary}
                  riskNotes={diffResult.riskNotes}
                  verifyCommands={diffResult.verifyCommands}
                  model={diffResult.resolvedModel}
                  latencyMs={diffResult.latencyMs}
                />
                {!applyResult && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => applyChangeset(false)}
                      disabled={applyLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-40 transition"
                    >
                      {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Approve &amp; Save
                    </button>
                    <button
                      onClick={() => applyChangeset(true)}
                      disabled={applyLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-40 transition"
                    >
                      {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Approve, Commit &amp; Push
                    </button>
                    <button
                      onClick={() => { setDiffResult(null); setDiffError(null) }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white transition"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </Section>
            )}

            {/* Step 6: Result */}
            {applyResult && (
              <Section step={6} label="Result" active done={hasApplied}>
                <div className={`rounded-xl border p-4 ${applyResult.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                  {applyResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-medium">
                        <CheckCircle className="h-4 w-4" />
                        Changeset {applyResult.status} — {applyResult.filesApplied} file(s)
                      </div>
                      {applyResult.artifactId && (
                        <p className="text-xs text-slate-400">Artifact: <code className="text-cyan-300">{applyResult.artifactId.slice(0, 8)}…</code></p>
                      )}
                      {applyResult.commitSha && (
                        <p className="text-xs text-slate-400">Commit: <code className="text-cyan-300">{applyResult.commitSha.slice(0, 12)}</code></p>
                      )}
                      {applyResult.pushError && (
                        <p className="text-xs text-amber-400">Push warning: {applyResult.pushError}</p>
                      )}
                      <div className="flex gap-3 pt-1">
                        <Link href="/admin/dashboard/artifacts" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                          <ExternalLink className="h-3 w-3" /> Artifacts
                        </Link>
                        <Link href="/admin/dashboard/deployments" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                          <Rocket className="h-3 w-3" /> Deployments
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      {applyResult.error ?? 'Apply failed'}
                    </div>
                  )}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ── Deploy mode ──────────────────────────────────────────────────── */}
        {mode === 'deploy' && (
          <Section step={2} label="Deploy App to VPS" active done={!!deployResult?.success}>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">App Slug</label>
                  <input
                    value={deploySlug}
                    onChange={e => setDeploySlug(e.target.value.trim())}
                    placeholder="e.g. eyenode"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Branch</label>
                  <input
                    value={deployBranch}
                    onChange={e => setDeployBranch(e.target.value.trim())}
                    placeholder="main"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deployConfirm}
                  onChange={e => setDeployConfirm(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-300">
                  I confirm I want to deploy <code className="text-cyan-300">{deploySlug || 'this app'}</code> to the production VPS
                </span>
              </label>
              <button
                onClick={runDeploy}
                disabled={!deploySlug || !deployConfirm || deployLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 disabled:opacity-40 transition"
              >
                {deployLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {deployLoading ? 'Deploying…' : 'Deploy Now'}
              </button>

              {deployResult && (
                <div className={`rounded-xl border p-4 ${
                  deployResult.success ? 'border-emerald-500/20 bg-emerald-500/5' :
                  deployResult.planned  ? 'border-amber-500/20 bg-amber-500/5' :
                                          'border-red-500/20 bg-red-500/5'
                }`}>
                  <div className={`flex items-center gap-2 font-medium mb-2 ${
                    deployResult.success ? 'text-emerald-400' :
                    deployResult.planned  ? 'text-amber-400' :
                                            'text-red-400'
                  }`}>
                    {deployResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Deploy {deployResult.status}
                  </div>
                  {deployResult.planned && (
                    <p className="text-xs text-amber-300 mb-2">
                      No Webdock server configured — deploy plan recorded. Configure Webdock in Settings to enable remote execution.
                    </p>
                  )}
                  {deployResult.steps && (
                    <div className="space-y-1 mb-2">
                      {deployResult.steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`font-mono w-16 shrink-0 ${
                            s.status === 'success' ? 'text-emerald-400' :
                            s.status === 'failed'  ? 'text-red-400' :
                            s.status === 'planned' ? 'text-amber-400' :
                            'text-slate-500'
                          }`}>{s.status}</span>
                          <span className="text-slate-400 font-mono w-32 shrink-0">{s.name}</span>
                          <span className="text-slate-500 truncate">{s.output.slice(0, 80)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {deployResult.logOutput && (
                    <pre className="bg-[#050a17] rounded-lg p-2 text-[10px] font-mono text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap">
                      {deployResult.logOutput.slice(0, 1500)}
                    </pre>
                  )}
                  <div className="flex gap-3 mt-2">
                    <Link href="/admin/dashboard/monitor" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Monitor
                    </Link>
                    <Link href="/admin/dashboard/deployments" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">
                      <Rocket className="h-3 w-3" /> Deployments
                    </Link>
                    <Link href="/admin/dashboard/settings" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">
                      Configure Webdock
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Monitor shortcut ──────────────────────────────────────────────── */}
        {mode === 'monitor' && (
          <Section step={2} label="Monitor" active done={false}>
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-slate-300">Real-time server, app health, AI engine, and storage metrics.</p>
              <Link
                href="/admin/dashboard/monitor"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition"
              >
                <Activity className="h-4 w-4" />
                Open Monitor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Section>
        )}

        {/* ── New App shortcut ──────────────────────────────────────────────── */}
        {mode === 'new-app' && (
          <Section step={2} label="Create New App" active done={false}>
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-slate-300">Create an app with agent, repo, and deploy target configuration.</p>
              <Link
                href="/admin/dashboard/apps/new"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition"
              >
                <PlusCircle className="h-4 w-4" />
                Create New App
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin/dashboard/apps" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white">
                <Wrench className="h-4 w-4" /> Manage existing apps
              </Link>
            </div>
          </Section>
        )}

        {/* ── Media generation ─────────────────────────────────────────────── */}
        {mode === 'media' && (
          <Section step={2} label="Generate Media" active done={false}>
            <CreatorStudioTab initialMode="image" />
          </Section>
        )}

      </div>

      {/* AI Buddy panel */}
      <AnimatePresence>
        {partnerOpen && (
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-[340px] shrink-0 h-[calc(100vh-112px)] min-h-[600px]"
          >
            <AIPartnerWidget
              open={partnerOpen}
              variant="panel"
              onClose={() => setPartnerOpen(false)}
              onAction={handleAction}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
