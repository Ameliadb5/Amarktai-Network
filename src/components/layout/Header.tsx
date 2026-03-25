'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Lock, ChevronRight } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/apps', label: 'Apps' },
  { href: '/contact', label: 'Contact' },
]

const TRIGGER_PHRASE = 'show admin'

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminRevealed, setAdminRevealed] = useState(false)
  const [showAdminHint, setShowAdminHint] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null)
  const typedPhraseRef = useRef('')
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isAdminPage = pathname.startsWith('/admin')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Hidden admin discovery: listen for typing "show admin" anywhere on page
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only on non-input elements
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (isAdminPage) return

    const key = e.key.toLowerCase()
    if (key.length === 1) {
      typedPhraseRef.current = (typedPhraseRef.current + key).slice(-TRIGGER_PHRASE.length)
      if (typedPhraseRef.current === TRIGGER_PHRASE) {
        setAdminRevealed(true)
        setShowAdminHint(true)
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
        hintTimerRef.current = setTimeout(() => setShowAdminHint(false), 8000)
        typedPhraseRef.current = ''
      }
      // Reset partial phrase after 3s of inactivity
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => { typedPhraseRef.current = '' }, 3000)
    }
  }, [isAdminPage])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [handleKeyDown])

  const dismissHint = () => {
    setShowAdminHint(false)
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
  }

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'glass-strong border-b border-blue-500/10 shadow-xl shadow-black/30'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 flex-shrink-0">
                <Image
                  src="/Amarktai-logo.png"
                  alt="AmarktAI Network"
                  width={36}
                  height={36}
                  className="rounded-xl object-contain transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="font-bold text-base leading-tight tracking-tight font-heading">
                  <span className="text-white">Amarkt</span><span className="text-blue-400">AI</span>
                  <span className="text-slate-300 ml-1.5 font-light">Network</span>
                </span>

              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      active
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-white/8 rounded-lg border border-white/10"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                )
              })}
              {(adminRevealed || isAdminPage) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className="ml-1"
                >
                  <Link
                    href="/admin/login"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-400 border border-violet-500/30 rounded-lg bg-violet-500/8 hover:bg-violet-500/15 hover:border-violet-500/50 transition-all"
                  >
                    <Lock className="w-3 h-3" />
                    Admin
                  </Link>
                </motion.div>
              )}
            </nav>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/contact"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-all hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
              >
                Get in Touch
              </Link>
            </div>

            {/* Mobile Button */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden glass-strong border-t border-blue-500/10"
            >
              <div className="px-4 py-5 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? 'text-white bg-white/8 border border-white/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {(adminRevealed || isAdminPage) && (
                  <Link
                    href="/admin/login"
                    onClick={() => setMenuOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-violet-400 border border-violet-500/20 bg-violet-500/8 flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Admin Access
                  </Link>
                )}
                <div className="pt-3 border-t border-white/5 mt-2">
                  <Link
                    href="/contact"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm font-semibold text-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg"
                  >
                    Get in Touch
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Hidden Admin Reveal Notification */}
      <AnimatePresence>
        {showAdminHint && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-24 left-1/2 z-[100] pointer-events-none"
            style={{ transform: 'translateX(-50%)' }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/40 bg-[#0A0F22]/95 backdrop-blur-xl shadow-2xl shadow-violet-500/20 px-6 py-4 min-w-[300px]">
              {/* Scanning line animation */}
              <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-pulse" style={{ top: '0' }} />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0 border border-violet-500/30">
                  <Lock className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="font-heading text-sm font-semibold text-white">
                    Access path revealed
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Administrative portal is now visible in navigation.</p>
                  <button
                    onClick={() => { dismissHint(); router.push('/admin/login') }}
                    className="pointer-events-auto mt-2 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  >
                    Proceed to secure login <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" style={{ bottom: '0' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
