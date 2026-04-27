'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Platform' },
  { href: '/about', label: 'Architecture' },
  { href: '/apps', label: 'Capabilities' },
  { href: '/docs', label: 'API' },
  { href: '/contact', label: 'Access' },
]

/** Reveal operator login when user types the word "login" anywhere on the page (non-input). */
function useLoginReveal() {
  const [revealed, setRevealed] = useState(false)
  const bufRef = useRef('')
  useEffect(() => {
    if (revealed) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.length !== 1) return
      bufRef.current = (bufRef.current + e.key).toLowerCase().slice(-6)
      if (bufRef.current.includes('login')) setRevealed(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [revealed])
  return revealed
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const loginRevealed = useLoginReveal()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  if (pathname.startsWith('/admin')) return null

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'glass-strong' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand — AI styled blue */}
        <Link href="/" className="flex items-center gap-2" aria-label="Amarktai Network">
          <span className="text-base font-bold tracking-tight text-white">
            Amarkt<span className="text-blue-400">AI</span> Network
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <Link key={link.href} href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <AnimatePresence>
            {loginRevealed && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
              >
                <Link href="/admin/login" className="text-sm text-slate-400 hover:text-white transition">
                  Operator Login
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            Request Access <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <button className="rounded-lg p-2 text-slate-400 md:hidden" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/10 bg-[#050b1b]/95 md:hidden"
          >
            <nav className="space-y-2 px-4 py-4">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                  {link.label}
                </Link>
              ))}
              {loginRevealed && (
                <Link href="/admin/login"
                  className="block rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">
                  Operator Login
                </Link>
              )}
              <Link href="/contact"
                className="mt-2 block rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-2 text-center text-sm font-semibold text-white">
                Request Access
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
