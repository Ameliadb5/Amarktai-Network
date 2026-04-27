/**
 * GET /api/admin/github/import-public
 *
 * Import the file tree of a PUBLIC GitHub repository by URL.
 * Does not require a stored GitHub token — uses the public GitHub API
 * (unauthenticated, rate-limited to 60 req/hr per IP).
 * If a stored token is configured, it is used to increase the rate limit.
 *
 * Query params:
 *   url    — full GitHub repo URL, e.g. https://github.com/owner/repo
 *   branch — optional branch name (default: auto-detect from API)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getGitHubConfig } from '@/lib/github-integration'

const GITHUB_API = 'https://api.github.com'

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/, '')
    // Validate: owner and repo must be safe identifiers
    if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) return null
    return { owner, repo }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const repoUrl = searchParams.get('url')
  const branchParam = searchParams.get('branch')

  if (!repoUrl) {
    return NextResponse.json({ error: 'url query param is required (e.g. https://github.com/owner/repo)' }, { status: 400 })
  }

  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid GitHub URL. Expected https://github.com/owner/repo' }, { status: 400 })
  }

  const { owner, repo } = parsed

  // Build auth headers — use stored token if available (increases rate limit)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Amarktai-Network/1.0',
  }

  try {
    const config = await getGitHubConfig()
    if (config?.accessToken) {
      headers['Authorization'] = `Bearer ${config.accessToken}`
    }
  } catch {
    // No token — proceed unauthenticated (public repos only)
  }

  try {
    // 1. Fetch repo metadata to get the default branch
    const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (repoRes.status === 404) {
      return NextResponse.json({ error: `Repository ${owner}/${repo} not found or is private. Only public repositories can be imported without a GitHub token.` }, { status: 404 })
    }

    if (!repoRes.ok) {
      const err = await repoRes.json().catch(() => ({})) as { message?: string }
      return NextResponse.json({ error: `GitHub API error: ${err.message ?? repoRes.statusText}` }, { status: repoRes.status })
    }

    const repoData = await repoRes.json() as {
      full_name: string
      name: string
      description: string | null
      default_branch: string
      private: boolean
      html_url: string
      language: string | null
      stargazers_count: number
      forks_count: number
    }

    if (repoData.private) {
      return NextResponse.json({
        error: 'This repository is private. Configure a GitHub personal access token in Settings to access private repos.',
        requiresToken: true,
      }, { status: 403 })
    }

    const branch = branchParam || repoData.default_branch

    // 2. Fetch file tree (recursive)
    const treeRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, signal: AbortSignal.timeout(15_000) },
    )

    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({})) as { message?: string }
      return NextResponse.json({ error: `Failed to fetch file tree: ${err.message ?? treeRes.statusText}` }, { status: treeRes.status })
    }

    const treeData = await treeRes.json() as {
      sha: string
      truncated: boolean
      tree: Array<{ path: string; type: string; size?: number; sha: string }>
    }

    // Filter to files only (not directories), exclude binary-likely extensions
    const files = treeData.tree
      .filter(item => item.type === 'blob')
      .map(item => ({
        path: item.path,
        sha: item.sha,
        size: item.size ?? 0,
      }))

    return NextResponse.json({
      success: true,
      repo: {
        fullName: repoData.full_name,
        name: repoData.name,
        description: repoData.description,
        defaultBranch: repoData.default_branch,
        branch,
        htmlUrl: repoData.html_url,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      files,
      fileCount: files.length,
      truncated: treeData.truncated,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to import repository' },
      { status: 500 },
    )
  }
}
