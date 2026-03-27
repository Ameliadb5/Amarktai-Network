'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Code2, Bot, BookTemplate, Activity,
  Send, Loader2, Play, Plus, Trash2, Save,
  ChevronDown, Thermometer, Hash, RefreshCw, Copy,
  CheckCircle2, XCircle, Clock, Zap, ArrowRight,
  Terminal, GitBranch, Eye, Pencil, Search,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────────── */

type WorkspaceTab = 'chat' | 'code' | 'agents' | 'prompts' | 'traces'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  provider?: string
  latencyMs?: number
  timestamp: string
}

interface ModelOption {
  provider: string
  model_id: string
  model_name: string
  primary_role: string
  supports_chat: boolean
  enabled: boolean
}

interface AgentInfo {
  type: string
  name: string
  description: string
  capabilities: string[]
  status: string
  defaultProvider: string
  defaultModel: string
}

interface BrainEvent {
  id?: number
  traceId: string
  appSlug: string
  taskType: string
  executionMode: string
  routedProvider: string | null
  routedModel: string | null
  success: boolean
  latencyMs: number | null
  confidenceScore: number | null
  validationUsed: boolean
  consensusUsed: boolean
  errorMessage: string | null
  createdAt?: string
}

interface PromptTemplate {
  id: string
  name: string
  template: string
  variables: string[]
  model: string
  lastTested: string | null
}

/* ─── Tab Config ────────────────────────────────────────────── */

const TABS: { key: WorkspaceTab; label: string; icon: React.ElementType }[] = [
  { key: 'chat',    label: 'Chat',    icon: MessageSquare },
  { key: 'code',    label: 'Code',    icon: Code2 },
  { key: 'agents',  label: 'Agents',  icon: Bot },
  { key: 'prompts', label: 'Prompts', icon: BookTemplate },
  { key: 'traces',  label: 'Traces',  icon: Activity },
]

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust', 'json', 'html', 'css', 'sql', 'bash',
]

