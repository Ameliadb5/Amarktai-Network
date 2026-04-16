'use client'

import '@fontsource-variable/inter'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, AppWindow, Brain, FlaskConical, Settings,
  LogOut, Menu, X, User, Activity, Package, Sparkles,
  Shield, ChevronDown,
  Film, Mic, Music, Workflow, GitBranch, Layers, Server, Cpu,
} from 'lucide-react'

/* ── Grouped navigation structure ───────────────────────────────── */

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

interface NavGroup {
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  accent: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Command Center',
    icon: LayoutDashboard,
    accent: 'text-blue-400',
    items: [
      { href: '/admin/dashboard',         label: 'Overview',    icon: LayoutDashboard },
      { href: '/admin/dashboard/alerts',   label: 'Alerts',      icon: Shield },
    ],
  },
  {
    label: 'Apps',
    icon: AppWindow,
    accent: 'text-cyan-400',
    items: [
      { href: '/admin/dashboard/apps',        label: 'All Apps',     icon: AppWindow },
      { href: '/admin/dashboard/app-agents',   label: 'App Agents',   icon: Cpu },
    ],
  },
  {
    label: 'Studio',
    icon: Sparkles,
    accent: 'text-amber-400',
    items: [
      { href: '/admin/dashboard/build-studio', label: 'Studio',    icon: FlaskConical },
    ],
  },
  {
    label: 'Media',
    icon: Package,
    accent: 'text-pink-400',
    items: [
      { href: '/admin/dashboard/artifacts',    label: 'Artifacts',    icon: Package },
      { href: '/admin/dashboard/music-studio', label: 'Music',        icon: Music },
      { href: '/admin/dashboard/video',        label: 'Video',        icon: Film },
      { href: '/admin/dashboard/voice',        label: 'Voice',        icon: Mic },
    ],
  },
  {
    label: 'Brain',
    icon: Brain,
    accent: 'text-violet-400',
    items: [
      { href: '/admin/dashboard/intelligence', label: 'Intelligence', icon: Brain },
      { href: '/admin/dashboard/models',       label: 'Models',       icon: Layers },
      { href: '/admin/dashboard/emotions',     label: 'Emotions',     icon: Sparkles },
    ],
  },
  {
    label: 'System',
    icon: Server,
    accent: 'text-slate-400',
    items: [
      { href: '/admin/dashboard/operations',   label: 'Providers',    icon: Server },
      { href: '/admin/dashboard/jobs',         label: 'Jobs',         icon: Workflow },
      { href: '/admin/dashboard/events',       label: 'Events',       icon: Activity },
      { href: '/admin/dashboard/integrations', label: 'Integrations', icon: GitBranch },
      { href: '/admin/dashboard/access',       label: 'Settings',     icon: Settings },
    ],
  },
]

/* Flat list for breadcrumbs */
const flatNavItems = navGroups.flatMap(g => g.items)

/* ── Component ───────────────────────────────────────────────────── */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }, [router])

  const isActive = (href: string) =>
    href === '/admin/dashboard' ? pathname === href : pathname.startsWith(href)

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-white/[0.06]">
        <Link href="/admin/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-none">
              <span className="text-white">Amarkt</span>
              <span className="text-blue-400">AI</span>
            </span>
            <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase leading-none mt-0.5">Command Center</span>
          </div>
        </Link>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Dashboard navigation">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label)
          const hasActive = group.items.some(i => isActive(i.href))
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold rounded-lg transition-colors
                  ${hasActive ? group.accent : 'text-slate-500 hover:text-slate-300'}`}
              >
                <div className="flex items-center gap-2">
                  <group.icon className="w-3 h-3" />
                  <span>{group.label}</span>
                </div>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 mx-1 my-0.5
                            ${active
                              ? 'text-white bg-white/[0.06] border border-white/[0.08]'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                            }`}
                        >
                          <item.icon className={`w-4 h-4 shrink-0 ${active ? group.accent : ''}`} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-white font-medium block truncate">Operator</span>
            <span className="text-[10px] text-slate-500">Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="min-h-screen bg-[#030712] flex"
      style={{ fontFamily: "'Inter Variable','Inter',system-ui,-apple-system,sans-serif" }}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#0a0f1c]/80 backdrop-blur-2xl border-r border-white/[0.06] transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'
        }`}
        style={{ position: 'sticky', top: 0, height: '100vh' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030712]/80 backdrop-blur-2xl">
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                className="hidden lg:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                onClick={() => setSidebarOpen(v => !v)}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <Menu className="w-4 h-4" />
              </button>
              <button
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.04] transition-colors"
                onClick={() => setMobileOpen(v => !v)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              {/* Mobile brand */}
              <Link href="/admin/dashboard" className="lg:hidden flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                  <span className="text-white">Amarkt</span>
                  <span className="text-blue-400">AI</span>
                </span>
              </Link>
            </div>

            {/* Breadcrumb */}
            <div className="hidden sm:flex items-center text-xs text-slate-500">
              {(() => {
                const activeItem = flatNavItems.find(i => isActive(i.href))
                const activeGroup = navGroups.find(g => g.items.some(i => isActive(i.href)))
                if (!activeItem) return null
                return (
                  <span className="flex items-center gap-1.5">
                    {activeGroup && <span className="text-slate-600">{activeGroup.label}</span>}
                    {activeGroup && <span className="text-slate-700">/</span>}
                    <span className="text-slate-400 font-medium">{activeItem.label}</span>
                  </span>
                )
              })()}
            </div>

            {/* Desktop: user */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-400 font-medium">Operator</span>
              <button
                onClick={handleLogout}
                className="ml-1 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Mobile drawer overlay ── */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0a0f1c] border-r border-white/[0.06] lg:hidden"
              >
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Content ── */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto w-full" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
