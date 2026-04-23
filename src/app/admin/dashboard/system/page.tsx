'use client'

/**
 * System hub — redirects to Operations (the real operator surface).
 * Kept as a route so existing bookmarks still work.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SystemHubRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/operations') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Operations…
    </div>
  )
}
