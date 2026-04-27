/**
 * POST /api/admin/settings/test-github
 *
 * Test the GitHub token using the provided (or stored) personal access token.
 * Returns real results — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Accept inline token from form (not-yet-saved values)
  let inlineToken = ''
  try {
    const body = await req.json()
    inlineToken = typeof body.token === 'string' ? body.token.trim() : ''
  } catch { /* ignore */ }

  // Resolve token: inline > DB
  let token = inlineToken
  if (!token) {
    try {
      const row = await prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } })
      token = row?.accessToken ?? ''
    } catch { /* ignore */ }
  }

  if (!token) {
    return NextResponse.json({
      success: false,
      valid: false,
      error: 'No GitHub token configured',
    })
  }

  const start = Date.now()
  try {
    const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(10_000),
      })

    const latencyMs = Date.now() - start

    if (!userRes.ok) {
      return NextResponse.json({
        success: false,
        valid: false,
        error: userRes.status === 401 ? 'Token is invalid or expired' : `GitHub API returned HTTP ${userRes.status}`,
        latencyMs,
      })
    }

    const userData = await userRes.json() as {
      login?: string
      name?: string
      public_repos?: number
      total_private_repos?: number
      avatar_url?: string
    }

    const repoCount = (userData.public_repos ?? 0) + (userData.total_private_repos ?? 0)

    // Update stored username if using the stored token (not inline)
    if (!inlineToken) {
      try {
        const row = await prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } })
        if (row && userData.login) {
          await prisma.gitHubConfig.update({
            where: { id: row.id },
            data: {
              username: userData.login,
              lastValidatedAt: new Date(),
            },
          })
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      success: true,
      valid: true,
      username: userData.login ?? null,
      name: userData.name ?? null,
      repoCount,
      latencyMs,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      valid: false,
      error: err instanceof Error ? err.message : 'Connection failed',
      latencyMs: Date.now() - start,
    })
  }
}