/* ─── Helpers ───────────────────────────────────────────────── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const LANG_EXTENSIONS: Record<string, string> = {
  typescript: 'ts', javascript: 'js', python: 'py', rust: 'rs', bash: 'sh',
}

function extractTemplateVars(template: string): string[] {
  return (template.match(/\{\{(\w+)\}\}/g) ?? []).map(v => v.replace(/[{}]/g, ''))
}

/* ─── Main Component ────────────────────────────────────────── */

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chat')

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-[1400px]">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-6 h-6 text-purple-400" />
          AI Workspace
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Chat with models, run code, test agents, manage prompts, and trace executions.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 flex items-center gap-1 border-b border-white/[0.06] pb-px mb-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === key
                ? 'text-purple-300 bg-white/5'
                : 'text-slate-500 hover:text-white hover:bg-white/3'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {activeTab === key && (
              <motion.div
                layoutId="workspace-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'chat'    && <ChatWorkspace />}
            {activeTab === 'code'    && <CodeWorkspace />}
            {activeTab === 'agents'  && <AgentsWorkspace />}
            {activeTab === 'prompts' && <PromptsWorkspace />}
            {activeTab === 'traces'  && <TracesWorkspace />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CHAT WORKSPACE
   ═══════════════════════════════════════════════════════════════ */

function ChatWorkspace() {
  const [models, setModels]           = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens]     = useState(2048)
  const [showSettings, setShowSettings] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/models')
      .then(r => r.json())
      .then(data => {
        const list: ModelOption[] = (data.models ?? data ?? [])
          .filter((m: ModelOption) => m.enabled && m.supports_chat)
        setModels(list)
        if (list.length > 0 && !selectedModel) {
          setSelectedModel(`${list[0].provider}/${list[0].model_id}`)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const [provider] = selectedModel.split('/')
      const res = await fetch('/api/brain/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'admin-playground',
          appSecret: 'internal',
          taskType: 'chat',
          message: text,
          metadata: {
            preferredProvider: provider || undefined,
            preferredModel: selectedModel.split('/').slice(1).join('/') || undefined,
            temperature,
            max_tokens: maxTokens,
          },
        }),
      })
      const data = await res.json()
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: data.output ?? data.error ?? 'No response received.',
        model: data.routedModel ?? selectedModel,
        provider: data.routedProvider ?? provider,
        latencyMs: data.latencyMs ?? undefined,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'assistant',
        content: 'Error: Failed to reach the Brain API.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controls Bar */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        {/* Model Selector */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none pr-8"
          >
            {models.length === 0 && <option value="">Loading models…</option>}
            {models.map(m => (
              <option key={`${m.provider}/${m.model_id}`} value={`${m.provider}/${m.model_id}`}>
                {m.provider} / {m.model_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
            showSettings
              ? 'bg-purple-600/20 border-purple-500/30 text-purple-300'
              : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Thermometer className="w-3.5 h-3.5" />
          Settings
        </button>

        {/* Clear Chat */}
        <button
          onClick={() => setMessages([])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <div className="flex items-center gap-6 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                <label className="text-xs text-slate-400">Temperature</label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-24 accent-purple-500"
                />
                <span className="text-xs text-white font-mono w-8">{temperature.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                <label className="text-xs text-slate-400">Max Tokens</label>
                <input
                  type="number"
                  min={64}
                  max={32768}
                  step={64}
                  value={maxTokens}
                  onChange={e => setMaxTokens(parseInt(e.target.value) || 2048)}
                  className="w-24 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-purple-400/20 mb-3" />
            <p className="text-slate-500 font-medium">Start a conversation</p>
            <p className="text-slate-600 text-sm mt-1">Select a model and send a message to begin.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-600/20 border border-purple-500/20 text-white'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.role === 'assistant' && (msg.model || msg.latencyMs) && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-xs text-slate-500">
                  {msg.model && <span className="font-mono">{msg.model}</span>}
                  {msg.provider && <span>{msg.provider}</span>}
                  {msg.latencyMs != null && <span>{msg.latencyMs}ms</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 resize-none placeholder:text-slate-600"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CODE WORKSPACE
   ═══════════════════════════════════════════════════════════════ */

function CodeWorkspace() {
  const [code, setCode]         = useState('// Write or paste code here\nconsole.log("Hello from Amarktai Workspace");\n')
  const [language, setLanguage] = useState('javascript')
  const [output, setOutput]     = useState('')
  const [running, setRunning]   = useState(false)
  const [pushing, setPushing]   = useState(false)
  const [pushMsg, setPushMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  const handleRun = async () => {
    setRunning(true)
    setOutput('')
    try {
      const res = await fetch('/api/brain/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'admin-playground',
          appSecret: 'internal',
          taskType: 'chat',
          message: `Execute or analyze this ${language} code and show the expected output. If it cannot be executed, explain what it does:\n\n\`\`\`${language}\n${code}\n\`\`\``,
          metadata: { codeExecution: true },
        }),
      })
      const data = await res.json()
      setOutput(data.output ?? data.error ?? 'No output.')
    } catch {
      setOutput('Error: Failed to reach the Brain API.')
    } finally {
      setRunning(false)
    }
  }

  const handlePush = async () => {
    setPushing(true)
    setPushMsg(null)
    try {
      const res = await fetch('/api/admin/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `playground-snippet.${LANG_EXTENSIONS[language] ?? language}`,
          content: code,
          message: `[Workspace] Add ${language} snippet from playground`,
        }),
      })
      const data = await res.json()
      setPushMsg({ ok: res.ok, text: data.message ?? (res.ok ? 'Pushed successfully' : 'Push failed') })
    } catch {
      setPushMsg({ ok: false, text: 'Failed to connect to GitHub API.' })
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 appearance-none pr-8"
          >
            {LANGUAGES.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        <button
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running…' : 'Run / Analyze'}
        </button>

        <button
          onClick={handlePush}
          disabled={pushing || !code.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-40"
        >
          {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
          Push to GitHub
        </button>

        <button
          onClick={() => { navigator.clipboard.writeText(code); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
      </div>

      {pushMsg && (
        <div className={`flex-shrink-0 flex items-center gap-2 p-3 rounded-xl text-sm ${
          pushMsg.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {pushMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {pushMsg.text}
        </div>
      )}

      {/* Editor + Output */}
      <div className="flex-1 min-h-0 grid grid-rows-2 gap-3">
        <div className="relative rounded-xl border border-white/10 bg-[#0a0c18] overflow-hidden">
          <div className="absolute top-2 left-3 text-xs text-slate-600 font-mono pointer-events-none select-none">
            {language}
          </div>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
            className="w-full h-full bg-transparent text-emerald-300 font-mono text-sm p-4 pt-7 resize-none focus:outline-none placeholder:text-slate-700 leading-relaxed"
            placeholder="// Paste or write code here…"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0a0c18] overflow-auto">
          <div className="sticky top-0 flex items-center gap-2 px-3 py-2 bg-[#0a0c18] border-b border-white/5 z-10">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Output</span>
          </div>
          <pre className="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {output || <span className="text-slate-600 italic">Run code to see output…</span>}
          </pre>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AGENTS WORKSPACE
   ═══════════════════════════════════════════════════════════════ */

function AgentsWorkspace() {
  const [agents, setAgents]           = useState<AgentInfo[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [taskInput, setTaskInput]     = useState('')
  const [running, setRunning]         = useState(false)
  const [result, setResult]           = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/agents')
      .then(r => r.json())
      .then(data => {
        const list: AgentInfo[] = data.agents ?? data ?? []
        setAgents(list)
        if (list.length > 0) setSelectedAgent(list[0].type)
      })
      .catch(() => setError('Failed to load agents'))
      .finally(() => setLoading(false))
  }, [])

  const currentAgent = agents.find(a => a.type === selectedAgent)

  const handleRun = async () => {
    if (!taskInput.trim() || !selectedAgent) return
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/brain/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'admin-playground',
          appSecret: 'internal',
          taskType: 'chat',
          message: taskInput,
          metadata: {
            agentType: selectedAgent,
            executionMode: 'specialist',
          },
        }),
      })
      const data = await res.json()
      setResult(data.output ?? JSON.stringify(data, null, 2))
    } catch {
      setError('Failed to execute agent task.')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* Agent List */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider px-2 mb-2">
          Available Agents ({agents.length})
        </div>
        {agents.map(agent => (
          <button
            key={agent.type}
            onClick={() => setSelectedAgent(agent.type)}
            className={`flex items-start gap-2.5 p-3 rounded-xl text-left text-sm transition-colors ${
              selectedAgent === agent.type
                ? 'bg-purple-600/15 border border-purple-500/25 text-white'
                : 'bg-white/[0.03] border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Bot className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectedAgent === agent.type ? 'text-purple-400' : 'text-slate-600'}`} />
            <div className="min-w-0">
              <div className="font-medium truncate">{agent.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{agent.description}</div>
            </div>
          </button>
        ))}
        {agents.length === 0 && (
          <div className="p-4 text-center text-slate-600 text-sm">No agents registered.</div>
        )}
      </div>

      {/* Agent Workspace */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {currentAgent && (
          <div className="flex-shrink-0 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <h3 className="text-white font-bold">{currentAgent.name}</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 text-slate-400">
                {currentAgent.type}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-2">{currentAgent.description}</p>
            {currentAgent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentAgent.capabilities.map(cap => (
                  <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    {cap}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span>Provider: {currentAgent.defaultProvider}</span>
              <span>Model: {currentAgent.defaultModel}</span>
            </div>
          </div>
        )}

        {/* Task Input */}
        <div className="flex-shrink-0">
          <textarea
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            placeholder="Describe the task for this agent…"
            rows={3}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 resize-none placeholder:text-slate-600"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleRun}
              disabled={running || !taskInput.trim() || !selectedAgent}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Running…' : 'Run Agent'}
            </button>
            <button
              onClick={() => { setResult(null); setError(null); setTaskInput('') }}
              className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="flex-shrink-0 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Results */}
        {result !== null && (
          <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-[#0a0c18] overflow-auto">
            <div className="sticky top-0 flex items-center gap-2 px-3 py-2 bg-[#0a0c18] border-b border-white/5 z-10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400 font-medium">Agent Result</span>
            </div>
            <pre className="p-4 text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PROMPTS WORKSPACE
   ═══════════════════════════════════════════════════════════════ */

function PromptsWorkspace() {
  const [prompts, setPrompts]         = useState<PromptTemplate[]>([])
  const [selected, setSelected]       = useState<PromptTemplate | null>(null)
  const [editing, setEditing]         = useState(false)
  const [testOutput, setTestOutput]   = useState<string | null>(null)
  const [testing, setTesting]         = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Form state
  const [formName, setFormName]       = useState('')
  const [formTemplate, setFormTemplate] = useState('')
  const [formModel, setFormModel]     = useState('')

  const createNew = () => {
    const tpl: PromptTemplate = {
      id: uid(),
      name: 'Untitled Prompt',
      template: '',
      variables: [],
      model: '',
      lastTested: null,
    }
    setPrompts(prev => [tpl, ...prev])
    setSelected(tpl)
    setFormName(tpl.name)
    setFormTemplate(tpl.template)
    setFormModel(tpl.model)
    setEditing(true)
    setTestOutput(null)
  }

  const openPrompt = (p: PromptTemplate) => {
    setSelected(p)
    setFormName(p.name)
    setFormTemplate(p.template)
    setFormModel(p.model)
    setEditing(false)
    setTestOutput(null)
  }

  const savePrompt = () => {
    if (!selected) return
    const vars = extractTemplateVars(formTemplate)
    const updated: PromptTemplate = { ...selected, name: formName, template: formTemplate, model: formModel, variables: vars }
    setPrompts(prev => prev.map(p => p.id === selected.id ? updated : p))
    setSelected(updated)
    setEditing(false)
  }

  const deletePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id))
    if (selected?.id === id) { setSelected(null); setTestOutput(null) }
  }

  const testPrompt = async () => {
    if (!formTemplate.trim()) return
    setTesting(true)
    setTestOutput(null)
    try {
      const res = await fetch('/api/brain/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'admin-playground',
          appSecret: 'internal',
          taskType: 'chat',
          message: formTemplate,
          metadata: { promptTest: true },
        }),
      })
      const data = await res.json()
      setTestOutput(data.output ?? data.error ?? 'No output.')
      if (selected) {
        const updated = { ...selected, lastTested: new Date().toISOString() }
        setPrompts(prev => prev.map(p => p.id === selected.id ? updated : p))
        setSelected(updated)
      }
    } catch {
      setTestOutput('Error: Failed to reach the Brain API.')
    } finally {
      setTesting(false)
    }
  }

  const filtered = prompts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.template.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full gap-4">
      {/* Prompt Library */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search prompts…"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={createNew}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 && (
            <div className="p-6 text-center">
              <BookTemplate className="w-8 h-8 text-purple-400/20 mx-auto mb-2" />
              <p className="text-xs text-slate-600">
                {prompts.length === 0 ? 'No prompts yet. Create one to get started.' : 'No matches.'}
              </p>
            </div>
          )}
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => openPrompt(p)}
              className={`group flex items-start justify-between gap-2 p-3 rounded-xl cursor-pointer text-sm transition-colors ${
                selected?.id === p.id
                  ? 'bg-purple-600/15 border border-purple-500/25 text-white'
                  : 'bg-white/[0.03] border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {truncate(p.template || 'Empty template', 60)}
                </div>
                {p.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.variables.map(v => (
                      <span key={v} className="text-[10px] font-mono px-1 py-0.5 rounded bg-blue-500/10 text-blue-300">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); deletePrompt(p.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookTemplate className="w-12 h-12 text-purple-400/20 mb-3" />
            <p className="text-slate-500 font-medium">Select or create a prompt</p>
            <p className="text-slate-600 text-sm mt-1">Use {`{{variable}}`} syntax for template variables.</p>
          </div>
        ) : (
          <>
            {/* Prompt Header */}
            <div className="flex-shrink-0 flex items-center gap-3">
              {editing ? (
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-purple-500/50"
                />
              ) : (
                <h3 className="flex-1 text-white font-bold text-lg">{selected.name}</h3>
              )}
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <button onClick={savePrompt} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
                  <Save className="w-3.5 h-3.5" /> Save
                </button>
              )}
            </div>

            {/* Model */}
            {editing && (
              <input
                value={formModel}
                onChange={e => setFormModel(e.target.value)}
                placeholder="Model (e.g. openai/gpt-4o)"
                className="flex-shrink-0 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-slate-600"
              />
            )}

            {/* Template Editor */}
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex-1 min-h-0 relative rounded-xl border border-white/10 bg-[#0a0c18] overflow-hidden">
                <textarea
                  value={formTemplate}
                  onChange={e => setFormTemplate(e.target.value)}
                  readOnly={!editing}
                  spellCheck={false}
                  placeholder="Write your prompt template here… Use {{variable}} for dynamic parts."
                  className="w-full h-full bg-transparent text-slate-200 font-mono text-sm p-4 resize-none focus:outline-none placeholder:text-slate-700 leading-relaxed"
                />
              </div>

              {/* Test Area */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={testPrompt}
                  disabled={testing || !formTemplate.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {testing ? 'Testing…' : 'Test Prompt'}
                </button>
                {selected.lastTested && (
                  <span className="text-xs text-slate-500">
                    Last tested: {new Date(selected.lastTested).toLocaleString()}
                  </span>
                )}
              </div>

              {testOutput !== null && (
                <div className="flex-shrink-0 max-h-48 overflow-auto rounded-xl border border-white/10 bg-[#0a0c18] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-slate-400 font-medium">Test Output</span>
                  </div>
                  <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{testOutput}</pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TRACES WORKSPACE
   ═══════════════════════════════════════════════════════════════ */

function TracesWorkspace() {
  const [events, setEvents]       = useState<BrainEvent[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<BrainEvent | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/brain/events')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEvents(data.events ?? data ?? [])
    } catch {
      setError('Failed to load brain events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* Event List */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Recent Events ({events.length})
          </span>
          <button
            onClick={loadEvents}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {events.length === 0 && (
            <div className="p-6 text-center">
              <Activity className="w-8 h-8 text-purple-400/20 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No brain events recorded yet.</p>
            </div>
          )}
          {events.map((ev, i) => (
            <button
              key={ev.traceId + i}
              onClick={() => setSelected(ev)}
              className={`w-full text-left p-3 rounded-xl text-sm transition-colors ${
                selected?.traceId === ev.traceId
                  ? 'bg-purple-600/15 border border-purple-500/25'
                  : 'bg-white/[0.03] border border-transparent hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {ev.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
                <span className="text-white font-medium truncate">{ev.taskType}</span>
                <span className="ml-auto text-xs text-slate-500 font-mono flex-shrink-0">
                  {ev.latencyMs != null ? `${ev.latencyMs}ms` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{ev.routedProvider ?? 'none'}/{ev.routedModel ?? 'none'}</span>
                <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{ev.executionMode}</span>
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-1 truncate">{ev.traceId}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Trace Detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Activity className="w-12 h-12 text-purple-400/20 mb-3" />
            <p className="text-slate-500 font-medium">Select a trace</p>
            <p className="text-slate-600 text-sm mt-1">Click an event to view routing details and execution metadata.</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-4 pr-1">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-bold text-lg">Trace Detail</h3>
              {selected.success ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Success</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Failed</span>
              )}
            </div>

            {/* Trace ID */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-xs text-slate-500 mb-1">Trace ID</div>
              <div className="text-sm text-white font-mono break-all">{selected.traceId}</div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Task Type',       value: selected.taskType,       icon: Zap,           color: 'text-purple-400' },
                { label: 'Execution Mode',   value: selected.executionMode,  icon: ArrowRight,    color: 'text-blue-400' },
                { label: 'Provider',         value: selected.routedProvider ?? '—', icon: Bot,    color: 'text-emerald-400' },
                { label: 'Model',            value: selected.routedModel ?? '—',    icon: Terminal, color: 'text-amber-400' },
                { label: 'Latency',          value: selected.latencyMs != null ? `${selected.latencyMs}ms` : '—', icon: Clock, color: 'text-pink-400' },
                { label: 'Confidence',       value: selected.confidenceScore != null ? `${(selected.confidenceScore * 100).toFixed(1)}%` : '—', icon: Activity, color: 'text-cyan-400' },
                { label: 'App Slug',         value: selected.appSlug || '—', icon: Code2,         color: 'text-orange-400' },
                { label: 'Validation Used',  value: selected.validationUsed ? 'Yes' : 'No', icon: CheckCircle2, color: 'text-indigo-400' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                  <div className="text-sm text-white font-medium truncate">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-2">
              {selected.consensusUsed && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">Consensus</span>
              )}
              {selected.validationUsed && (
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Validated</span>
              )}
            </div>

            {/* Error */}
            {selected.errorMessage && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400 font-medium">Error</span>
                </div>
                <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap">{selected.errorMessage}</pre>
              </div>
            )}

            {selected.createdAt && (
              <div className="text-xs text-slate-600">
                Created: {new Date(selected.createdAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
