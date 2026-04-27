import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getFileTree, getFileContent } from '@/lib/github-integration'

/**
 * POST /api/admin/github/import
 *
 * Import a public or private repo by URL.
 * - Public repos: fetches without token via GitHub raw API, or uses stored token if available.
 * - Private repos: requires GitHub token configured in Settings.
 *
 * Body:
 *   repoUrl    string  — full GitHub URL, e.g. https://github.com/owner/repo
 *   branch     string? — branch to fetch (default: main)
 *   fetchTree  boolean? — whether to also return the file tree (default: true)
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { repoUrl, branch = 'main', fetchTree = true } = body

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 })
    }

    // Parse owner/repo from URL
    // Accepts: https://github.com/owner/repo[.git][/...]
    const match = repoUrl.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/)
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' },
        { status: 400 },
      )
    }

    const owner = match[1]
    const repoName = match[2].replace(/\.git$/, '')
    const repoFullName = `${owner}/${repoName}`

    // Validate owner and repoName contain only safe characters to prevent injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repoName)) {
      return NextResponse.json({ error: 'Invalid repository owner or name format' }, { status: 400 })
    }

    // Get public repo info via GitHub public API (no token needed for public repos)
    // URL is always api.github.com — no user-controlled host in the URL
    const githubApiUrl = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`)
    if (githubApiUrl.hostname !== 'api.github.com') {
      return NextResponse.json({ error: 'Invalid GitHub API URL' }, { status: 400 })
    }
    const repoInfoRes = await fetch(
      githubApiUrl.href,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Amarktai-Network/1.0',
        },
        next: { revalidate: 0 },
      },
    )

    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        return NextResponse.json(
          { error: 'Repository not found. For private repos, configure a GitHub token in Settings.' },
          { status: 404 },
        )
      }
      return NextResponse.json(
        { error: `Failed to fetch repository info (HTTP ${repoInfoRes.status})` },
        { status: repoInfoRes.status },
      )
    }

    const repoInfo = await repoInfoRes.json()
    const defaultBranch: string = repoInfo.default_branch ?? 'main'
    const targetBranch = branch || defaultBranch

    const result: {
      repoFullName: string
      owner: string
      name: string
      url: string
      defaultBranch: string
      targetBranch: string
      description: string | null
      private: boolean
      tree?: { path: string; type: string; sha: string; size?: number; url: string }[]
      truncated?: boolean
      treeError?: string
    } = {
      repoFullName,
      owner,
      name: repoName,
      url: repoInfo.html_url ?? `https://github.com/${repoFullName}`,
      defaultBranch,
      targetBranch,
      description: repoInfo.description ?? null,
      private: repoInfo.private ?? false,
    }

    // Optionally fetch the file tree
    if (fetchTree) {
      const treeResult = await getFileTree(repoFullName, targetBranch, true)
      if (treeResult.error) {
        result.treeError = treeResult.error
        result.tree = []
        result.truncated = false
      } else {
        result.tree = treeResult.tree
        result.truncated = treeResult.truncated
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Import failed' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/admin/github/import
 * Quick repo info lookup by URL query param.
 * ?url=https://github.com/owner/repo&branch=main
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const repoUrl = searchParams.get('url')
  const branch = searchParams.get('branch') ?? 'main'
  const path = searchParams.get('path') // optional: fetch single file content

  if (!repoUrl) {
    return NextResponse.json({ error: 'url query param is required' }, { status: 400 })
  }

  const match = repoUrl.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/)
  if (!match) {
    return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
  }

  const owner = match[1]
  const repoName = match[2].replace(/\.git$/, '')
  const repoFullName = `${owner}/${repoName}`

  try {
    if (path) {
      // Fetch single file content
      const fileResult = await getFileContent(repoFullName, branch, path)
      if (fileResult.error) {
        return NextResponse.json({ error: fileResult.error }, { status: 404 })
      }
      return NextResponse.json(fileResult)
    }

    // Fetch file tree
    const treeResult = await getFileTree(repoFullName, branch, true)
    return NextResponse.json({
      repoFullName,
      branch,
      ...treeResult,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    )
  }
}
