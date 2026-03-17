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
  title: 'Amarktai Network — The AI Ecosystem',
  description: "Amarktai Network designs and develops AI systems, applications, PWAs, and intelligent automation platforms. Africa's most advanced technology ecosystem.",
  keywords: ['AI', 'technology', 'applications', 'automation', 'digital platforms', 'Africa', 'fintech'],
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
