'use client'

import '@fontsource-variable/inter'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu, X, User, LayoutDashboard, AppWindow, Sparkles, Brain, Server,
  Bot, Cpu, Archive, Plug, ClipboardList, Bell, Rocket,
} from 'lucide-react'

// ── Nav structure ─────────────────────────────────────────────────────────────
// Grouped for clean sidebar. Groups without a label get no divider.

const NAV_GROUPS: Array<{
  label?: string
  items: Array<{ href: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }>
}> = [
  {
    items: [
      { href: '/admin/dashboard',           label: 'Overview',     icon: LayoutDashboard },
      { href: '/admin/dashboard/workspace', label: 'Workspace',    icon: Sparkles },
    ],
  },
  {
    label: 'Apps',
    items: [
      { href: '/admin/dashboard/apps',        label: 'Apps',        icon: AppWindow },
      { href: '/admin/dashboard/app-agents',  label: 'App Agents',  icon: Bot },
      { href: '/admin/dashboard/onboarding',  label: 'Connect App', icon: Rocket },
      { href: '/admin/dashboard/integrations', label: 'Integrations', icon: Plug },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/admin/dashboard/intelligence', label: 'Intelligence', icon: Brain },
      { href: '/admin/dashboard/models',       label: 'Models',       icon: Cpu },
    ],
  },
  {
    label: 'Output',
    items: [
      { href: '/admin/dashboard/artifacts', label: 'Artifacts', icon: Archive },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/dashboard/operations', label: 'Operations', icon: Server },
      { href: '/admin/dashboard/jobs',       label: 'Jobs',       icon: ClipboardList },
      { href: '/admin/dashboard/alerts',     label: 'Alerts',     icon: Bell },
    ],
  },
]

// Flat list for breadcrumb label lookup
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }, [router])

  const isActive = (href: string) => (href === '/admin/dashboard' ? pathname === href : pathname.startsWith(href))

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-16 border-b border-white/10 px-5">
        <Link href="/admin/dashboard" className="flex h-full items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 px-2 py-1 text-xs font-bold text-white">AN</div>
          <div>
            <p className="text-sm font-bold text-white">Amarktai Network</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Operator Command</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4" aria-label="Dashboard navigation">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'border border-cyan-400/30 bg-cyan-400/10 text-white'
                        : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
          <User className="h-4 w-4 text-cyan-300" />
          <span className="flex-1 text-xs text-slate-300">Operator</span>
          <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-300">Sign out</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#030712]" style={{ fontFamily: "'Inter Variable','Inter',system-ui,-apple-system,sans-serif" }}>
      <aside className={`hidden border-r border-white/10 bg-[#070d1a]/95 lg:block ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#030712]/90 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-2">
              <button className="hidden rounded-lg p-2 text-slate-400 lg:block" onClick={() => setSidebarOpen(v => !v)}>
                <Menu className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-2 text-slate-400 lg:hidden" onClick={() => setMobileOpen(v => !v)}>
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {ALL_NAV_ITEMS.find(s => isActive(s.href))?.label ?? 'Dashboard'}
              </span>
            </div>
            <span className="text-xs text-slate-500">Amarktai Network</span>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-[#070d1a]">{sidebar}</aside>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
