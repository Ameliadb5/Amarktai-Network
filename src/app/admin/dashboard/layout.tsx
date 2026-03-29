'use client'

import '@fontsource-variable/inter'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, AppWindow, Plug, Brain, Layers, Route, BookOpen,
  DollarSign, Bot, Database, Palette, FlaskConical, ShieldAlert, Bell,
  FileText, Server, Mail, Users, LogOut, Menu, X, ChevronRight,
  Sun, Moon, User, PanelLeftClose, PanelLeft,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  color: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Command Center',
    items: [
      { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, color: 'text-blue-400' },
      { href: '/admin/dashboard/apps', label: 'App Registry', icon: AppWindow, color: 'text-cyan-400' },
      { href: '/admin/dashboard/apps/new', label: 'App Onboarding', icon: Plug, color: 'text-emerald-400' },
    ],
  },
  {
    label: 'AI Engine',
    items: [
      { href: '/admin/dashboard/ai-providers', label: 'Providers', icon: Brain, color: 'text-violet-400' },
      { href: '/admin/dashboard/models', label: 'Models', icon: Layers, color: 'text-orange-400' },
      { href: '/admin/dashboard/routing', label: 'Routing', icon: Route, color: 'text-pink-400' },
      { href: '/admin/dashboard/learning', label: 'Learning', icon: BookOpen, color: 'text-emerald-400' },
      { href: '/admin/dashboard/budgets', label: 'Budgets', icon: DollarSign, color: 'text-amber-400' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/admin/dashboard/agents', label: 'Agents', icon: Bot, color: 'text-yellow-400' },
      { href: '/admin/dashboard/memory', label: 'Memory', icon: Database, color: 'text-green-400' },
      { href: '/admin/dashboard/multimodal', label: 'Multimodal', icon: Palette, color: 'text-rose-400' },
      { href: '/admin/dashboard/playground', label: 'Playground', icon: FlaskConical, color: 'text-purple-400' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/admin/dashboard/healing', label: 'Self-Healing', icon: ShieldAlert, color: 'text-lime-400' },
      { href: '/admin/dashboard/alerts', label: 'Alerts', icon: Bell, color: 'text-red-400' },
      { href: '/admin/dashboard/events', label: 'Events', icon: FileText, color: 'text-slate-300' },
      { href: '/admin/dashboard/vps', label: 'VPS', icon: Server, color: 'text-amber-400' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/admin/dashboard/contacts', label: 'Contacts', icon: Mail, color: 'text-pink-400' },
      { href: '/admin/dashboard/waitlist', label: 'Waitlist', icon: Users, color: 'text-indigo-400' },
    ],
  },
]

const allNavItems = navGroups.flatMap((g) => g.items)

/* ─── Pulse indicator ─── */
function StatusPulse({ compact }: { compact?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75" />
      <span className={`relative inline-flex rounded-full h-2 w-2 bg-emerald-400 ${compact ? '' : 'shadow-[0_0_6px_rgba(52,211,153,.6)]'}`} />
    </span>
  )
}

/* ─── Theme toggle ─── */
function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

/* ─── Sidebar (shared between desktop & mobile) ─── */
function SidebarContent({
  collapsed, onClose, theme, onThemeToggle, onLogout,
}: {
  collapsed?: boolean
  onClose?: () => void
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  onLogout: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={`border-b border-white/[0.06] ${collapsed ? 'p-3 flex justify-center' : 'p-5'}`}>
        <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="relative w-9 h-9 shrink-0">
            <Image src="/Amarktai-logo.png" alt="AmarktAI" width={36} height={36} className="rounded-lg object-contain" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white leading-tight whitespace-nowrap">
                Amarkt<span className="text-blue-400">AI</span>
              </p>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Network</p>
            </div>
          )}
        </Link>
      </div>

      {/* Brain status */}
      {!collapsed ? (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-2">
          <StatusPulse />
          <span className="text-[11px] text-emerald-400 font-mono tracking-wide">BRAIN ACTIVE</span>
          <div className="ml-auto flex gap-0.5 items-end" aria-hidden="true">
            {[8, 12, 6, 10, 7].map((h, i) => (
              <div key={i} className="w-1 bg-emerald-500/60 rounded-sm" style={{ height: h }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center mt-3">
          <StatusPulse compact />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 pt-3 pb-2 overflow-y-auto scrollbar-thin" aria-label="Dashboard navigation">
        {navGroups.map((group, gi) => (
          <div key={group.label} className="mb-1">
            {gi > 0 && <div className={`my-2 border-t border-white/[0.04] ${collapsed ? 'mx-1' : 'mx-2'}`} />}
            {!collapsed && (
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase px-3 mb-1 font-semibold">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5" role="list">
              {group.items.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    role="listitem"
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060C1B]
                      ${active
                        ? 'bg-blue-500/15 text-white border border-blue-500/25 shadow-[0_0_12px_-3px_rgba(59,130,246,.3)]'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                      }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${active ? item.color : `group-hover:${item.color}`}`} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {active && !collapsed && <ChevronRight className="w-3 h-3 text-blue-400" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`border-t border-white/[0.06] ${collapsed ? 'p-2 flex flex-col items-center gap-1' : 'p-3 space-y-1'}`}>
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[10px] text-slate-500 font-mono">Theme</span>
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          </div>
        )}
        {collapsed && <ThemeToggle theme={theme} onToggle={onThemeToggle} />}
        <button
          onClick={onLogout}
          title="Sign Out"
          className={`flex items-center ${collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2 w-full'} rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all
            focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-slate-600 font-mono tracking-wide px-3 pt-1 border-t border-white/[0.04]">
            v2.0.0 — Production
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── Main layout ─── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('amarktai-theme') as 'dark' | 'light' | null
      if (saved === 'light' || saved === 'dark') setTheme(saved)
      const sb = localStorage.getItem('amarktai-sidebar')
      if (sb === 'collapsed') setCollapsed(true)
    } catch { /* SSR / restricted */ }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    try { localStorage.setItem('amarktai-theme', theme) } catch { /* noop */ }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((p) => (p === 'dark' ? 'light' : 'dark')), [])

  const toggleSidebar = useCallback(() => {
    setCollapsed((p) => {
      const next = !p
      try { localStorage.setItem('amarktai-sidebar', next ? 'collapsed' : 'expanded') } catch { /* noop */ }
      return next
    })
  }, [])

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }, [router])

  const marginL = collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'

  const currentPage = allNavItems.find((n) => n.href === pathname)
  const currentGroup = navGroups.find((g) => g.items.some((i) => i.href === pathname))

  return (
    <div className="min-h-screen bg-[#050816] dark:bg-[#050816] flex" style={{ fontFamily: "'Inter Variable','Inter',system-ui,-apple-system,sans-serif" }}>
      {/* Background ambience */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/[.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/[.03] rounded-full blur-[100px]" />
      </div>

      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`hidden lg:flex flex-col bg-[#060C1B]/95 backdrop-blur-xl border-r border-white/[0.06] fixed inset-y-0 left-0 z-40 overflow-hidden`}
        aria-label="Sidebar"
      >
        <SidebarContent collapsed={collapsed} theme={theme} onThemeToggle={toggleTheme} onLogout={handleLogout} />
      </motion.aside>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-64 bg-[#060C1B] border-r border-white/[0.06] flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors z-10"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent onClose={() => setMobileOpen(false)} theme={theme} onThemeToggle={toggleTheme} onLogout={handleLogout} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className={`flex-1 ${marginL} relative z-10 transition-[margin] duration-300`}>
        {/* Top bar */}
        <header className="h-14 border-b border-white/[0.06] bg-[#050816]/80 backdrop-blur-xl flex items-center gap-3 px-4 lg:px-5 sticky top-0 z-30">
          {/* Mobile hamburger */}
          <button className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(true)} aria-label="Open sidebar">
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm min-w-0">
            {currentGroup && <span className="text-slate-500 font-medium hidden sm:inline truncate">{currentGroup.label}</span>}
            {currentGroup && currentPage && <ChevronRight className="w-3 h-3 text-slate-600 hidden sm:inline shrink-0" aria-hidden="true" />}
            {currentPage && (
              <div className="flex items-center gap-2 min-w-0">
                <currentPage.icon className={`w-4 h-4 shrink-0 ${currentPage.color}`} />
                <span className="font-semibold text-white truncate">{currentPage.label}</span>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Right section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <StatusPulse compact />
              <span className="text-[11px] text-emerald-400 font-mono tracking-wide">BRAIN ACTIVE</span>
            </div>
            <div className="h-4 w-px bg-white/10 hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white" aria-label="Admin user">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline text-xs text-slate-400 font-medium">Admin</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
              aria-label="Sign out"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 max-w-7xl" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
