'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The legacy "Execution Config / Setup Matrix" page.
 * AI provider configuration has been consolidated into the AI Providers page.
 * This redirect ensures any existing links / bookmarks continue to work.
 */
export default function ConfigRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/dashboard/ai-providers')
  }, [router])
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-slate-500">Redirecting to AI Provider Setup…</p>
    </div>
  )
}
