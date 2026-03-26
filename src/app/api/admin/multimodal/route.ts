import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getMultimodalStatus } from '@/lib/multimodal-router'

/** GET /api/admin/multimodal — returns multimodal generation engine status */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = await getMultimodalStatus()
  return NextResponse.json(status)
}
