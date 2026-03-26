import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { validateGitHubToken } from '@/lib/github-integration'

/** POST /api/admin/github/validate — validate stored GitHub token */
export async function POST() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await validateGitHubToken()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Validation failed' },
      { status: 500 },
    )
  }
}
