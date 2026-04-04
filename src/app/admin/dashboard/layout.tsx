'use client'

import '@fontsource-variable/inter'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, AppWindow, Brain, Palette, Server, FlaskConical, Settings,
  LogOut, Menu, X, User, Code2, Heart,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const navItems: NavItem[] = [
  { href: '/admin/dashboard',              label: 'Overview',      icon: LayoutDashboard },
  { href: '/admin/dashboard/apps',         label: 'Apps',          icon: AppWindow },
  { href: '/admin/dashboard/intelligence', label: 'Intelligence',  icon: Brain },
  { href: '/admin/dashboard/emotions',     label: 'Emotions',      icon: Heart },
  { href: '/admin/dashboard/media',        label: 'Media',         icon: Palette },
  { href: '/admin/dashboard/operations',   label: 'Operations',    icon: Server },
  { href: '/admin/dashboard/lab',          label: 'Lab',           icon: FlaskConical },
  { href: '/admin/dashboard/labs',         label: 'Labs',          icon: Code2 },
  { href: '/admin/dashboard/access',       label: 'Access',        icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }, [router])

  const isActive = (href: string) =>
    href === '/admin/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <div
      className="min-h-screen bg-[#050810]"
      style={{ fontFamily: "'Inter Variable','Inter',system-ui,-apple-system,sans-serif" }}
    >
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          {/* Left: Brand */}
          <Link href="/admin/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">
              <span className="text-white">Amarkt</span>
              <span className="text-blue-500">AI</span>
              <span className="text-white ml-1">Network</span>
            </span>
          </Link>

          {/* Center: Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200
                    ${active
                      ? 'text-white bg-blue-500/10 border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right: User + logout (desktop) / hamburger (mobile) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-slate-400 font-medium">Admin</span>
              <button
                onClick={handleLogout}
                className="ml-1 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden overflow-hidden border-t border-white/[0.06] bg-[#0a0f1a]/95 backdrop-blur-xl"
            >
              <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Mobile navigation">
                {navItems.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200
                        ${active
                          ? 'text-white bg-blue-500/10 border border-blue-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                        }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-blue-400' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}

                {/* Mobile user section */}
                <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-3 px-3 py-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-slate-400 font-medium flex-1">Admin</span>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6 lg:py-8" role="main">
        {children}
      </main>
    </div>
  )
}
