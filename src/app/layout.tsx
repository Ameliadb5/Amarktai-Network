import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
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
  title: 'Amarktai Network — The AI Command Center',
  description: "Amarktai Network is the central nervous system for AI operations. Multi-model orchestration, shared memory, monitoring, and automation across connected apps. Africa's premier AI operations platform.",
  keywords: ['AI operations', 'AI orchestration', 'multi-model AI', 'AI operating layer', 'Africa', 'connected apps', 'AI monitoring'],
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
