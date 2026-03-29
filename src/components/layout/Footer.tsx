import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const platformLinks = [
  { href: '/apps', label: 'Ecosystem' },
  { href: '/admin/login', label: 'Admin Dashboard' },
  { href: '/docs/api', label: 'Brain API' },
  { href: '/docs', label: 'Documentation' },
]

const companyLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/contact', label: 'Waitlist' },
]

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
]

function FooterLinkItem({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-sm text-slate-500 transition-colors duration-200 hover:text-white"
      >
        {label}
        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 translate-y-0.5 transition-all duration-200 group-hover:opacity-70 group-hover:translate-x-0 group-hover:translate-y-0" />
      </Link>
    </li>
  )
}

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#050816]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -bottom-10 left-1/4 h-40 w-[28rem] rounded-full bg-blue-600/[0.03] blur-[80px]" />
        <div className="absolute -bottom-10 right-1/4 h-40 w-96 rounded-full bg-violet-600/[0.02] blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 md:grid-cols-12 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-4">
            <Link href="/" className="group mb-5 inline-flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight font-heading">
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  AmarktAI
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              The intelligence layer powering a growing ecosystem of connected
              apps. Multi-model orchestration, adaptive execution, and shared
              context&nbsp;— one&nbsp;layer, every&nbsp;app.
            </p>
          </div>

          {/* Platform */}
          <div className="md:col-span-3 lg:col-span-3">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Platform
            </h4>
            <ul className="space-y-2.5">
              {platformLinks.map((l) => (
                <FooterLinkItem key={l.label} href={l.href} label={l.label} />
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-3 lg:col-span-3">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Company
            </h4>
            <ul className="space-y-2.5">
              {companyLinks.map((l) => (
                <FooterLinkItem key={l.label} href={l.href} label={l.label} />
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-2 lg:col-span-2">
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Legal
            </h4>
            <ul className="space-y-2.5">
              {legalLinks.map((l) => (
                <FooterLinkItem key={l.label} href={l.href} label={l.label} />
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-slate-600 font-mono">
            &copy; {new Date().getFullYear()} AmarktAI Network. All rights
            reserved.
          </p>

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400/90 font-mono">
              Status: Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
