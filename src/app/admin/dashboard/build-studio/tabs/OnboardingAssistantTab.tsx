'use client'

/**
 * OnboardingAssistantTab — AI-guided new app onboarding assistant.
 *
 * The operator describes the app they want to connect and the assistant
 * generates: subdomain steps, VPS commands, env vars, code snippets,
 * and copy-paste deployment instructions tailored to Amarktai Network.
 */

import { useState, useCallback } from 'react'
import {
  Loader2, Sparkles, Copy, Check, AlertCircle, Terminal, ChevronDown, ChevronUp,
} from 'lucide-react'

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

const SYSTEM_PROMPT = `You are Amarktai Network's onboarding assistant. When the operator describes an app they want to connect, generate a complete, copy-paste-ready onboarding guide with these sections:

## 1. App Summary
Brief summary of the app and how it fits into Amarktai Network.

## 2. Subdomain & DNS Setup
Exact steps for subdomain configuration (e.g. app.amarktai.com or customer domain).

## 3. VPS / Server Setup Commands
Bash commands to set up the app on a VPS. Use code blocks.

## 4. Environment Variables
All .env variables the app needs to connect to Amarktai Network. Use a code block.

## 5. Integration Code Snippet
The minimum code snippet (API route or middleware) to add to the app for Amarktai Network brain integration. Use code blocks with language labels.

## 6. Deployment Commands
Final deploy steps: build, copy, restart. Use code blocks.

## 7. Verification Checklist
Numbered checklist of steps to confirm the app is correctly connected.

Be specific and practical. Use real Amarktai Network API paths (e.g. /api/brain/chat, /api/brain/tts). Generate real env var names. Output clean markdown.`

const STARTER_PROMPTS = [
  'I want to add my marketing agency website to Amarktai Network',
  'I want to connect a Next.js e-commerce app with AI chat support',
  'I want to onboard a mobile fitness coaching app',
  'I want to add a church ministry platform with devotionals and AI prayer support',
  'I want to connect a SaaS dashboard with an embedded AI assistant',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative">
      {label && <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-slate-500"><Terminal className="w-3 h-3" />{label}</div>}
      <div className="relative bg-[#080f1f] border border-white/[0.06] rounded-xl p-4 text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
        <CopyButton text={code} />
        {code}
      </div>
    </div>
  )
}

interface Section { title: string; content: string }

function parseSections(raw: string): Section[] {
  // Split on markdown heading lines (## or ###)
  const parts = raw.split(/\n(?=#{1,3}\s)/)
  return parts
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const lines = p.split('\n')
      const heading = lines[0].replace(/^#+\s*/, '').trim()
      const body = lines.slice(1).join('\n').trim()
      return { title: heading, content: body }
    })
}

function SectionCard({ section, defaultOpen = false }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  // Detect code blocks in content
  const hasCode = section.content.includes('```')

  const renderContent = (text: string) => {
    if (!hasCode) {
      return (
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
      )
    }
    const parts = text.split(/(```[\s\S]*?```)/g)
    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const lines = part.slice(3).split('\n')
            const lang = lines[0].trim()
            const code = lines.slice(1).join('\n').replace(/```$/, '').trim()
            return <CodeBlock key={i} code={code} label={lang || undefined} />
          }
          return part.trim() ? <p key={i} className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{part.trim()}</p> : null
        })}
      </div>
    )
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-white">{section.title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-white/[0.04]">
          <div className="pt-3">{renderContent(section.content)}</div>
        </div>
      )}
    </div>
  )
}

export default function OnboardingAssistantTab() {
  const [appDescription, setAppDescription] = useState('')
  const [running, setRunning] = useState(false)
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const generate = useCallback(async () => {
    if (!appDescription.trim()) return
    setRunning(true); setError(null); setRawOutput(null); setSections([])
    try {
      const res = await fetch('/api/admin/brain/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: '__admin_test__',
          appSecret: 'admin-test-secret',
          taskType: 'chat',
          message: `${SYSTEM_PROMPT}\n\n---\n\nOperator request: ${appDescription}`,
        }),
      })
      const data = await res.json().catch(() => ({ error: `Unexpected response (HTTP ${res.status})` }))
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      const output: string = data.output ?? data.text ?? ''
      setRawOutput(output)
      setSections(parseSections(output))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onboarding generation failed')
    } finally {
      setRunning(false)
    }
  }, [appDescription])

  const saveArtifact = useCallback(async () => {
    if (!rawOutput) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSlug: 'workspace',
          type: 'document',
          subType: 'onboarding',
          title: `Onboarding: ${appDescription.slice(0, 80)}`,
          description: appDescription,
          contentBase64: encodeBase64Utf8(rawOutput),
          mimeType: 'text/markdown; charset=utf-8',
          metadata: { source: 'onboarding-assistant', prompt: appDescription },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Save failed`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save artifact')
    } finally {
      setSaving(false)
    }
  }, [rawOutput, appDescription])

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-400 leading-relaxed">
        Describe the app you want to connect to Amarktai Network. The AI will generate subdomain setup steps, VPS commands, env vars, integration code, and deployment instructions.
      </div>

      {/* Starter prompts */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map(p => (
          <button key={p} onClick={() => setAppDescription(p)}
            className="px-3 py-1.5 text-[11px] rounded-xl border border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={appDescription}
        onChange={e => setAppDescription(e.target.value)}
        rows={4}
        placeholder="Describe your app: what it does, its tech stack, and how you want it connected to Amarktai Network…"
        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={generate}
          disabled={running || !appDescription.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/20 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {running ? 'Generating…' : 'Generate Onboarding Guide'}
        </button>
        {rawOutput && (
          <button
            onClick={saveArtifact}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {saved ? 'Saved to Artifacts' : 'Save to Artifacts'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section, i) => (
            <SectionCard key={i} section={section} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {/* Raw fallback */}
      {rawOutput && sections.length === 0 && (
        <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <CopyButton text={rawOutput} />
          <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">{rawOutput}</pre>
        </div>
      )}
    </div>
  )
}
