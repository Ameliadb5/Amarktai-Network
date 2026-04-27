/**
 * GET  /api/admin/settings/webdock  — Return stored Webdock config (masked)
 * POST /api/admin/settings/webdock  — Save Webdock API token
 * DELETE /api/admin/settings/webdock — Remove Webdock config
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encryptVaultKey, decryptVaultKey } from '@/lib/crypto-vault'
import { z } from 'zod'

const WEBDOCK_KEY = 'webdock'

function maskKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 8) return '•'.repeat(raw.length)
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

async function getRow() {
  try {
    return await prisma.integrationConfig.findUnique({ where: { key: WEBDOCK_KEY } })
  } catch {
    return null
  }
}

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await getRow()
  let token = ''
  try {
    if (row?.apiKey) token = decryptVaultKey(row.apiKey) ?? ''
  } catch { /* ignore */ }

  const envToken = process.env.WEBDOCK_API_TOKEN ?? ''
  const effectiveToken = token || envToken

  let notes: Record<string, string> = {}
  try { notes = JSON.parse(row?.notes ?? '{}') } catch { /* ignore */ }

  return NextResponse.json({
    configured: !!effectiveToken,
    maskedToken: maskKey(effectiveToken),
    source: token ? 'database' : (envToken ? 'env' : 'none'),
    defaultServerSlug: notes.defaultServerSlug ?? '',
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  })
}

const saveSchema = z.object({
  token: z.string().min(1).optional(),
  defaultServerSlug: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 })
  }

  const { token, defaultServerSlug } = parsed.data

  // Require a token if no existing config is stored
  const existing = await getRow()
  if (!token && !existing?.apiKey) {
    return NextResponse.json({ error: 'Token is required for initial setup' }, { status: 400 })
  }

  let notes: Record<string, string> = {}
  try { notes = JSON.parse(existing?.notes ?? '{}') } catch { /* ignore */ }
  if (defaultServerSlug !== undefined) notes.defaultServerSlug = defaultServerSlug

  const encryptedToken = token ? encryptVaultKey(token) : existing?.apiKey ?? ''

  try {
    await prisma.integrationConfig.upsert({
      where: { key: WEBDOCK_KEY },
      update: { apiKey: encryptedToken, notes: JSON.stringify(notes) },
      create: {
        key: WEBDOCK_KEY,
        displayName: 'Webdock',
        apiKey: encryptedToken,
        apiUrl: 'https://app.webdock.io/api/v1',
        enabled: true,
        notes: JSON.stringify(notes),
      },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[settings/webdock] POST error:', err)
    return NextResponse.json({ error: 'Failed to save Webdock config' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.integrationConfig.delete({ where: { key: WEBDOCK_KEY } }).catch(() => null)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[settings/webdock] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove Webdock config' }, { status: 500 })
  }
}
