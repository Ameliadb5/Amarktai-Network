'use client'

/**
 * Voice enrollment is no longer part of this product.
 * Phase 3I: redirecting to Settings.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceEnrollmentRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/settings') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Settings…
    </div>
  )
}
