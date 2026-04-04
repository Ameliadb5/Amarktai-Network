'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Play, Loader2, Copy, Check, FolderTree, FileCode, Rocket,
  MessageSquare, ChevronRight, Download, GitBranch, RefreshCw,
  Sparkles, Layers, Clock, X, Send, Plus, FlaskConical,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectTypeInfo {
  id: string
  label: string
  description: string
  language: string
  icon: string
}

interface GeneratedFile {
  path: string
  content: string
  language: string
}

interface GenerationEvent {
  id: string
  type: 'generate' | 'refine'
  description: string
  projectType: string
  timestamp: string
  fileCount: number
}

interface GenerationSession {
  id: string
  description: string
  projectType: string
  files: GeneratedFile[]
  history: GenerationEvent[]
  createdAt: string
  updatedAt: string
}

// ── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

const stagger = {
  show: { transition: { staggerChildren: 0.06 } },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LabsPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('')
  const [projectType, setProjectType] = useState('nextjs')
  const [projectTypes, setProjectTypes] = useState<ProjectTypeInfo[]>([])
  const [generating, setGenerating] = useState(false)
  const [session, setSession] = useState<GenerationSession | null>(null)
  const [sessions, setSessions] = useState<GenerationSession[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Deploy state
  const [deploying, setDeploying] = useState(false)
  const [repoName, setRepoName] = useState('')
  const [branch, setBranch] = useState('labs/generated-app')
  const [deployResult, setDeployResult] = useState<{ success: boolean; commitUrl?: string | null; error?: string | null } | null>(null)

  // Refinement state
  const [feedback, setFeedback] = useState('')
  const [refining, setRefining] = useState(false)

  // History sidebar
  const [showHistory, setShowHistory] = useState(false)

  // Options
  const [includeDocker, setIncludeDocker] = useState(false)
  const [styling, setStyling] = useState<'tailwind' | 'css-modules' | 'plain'>('tailwind')

  // ── Load project types & sessions ────────────────────────────────────────
  const loadProjectTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/labs?action=types')
      if (res.ok) {
        const data = await res.json()
        setProjectTypes(data.types ?? [])
      }
    } catch { /* best-effort */ }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/labs')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions ?? [])
      }
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => {
    loadProjectTypes()
    loadSessions()
  }, [loadProjectTypes, loadSessions])

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return
    setGenerating(true)
    setError(null)
    setDeployResult(null)

    try {
      const res = await fetch('/api/admin/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          description: description.trim(),
          projectType,
          options: { includeDocker, styling, includeDocs: true },
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      const s = data.session as GenerationSession
      setSession(s)
      setSelectedFile(s.files[0] ?? null)
      loadSessions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [description, projectType, includeDocker, styling, loadSessions])

  // ── Refine ───────────────────────────────────────────────────────────────
  const handleRefine = useCallback(async () => {
    if (!feedback.trim() || !session) return
    setRefining(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine',
          sessionId: session.id,
          feedback: feedback.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refinement failed')

      const s = data.session as GenerationSession
      setSession(s)
      setSelectedFile(s.files[0] ?? null)
      setFeedback('')
      loadSessions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refinement failed')
    } finally {
      setRefining(false)
    }
  }, [feedback, session, loadSessions])

  // ── Deploy ───────────────────────────────────────────────────────────────
  const handleDeploy = useCallback(async () => {
    if (!session || !repoName.trim()) return
    setDeploying(true)
    setDeployResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy',
          sessionId: session.id,
          repoFullName: repoName.trim(),
          branch,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Deploy failed')

      setDeployResult(data.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deploy failed')
    } finally {
      setDeploying(false)
    }
  }, [session, repoName, branch])

  // ── Copy ─────────────────────────────────────────────────────────────────
  const copyContent = useCallback(() => {
    if (!selectedFile) return
    navigator.clipboard.writeText(selectedFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [selectedFile])

  // ── Load session ─────────────────────────────────────────────────────────
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/labs?sessionId=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const s = data.session as GenerationSession
        setSession(s)
        setSelectedFile(s.files[0] ?? null)
        setShowHistory(false)
      }
    } catch { /* best-effort */ }
  }, [])

  // ── Build file tree ──────────────────────────────────────────────────────
  const buildTree = (files: GeneratedFile[]) => {
    const dirs = new Map<string, GeneratedFile[]>()
    for (const f of files) {
      const parts = f.path.split('/')
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
      if (!dirs.has(dir)) dirs.set(dir, [])
      dirs.get(dir)!.push(f)
    }
    return dirs
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <span>
              Labs{' '}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                — App Builder
              </span>
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 ml-12">
            Describe an app in natural language, generate code, preview, and deploy to GitHub.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-transparent hover:border-white/[0.06] transition-colors"
          >
            <Clock className="w-4 h-4" />
            History
            {sessions.length > 0 && (
              <span className="ml-1 text-[10px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">
                {sessions.length}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <X className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-6">
        {/* ── Left Column: Input + File Tree ──────────────────────────────── */}
        <div className="w-[380px] shrink-0 space-y-4">
          {/* Input Card */}
          <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Describe Your App
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"e.g. A task management app with drag-and-drop kanban board,\nuser authentication, dark mode, and a REST API backend.\n\nBe as detailed as you want — the more context, the better."}
              rows={5}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-colors"
            />

            {/* Project Type Selector */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1.5 block">
                Project Type
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(projectTypes.length > 0 ? projectTypes : [
                  { id: 'nextjs', label: 'Next.js', icon: '▲' },
                  { id: 'react', label: 'React', icon: '⚛' },
                  { id: 'express', label: 'Express', icon: '🚀' },
                  { id: 'flask', label: 'Flask', icon: '🐍' },
                  { id: 'static', label: 'Static', icon: '🌐' },
                ]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setProjectType(t.id)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      projectType === t.id
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDocker}
                  onChange={(e) => setIncludeDocker(e.target.checked)}
                  className="rounded border-white/10 bg-white/[0.04] text-violet-500 focus:ring-violet-500/20"
                />
                <span>Docker</span>
              </label>
              <select
                value={styling}
                onChange={(e) => setStyling(e.target.value as 'tailwind' | 'css-modules' | 'plain')}
                className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-slate-400 focus:border-violet-500/40 focus:outline-none"
              >
                <option value="tailwind">Tailwind CSS</option>
                <option value="css-modules">CSS Modules</option>
                <option value="plain">Plain CSS</option>
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/10"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate App
                </>
              )}
            </button>
          </motion.div>

          {/* File Tree */}
          {session && (
            <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <FolderTree className="w-4 h-4 text-violet-400" />
                Files
                <span className="text-[10px] text-slate-500 font-mono ml-auto">
                  {session.files.length} files
                </span>
              </div>

              <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {Array.from(buildTree(session.files).entries()).map(([dir, files]) => (
                  <div key={dir}>
                    {dir !== '.' && (
                      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 font-mono">
                        <ChevronRight className="w-3 h-3" />
                        {dir}/
                      </div>
                    )}
                    {files.map((f) => {
                      const fileName = f.path.split('/').pop()
                      const isSelected = selectedFile?.path === f.path
                      return (
                        <button
                          key={f.path}
                          onClick={() => setSelectedFile(f)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-mono transition-colors ${
                            dir !== '.' ? 'ml-4' : ''
                          } ${
                            isSelected
                              ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                              : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
                          }`}
                        >
                          <FileCode className="w-3.5 h-3.5 shrink-0" />
                          {fileName}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Column: Code Preview + Deploy + Refine ────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Code Preview */}
          <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Code2 className="w-4 h-4 text-violet-400" />
                {selectedFile ? selectedFile.path : 'Code Preview'}
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded">
                    {selectedFile.language}
                  </span>
                  <button
                    onClick={copyContent}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Code Content */}
            <div className="min-h-[350px] max-h-[500px] overflow-auto">
              {selectedFile ? (
                <pre className="p-4 text-[13px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words">
                  {selectedFile.content}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] text-slate-500">
                  <Code2 className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">Describe an app and click Generate to see code here</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Deploy + Refine Row */}
          {session && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Deploy Card */}
              <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Rocket className="w-4 h-4 text-violet-400" />
                  Deploy to GitHub
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1 block">
                      Repository (owner/repo)
                    </label>
                    <input
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="owner/repo-name"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1 block">
                      Branch
                    </label>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDeploy}
                  disabled={deploying || !repoName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deploying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deploying…</>
                  ) : (
                    <><Download className="w-4 h-4" /> Push to GitHub</>
                  )}
                </button>

                {/* Deploy Result */}
                <AnimatePresence>
                  {deployResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-2.5 rounded-lg text-xs ${
                        deployResult.success
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/10 border border-red-500/20 text-red-400'
                      }`}
                    >
                      {deployResult.success ? (
                        <div>
                          <span className="font-medium">Deployed successfully!</span>
                          {deployResult.commitUrl && (
                            <a
                              href={deployResult.commitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mt-1 text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                            >
                              View commit →
                            </a>
                          )}
                        </div>
                      ) : (
                        <span>{deployResult.error || 'Deploy failed'}</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Refine Card */}
              <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquare className="w-4 h-4 text-violet-400" />
                  Refine
                </div>

                {/* Refinement History */}
                {session.history.length > 1 && (
                  <div className="space-y-1 max-h-[100px] overflow-y-auto">
                    {session.history.filter(h => h.type === 'refine').map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-[11px] text-slate-500">
                        <RefreshCw className="w-3 h-3 mt-0.5 shrink-0 text-violet-400/60" />
                        <span className="line-clamp-1">{h.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Add dark mode, authentication, tests…"
                    onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                  />
                  <button
                    onClick={handleRefine}
                    disabled={refining || !feedback.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {refining ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-slate-600">
                  Iterate on your generated app — add features, fix issues, change styling.
                </p>
              </motion.div>
            </div>
          )}

          {/* Session Info Bar */}
          {session && (
            <motion.div variants={fadeUp} className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span className="font-mono">{session.projectType}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                <span>{session.files.length} files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{session.history.length} revision{session.history.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{new Date(session.updatedAt).toLocaleTimeString()}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── History Sidebar ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-[280px] shrink-0"
            >
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sticky top-24">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Clock className="w-4 h-4 text-violet-400" />
                    History
                  </div>
                  <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No sessions yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                    {sessions.map((s) => {
                      const isActive = session?.id === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s.id)}
                          className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                            isActive
                              ? 'bg-violet-500/10 border border-violet-500/20'
                              : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
                          }`}
                        >
                          <div className={`text-xs font-medium truncate ${isActive ? 'text-violet-400' : 'text-white'}`}>
                            {s.description.length > 50 ? s.description.slice(0, 50) + '…' : s.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                            <span>{s.projectType}</span>
                            <span>•</span>
                            <span>{s.files.length} files</span>
                            <span>•</span>
                            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  onClick={() => {
                    setSession(null)
                    setSelectedFile(null)
                    setDescription('')
                    setDeployResult(null)
                    setError(null)
                  }}
                  className="w-full flex items-center justify-center gap-1.5 mt-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
