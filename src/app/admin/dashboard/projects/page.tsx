'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FolderOpen, RefreshCw, Plus, FileText, Clock, MessageSquare,
  Github, Upload, Save, Trash2, Tag,
} from 'lucide-react'

interface PromptEntry {
  id: string
  timestamp: string
  prompt: string
  model: string
  provider: string
  response: string
  latencyMs: number | null
  notes: string
}

interface ProjectFile {
  id: string
  name: string
  type: string
  content: string
  language: string | null
  createdAt: string
}

interface Project {
  id: number
  name: string
  type: string
  status: string
  description: string
  promptHistory: PromptEntry[]
  files: ProjectFile[]
  agentConfigs: unknown[]
  workflows: unknown[]
  tags: string[]
  githubRepo: string | null
  githubBranch: string | null
  lastPushedAt: string | null
  updatedAt: string
}

const TYPE_LABELS: Record<string, string> = {
  prompt_test: 'Prompt Test', agent_prototype: 'Agent Prototype',
  workflow: 'Workflow', code_assistant: 'Code Assistant',
  comparison: 'Model Comparison', general: 'General',
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageInner />
    </Suspense>
  )
}

function ProjectsPageInner() {
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id') ? parseInt(searchParams.get('id')!, 10) : null

  const [projects, setProjects]   = useState<Project[]>([])
  const [selected, setSelected]   = useState<Project | null>(null)
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'prompts' | 'files' | 'push'>('prompts')
  const [pushForm, setPushForm]   = useState({ repo: '', branch: 'amarktai/playground', message: '' })
  const [pushing, setPushing]     = useState(false)
  const [pushResult, setPushResult] = useState<{ success: boolean; commitUrl?: string | null; error?: string | null } | null>(null)
  const [newFileForm, setNewFileForm] = useState({ name: '', type: 'snippet', content: '', language: '' })
  const [addingFile, setAddingFile] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/playground')
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }, [])

  const loadProject = useCallback(async (id: number) => {
    const res = await fetch(`/api/admin/playground/${id}`)
    if (res.ok) setSelected(await res.json())
  }, [])

  useEffect(() => {
    loadProjects()
    if (selectedId) loadProject(selectedId)
  }, [loadProjects, loadProject, selectedId])

  const handlePush = async () => {
    if (!selected || !pushForm.repo) return
    setPushing(true)
    setPushResult(null)
    try {
      // Build files array from project's files + prompt history summary
      const files = [
        ...selected.files.map(f => ({
          path: `projects/${selected.name.replace(/\s+/g, '-').toLowerCase()}/${f.name}`,
          content: f.content,
        })),
        {
          path: `projects/${selected.name.replace(/\s+/g, '-').toLowerCase()}/README.md`,
          content: `# ${selected.name}\n\n${selected.description}\n\nType: ${TYPE_LABELS[selected.type] ?? selected.type}\nStatus: ${selected.status}\nLast updated: ${selected.updatedAt}\n`,
        },
      ]
      if (files.length === 0) {
        // At minimum push a README
        files.push({
          path: `projects/${selected.name.replace(/\s+/g, '-').toLowerCase()}/README.md`,
          content: `# ${selected.name}\n\n${selected.description}\n`,
        })
      }
      const res = await fetch('/api/admin/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selected.id,
          repoFullName: pushForm.repo,
          branch: pushForm.branch || 'amarktai/playground',
          commitMessage: pushForm.message || `AmarktAI Playground: ${selected.name}`,
          files,
        }),
      })
      const result = await res.json()
      setPushResult(result)
      if (result.success) await loadProject(selected.id)
    } catch (e) {
      setPushResult({ success: false, error: String(e) })
    } finally {
      setPushing(false)
    }
  }

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !newFileForm.name) return
    const res = await fetch(`/api/admin/playground/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'add_file', file: newFileForm }),
    })
    if (res.ok) {
      setSelected(await res.json())
      setAddingFile(false)
      setNewFileForm({ name: '', type: 'snippet', content: '', language: '' })
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!selected) return
    const files = selected.files.filter(f => f.id !== fileId)
    const res = await fetch(`/api/admin/playground/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    })
    if (res.ok) setSelected(await res.json())
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-400" />
            Projects
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Open and manage playground project files, prompt history, and GitHub exports.
          </p>
        </div>
        <button
          onClick={loadProjects}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-white text-sm disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Project list */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">
            {projects.length} projects
          </p>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); loadProject(p.id) }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selected?.id === p.id
                  ? 'bg-blue-600/15 border-blue-500/30 text-white'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/15'
              }`}
            >
              <p className="font-medium text-sm truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                <span>{TYPE_LABELS[p.type] ?? p.type}</span>
                <span>·</span>
                <span className="capitalize">{p.status}</span>
              </div>
            </button>
          ))}
          {projects.length === 0 && !loading && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center text-slate-600 text-xs">
              No projects. Create one in Playground.
            </div>
          )}
          <a
            href="/admin/dashboard/playground"
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 mt-2 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New in Playground
          </a>
        </div>

        {/* Project detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="p-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center text-slate-600">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Select a project to view its files and history.</p>
            </div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <p className="text-slate-400 text-sm">{selected.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Tag className="w-3 h-3" />
                    {selected.tags.join(', ') || 'No tags'}
                    {selected.githubRepo && (
                      <><span>·</span><Github className="w-3 h-3 text-purple-400" /><span className="text-purple-400">{selected.githubRepo}</span></>
                    )}
                    {selected.lastPushedAt && (
                      <><span>·</span>Last pushed {new Date(selected.lastPushedAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-white/[0.06] pb-1">
                {(['prompts', 'files', 'push'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                      tab === t ? 'bg-blue-600/20 text-blue-300' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {t === 'prompts' ? `Prompt History (${selected.promptHistory.length})` :
                     t === 'files'   ? `Files (${selected.files.length})` : 'Push to GitHub'}
                  </button>
                ))}
              </div>

              {/* Prompts tab */}
              {tab === 'prompts' && (
                <div className="space-y-2">
                  {selected.promptHistory.length === 0 ? (
                    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center text-slate-600 text-sm">
                      No prompt history yet. Use Gateway Test or Playground to generate prompts.
                    </div>
                  ) : selected.promptHistory.slice(0, 20).map((ph) => (
                    <div key={ph.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm">
                      <div className="flex items-center gap-2 mb-1 text-xs text-slate-500">
                        <MessageSquare className="w-3 h-3" />
                        <span className="font-mono text-purple-400">{ph.model}</span>
                        <span>·</span>
                        <span>{ph.provider}</span>
                        {ph.latencyMs && <><span>·</span><span>{ph.latencyMs}ms</span></>}
                        <span className="ml-auto">{new Date(ph.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 line-clamp-2">{ph.prompt}</p>
                      {ph.notes && <p className="text-slate-600 text-xs mt-1 italic">{ph.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Files tab */}
              {tab === 'files' && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setAddingFile(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white text-xs transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add File
                    </button>
                  </div>
                  {addingFile && (
                    <form onSubmit={handleAddFile} className="p-3 rounded-xl bg-white/[0.03] border border-blue-500/20 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="filename.md"
                          value={newFileForm.name}
                          onChange={e => setNewFileForm(f => ({ ...f, name: e.target.value }))}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
                        />
                        <select
                          value={newFileForm.type}
                          onChange={e => setNewFileForm(f => ({ ...f, type: e.target.value }))}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
                        >
                          {['snippet', 'config', 'prompt', 'workflow', 'note'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        placeholder="File content…"
                        value={newFileForm.content}
                        onChange={e => setNewFileForm(f => ({ ...f, content: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50 resize-none font-mono"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs">
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button type="button" onClick={() => setAddingFile(false)} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white text-xs">Cancel</button>
                      </div>
                    </form>
                  )}
                  {selected.files.length === 0 && !addingFile ? (
                    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center text-slate-600 text-sm">
                      No files yet. Add snippets, configs, prompts, or notes.
                    </div>
                  ) : selected.files.map(file => (
                    <div key={file.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-mono text-white text-xs">{file.name}</span>
                          <span className="text-slate-600 text-xs">({file.type})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{new Date(file.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => handleDeleteFile(file.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-4 font-mono bg-black/20 rounded p-2">{file.content}</pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Push tab */}
              {tab === 'push' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Target Repo (owner/repo)</label>
                      <input
                        placeholder="your-org/your-repo"
                        value={pushForm.repo}
                        onChange={e => setPushForm(f => ({ ...f, repo: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Branch</label>
                      <input
                        value={pushForm.branch}
                        onChange={e => setPushForm(f => ({ ...f, branch: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Commit Message</label>
                      <input
                        placeholder={`AmarktAI Playground: ${selected.name}`}
                        value={pushForm.message}
                        onChange={e => setPushForm(f => ({ ...f, message: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <button
                      onClick={handlePush}
                      disabled={pushing || !pushForm.repo}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {pushing ? 'Pushing…' : 'Push to GitHub'}
                    </button>
                    {pushResult && (
                      <div className={`p-3 rounded-xl text-sm ${pushResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                        {pushResult.success ? (
                          <>
                            ✓ Pushed successfully.
                            {pushResult.commitUrl && (
                              <a href={pushResult.commitUrl} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-purple-400">View commit</a>
                            )}
                          </>
                        ) : (
                          `✗ ${pushResult.error}`
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    GitHub must be configured in Developer Workspace with a valid PAT.
                    All project files and a README will be pushed to the target repo on the specified branch.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
