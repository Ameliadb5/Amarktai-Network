'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FlaskConical, Plus, Trash2, FolderOpen, FileText, Clock, Tag,
  ChevronRight, RefreshCw, Archive, Zap,
} from 'lucide-react'

interface PlaygroundProject {
  id: number
  name: string
  type: string
  status: string
  description: string
  promptHistory: unknown[]
  files: unknown[]
  tags: string[]
  githubRepo: string | null
  createdAt: string
  updatedAt: string
}

const TYPE_LABELS: Record<string, string> = {
  prompt_test:       'Prompt Test',
  agent_prototype:   'Agent Prototype',
  workflow:          'Workflow',
  code_assistant:    'Code Assistant',
  comparison:        'Model Comparison',
  general:           'General',
}

const STATUS_COLORS: Record<string, string> = {
  draft:    'text-slate-400 bg-slate-500/10 border-slate-500/20',
  active:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  archived: 'text-slate-600 bg-slate-800/50 border-slate-700/50',
}

export default function PlaygroundPage() {
  const [projects, setProjects] = useState<PlaygroundProject[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm]   = useState({ name: '', type: 'general', description: '' })
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/playground${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      if (!res.ok) throw new Error('Failed to create')
      setCreating(false)
      setNewForm({ name: '', type: 'general', description: '' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id: number) => {
    await fetch(`/api/admin/playground/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    await load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    await fetch(`/api/admin/playground/${id}`, { method: 'DELETE' })
    await load()
  }

  const activeProjects = projects.filter(p => p.status !== 'archived')
  const archivedProjects = projects.filter(p => p.status === 'archived')

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            Playground
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Test prompts, compare models, and save workspaces for later. Admin-only.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Create Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#0d0f14] border border-white/12 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-white mb-4">New Playground Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FaithHaven Chat Prompt Tests"
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Project Type</label>
                <select
                  value={newForm.type}
                  onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional description"
                  value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'draft', 'active', 'archived'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/8'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {loading && !projects.length ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-7 h-7 text-purple-400 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white/3 border border-white/8 text-center">
          <FlaskConical className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No projects yet</p>
          <p className="text-slate-600 text-sm mt-1">Create your first playground project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((proj, i) => (
            <motion.div
              key={proj.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-4 rounded-xl border bg-white/3 border-white/8 group hover:border-purple-500/30 transition-colors ${
                proj.status === 'archived' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">{proj.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{TYPE_LABELS[proj.type] ?? proj.type}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${STATUS_COLORS[proj.status] ?? STATUS_COLORS.draft}`}>
                  {proj.status}
                </span>
              </div>
              {proj.description && (
                <p className="text-xs text-slate-400 mb-2 line-clamp-2">{proj.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-600 mb-3">
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{(proj.promptHistory as unknown[]).length} prompts</span>
                <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{(proj.files as unknown[]).length} files</span>
                {proj.githubRepo && (
                  <span className="flex items-center gap-1 text-purple-400"><Tag className="w-3 h-3" />{proj.githubRepo}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                <Clock className="w-3 h-3" />
                Updated {new Date(proj.updatedAt).toLocaleDateString()}
              </div>
              <div className="flex gap-1.5">
                <a
                  href={`/admin/dashboard/projects?id=${proj.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-white text-xs transition-colors"
                >
                  Open <ChevronRight className="w-3 h-3" />
                </a>
                {proj.status !== 'archived' && (
                  <button
                    onClick={() => handleArchive(proj.id)}
                    title="Archive"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <Archive className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(proj.id)}
                  title="Delete"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats */}
      {projects.length > 0 && (
        <p className="text-xs text-slate-600 text-center">
          {activeProjects.length} active · {archivedProjects.length} archived · {projects.length} total
        </p>
      )}
    </div>
  )
}
