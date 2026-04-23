'use client'

/**
 * Media hub — redirects to the Workspace which contains all media tabs
 * (Images, Voice, Video, Music). Kept as a route so existing bookmarks still work.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MediaHubRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/workspace') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Workspace…
    </div>
  )
}
