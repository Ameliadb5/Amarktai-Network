/**
 * POST /api/admin/settings/webdock/test
 *
 * Test a Webdock API token and return account/server details.
 * Accepts an inline token (not-yet-saved) or uses the stored config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { testWebdockConnection, listWebdockServers } from '@/lib/webdock-client'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let inlineToken = ''
  try {
    const body = await req.json()
    inlineToken = typeof body.token === 'string' ? body.token.trim() : ''
  } catch { /* ignore */ }

  // Resolve: inline > DB > env
  let token = inlineToken
  if (!token) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'webdock' } })
      if (row?.apiKey) token = decryptVaultKey(row.apiKey) ?? ''
    } catch { /* ignore */ }
  }
  if (!token) token = process.env.WEBDOCK_API_TOKEN ?? ''

  const result = await testWebdockConnection(token)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error, latencyMs: result.latencyMs })
  }

  // Fetch server list for the response
  const serversResult = await listWebdockServers()
  const servers = serversResult.data ?? []

  return NextResponse.json({
    success: true,
    serverCount: result.serverCount,
    latencyMs: result.latencyMs,
    servers: servers.map(s => ({
      slug: s.slug,
      name: s.name,
      status: s.status,
      ipv4: s.ipv4,
      location: s.location,
      profile: s.profile,
    })),
  })
}
