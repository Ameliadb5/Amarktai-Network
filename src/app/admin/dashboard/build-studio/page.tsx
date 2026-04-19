'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BuildStudioRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/dashboard/workspace')
  }, [router])

  return <div className="py-24 text-center text-sm text-slate-400">Redirecting to Workspace…</div>
}
