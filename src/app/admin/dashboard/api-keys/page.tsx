'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Key, X, Loader2, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react'
import { format } from 'date-fns'

interface ApiKey {
  id: number
  provider: string
  label: string
  isActive: boolean
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ provider: '', label: '', apiKey: '' })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchKeys() }, [])

  const fetchKeys = async () => {
    const res = await fetch('/api/admin/api-keys')
    const data = await res.json()
    setKeys(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await fetchKeys()
        setModalOpen(false)
        setForm({ provider: '', label: '', apiKey: '' })
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save')
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: number, isActive: boolean) => {
    await fetch(`/api/admin/api-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await fetchKeys()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this API key?')) return
    await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
    await fetchKeys()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">API Keys</h1>
          <p className="text-sm text-slate-400 mt-1">Manage third-party service credentials</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Add Key
        </button>
      </div>

      {/* Clarifying note */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
        <Key className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-violet-300 font-medium">This page is for third-party service credentials</p>
          <p className="text-xs text-slate-500 mt-1">
            Store credentials for external services used by the platform (e.g. Resend, Stripe, SendGrid, Twilio).
            For <strong className="text-slate-400">AI provider keys</strong> (OpenAI, Gemini, Grok, etc.), go to{' '}
            <a href="/admin/dashboard/ai-providers" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
              AI Providers
            </a>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Key className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No API keys stored. Add your first key.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Provider</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Label</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Created</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {keys.map((key, i) => (
                <motion.tr
                  key={key.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-white">{key.provider}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-400">{key.label}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-xs text-slate-500">{format(new Date(key.createdAt), 'MMM d, yyyy')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${key.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {key.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleToggle(key.id, key.isActive)}
                        className={`p-1.5 transition-colors ${key.isActive ? 'text-emerald-400 hover:text-amber-400' : 'text-slate-400 hover:text-emerald-400'}`}
                      >
                        {key.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-[#0B1020] border border-white/10 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white font-heading">Add API Key</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Provider *</label>
                <input
                  required
                  value={form.provider}
                  onChange={(e) => setForm(p => ({ ...p, provider: e.target.value }))}
                  placeholder="e.g. OpenAI, Stripe, Resend"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Label *</label>
                <input
                  required
                  value={form.label}
                  onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Production API Key"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">API Key *</label>
                <div className="relative">
                  <input
                    required
                    type={showKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => setForm(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 glass text-slate-400 text-sm rounded-xl hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Key'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
