import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { validateConfig, classifyDbError, configErrorResponse } from '@/lib/config-validator'

/**
 * GET /api/admin/apps — Admin-authenticated apps list.
 *
 * Returns all products with integration details for admin dashboard use.
 * This mirrors /api/admin/products but lives at the path the dashboard
 * apps/[slug] page expects.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cfg = validateConfig()
  if (!cfg.valid) return NextResponse.json({ ...configErrorResponse(cfg), apps: [] }, { status: 503 })

  try {
    const apps = await prisma.product.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { integration: true },
    })
    return NextResponse.json(apps)
  } catch (error) {
    const { category, message } = classifyDbError(error)
    return NextResponse.json({ error: message, category }, { status: category === 'config_invalid' ? 503 : 500 })
  }
}
