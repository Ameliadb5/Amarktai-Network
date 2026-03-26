import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getRetrievalStatus } from '@/lib/retrieval-engine'

/** GET /api/admin/retrieval — returns retrieval engine status */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = await getRetrievalStatus()
  return NextResponse.json(status)
}
