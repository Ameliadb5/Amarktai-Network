import Link from 'next/link'
import { Zap, Twitter, Linkedin, Github, ArrowRight } from 'lucide-react'

const ecosystem = [
  'Amarktai Crypto', 'Amarktai Forex', 'Faith Haven',
  'Learn Digital', 'Jobs SA', 'Kinship', 'Amarktai Secure', 'Crowd Lens',
]

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#050816] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-blue-600/4 rounded-full blur-[60px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-32 bg-violet-600/3 rounded-full blur-[60px]" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <Link href="/" className="flex items-center gap-2.5 mb-5 group w-fit">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-violet-500 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" fill="white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 blur-md opacity-30 group-hover:opacity-50 transition-opacity" />
              </div>
              <div>
                <span className="font-bold text-base block leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  <span className="gradient-text-blue-cyan">Amarktai</span>
                  <span className="text-slate-400 ml-1.5 font-light">Network</span>
                </span>
                <span className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">AI Ecosystem</span>
              </div>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-6">
              Designing and developing AI systems, applications, and intelligent automation platforms for a connected world.
            </p>
            <div className="flex gap-2.5">
              {[
                { Icon: Twitter, href: '#' },
                { Icon: Linkedin, href: '#' },
                { Icon: Github, href: '#' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-8 h-8 glass rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:border-blue-500/30 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold text-white mb-4 tracking-wider uppercase font-mono">Company</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/about', label: 'About' },
                { href: '/apps', label: 'Apps' },
                { href: '/contact', label: 'Contact' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-white transition-colors group flex items-center gap-1">
                    {l.label}
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ecosystem */}
          <div className="md:col-span-6">
            <h4 className="text-xs font-semibold text-white mb-4 tracking-wider uppercase font-mono">Ecosystem</h4>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
              {ecosystem.map(app => (
                <span key={app} className="text-sm text-slate-600 font-mono text-xs">{app}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="section-divider mb-8" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600 font-mono">
            © {new Date().getFullYear()} Amarktai Network. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-700 font-mono cursor-default hover:text-slate-500 transition-colors">Privacy Policy</span>
            <span className="text-xs text-slate-700 font-mono cursor-default hover:text-slate-500 transition-colors">Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
