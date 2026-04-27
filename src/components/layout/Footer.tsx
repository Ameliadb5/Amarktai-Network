import Link from 'next/link'

const columns = [
  {
    heading: 'Platform',
    links: [
      { href: '/', label: 'Platform' },
      { href: '/about', label: 'Architecture' },
      { href: '/apps', label: 'Capabilities' },
      { href: '/docs', label: 'API Reference' },
    ],
  },
  {
    heading: 'Access',
    links: [
      { href: '/contact', label: 'Request Access' },
      { href: '/apps', label: 'Capability Surfaces' },
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
            <p className="text-lg font-bold text-white">
              Amarkt<span className="text-blue-400">AI</span> Network
            </p>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              Multi-provider AI orchestration for real products: one routing brain, one capability engine, one operator console.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading} className="md:col-span-2">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{column.heading}</h4>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
          © {new Date().getFullYear()} Amarkt<span className="text-blue-400/70">AI</span> Network. Operator-grade AI infrastructure.
        </div>
      </div>
    </footer>
  )
}
