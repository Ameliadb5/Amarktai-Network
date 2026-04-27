/**
 * GET   /api/admin/settings/deploy-defaults  — Return deployment defaults
 * PATCH /api/admin/settings/deploy-defaults  — Save deployment defaults
 *
 * Stored as IntegrationConfig key='deploy_defaults' (JSON in notes field).
 * No secrets — no encryption needed for this config block.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DB_KEY = 'deploy_defaults'

interface DeployDefaults {
  domainRoot: string           // e.g. amarktai.com
  deployRoot: string           // e.g. /var/www/apps
  nginxTemplate: string        // e.g. reverse_proxy | static | none
  systemdNaming: string        // e.g. amarktai-{slug}
  defaultWebdockSlug: string   // slug of default Webdock server
  deployMethod: string         // direct_vps | github_actions | manual
}

const DEFAULT_DEPLOY: DeployDefaults = {
  domainRoot: 'amarktai.com',
  deployRoot: '/var/www/apps',
  nginxTemplate: 'reverse_proxy',
  systemdNaming: 'amarktai-{slug}',
  defaultWebdockSlug: '',
  deployMethod: 'direct_vps',
}

async function getRow() {
  try {
    return await prisma.integrationConfig.findUnique({ where: { key: DB_KEY } })
  } catch {
    return null
  }
}

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await getRow()
  let saved: Partial<DeployDefaults> = {}
  try { saved = JSON.parse(row?.notes ?? '{}') } catch { /* ignore */ }

  return NextResponse.json({
    ...DEFAULT_DEPLOY,
    ...saved,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  })
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i

const patchSchema = z.object({
  domainRoot: z.string().max(253).refine(v => !v || DOMAIN_RE.test(v), { message: 'Must be a valid domain name' }).optional(),
  deployRoot: z.string().max(512)
    .refine(v => !v || v.startsWith('/'), { message: 'Deploy root must be an absolute path starting with /' })
    .refine(v => !v || !v.includes('..'), { message: 'Deploy root must not contain path traversal sequences' })
    .optional(),
  nginxTemplate: z.enum(['reverse_proxy', 'static', 'none']).optional(),
  systemdNaming: z.string().max(128)
    .refine(v => !v || !v.includes('..'), { message: 'Invalid naming pattern' })
    .optional(),
  defaultWebdockSlug: z.string().max(64).optional(),
  deployMethod: z.enum(['direct_vps', 'github_actions', 'manual']).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 })
  }

  const row = await getRow()
  let current: Partial<DeployDefaults> = {}
  try { current = JSON.parse(row?.notes ?? '{}') } catch { /* ignore */ }

  const updated = { ...current, ...parsed.data }

  try {
    await prisma.integrationConfig.upsert({
      where: { key: DB_KEY },
      update: { notes: JSON.stringify(updated) },
      create: {
        key: DB_KEY,
        displayName: 'Deployment Defaults',
        apiKey: '',
        apiUrl: '',
        enabled: true,
        notes: JSON.stringify(updated),
      },
    })
    return NextResponse.json({ success: true, ...DEFAULT_DEPLOY, ...updated })
  } catch (err) {
    console.error('[settings/deploy-defaults] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to save deployment defaults' }, { status: 500 })
  }
}
