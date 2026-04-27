/**
 * POST /api/admin/settings/test-github
 * Validates the stored GitHub token and returns repo count.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateGitHubToken } from '@/lib/github-integration'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await validateGitHubToken()

    if (!result.valid) {
      return NextResponse.json({
        success: false,
        username: null,
        repoCount: null,
        error: result.error ?? 'GitHub token validation failed',
      })
    }

    // Fetch repo count
    let repoCount: number | null = null
    try {
      const config = await prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } })
      if (config?.accessToken) {
        const res = await fetch('https://api.github.com/user/repos?per_page=1&page=1', {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          // Parse Link header to find last page
          const link = res.headers.get('link') ?? ''
          const lastMatch = link.match(/page=(\d+)>; rel="last"/)
          if (lastMatch) {
            repoCount = parseInt(lastMatch[1], 10)
          } else {
            const data = await res.json()
            repoCount = Array.isArray(data) ? data.length : null
          }
        }
      }
    } catch { /* repo count is best-effort */ }

    return NextResponse.json({
      success: true,
      username: result.username,
      repoCount,
      error: null,
    })
  } catch (e) {
    return NextResponse.json({
      success: false,
      username: null,
      repoCount: null,
      error: e instanceof Error ? e.message : 'Test failed',
    })
  }
}
