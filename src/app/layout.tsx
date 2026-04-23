import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import '@fontsource-variable/space-grotesk'

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
  title: 'Amarktai Network — Multi-Provider AI Operating System',
  description: 'Amarktai Network is a multi-provider AI orchestration platform with routing intelligence, operator controls, and production-ready capability surfaces for real applications.',
  keywords: ['AI orchestration', 'multi-provider AI', 'AI operating system', 'Amarktai Network', 'model routing', 'AI operator console', 'artifact workflows'],
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
      </body>
    </html>
  )
}
