import Link from 'next/link'

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { href: '/', label: 'Home' },
      { href: '/apps', label: 'Ecosystem' },
      { href: '/docs', label: 'API Docs' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
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
    <footer className="border-t border-white/[0.06] bg-[#050810]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12 lg:gap-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-5">
            <Link href="/" className="inline-flex items-center">
              <span className="text-lg font-bold tracking-tight font-heading">
                <span className="text-white">Amarkt</span>
                <span className="text-blue-500">AI</span>
              </span>
              <span className="text-lg font-bold tracking-tight font-heading text-white ml-1.5">
                Network
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              The intelligence layer powering a growing ecosystem of connected
              applications.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.heading} className="md:col-span-2">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={`${col.heading}-${l.href}`}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-500 transition-colors duration-200 hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="my-10 h-px w-full bg-white/[0.06]" />

        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} AmarktAI Network. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
