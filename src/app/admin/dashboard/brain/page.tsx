'use client'

/**
 * Brain hub — redirects to Intelligence (the real operator surface).
 * Kept as a route so existing bookmarks still work.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrainHubRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/intelligence') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Intelligence…
    </div>
  )
}
