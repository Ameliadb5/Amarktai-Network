/**
 * Admin API — Integrations & API Keys Settings
 *
 * GET  /api/admin/settings/integrations  → Return integration configs (keys masked)
 * PATCH /api/admin/settings/integrations → Save integration configs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encryptVaultKey, decryptVaultKey } from '@/lib/crypto-vault'
import { getGitHubConfig, saveGitHubConfig } from '@/lib/github-integration'

function maskKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 10) return '•'.repeat(raw.length)
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

async function getRow(key: string) {
  return prisma.integrationConfig.findUnique({ where: { key } })
}

async function upsertRow(key: string, displayName: string, data: {
  apiKey?: string
  apiUrl?: string
  notes?: string
  enabled?: boolean
}) {
  return prisma.integrationConfig.upsert({
    where: { key },
    create: { key, displayName, ...data },
    update: { ...data, updatedAt: new Date() },
  })
}

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // GenX config
    const genxRow = await getRow('genx')
    let genxKey = ''
    if (genxRow?.apiKey) {
      genxKey = decryptVaultKey(genxRow.apiKey) ?? ''
    }
    if (!genxKey) genxKey = process.env.GENX_API_KEY ?? ''
    const genxUrl = genxRow?.apiUrl || process.env.GENX_API_URL || 'https://query.genx.sh'

    // GitHub config
    const ghConfig = await getGitHubConfig()

    // Storage config
    const storageRow = await getRow('storage_config')
    let storageData: {
      driver: 'local' | 's3' | 'r2'
      bucket: string
      region: string
      endpoint: string
      accessKey: string
      secretKey: string
      publicUrl: string
    } = {
      driver: (process.env.STORAGE_DRIVER as 'local' | 's3' | 'r2') ?? 'local',
      bucket: process.env.S3_BUCKET ?? '',
      region: process.env.S3_REGION ?? '',
      endpoint: process.env.S3_ENDPOINT ?? '',
      accessKey: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      publicUrl: process.env.R2_PUBLIC_URL ?? '',
    }
    if (storageRow?.notes) {
      try {
        const parsed = JSON.parse(storageRow.notes)
        storageData = { ...storageData, ...parsed }
      } catch { /* keep env defaults */ }
    }
    if (storageRow?.apiUrl) {
      storageData.driver = (storageRow.apiUrl as 'local' | 's3' | 'r2') ?? storageData.driver
    }
    // Decrypt access/secret keys from apiKey field
    if (storageRow?.apiKey) {
      try {
        const rawJson = decryptVaultKey(storageRow.apiKey) ?? storageRow.apiKey
        const keys = JSON.parse(rawJson)
        if (keys.accessKey) storageData.accessKey = decryptVaultKey(keys.accessKey) ?? keys.accessKey
        if (keys.secretKey) storageData.secretKey = decryptVaultKey(keys.secretKey) ?? keys.secretKey
      } catch { /* keep env defaults */ }
    }

    // Adult provider config
    const adultRow = await getRow('adult_provider')
    let adultMode: 'genx' | 'specialist' | 'disabled' = 'genx'
    let adultEndpoint = ''
    let adultKey = ''
    if (adultRow) {
      try {
        const notesData = JSON.parse(adultRow.notes || '{}')
        adultMode = notesData.mode ?? 'genx'
        adultEndpoint = notesData.endpoint ?? adultRow.apiUrl ?? ''
      } catch {
        adultEndpoint = adultRow.apiUrl ?? ''
      }
      if (adultRow.apiKey) adultKey = decryptVaultKey(adultRow.apiKey) ?? ''
    }

    // Fallback providers
    const fallbackKeys = ['openai', 'gemini', 'huggingface', 'together'] as const
    const fallbackRows = await prisma.integrationConfig.findMany({
      where: { key: { in: [...fallbackKeys] } },
    })
    const fallbackByKey = new Map(fallbackRows.map(r => [r.key, r]))

    const envFallbacks: Record<string, string> = {
      openai: process.env.OPENAI_API_KEY ?? '',
      gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
      huggingface: process.env.HUGGINGFACE_API_KEY ?? '',
      together: process.env.TOGETHER_API_KEY ?? '',
    }

    const fallbackProviders: Record<string, { configured: boolean; maskedKey: string }> = {}
    for (const k of fallbackKeys) {
      const row = fallbackByKey.get(k)
      let effectiveKey = ''
      if (row?.apiKey) effectiveKey = decryptVaultKey(row.apiKey) ?? ''
      if (!effectiveKey) effectiveKey = envFallbacks[k] ?? ''
      fallbackProviders[k] = {
        configured: !!effectiveKey,
        maskedKey: maskKey(effectiveKey),
      }
    }

    return NextResponse.json({
      genx: {
        configured: !!(genxKey || process.env.GENX_API_KEY),
        maskedKey: maskKey(genxKey),
        apiUrl: genxUrl,
      },
      github: {
        configured: ghConfig?.configured ?? false,
        username: ghConfig?.username ?? null,
        lastValidatedAt: ghConfig?.lastValidatedAt ?? null,
      },
      storage: {
        driver: storageData.driver,
        bucket: storageData.bucket,
        region: storageData.region,
        endpoint: storageData.endpoint,
        accessKey: maskKey(storageData.accessKey),
        secretKey: maskKey(storageData.secretKey),
        publicUrl: storageData.publicUrl,
        configured: storageData.driver !== 'local'
          ? !!(storageData.bucket || storageData.publicUrl)
          : true,
      },
      adultProvider: {
        mode: adultMode,
        endpoint: adultEndpoint,
        maskedKey: maskKey(adultKey),
      },
      fallbackProviders,
    })
  } catch (e) {
    console.error('[settings/integrations GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    // GenX
    if (body.genx) {
      const { apiKey, apiUrl } = body.genx as { apiKey?: string; apiUrl?: string }
      const existing = await getRow('genx')
      const encKey = apiKey ? encryptVaultKey(apiKey) : (existing?.apiKey ?? '')
      await upsertRow('genx', 'GenX AI', {
        apiKey: encKey,
        apiUrl: apiUrl ?? existing?.apiUrl ?? '',
      })
    }

    // GitHub
    if (body.github) {
      const { accessToken } = body.github as { accessToken: string }
      if (accessToken) {
        await saveGitHubConfig({ username: '', accessToken, defaultOwner: '' })
      }
    }

    // Storage
    if (body.storage) {
      const s = body.storage as {
        driver: 'local' | 's3' | 'r2'
        bucket?: string
        region?: string
        endpoint?: string
        accessKey?: string
        secretKey?: string
        publicUrl?: string
      }
      const existing = await getRow('storage_config')
      const notesData = {
        bucket: s.bucket ?? '',
        region: s.region ?? '',
        endpoint: s.endpoint ?? '',
        publicUrl: s.publicUrl ?? '',
      }
      let encKeys = existing?.apiKey ?? ''
      if (s.accessKey || s.secretKey) {
        const encAccess = s.accessKey ? encryptVaultKey(s.accessKey) : ''
        const encSecret = s.secretKey ? encryptVaultKey(s.secretKey) : ''
        encKeys = encryptVaultKey(JSON.stringify({ accessKey: encAccess, secretKey: encSecret }))
      }
      await upsertRow('storage_config', 'Artifact Storage', {
        apiKey: encKeys,
        apiUrl: s.driver,
        notes: JSON.stringify(notesData),
      })
    }

    // Adult provider
    if (body.adultProvider) {
      const ap = body.adultProvider as {
        mode: 'genx' | 'specialist' | 'disabled'
        endpoint?: string
        apiKey?: string
      }
      const existing = await getRow('adult_provider')
      const encKey = ap.apiKey ? encryptVaultKey(ap.apiKey) : (existing?.apiKey ?? '')
      await upsertRow('adult_provider', 'Adult Provider', {
        apiKey: encKey,
        notes: JSON.stringify({ mode: ap.mode, endpoint: ap.endpoint ?? '' }),
      })
    }

    // Fallback providers
    if (body.fallbackProviders) {
      const fps = body.fallbackProviders as Record<string, string>
      const displayNames: Record<string, string> = {
        openai: 'OpenAI',
        gemini: 'Gemini',
        huggingface: 'HuggingFace',
        together: 'Together AI',
      }
      for (const [k, val] of Object.entries(fps)) {
        if (!val || typeof val !== 'string') continue
        const encKey = encryptVaultKey(val)
        await upsertRow(k, displayNames[k] ?? k, { apiKey: encKey })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[settings/integrations PATCH]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
