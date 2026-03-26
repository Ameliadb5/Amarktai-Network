'use client'

import '@fontsource-variable/inter'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Plug, Mail, Users, LogOut,
  Menu, X, ChevronRight, Server, Activity, Shield,
  Brain, MessageSquare, Bell, FileText, AppWindow, BookOpen,
  Route, Zap, Database, Palette, CheckCircle, Layers,
  FlaskConical, Github, FolderOpen, DollarSign, ShieldAlert, Bot,
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
    label: 'Operations',
    items: [
      { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, color: 'text-blue-400' },
      { href: '/admin/dashboard/apps', label: 'App Registry', icon: AppWindow, color: 'text-cyan-400' },
      { href: '/admin/dashboard/integrations', label: 'App Integrations', icon: Plug, color: 'text-emerald-400' },
    ],
  },
  {
    label: 'AI Execution',
    items: [
      { href: '/admin/dashboard/ai-providers', label: 'AI Providers', icon: Brain, color: 'text-violet-400' },
      { href: '/admin/dashboard/budgets', label: 'Budgets', icon: DollarSign, color: 'text-amber-400' },
      { href: '/admin/dashboard/models', label: 'Model Registry', icon: Layers, color: 'text-orange-400' },
      { href: '/admin/dashboard/routing', label: 'Routing Policies', icon: Route, color: 'text-pink-400' },
      { href: '/admin/dashboard/ai-usage', label: 'AI Usage', icon: Activity, color: 'text-blue-400' },
      { href: '/admin/dashboard/brain-chat', label: 'Gateway Test', icon: MessageSquare, color: 'text-cyan-400' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/admin/dashboard/agent-workspace', label: 'Agent Workspace', icon: Bot, color: 'text-yellow-400' },
      { href: '/admin/dashboard/agents', label: 'Agent Activity', icon: Zap, color: 'text-orange-400' },
      { href: '/admin/dashboard/memory', label: 'Memory & Retrieval', icon: Database, color: 'text-green-400' },
      { href: '/admin/dashboard/multimodal', label: 'Multimodal Services', icon: Palette, color: 'text-rose-400' },
      { href: '/admin/dashboard/learning', label: 'Learning', icon: BookOpen, color: 'text-emerald-400' },
    ],
  },
  {
    label: 'Developer',
    items: [
      { href: '/admin/dashboard/playground', label: 'Playground', icon: FlaskConical, color: 'text-purple-400' },
      { href: '/admin/dashboard/projects', label: 'Projects', icon: FolderOpen, color: 'text-blue-400' },
      { href: '/admin/dashboard/dev-workspace', label: 'Dev Workspace', icon: Github, color: 'text-slate-300' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/admin/dashboard/healing', label: 'Self-Healing', icon: ShieldAlert, color: 'text-lime-400' },
      { href: '/admin/dashboard/readiness', label: 'Go-Live Readiness', icon: CheckCircle, color: 'text-emerald-400' },
      { href: '/admin/dashboard/vps', label: 'VPS Monitoring', icon: Server, color: 'text-amber-400' },
      { href: '/admin/dashboard/alerts', label: 'Alerts', icon: Bell, color: 'text-red-400' },
      { href: '/admin/dashboard/events', label: 'Events & Logs', icon: FileText, color: 'text-slate-400' },
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

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
          <div className="relative w-9 h-9 flex-shrink-0">
            <Image
              src="/Amarktai-logo.png"
              alt="AmarktAI Network"
              width={36}
              height={36}
              className="rounded-xl object-contain"
            />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span>
            </p>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Network</p>
          </div>
        </Link>
      </div>

      {/* System status */}
      <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-xs text-emerald-400 font-mono">AMARKTAI NETWORK ACTIVE</span>
        <div className="ml-auto flex gap-0.5 items-end">
          {[8, 12, 6, 10, 7].map((h, b) => (
            <div key={b} className="w-1 bg-emerald-500/70 rounded-sm" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 mt-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      active
                        ? 'bg-blue-500/12 text-white border border-blue-500/20'
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? item.color : 'group-hover:' + item.color}`} />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="w-3 h-3 text-blue-400" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <Shield className="w-3.5 h-3.5" />
          View Public Site
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentPage = allNavItems.find((n) => n.href === pathname)

  return (
    <div
      className="min-h-screen bg-[#050816] flex"
      style={{ fontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif" }}
    >
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/3 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/3 rounded-full blur-[100px]" />
        <div className="absolute inset-0 grid-bg opacity-[0.15]" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-[#080E1C]/90 backdrop-blur-xl border-r border-white/5 fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 flex"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <motion.div
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-64 bg-[#080E1C] border-r border-white/5 flex flex-col"
            >
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 relative z-10">
        {/* Top Bar */}
        <div className="h-14 border-b border-white/5 bg-[#050816]/80 backdrop-blur-xl flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {currentPage && (
              <>
                <currentPage.icon className={`w-4 h-4 ${currentPage.color}`} />
                <span className="text-sm font-semibold text-white">{currentPage.label}</span>
              </>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400 font-mono">System Online</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 lg:p-6 max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  )
}
