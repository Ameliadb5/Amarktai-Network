'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /admin/dashboard/models redirects to the Operations page (Models tab).
 * Models management lives under Operations → Models.
 */
export default function ModelsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard/operations')
  }, [router])

  return (
    <div className="flex items-center justify-center py-32">
      <span className="text-sm text-slate-400">Redirecting to Operations → Models…</span>
    </div>
  )
}
