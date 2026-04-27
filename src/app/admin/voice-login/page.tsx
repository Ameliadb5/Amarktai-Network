'use client'

/**
 * Voice login is disabled — redirects to standard admin login.
 * Phase 3I: dead route removed per CRITICAL RULES.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceLoginRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/login') }, [router])
  return (
    <div className="min-h-screen bg-[#030a18] flex items-center justify-center text-sm text-slate-400">
      Redirecting to login…
    </div>
  )
}
