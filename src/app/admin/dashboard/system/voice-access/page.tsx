'use client'

/**
 * Voice access settings have been removed from this product surface.
 * Phase 3I: redirecting to Settings page where voice/TTS config lives.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function VoiceAccessRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/settings') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Settings…
    </div>
  )
}
