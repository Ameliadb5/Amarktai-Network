import Link from 'next/link'

const columns = [
  {
    heading: 'Platform',
    links: [
      { href: '/', label: 'Home' },
      { href: '/apps', label: 'Ecosystem' },
      { href: '/about', label: 'Architecture' },
    ],
  },
  {
    heading: 'Access',
    links: [
      { href: '/contact', label: 'Request Access' },
      { href: '/admin/login', label: 'Operator Login' },
      { href: '/voice-access', label: 'Voice Access Preview' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#020711]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-lg font-bold text-white">Amarktai Network</p>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              The operator-grade AI operating system for app creation, orchestration, automation, and multimodal production.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading} className="md:col-span-2">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{column.heading}</h4>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-slate-400 hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
          © {new Date().getFullYear()} Amarktai Network. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
