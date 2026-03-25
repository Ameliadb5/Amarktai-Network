import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import '@fontsource-variable/space-grotesk'
import CommandBar from '@/components/CommandBar'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Amarktai Network — Central Nervous System for Connected Apps',
  description: "Amarktai Network is the central nervous system for a growing ecosystem of connected apps. Multi-model AI orchestration, shared intelligence layer, centralized monitoring, and self-healing automation — all routed through one CNS.",
  keywords: ['AI operations', 'AI orchestration', 'multi-model AI', 'AI operating layer', 'Africa', 'connected apps', 'AI monitoring', 'shared intelligence'],
  authors: [{ name: 'Amarktai Network' }],
  robots: 'index, follow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <CommandBar />
      </body>
    </html>
  )
}
