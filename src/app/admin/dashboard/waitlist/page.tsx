'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, Download } from 'lucide-react'
import { format } from 'date-fns'

interface WaitlistEntry {
  id: number
  name: string
  email: string
  interest: string
  createdAt: string
}

const interestLabels: Record<string, string> = {
  crypto: 'Amarktai Crypto',
  forex: 'Amarktai Forex',
  marketing: 'Amarktai Marketing',
  travel: 'Amarktai Travel',
  equiprofile: 'EquiProfile',
  'amarktai-online': 'Amarktai Online',
  'faith-haven': 'Faith Haven',
  'learn-digital': 'Learn Digital',
  'jobs-sa': 'Jobs SA',
  all: 'All Platforms',
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/waitlist')
      .then(r => r.json())
      .then(data => { setEntries(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  const filtered = entries.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleExport = () => {
    const csv = [
      ['Name', 'Email', 'Interest', 'Joined'].join(','),
      ...filtered.map(e => [
        `"${e.name}"`,
        e.email,
        `"${interestLabels[e.interest] || e.interest || ''}"`,
        format(new Date(e.createdAt), 'yyyy-MM-dd'),
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'waitlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group by interest
  const interestCounts = entries.reduce((acc, e) => {
    const key = e.interest || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Waitlist</h1>
          <p className="text-sm text-slate-400 mt-1">{entries.length} total signups</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 glass text-slate-300 text-sm rounded-xl hover:text-white border border-white/[0.06]"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Interest Breakdown */}
      {Object.keys(interestCounts).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(interestCounts).map(([key, count]) => (
            <div key={key} className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white font-heading">{count}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{interestLabels[key] || key}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search waitlist..."
          className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 border border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No waitlist entries yet.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Interest</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((entry, i) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-white">{entry.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <a href={`mailto:${entry.email}`} className="text-sm text-blue-400 hover:text-blue-300">
                      {entry.email}
                    </a>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-slate-400">
                      {interestLabels[entry.interest] || entry.interest || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-xs text-slate-500">{format(new Date(entry.createdAt), 'MMM d, yyyy')}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
