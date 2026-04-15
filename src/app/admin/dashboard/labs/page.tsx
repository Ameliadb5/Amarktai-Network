'use client'

/**
 * Labs page — now redirects to the unified Build Studio (Create App tab).
 * Kept as a route so existing bookmarks/links still work.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LabsRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/admin/dashboard/build-studio') }, [router])
  return (
    <div className="flex items-center justify-center py-32 text-sm text-slate-400">
      Redirecting to Build Studio…
    </div>
  )
}
