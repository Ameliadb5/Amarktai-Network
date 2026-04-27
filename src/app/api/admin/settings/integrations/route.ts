/**
 * GET  /api/admin/settings/integrations — Return primary system integration config
 * PATCH /api/admin/settings/integrations — Save primary system integration config
 *
 * Covers: GenX, GitHub, Artifact Storage, Adult Mode
 * All secrets are encrypted at rest via crypto-vault.
 * Raw keys are never returned — only masked previews.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encryptVaultKey, decryptVaultKey } from '@/lib/crypto-vault'
import { z } from 'zod'

// ── Key constants ──────────────────────────────────────────────────────────────

const GENX_KEY         = 'genx'
const STORAGE_KEY      = 'storage_config'
const ADULT_KEY        = 'adult_mode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 8) return '•'.repeat(raw.length)
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

function maskToken(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 8) return '•'.repeat(raw.length)
  return `••••••••••••${raw.slice(-4)}`
}

async function getIntegrationConfig(key: string) {
  try {
    return await prisma.integrationConfig.findUnique({ where: { key } })
  } catch {
    return null
  }
}

async function upsertIntegrationConfig(data: {
  key: string
  displayName: string
  apiKey?: string
  apiUrl?: string
  enabled?: boolean
  notes?: string
}) {
  const encryptedKey = data.apiKey ? encryptVaultKey(data.apiKey) : undefined

  return prisma.integrationConfig.upsert({
    where: { key: data.key },
    update: {
      ...(encryptedKey !== undefined ? { apiKey: encryptedKey } : {}),
      ...(data.apiUrl !== undefined ? { apiUrl: data.apiUrl } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    create: {
      key: data.key,
      displayName: data.displayName,
      apiKey: encryptedKey ?? '',
      apiUrl: data.apiUrl ?? '',
      enabled: data.enabled ?? true,
      notes: data.notes ?? '',
    },
  })
}

function decryptConfig(row: { apiKey: string } | null): string {
  if (!row?.apiKey) return ''
  try {
    return decryptVaultKey(row.apiKey) ?? ''
  } catch {
    return ''
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [genxRow, storageRow, adultRow, githubRow] = await Promise.all([
    getIntegrationConfig(GENX_KEY),
    getIntegrationConfig(STORAGE_KEY),
    getIntegrationConfig(ADULT_KEY),
    prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } }).catch(() => null),
  ])

  // ── GenX ──
  const genxKey = decryptConfig(genxRow)
  const genxUrl = genxRow?.apiUrl || process.env.GENX_API_URL || ''
  const genxConfigured = !!(genxKey || process.env.GENX_API_KEY) && !!genxUrl

  // ── GitHub ──
  const ghToken = githubRow?.accessToken || ''
  const ghConfigured = !!ghToken

  // ── Storage ──
  let storageNotes: Record<string, string> = {}
  try { storageNotes = JSON.parse(storageRow?.notes ?? '{}') } catch { /* ignore */ }
  const storageDriver = storageNotes.driver || process.env.STORAGE_DRIVER || 'local'

  // ── Adult mode ──
  let adultNotes: Record<string, string> = {}
  try { adultNotes = JSON.parse(adultRow?.notes ?? '{}') } catch { /* ignore */ }
  const adultMode = adultNotes.mode || 'disabled'

  // ── Aiva ──
  const AIVA_KEY = 'aiva_config'
  const aivaRow = await getIntegrationConfig(AIVA_KEY).catch(() => null)
  let aivaNotes: Record<string, unknown> = {}
  try { aivaNotes = JSON.parse(aivaRow?.notes ?? '{}') } catch { /* ignore */ }

  return NextResponse.json({
    genx: {
      configured: genxConfigured,
      maskedKey: maskKey(genxKey || (process.env.GENX_API_KEY ?? '')),
      apiUrl: genxUrl,
      source: genxRow?.apiKey ? 'database' : (process.env.GENX_API_KEY ? 'env' : 'none'),
      updatedAt: genxRow?.updatedAt?.toISOString() ?? null,
    },
    github: {
      configured: ghConfigured,
      maskedToken: maskToken(ghToken),
      username: githubRow?.username || null,
      defaultOwner: githubRow?.defaultOwner || '',
      lastValidatedAt: githubRow?.lastValidatedAt?.toISOString() ?? null,
    },
    storage: {
      driver: storageDriver,
      bucket: storageNotes.bucket || process.env.S3_BUCKET || '',
      region: storageNotes.region || process.env.S3_REGION || '',
      endpoint: storageNotes.endpoint || process.env.S3_ENDPOINT || '',
      accessKey: storageNotes.accessKey ? maskKey(storageNotes.accessKey) : (process.env.AWS_ACCESS_KEY_ID ? maskKey(process.env.AWS_ACCESS_KEY_ID) : ''),
      r2PublicUrl: storageNotes.r2PublicUrl || process.env.R2_PUBLIC_URL || '',
      configured: storageDriver !== 'local' ? !!(storageNotes.bucket || process.env.S3_BUCKET) : true,
      source: storageRow ? 'database' : 'env',
    },
    adult: {
      mode: adultMode,
      providerType: adultNotes.providerType || 'together',
      specialistEndpoint: adultNotes.specialistEndpoint || '',
      hasSpecialistKey: !!(adultNotes.specialistKey),
      maskedSpecialistKey: adultNotes.specialistKey ? maskKey(adultNotes.specialistKey) : '',
      providerModel: adultNotes.providerModel || '',
      lastTestStatus: adultNotes.lastTestStatus || null,
    },
    aiva: {
      typedEnabled:          aivaNotes.typedEnabled          !== undefined ? Boolean(aivaNotes.typedEnabled)          : true,
      voiceEnabled:          aivaNotes.voiceEnabled          !== undefined ? Boolean(aivaNotes.voiceEnabled)          : false,
      sttProvider:           String(aivaNotes.sttProvider    || 'auto'),
      ttsProvider:           String(aivaNotes.ttsProvider    || 'auto'),
      preferredVoiceModel:   String(aivaNotes.preferredVoiceModel || ''),
      continuousConversation: aivaNotes.continuousConversation !== undefined ? Boolean(aivaNotes.continuousConversation) : false,
    },
  })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  genx: z.object({
    apiKey: z.string().optional(),
    apiUrl: z.string().refine(v => !v || /^https?:\/\/.+/.test(v), { message: 'Must be a valid URL or empty' }).optional(),
  }).optional(),
  github: z.object({
    token: z.string().optional(),
    defaultOwner: z.string().optional(),
  }).optional(),
  storage: z.object({
    driver: z.enum(['local_vps', 'local', 's3', 'r2']).optional(),
    bucket: z.string().optional(),
    region: z.string().optional(),
    endpoint: z.string().optional(),
    accessKey: z.string().optional(),
    secretKey: z.string().optional(),
    r2PublicUrl: z.string().optional(),
  }).optional(),
  adult: z.object({
    mode: z.enum(['specialist', 'disabled']).optional(),
    providerType: z.enum(['together', 'huggingface', 'xai', 'custom']).optional(),
    specialistEndpoint: z.string().optional(),
    specialistKey: z.string().optional(),
    providerModel: z.string().optional(),
  }).optional(),
  webdock: z.object({
    apiKey: z.string().optional(),
  }).optional(),
  aiva: z.object({
    typedEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    sttProvider: z.string().optional(),
    ttsProvider: z.string().optional(),
    preferredVoiceModel: z.string().optional(),
    continuousConversation: z.boolean().optional(),
  }).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data
  const ops: Promise<unknown>[] = []

  // ── Save GenX ──
  if (data.genx) {
    ops.push(
      upsertIntegrationConfig({
        key: GENX_KEY,
        displayName: 'GenX AI',
        ...(data.genx.apiKey ? { apiKey: data.genx.apiKey } : {}),
        ...(data.genx.apiUrl !== undefined ? { apiUrl: data.genx.apiUrl } : {}),
      }),
    )
  }

  // ── Save GitHub ──
  if (data.github) {
    const existing = await prisma.gitHubConfig.findFirst({ orderBy: { id: 'desc' } }).catch(() => null)
    if (data.github.token) {
      // Validate the token to get username before saving
      let username = existing?.username ?? ''
      let defaultOwner = data.github.defaultOwner ?? existing?.defaultOwner ?? ''
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${data.github.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) {
          const userData = await res.json() as { login?: string }
          username = userData.login ?? username
          if (!defaultOwner) defaultOwner = username
        }
      } catch { /* ignore — save token even if validation fails */ }

      if (existing) {
        ops.push(
          prisma.gitHubConfig.update({
            where: { id: existing.id },
            data: {
              accessToken: data.github.token,
              username,
              defaultOwner: defaultOwner || username,
              lastValidatedAt: new Date(),
            },
          }),
        )
      } else {
        ops.push(
          prisma.gitHubConfig.create({
            data: {
              accessToken: data.github.token,
              username,
              defaultOwner: defaultOwner || username,
              lastValidatedAt: new Date(),
            },
          }),
        )
      }
    } else if (data.github.defaultOwner !== undefined && existing) {
      ops.push(
        prisma.gitHubConfig.update({
          where: { id: existing.id },
          data: { defaultOwner: data.github.defaultOwner },
        }),
      )
    }
  }

  // ── Save Storage ──
  if (data.storage) {
    const existing = await getIntegrationConfig(STORAGE_KEY)
    let notes: Record<string, string> = {}
    try { notes = JSON.parse(existing?.notes ?? '{}') } catch { /* ignore */ }

    if (data.storage.driver !== undefined) notes.driver = data.storage.driver
    if (data.storage.bucket !== undefined) notes.bucket = data.storage.bucket
    if (data.storage.region !== undefined) notes.region = data.storage.region
    if (data.storage.endpoint !== undefined) notes.endpoint = data.storage.endpoint
    if (data.storage.accessKey !== undefined) notes.accessKey = data.storage.accessKey
    if (data.storage.r2PublicUrl !== undefined) notes.r2PublicUrl = data.storage.r2PublicUrl

    ops.push(
      upsertIntegrationConfig({
        key: STORAGE_KEY,
        displayName: 'Artifact Storage',
        ...(data.storage.secretKey ? { apiKey: data.storage.secretKey } : {}),
        notes: JSON.stringify(notes),
      }),
    )
  }

  // ── Save Adult Mode ──
  if (data.adult) {
    const existing = await getIntegrationConfig(ADULT_KEY)
    let notes: Record<string, string> = {}
    try { notes = JSON.parse(existing?.notes ?? '{}') } catch { /* ignore */ }

    if (data.adult.mode !== undefined) notes.mode = data.adult.mode
    if (data.adult.providerType !== undefined) notes.providerType = data.adult.providerType
    if (data.adult.specialistEndpoint !== undefined) notes.specialistEndpoint = data.adult.specialistEndpoint
    if (data.adult.providerModel !== undefined) notes.providerModel = data.adult.providerModel

    const adultKey = data.adult.specialistKey || undefined

    ops.push(
      upsertIntegrationConfig({
        key: ADULT_KEY,
        displayName: 'Adult Content Provider',
        ...(adultKey ? { apiKey: adultKey } : {}),
        notes: JSON.stringify(notes),
      }),
    )
  }

  // ── Save Webdock ──
  if (data.webdock?.apiKey) {
    ops.push(
      upsertIntegrationConfig({
        key: 'webdock',
        displayName: 'Webdock',
        apiKey: data.webdock.apiKey,
      }),
    )
  }

  // ── Save Aiva ──
  if (data.aiva) {
    const AIVA_KEY = 'aiva_config'
    const existing = await getIntegrationConfig(AIVA_KEY)
    let notes: Record<string, unknown> = {}
    try { notes = JSON.parse(existing?.notes ?? '{}') } catch { /* ignore */ }

    if (data.aiva.typedEnabled !== undefined)          notes.typedEnabled          = data.aiva.typedEnabled
    if (data.aiva.voiceEnabled !== undefined)          notes.voiceEnabled          = data.aiva.voiceEnabled
    if (data.aiva.sttProvider !== undefined)           notes.sttProvider           = data.aiva.sttProvider
    if (data.aiva.ttsProvider !== undefined)           notes.ttsProvider           = data.aiva.ttsProvider
    if (data.aiva.preferredVoiceModel !== undefined)   notes.preferredVoiceModel   = data.aiva.preferredVoiceModel
    if (data.aiva.continuousConversation !== undefined) notes.continuousConversation = data.aiva.continuousConversation

    ops.push(
      upsertIntegrationConfig({
        key: AIVA_KEY,
        displayName: 'Aiva Config',
        notes: JSON.stringify(notes),
      }),
    )
  }

  try {
    await Promise.all(ops)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[settings/integrations] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
