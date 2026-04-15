'use client'

/**
 * CreateAppTab — App creation workbench inside Build Studio.
 * Uses the existing /api/admin/labs endpoint for AI-powered app scaffold generation.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Copy, Check, FolderTree, FileCode, Rocket,
  Download, Sparkles, ChevronRight,
  Send, X,
} from 'lucide-react'

interface ProjectTypeInfo { id: string; label: string; description: string; language: string; icon: string }
interface GeneratedFile { path: string; content: string; language: string }
interface GenerationSession {
  id: string; description: string; projectType: string; files: GeneratedFile[]
  history: Array<{ id: string; type: string; description: string; projectType: string; timestamp: string; fileCount: number }>
  createdAt: string; updatedAt: string; aiProvider?: string | null
}

export default function CreateAppTab() {
  const [description, setDescription] = useState('')
  const [projectType, setProjectType] = useState('nextjs')
  const [projectTypes, setProjectTypes] = useState<ProjectTypeInfo[]>([])
  const [generating, setGenerating] = useState(false)
  const [session, setSession] = useState<GenerationSession | null>(null)
  const [sessions, setSessions] = useState<GenerationSession[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [refining, setRefining] = useState(false)
  const [includeDocker, setIncludeDocker] = useState(false)
  const [styling, setStyling] = useState<'tailwind' | 'css-modules' | 'plain'>('tailwind')
  const [capabilityPack, setCapabilityPack] = useState<string>('')

  const loadProjectTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/labs?action=types')
      if (res.ok) { const data = await res.json(); setProjectTypes(data.types ?? []) }
    } catch { /* best-effort */ }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/labs?action=sessions')
      if (res.ok) { const data = await res.json(); setSessions(data.sessions ?? []) }
    } catch { /* best-effort */ }
  }, [])

  useEffect(() => { loadProjectTypes(); loadSessions() }, [loadProjectTypes, loadSessions])

  const generate = useCallback(async () => {
    if (!description.trim()) return
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/admin/labs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', description, projectType, options: { includeDocker, styling, capabilityPack: capabilityPack || undefined } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSession(data.session ?? null)
      if (data.session?.files?.length) setSelectedFile(data.session.files[0])
      loadSessions()
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed') } finally { setGenerating(false) }
  }, [description, projectType, includeDocker, styling, capabilityPack, loadSessions])

  const refine = useCallback(async () => {
    if (!feedback.trim() || !session) return
    setRefining(true); setError(null)
    try {
      const res = await fetch('/api/admin/labs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refine', sessionId: session.id, feedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Refine failed')
      setSession(data.session ?? null); setFeedback('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Refine failed') } finally { setRefining(false) }
  }, [feedback, session])

  const downloadAll = useCallback(() => {
    if (!session) return
    const text = session.files.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${session.description.slice(0, 30).replace(/\s+/g, '-')}-generated.txt`
    a.click(); URL.revokeObjectURL(url)
  }, [session])

  return (
    <div className="space-y-6">
      {/* Generator form */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white text-sm font-medium">
          <Sparkles className="w-4 h-4 text-blue-400" /> App Generator
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Describe the app you want to build (e.g. 'A Next.js prayer tracking app with user authentication and daily reminders')…"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 resize-none" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={projectType} onChange={e => setProjectType(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
            {projectTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            {projectTypes.length === 0 && <option value="nextjs">Next.js</option>}
          </select>
          <select value={styling} onChange={e => setStyling(e.target.value as typeof styling)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
            <option value="tailwind">Tailwind CSS</option><option value="css-modules">CSS Modules</option><option value="plain">Plain CSS</option>
          </select>
          <select value={capabilityPack} onChange={e => setCapabilityPack(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white">
            <option value="">No capability pack</option>
            <option value="support_pack">Support & Chat</option>
            <option value="creator_pack">Creator / Media</option>
            <option value="companion_pack">Companion</option>
            <option value="research_pack">Research</option>
            <option value="education_pack">Education</option>
            <option value="smart_home_pack">Smart Home</option>
            <option value="equestrian_pack">Equestrian</option>
            <option value="pet_horse_pack">Pet & Equestrian</option>
            <option value="religious_pack">Religious / Spiritual</option>
            <option value="security_pack">Security</option>
            <option value="health_pack">Health / Tracking</option>
            <option value="family_pack">Family / Personal Assistant</option>
            <option value="knowledge_pack">Knowledge / Reference</option>
            <option value="media_pack">Media / Production</option>
            <option value="voice_pack">Voice Assistant</option>
            <option value="dev_pack">Developer / Engineering</option>
            <option value="operations_pack">Operations / Automation</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={includeDocker} onChange={e => setIncludeDocker(e.target.checked)} className="rounded border-slate-600 bg-transparent" />
            Include Docker
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={generate} disabled={generating || !description.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {generating ? 'Generating…' : 'Generate App'}
          </button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      {/* Session: File tree + code viewer */}
      {session && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 text-sm text-white font-medium">
              <FolderTree className="w-4 h-4 text-blue-400" />
              {session.description.slice(0, 60)}
              {session.aiProvider && <span className="text-[10px] text-slate-500 ml-2">via {session.aiProvider}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadAll} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-300 transition-colors">
                <Download className="w-3 h-3" /> Download All
              </button>
              <button onClick={() => { setSession(null); setSelectedFile(null) }}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex min-h-[400px]">
            {/* File tree */}
            <div className="w-56 shrink-0 border-r border-white/[0.06] overflow-y-auto py-2">
              {session.files.map(f => (
                <button key={f.path} onClick={() => setSelectedFile(f)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors
                    ${selectedFile?.path === f.path ? 'bg-blue-500/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}`}>
                  <FileCode className="w-3 h-3 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>
            {/* Code viewer */}
            <div className="flex-1 overflow-auto relative">
              {selectedFile ? (
                <>
                  <button onClick={() => { navigator.clipboard.writeText(selectedFile.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <pre className="p-4 text-xs text-slate-300 overflow-auto"><code>{selectedFile.content}</code></pre>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">Select a file to view</div>
              )}
            </div>
          </div>
          {/* Refine */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.06]">
            <input value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Refine: describe changes…"
              className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); refine() } }} />
            <button onClick={refine} disabled={refining || !feedback.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium disabled:opacity-40 transition-colors">
              {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Refine
            </button>
          </div>
        </div>
      )}

      {/* Previous sessions */}
      {sessions.length > 0 && !session && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="text-xs text-slate-400 font-medium">Recent Sessions</div>
          {sessions.slice(0, 8).map(s => (
            <button key={s.id} onClick={() => { setSession(s); if (s.files.length) setSelectedFile(s.files[0]) }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-left transition-colors">
              <div>
                <div className="text-xs text-white font-medium truncate max-w-[300px]">{s.description}</div>
                <div className="text-[10px] text-slate-500">{s.projectType} · {s.files.length} files</div>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
