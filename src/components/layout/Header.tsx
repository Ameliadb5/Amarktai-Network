'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/apps', label: 'Apps' },
  { href: '/contact', label: 'Contact' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  // Hide header completely on admin pages — the dashboard has its own layout
  const _isAdminPage = pathname.startsWith('/admin')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
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
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
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
                  aria-current={active ? 'page' : undefined}
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
            aria-expanded={menuOpen}
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
            <nav className="px-4 py-5 flex flex-col gap-1" aria-label="Mobile navigation">
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
                  aria-current={pathname === link.href ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-white/5 mt-2">
                <Link
                  href="/contact"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm font-semibold text-center bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg"
                >
                  Get in Touch
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
