'use client'

/**
 * SkillLibraryTab — Browse & install reusable AI skill templates.
 * Uses the existing /api/admin/skill-templates endpoint.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Search, Loader2, CheckCircle, AlertCircle, Tag, Zap,
  RefreshCw, Play, Download,
} from 'lucide-react'

interface SkillTemplate {
  id: string; name: string; description: string; category: string
  tags: string[]; steps: Array<{ id: string; name: string; type: string }>
  installed?: boolean
}

const CATEGORIES = ['all', 'developer', 'productivity', 'content', 'integration', 'multi_agent', 'automation', 'smart_home']

export default function SkillLibraryTab() {
  const [skills, setSkills] = useState<SkillTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [installing, setInstalling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/skill-templates')
      if (res.ok) {
        const data = await res.json()
        setSkills(data.templates ?? [])
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load skills') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const installSkill = useCallback(async (id: string) => {
    setInstalling(id)
    try {
      const res = await fetch('/api/admin/skill-templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install', templateId: id }),
      })
      if (!res.ok) throw new Error('Install failed')
      load()
    } catch { /* best-effort */ } finally { setInstalling(null) }
  }, [load])

  const filtered = skills.filter(s => {
    if (category !== 'all' && s.category !== category) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return <div className="flex items-center gap-2 py-16 justify-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading skills…</div>
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400">Browse and install reusable AI skills — daily briefings, crawlers, email triage, social campaigns, and more.</div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40" />
        </div>
        <div className="flex items-center gap-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all
                ${category === c ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white'}`}>
              {c === 'all' ? 'All' : c.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-300 text-sm"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}

      {/* Skills grid */}
      {filtered.length === 0 ? (
        <div className="text-xs text-slate-500 bg-white/[0.02] border border-white/[0.06] rounded-lg p-8 text-center">
          {skills.length === 0 ? 'Skill templates are defined in the skill-templates system.' : 'No skills match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white">{s.name}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-400">{s.category.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{s.description}</p>
              <div className="flex flex-wrap gap-1">
                {s.tags.slice(0, 4).map(t => (
                  <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.03] text-slate-500">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => installSkill(s.id)} disabled={installing === s.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-40 transition-colors">
                  {installing === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Install
                </button>
                <span className="text-[10px] text-slate-500">{s.steps.length} steps</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
