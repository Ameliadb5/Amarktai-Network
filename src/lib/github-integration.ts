/**
 * GitHub Integration — AmarktAI Network
 *
 * Admin-only GitHub integration for the Developer Workspace.
 * Allows admins to:
 *  - Store a GitHub personal access token securely
 *  - Link playground projects to GitHub repos
 *  - Create branches, commit files, and push to GitHub
 *  - Track all push actions in an audit log
 *
 * Auth uses a stored Personal Access Token (PAT), NOT OAuth.
 * This is intentional for a single-admin system.
 *
 * Server-side only.
 */

import { prisma } from '@/lib/prisma'

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubConfigData {
  id: number
  username: string
  accessTokenMasked: string   // only last 4 chars shown
  defaultOwner: string
  configured: boolean
  lastValidatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GitHubRepo {
  full_name: string
  name: string
  private: boolean
  html_url: string
  default_branch: string
  description: string | null
}

export interface GitHubPushInput {
  projectId: number
  repoFullName: string         // e.g. "owner/repo"
  branch: string               // e.g. "amarktai/playground-export"
  commitMessage: string
  files: Array<{
    path: string               // path in repo, e.g. "projects/my-project/prompt.md"
    content: string            // UTF-8 text content
  }>
}

export interface GitHubPushResult {
  success: boolean
  commitSha: string | null
  commitUrl: string | null
  branch: string
  filesChanged: number
  error: string | null
  pushedAt: string
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  try {
    const config = await prisma.gitHubConfig.findFirst({
      orderBy: { id: 'desc' },
    })
    return config?.accessToken ?? null
  } catch {
    return null
  }
}

async function githubFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `https://api.github.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  })

  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = {}
  }

  return { ok: res.ok, status: res.status, body }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getGitHubConfig(): Promise<GitHubConfigData | null> {
  try {
    const row = await prisma.gitHubConfig.findFirst({
      orderBy: { id: 'desc' },
    })
    if (!row) return null

    return {
      id: row.id,
      username: row.username,
      accessTokenMasked: row.accessToken
        ? `••••••••••••${row.accessToken.slice(-4)}`
        : '(not set)',
      defaultOwner: row.defaultOwner,
      configured: !!row.accessToken,
      lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  } catch {
    return null
  }
}

export async function saveGitHubConfig(input: {
  username: string
  accessToken: string
  defaultOwner: string
}): Promise<GitHubConfigData> {
  // Upsert: one global GitHub config for the admin
  const existing = await prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } })

  const row = existing
    ? await prisma.gitHubConfig.update({
        where: { id: existing.id },
        data: { ...input, updatedAt: new Date() },
      })
    : await prisma.gitHubConfig.create({ data: input })

  return {
    id: row.id,
    username: row.username,
    accessTokenMasked: `••••••••••••${row.accessToken.slice(-4)}`,
    defaultOwner: row.defaultOwner,
    configured: true,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Validate the stored GitHub token by calling /user.
 * Returns the authenticated username on success, or null on failure.
 */
export async function validateGitHubToken(): Promise<{
  valid: boolean
  username: string | null
  error: string | null
}> {
  const token = await getAccessToken()
  if (!token) return { valid: false, username: null, error: 'No token configured' }

  try {
    const { ok, body } = await githubFetch('/user', token)
    if (!ok) return { valid: false, username: null, error: 'Token invalid or expired' }

    const user = body as { login: string }

    // Update lastValidatedAt
    await prisma.gitHubConfig.updateMany({
      data: { lastValidatedAt: new Date(), username: user.login },
    })

    return { valid: true, username: user.login, error: null }
  } catch (e) {
    return { valid: false, username: null, error: String(e) }
  }
}

/**
 * List repos accessible with the configured token.
 */
export async function listGitHubRepos(page = 1): Promise<{
  repos: GitHubRepo[]
  error: string | null
}> {
  const token = await getAccessToken()
  if (!token) return { repos: [], error: 'GitHub not configured' }

  try {
    const { ok, body } = await githubFetch(
      `/user/repos?per_page=50&page=${page}&sort=updated`,
      token,
    )
    if (!ok) return { repos: [], error: 'Failed to list repos' }
    return { repos: body as GitHubRepo[], error: null }
  } catch (e) {
    return { repos: [], error: String(e) }
  }
}

/**
 * Push playground project files to a GitHub repo.
 *
 * Flow:
 *  1. Get current HEAD SHA for the base branch
 *  2. Create a new branch (or use existing)
 *  3. Create a tree with all file blobs
 *  4. Create a commit pointing to the new tree
 *  5. Update the branch reference
 */
export async function pushProjectToGitHub(
  input: GitHubPushInput,
): Promise<GitHubPushResult> {
  const token = await getAccessToken()
  const pushedAt = new Date().toISOString()

  if (!token) {
    return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'GitHub token not configured', pushedAt }
  }

  const [owner, repo] = input.repoFullName.split('/')
  if (!owner || !repo) {
    return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Invalid repo format (expected owner/repo)', pushedAt }
  }

  try {
    // 1. Get default branch HEAD SHA
    const repoInfo = await githubFetch(`/repos/${owner}/${repo}`, token)
    if (!repoInfo.ok) {
      return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Could not access repo', pushedAt }
    }
    const defaultBranch = (repoInfo.body as { default_branch: string }).default_branch

    const defaultRefRes = await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, token)
    if (!defaultRefRes.ok) {
      return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Could not get default branch ref', pushedAt }
    }
    const defaultBaseSha = ((defaultRefRes.body as { object: { sha: string } }).object).sha

    // Use target branch as base when it already exists, otherwise base from default branch.
    const existingBranch = await githubFetch(
      `/repos/${owner}/${repo}/git/refs/heads/${input.branch}`,
      token,
    )
    const baseSha = existingBranch.ok
      ? ((existingBranch.body as { object: { sha: string } }).object).sha
      : defaultBaseSha

    const commitResInfo = await githubFetch(`/repos/${owner}/${repo}/git/commits/${baseSha}`, token)
    if (!commitResInfo.ok) {
      return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Could not resolve base commit', pushedAt }
    }
    const baseTreeSha = (commitResInfo.body as { tree: { sha: string } }).tree.sha

    // 2. Create blobs for each file
    const treeItems = await Promise.all(input.files.map(async (f) => {
      const blobRes = await githubFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
        method: 'POST',
        body: JSON.stringify({ content: f.content, encoding: 'utf-8' }),
      })
      const blobSha = (blobRes.body as { sha: string }).sha
      return {
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobSha,
      }
    }))

    // 3. Create tree
    const treeRes = await githubFetch(`/repos/${owner}/${repo}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    })
    if (!treeRes.ok) {
      return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Failed to create git tree', pushedAt }
    }
    const treeSha = (treeRes.body as { sha: string }).sha

    // 4. Create commit
    const commitRes = await githubFetch(`/repos/${owner}/${repo}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message: input.commitMessage,
        tree: treeSha,
        parents: [baseSha],
      }),
    })
    if (!commitRes.ok) {
      return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: 'Failed to create commit', pushedAt }
    }
    const commitSha = (commitRes.body as { sha: string }).sha

    // 5. Create or update the target branch
    const branchRef = `refs/heads/${input.branch}`
    if (existingBranch.ok) {
      const updateRef = await githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${input.branch}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitSha, force: false }),
      })
      if (!updateRef.ok) {
        return {
          success: false,
          commitSha: null,
          commitUrl: null,
          branch: input.branch,
          filesChanged: 0,
          error: 'Failed to update target branch ref',
          pushedAt,
        }
      }
    } else {
      const createRef = await githubFetch(`/repos/${owner}/${repo}/git/refs`, token, {
        method: 'POST',
        body: JSON.stringify({ ref: branchRef, sha: commitSha }),
      })
      if (!createRef.ok) {
        return {
          success: false,
          commitSha: null,
          commitUrl: null,
          branch: input.branch,
          filesChanged: 0,
          error: 'Failed to create target branch ref',
          pushedAt,
        }
      }
    }

    // Update project lastPushedAt
    try {
      await prisma.playgroundProject.update({
        where: { id: input.projectId },
        data: {
          githubRepo: input.repoFullName,
          githubBranch: input.branch,
          lastPushedAt: new Date(),
        },
      })
    } catch { /* project update failure is non-fatal */ }

    // Audit log
    try {
      await prisma.gitHubPushLog.create({
        data: {
          projectId: input.projectId,
          repoFullName: input.repoFullName,
          branch: input.branch,
          commitSha,
          commitMessage: input.commitMessage,
          filesChanged: input.files.length,
          success: true,
          error: null,
          pushedAt: new Date(),
        },
      })
    } catch { /* audit log failure is non-fatal */ }

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitSha}`
    return { success: true, commitSha, commitUrl, branch: input.branch, filesChanged: input.files.length, error: null, pushedAt }
  } catch (e) {
    const errorMsg = String(e)

    // Log failure
    try {
      await prisma.gitHubPushLog.create({
        data: {
          projectId: input.projectId,
          repoFullName: input.repoFullName,
          branch: input.branch,
          commitSha: null,
          commitMessage: input.commitMessage,
          filesChanged: 0,
          success: false,
          error: errorMsg,
          pushedAt: new Date(),
        },
      })
    } catch { /* non-fatal */ }

    return { success: false, commitSha: null, commitUrl: null, branch: input.branch, filesChanged: 0, error: errorMsg, pushedAt }
  }
}

/**
 * Returns the last N push log entries for display in the dashboard.
 */
export async function getGitHubPushLog(limit = 20): Promise<{
  id: number
  projectId: number
  repoFullName: string
  branch: string
  commitSha: string | null
  commitUrl: string | null
  commitMessage: string
  filesChanged: number
  success: boolean
  error: string | null
  pushedAt: string
}[]> {
  try {
    const rows = await prisma.gitHubPushLog.findMany({
      orderBy: { pushedAt: 'desc' },
      take: limit,
    })
    return rows.map(r => ({
      id: r.id,
      projectId: r.projectId,
      repoFullName: r.repoFullName,
      branch: r.branch,
      commitSha: r.commitSha,
      commitUrl: r.commitSha
        ? `https://github.com/${r.repoFullName}/commit/${r.commitSha}`
        : null,
      commitMessage: r.commitMessage,
      filesChanged: r.filesChanged,
      success: r.success,
      error: r.error,
      pushedAt: r.pushedAt.toISOString(),
    }))
  } catch {
    return []
  }
}
