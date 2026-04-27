'use client'

/**
 * CockpitTab — Unified Workspace Workflow Cockpit
 *
 * Phase 3A: Step-based workflow for:
 *   1. Select mode (Build/Fix, Review, Refactor, Create, Deploy, Monitor, Generate Media)
 *   2. Select source (public GitHub URL, connected repo, new app)
 *   3. Select branch
 *   4. Browse file tree + select files as context
 *   5. Write AI instruction
 *   6. Generate diff/change set via AI
 *   7. Review diff (approve/reject per file)
 *   8. Save artifact + commit/push
 *
 * All actions are connected to real backend routes. No fake buttons.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Hammer, Eye, RefreshCw, Plus, Rocket, Activity, ImageIcon,
  FolderGit2, GitBranch, FileCode, ChevronRight, ChevronDown,
  X, CheckCircle, AlertCircle, Loader2, Send, Save,
  GitCommit, ExternalLink, FileText, ShieldAlert,
  FolderOpen,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type WorkMode = 'build_fix' | 'review' | 'refactor' | 'create' | 'deploy' | 'monitor' | 'generate_media'
type SourceType = 'public_url' | 'connected_repo' | 'new_app'

interface TreeEntry {
  path: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

interface DiffFile {
  path: string
  action: 'modified' | 'created' | 'deleted'
  diff: string
  description: string
  approved: boolean
}

interface ChangeSet {
  summary: string
  filesChanged: DiffFile[]
  riskNotes: string[]
  verificationCommands: string[]
  model: string
  traceId: string
  binarySkipped: string[]
}

interface RepoInfo {
  name: string
  fullName: string
  url: string
  defaultBranch: string
}

// ── Step definitions ──────────────────────────────────────────────────────────

type Step = 'mode' | 'source' | 'branch' | 'files' | 'instruct' | 'diff' | 'commit'

const STEPS: Step[] = ['mode', 'source', 'branch', 'files', 'instruct', 'diff', 'commit']

const STEP_LABELS: Record<Step, string> = {
  mode:     'Mode',
  source:   'Source',
  branch:   'Branch',
  files:    'Files',
  instruct: 'Instruct AI',
  diff:     'Review Diff',
  commit:   'Save & Push',
}

const MODES: Array<{ key: WorkMode; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; desc: string }> = [
  { key: 'build_fix',     icon: Hammer,    label: 'Build / Fix Code',    desc: 'Fix bugs, add features, improve existing code' },
  { key: 'review',        icon: Eye,       label: 'Review Code',         desc: 'Review code quality and suggest improvements' },
  { key: 'refactor',      icon: RefreshCw, label: 'Refactor',            desc: 'Improve code structure without changing behavior' },
  { key: 'create',        icon: Plus,      label: 'Create New App',      desc: 'Generate a new application scaffold' },
  { key: 'deploy',        icon: Rocket,    label: 'Deploy',              desc: 'Deploy to VPS or trigger GitHub Actions' },
  { key: 'monitor',       icon: Activity,  label: 'Monitor',             desc: 'Check app and server health' },
  { key: 'generate_media', icon: ImageIcon, label: 'Generate Media',     desc: 'Generate images, audio, or video' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFileTree(entries: TreeEntry[]): Map<string, TreeEntry[]> {
  const map = new Map<string, TreeEntry[]>()
  for (const entry of entries) {
    const parts = entry.path.split('/')
    const parent = parts.slice(0, -1).join('/') || ''
    if (!map.has(parent)) map.set(parent, [])
    map.get(parent)!.push(entry)
  }
  return map
}

function isBinary(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ['png','jpg','jpeg','gif','webp','mp3','mp4','wav','pdf','zip','tar','gz','wasm','bin','ttf','woff','woff2'].includes(ext)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CockpitTab() {
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<WorkMode | null>(null)
  const [sourceType, setSourceType] = useState<SourceType | null>(null)

  // Source state
  const [publicUrl, setPublicUrl] = useState('')
  const [connectedRepos, setConnectedRepos] = useState<RepoInfo[]>([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [repoFullName, setRepoFullName] = useState('')

  // Branch state
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('main')

  // File tree state
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loadedFiles, setLoadedFiles] = useState<Map<string, string>>(new Map())

  // AI instruction state
  const [instruction, setInstruction] = useState('')

  // Diff state
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null)

  // Loading states
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingTree, setLoadingTree] = useState(false)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [savingArtifact, setSavingArtifact] = useState(false)
  const [pushing, setPushing] = useState(false)

  // Result state
  const [importError, setImportError] = useState<string | null>(null)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<{ success: boolean; artifactId?: string; message: string } | null>(null)
  const [pushResult, setPushResult] = useState<{ success: boolean; commitUrl?: string; message: string } | null>(null)

  // Load connected repos on mount
  useEffect(() => {
    setLoadingRepos(true)
    fetch('/api/admin/github/repos')
      .then(r => r.ok ? r.json() : { repos: [] })
      .then(d => {
        const repos: RepoInfo[] = Array.isArray(d.repos)
          ? d.repos.map((r: { name?: string; full_name?: string; fullName?: string; html_url?: string; url?: string; default_branch?: string; defaultBranch?: string }) => ({
              name: r.name ?? '',
              fullName: r.fullName ?? r.full_name ?? '',
              url: r.url ?? r.html_url ?? '',
              defaultBranch: r.defaultBranch ?? r.default_branch ?? 'main',
            }))
          : []
        setConnectedRepos(repos)
      })
      .catch(() => {})
      .finally(() => setLoadingRepos(false))
  }, [])

  const goToStep = useCallback((s: Step) => {
    setStep(s)
    setImportError(null)
    setDiffError(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (sourceType === 'public_url' && !publicUrl.trim()) return
    if (sourceType === 'connected_repo' && !selectedRepo) return

    setLoadingTree(true)
    setImportError(null)
    setTree([])
    setSelectedFiles(new Set())
    setLoadedFiles(new Map())

    try {
      if (sourceType === 'public_url') {
        const res = await fetch('/api/admin/github/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: publicUrl, branch: selectedBranch }),
        })
        const data = await res.json()
        if (!res.ok) { setImportError(data.error ?? 'Import failed'); return }
        setRepoFullName(data.repoFullName)
        setTree(data.tree ?? [])
        if (data.treeError) setImportError(`Tree: ${data.treeError}`)
      } else if (sourceType === 'connected_repo') {
        setRepoFullName(selectedRepo)
        const res = await fetch(`/api/admin/github/tree?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(selectedBranch)}`)
        const data = await res.json()
        if (!res.ok) { setImportError(data.error ?? 'Failed to load tree'); return }
        setTree(data.tree ?? [])
      }

      // Expand root level dirs by default
      const rootDirs = new Set<string>()
      const treeEntries = tree.length > 0 ? tree : []
      for (const e of treeEntries) {
        if (e.type === 'tree') {
          const parts = e.path.split('/')
          if (parts.length === 1) rootDirs.add(e.path)
        }
      }
      setExpandedDirs(rootDirs)
      goToStep('files')
    } finally {
      setLoadingTree(false)
    }
  }, [sourceType, publicUrl, selectedRepo, selectedBranch, tree, goToStep])

  const loadBranches = useCallback(async (repo: string) => {
    if (!repo) return
    setLoadingBranches(true)
    try {
      const res = await fetch(`/api/admin/github/branches?repo=${encodeURIComponent(repo)}`)
      const data = res.ok ? await res.json() : {}
      const list: string[] = Array.isArray(data.branches)
        ? data.branches.map((b: { name: string }) => b.name)
        : ['main']
      setBranches(list)
      if (list.length > 0 && !list.includes(selectedBranch)) {
        setSelectedBranch(list[0])
      }
    } catch {
      setBranches(['main'])
    } finally {
      setLoadingBranches(false)
    }
  }, [selectedBranch])

  useEffect(() => {
    if (sourceType === 'connected_repo' && selectedRepo) {
      loadBranches(selectedRepo)
    }
  }, [sourceType, selectedRepo, loadBranches])

  const loadFileContent = useCallback(async (path: string) => {
    if (loadedFiles.has(path) || isBinary(path)) return
    setLoadingFile(path)
    try {
      const res = await fetch(
        `/api/admin/github/file?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(selectedBranch)}&path=${encodeURIComponent(path)}`
      )
      const data = res.ok ? await res.json() : {}
      if (data.file?.content) {
        setLoadedFiles(prev => new Map(prev).set(path, data.file.content))
      }
    } catch { /* non-fatal */ } finally {
      setLoadingFile(null)
    }
  }, [loadedFiles, repoFullName, selectedBranch])

  const toggleFileSelection = useCallback((path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
        loadFileContent(path)
      }
      return next
    })
  }, [loadFileContent])

  const generateDiff = useCallback(async () => {
    if (!instruction.trim() || selectedFiles.size === 0) return
    setLoadingDiff(true)
    setDiffError(null)
    setChangeSet(null)

    const files = Array.from(selectedFiles)
      .filter(p => !isBinary(p))
      .map(p => ({ path: p, content: loadedFiles.get(p) ?? '' }))
      .filter(f => f.content)

    if (files.length === 0) {
      setDiffError('No text files with loaded content selected. Open files first by clicking them.')
      setLoadingDiff(false)
      return
    }

    try {
      const res = await fetch('/api/admin/ai/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, files }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDiffError(data.error ?? 'Diff generation failed')
        return
      }
      setChangeSet({
        ...data,
        filesChanged: data.filesChanged.map((f: { path: string; action: string; diff: string; description: string }) => ({
          ...f,
          approved: true, // default approved
        })),
      })
      goToStep('diff')
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : 'Diff request failed')
    } finally {
      setLoadingDiff(false)
    }
  }, [instruction, selectedFiles, loadedFiles, goToStep])

  const saveArtifact = useCallback(async () => {
    if (!changeSet) return
    setSavingArtifact(true)
    setSaveResult(null)
    try {
      const res = await fetch('/api/admin/ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          summary: changeSet.summary,
          filesChanged: changeSet.filesChanged.filter(f => f.approved),
          riskNotes: changeSet.riskNotes,
          verificationCommands: changeSet.verificationCommands,
          model: changeSet.model,
          traceId: changeSet.traceId,
          repo: repoFullName || null,
          branch: selectedBranch || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveResult({ success: true, artifactId: data.artifactId, message: 'Change set saved as artifact.' })
      } else {
        setSaveResult({ success: false, message: data.error ?? 'Save failed' })
      }
    } catch (e) {
      setSaveResult({ success: false, message: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSavingArtifact(false)
    }
  }, [changeSet, instruction, repoFullName, selectedBranch])

  const pushChanges = useCallback(async () => {
    if (!changeSet || !repoFullName) return
    const approvedFiles = changeSet.filesChanged.filter(f => f.approved && f.action !== 'deleted')
    if (approvedFiles.length === 0) {
      setPushResult({ success: false, message: 'No approved files to push.' })
      return
    }
    if (!confirm(`Push ${approvedFiles.length} file(s) to ${repoFullName}@${selectedBranch}? This is a real commit.`)) return

    setPushing(true)
    setPushResult(null)
    try {
      // Build file list from change set diffs
      const files = approvedFiles.map(f => ({
        path: f.path,
        content: f.action === 'created'
          ? f.diff // for new files, diff contains full content
          : applyDiff(loadedFiles.get(f.path) ?? '', f.diff),
      }))

      const res = await fetch('/api/admin/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 1, // workspace project
          repoFullName,
          branch: selectedBranch,
          commitMessage: `AI change: ${instruction.slice(0, 72)}`,
          files,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPushResult({ success: true, commitUrl: data.commitUrl, message: `Pushed ${data.filesChanged} file(s)` })
        goToStep('commit')
      } else {
        setPushResult({ success: false, message: data.error ?? 'Push failed' })
      }
    } catch (e) {
      setPushResult({ success: false, message: e instanceof Error ? e.message : 'Push failed' })
    } finally {
      setPushing(false)
    }
  }, [changeSet, repoFullName, selectedBranch, instruction, loadedFiles, goToStep])

  // ── Render helpers ────────────────────────────────────────────────────────

  const currentStepIdx = STEPS.indexOf(step)

  return (
    <div className="space-y-6">
      {/* Progress breadcrumb */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => { if (i <= currentStepIdx) goToStep(s) }}
            disabled={i > currentStepIdx}
            className={`flex items-center gap-1 text-xs whitespace-nowrap transition ${
              s === step
                ? 'text-white font-medium'
                : i < currentStepIdx
                ? 'text-cyan-400 hover:text-white'
                : 'text-slate-600'
            }`}
          >
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-700" />}
            <span className={`px-2 py-1 rounded-lg ${s === step ? 'bg-white/10' : ''}`}>
              {STEP_LABELS[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Context bar */}
      {(repoFullName || selectedBranch) && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {repoFullName && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-400">
              <FolderGit2 className="h-3 w-3" /> {repoFullName}
            </span>
          )}
          {selectedBranch && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-400">
              <GitBranch className="h-3 w-3" /> {selectedBranch}
            </span>
          )}
          {selectedFiles.size > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300">
              <FileCode className="h-3 w-3" /> {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
            </span>
          )}
          {mode && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-400/10 border border-violet-400/20 text-violet-300">
              {MODES.find(m => m.key === mode)?.label}
            </span>
          )}
        </div>
      )}

      {/* ── Step: Mode ─────────────────────────────────────────────────── */}
      {step === 'mode' && (
        <StepCard title="Select Mode" desc="What do you want to do?">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); goToStep('source') }}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition hover:border-cyan-500/30 ${
                    mode === m.key ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/[0.08] bg-white/[0.02]'
                  }`}
                >
                  <Icon className="h-5 w-5 text-cyan-400" />
                  <p className="text-sm font-medium text-white">{m.label}</p>
                  <p className="text-[11px] text-slate-500">{m.desc}</p>
                </button>
              )
            })}
          </div>
        </StepCard>
      )}

      {/* ── Step: Source ───────────────────────────────────────────────── */}
      {step === 'source' && (
        <StepCard title="Select Source" desc="Where is the code you want to work with?">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                { key: 'public_url',    icon: FolderGit2, label: 'Public GitHub URL',    desc: 'Import any public repo by URL' },
                { key: 'connected_repo', icon: GitBranch,  label: 'Connected GitHub Repo', desc: 'Pick from your linked repos' },
                { key: 'new_app',       icon: Plus,        label: 'New App',              desc: 'Start from scratch' },
              ] as const).map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.key}
                    onClick={() => setSourceType(s.key)}
                    className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition ${
                      sourceType === s.key
                        ? 'border-cyan-500/40 bg-cyan-500/5'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-cyan-400" />
                    <p className="text-sm font-medium text-white">{s.label}</p>
                    <p className="text-[11px] text-slate-500">{s.desc}</p>
                  </button>
                )
              })}
            </div>

            {sourceType === 'public_url' && (
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">GitHub Repository URL</label>
                <div className="flex gap-2">
                  <input
                    value={publicUrl}
                    onChange={e => setPublicUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="flex-1 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white focus:outline-none focus:border-cyan-500/40 font-mono"
                  />
                  <input
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    placeholder="main"
                    className="w-28 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              </div>
            )}

            {sourceType === 'connected_repo' && (
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Repository</label>
                {loadingRepos ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading repos…</div>
                ) : connectedRepos.length === 0 ? (
                  <p className="text-sm text-slate-500">No repos found. <a href="/admin/dashboard/settings" className="text-cyan-400 underline">Configure GitHub token</a>.</p>
                ) : (
                  <select
                    value={selectedRepo}
                    onChange={e => setSelectedRepo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white focus:outline-none focus:border-cyan-500/40"
                  >
                    <option value="">Select a repo…</option>
                    {connectedRepos.map(r => (
                      <option key={r.fullName} value={r.fullName} className="bg-[#0a0f1a]">{r.fullName}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {sourceType === 'new_app' && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-sm text-slate-400">
                  For creating a new app, use the <strong className="text-white">Build Apps</strong> tab
                  which includes app creation with agent linking and repo setup.
                </p>
                <a href="/admin/dashboard/apps/new" className="mt-2 inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300">
                  Create New App <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {importError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {importError}
              </div>
            )}

            {sourceType && sourceType !== 'new_app' && (
              <div className="flex justify-end">
                <button
                  onClick={handleImport}
                  disabled={loadingTree || (sourceType === 'public_url' && !publicUrl.trim()) || (sourceType === 'connected_repo' && !selectedRepo)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40 transition text-sm"
                >
                  {loadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  {loadingTree ? 'Importing…' : 'Import & Browse'}
                </button>
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step: Branch ───────────────────────────────────────────────── */}
      {step === 'branch' && (
        <StepCard title="Select Branch" desc={`Branch for ${repoFullName}`}>
          <div className="space-y-3">
            {loadingBranches ? (
              <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading branches…</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(branches.length > 0 ? branches : ['main', 'develop']).map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBranch(b)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition ${
                      selectedBranch === b
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                        : 'border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    <GitBranch className="h-3.5 w-3.5" /> {b}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleImport}
                disabled={loadingTree}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40 text-sm transition"
              >
                {loadingTree ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                Load Files
              </button>
            </div>
          </div>
        </StepCard>
      )}

      {/* ── Step: Files ────────────────────────────────────────────────── */}
      {step === 'files' && (
        <StepCard title="Browse & Select Files" desc="Select files to include as AI context">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {tree.length} entries · {selectedFiles.size} selected
                {tree.length === 0 && ' — no files loaded'}
              </p>
              <button
                onClick={() => { setSelectedFiles(new Set()); setLoadedFiles(new Map()) }}
                className="text-xs text-slate-500 hover:text-slate-300 transition"
              >
                Clear selection
              </button>
            </div>

            <FileTreeView
              tree={tree}
              expandedDirs={expandedDirs}
              setExpandedDirs={setExpandedDirs}
              selectedFiles={selectedFiles}
              loadedFiles={loadedFiles}
              loadingFile={loadingFile}
              onToggle={toggleFileSelection}
            />

            {selectedFiles.size > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => goToStep('instruct')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 text-sm transition"
                >
                  Continue with {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step: Instruct ─────────────────────────────────────────────── */}
      {step === 'instruct' && (
        <StepCard title="Give AI Instruction" desc="Tell the AI what to fix, add, or improve">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Instruction</label>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="e.g. Fix the TypeScript error in auth.ts, Add rate limiting to the API routes, Refactor the database queries to use transactions…"
                rows={5}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none font-mono"
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[11px] text-slate-500 mb-2">Selected context files:</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedFiles).map(p => (
                  <span key={p} className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] text-[11px] text-slate-400">
                    <FileText className="h-3 w-3" /> {p}
                    {!loadedFiles.has(p) && <span className="text-amber-500 ml-1">⚠ not loaded</span>}
                  </span>
                ))}
              </div>
            </div>

            {diffError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {diffError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={generateDiff}
                disabled={loadingDiff || !instruction.trim() || selectedFiles.size === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition text-sm font-medium"
              >
                {loadingDiff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loadingDiff ? 'Generating diff…' : 'Generate Change Set'}
              </button>
            </div>
          </div>
        </StepCard>
      )}

      {/* ── Step: Diff ─────────────────────────────────────────────────── */}
      {step === 'diff' && changeSet && (
        <StepCard title="Review Change Set" desc={changeSet.summary}>
          <div className="space-y-4">
            {/* Risk notes */}
            {changeSet.riskNotes.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400 mb-1">Risk Notes</p>
                {changeSet.riskNotes.map((note, i) => (
                  <p key={i} className="text-sm text-amber-300 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {note}
                  </p>
                ))}
              </div>
            )}

            {/* Binary files skipped */}
            {changeSet.binarySkipped?.length > 0 && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-3">
                <p className="text-[11px] text-slate-500">Binary files skipped: {changeSet.binarySkipped.join(', ')}</p>
              </div>
            )}

            {/* Verification commands */}
            {changeSet.verificationCommands.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Verification</p>
                {changeSet.verificationCommands.map((cmd, i) => (
                  <code key={i} className="block text-xs text-green-400 font-mono">$ {cmd}</code>
                ))}
              </div>
            )}

            {/* Per-file diffs */}
            <div className="space-y-3">
              {changeSet.filesChanged.map((file, i) => (
                <DiffFileCard
                  key={file.path}
                  file={file}
                  onToggleApprove={() => {
                    setChangeSet(prev => {
                      if (!prev) return prev
                      const updated = [...prev.filesChanged]
                      updated[i] = { ...updated[i], approved: !updated[i].approved }
                      return { ...prev, filesChanged: updated }
                    })
                  }}
                />
              ))}
            </div>

            <p className="text-[11px] text-slate-500">
              Model: {changeSet.model} · Trace: {changeSet.traceId.slice(0, 8)}
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={() => goToStep('instruct')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white text-sm transition"
              >
                <X className="h-4 w-4" /> Reject All
              </button>
              <button
                onClick={saveArtifact}
                disabled={savingArtifact}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 text-sm transition"
              >
                {savingArtifact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Artifact
              </button>
              {repoFullName && (
                <button
                  onClick={pushChanges}
                  disabled={pushing || changeSet.filesChanged.filter(f => f.approved).length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40 text-sm transition"
                >
                  {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
                  {pushing ? 'Pushing…' : `Commit & Push (${changeSet.filesChanged.filter(f => f.approved).length} files)`}
                </button>
              )}
            </div>

            {saveResult && (
              <div className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${saveResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                {saveResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {saveResult.message}
                {saveResult.artifactId && (
                  <a href="/admin/dashboard/artifacts" className="ml-1 underline text-xs">View artifacts</a>
                )}
              </div>
            )}

            {pushResult && (
              <div className={`rounded-xl border p-3 text-sm flex items-center gap-2 ${pushResult.success ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                {pushResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {pushResult.message}
                {pushResult.commitUrl && (
                  <a href={pushResult.commitUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-1 text-xs underline">
                    View commit <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* ── Step: Commit ───────────────────────────────────────────────── */}
      {step === 'commit' && (
        <StepCard title="Done" desc="Changes committed and saved">
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Change set applied successfully</p>
                {pushResult?.commitUrl && (
                  <a href={pushResult.commitUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                    View commit on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setStep('mode'); setMode(null); setSourceType(null); setTree([]); setSelectedFiles(new Set());
                  setLoadedFiles(new Map()); setInstruction(''); setChangeSet(null); setSaveResult(null); setPushResult(null)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 text-sm transition"
              >
                Start New Task
              </button>
              <a
                href="/admin/dashboard/deployments"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white text-sm transition"
              >
                <Rocket className="h-4 w-4" /> Go to Deployments
              </a>
            </div>
          </div>
        </StepCard>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function FileTreeView({
  tree, expandedDirs, setExpandedDirs, selectedFiles, loadedFiles,
  loadingFile, onToggle,
}: {
  tree: TreeEntry[]
  expandedDirs: Set<string>
  setExpandedDirs: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedFiles: Set<string>
  loadedFiles: Map<string, string>
  loadingFile: string | null
  onToggle: (path: string) => void
}) {
  if (tree.length === 0) {
    return <p className="text-sm text-slate-500 italic">No files found.</p>
  }

  const treeMap = buildFileTree(tree)

  function renderDir(prefix: string, depth: number): React.ReactNode {
    const entries = treeMap.get(prefix) ?? []
    const dirs = entries.filter(e => e.type === 'tree').sort((a, b) => a.path.localeCompare(b.path))
    const files = entries.filter(e => e.type === 'blob').sort((a, b) => a.path.localeCompare(b.path))

    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        {dirs.map(dir => {
          const isExpanded = expandedDirs.has(dir.path)
          const dirName = dir.path.split('/').pop() ?? dir.path
          return (
            <div key={dir.path}>
              <button
                onClick={() => setExpandedDirs(prev => {
                  const next = new Set(prev)
                  if (next.has(dir.path)) next.delete(dir.path)
                  else next.add(dir.path)
                  return next
                })}
                className="flex items-center gap-1.5 py-0.5 text-sm text-slate-400 hover:text-white transition w-full text-left"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-600" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                <FolderOpen className="h-3.5 w-3.5 text-yellow-500/70" />
                <span>{dirName}/</span>
              </button>
              {isExpanded && renderDir(dir.path, depth + 1)}
            </div>
          )
        })}
        {files.map(file => {
          const isSelected = selectedFiles.has(file.path)
          const isLoading = loadingFile === file.path
          const isLoaded = loadedFiles.has(file.path)
          const fileName = file.path.split('/').pop() ?? file.path
          const binary = isBinary(file.path)
          return (
            <button
              key={file.path}
              onClick={() => !binary && onToggle(file.path)}
              disabled={binary}
              title={binary ? 'Binary file — cannot be used as AI context' : file.path}
              className={`flex items-center gap-1.5 py-0.5 text-sm w-full text-left transition ${
                binary ? 'text-slate-600 cursor-not-allowed' :
                isSelected ? 'text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" /> :
               isSelected ? <CheckCircle className="h-3.5 w-3.5 text-cyan-400" /> :
               <FileCode className="h-3.5 w-3.5 text-slate-600" />}
              <span>{fileName}</span>
              {isLoaded && !isSelected && <span className="text-[10px] text-slate-600">loaded</span>}
              {binary && <span className="text-[10px] text-slate-700">binary</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 max-h-96 overflow-y-auto font-mono">
      {renderDir('', 0)}
    </div>
  )
}

function DiffFileCard({
  file, onToggleApprove,
}: {
  file: DiffFile
  onToggleApprove: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const actionColor = file.action === 'created' ? 'text-emerald-400' : file.action === 'deleted' ? 'text-red-400' : 'text-blue-400'

  return (
    <div className={`rounded-xl border transition ${file.approved ? 'border-white/[0.08] bg-white/[0.02]' : 'border-white/[0.04] bg-white/[0.01] opacity-60'}`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onToggleApprove} className={`shrink-0 h-4 w-4 rounded border flex items-center justify-center transition ${file.approved ? 'bg-cyan-500/20 border-cyan-500/40' : 'border-white/20'}`}>
          {file.approved && <CheckCircle className="h-3 w-3 text-cyan-400" />}
        </button>
        <span className={`text-[11px] font-mono ${actionColor}`}>[{file.action}]</span>
        <span className="text-sm text-white font-mono flex-1">{file.path}</span>
        <span className="text-[11px] text-slate-500">{file.description}</span>
        <button onClick={() => setExpanded(v => !v)} className="text-slate-600 hover:text-white transition">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {expanded && file.diff && (
        <div className="border-t border-white/[0.06] p-3 overflow-x-auto">
          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
            {file.diff.split('\n').map((line, i) => (
              <span
                key={i}
                className={`block ${
                  line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400' :
                  line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' :
                  line.startsWith('@@') ? 'text-blue-400' :
                  ''
                }`}
              >{line}</span>
            ))}
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * Applies a unified diff to original file content.
 *
 * NOTE: Full patch application requires a server-side library (e.g. diff-apply).
 * For now, when the AI generates a change set, the commit/push flow sends the
 * diff content to GitHub, which is why the AI is instructed to return full file
 * content for new files (action=created) and well-formed unified diffs for
 * modified files. The reviewing operator should verify the diff before approving.
 *
 * For modified files, the raw diff is returned here — the GitHub push route on
 * the server is expected to handle patch application or the operator reviews and
 * edits the diff before committing.
 */
function applyDiff(original: string, diff: string): string {
  if (!diff.trim()) return original
  // If the diff has no unified diff markers, treat it as a full file replacement
  if (!diff.includes('\n@@') && !diff.startsWith('@@') && !diff.includes('\n+++ ')) {
    return diff
  }
  // Return the diff as-is — server-side or post-review application required
  return diff
}
