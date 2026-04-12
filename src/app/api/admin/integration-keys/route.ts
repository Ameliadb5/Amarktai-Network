/**
 * Admin API — Integration Key Management
 *
 * GET    /api/admin/integration-keys         → List all integration configs (keys masked)
 * POST   /api/admin/integration-keys         → Create or update an integration config
 * DELETE /api/admin/integration-keys?key=xxx → Remove an integration config
 *
 * The API key field is encrypted at rest using the same crypto-vault as AI provider keys.
 * Raw keys are never returned — only masked previews.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encryptVaultKey, decryptVaultKey } from '@/lib/crypto-vault'
import { z } from 'zod'

/* Known integrations with their default metadata */
const KNOWN_INTEGRATIONS: Record<string, { displayName: string; urlPlaceholder?: string; keyEnvVar: string; urlEnvVar?: string; description: string }> = {
  firecrawl:  { displayName: 'Firecrawl',  keyEnvVar: 'FIRECRAWL_API_KEY',  urlEnvVar: 'FIRECRAWL_API_URL',  urlPlaceholder: 'https://api.firecrawl.dev/v1',  description: 'Website crawling for app discovery and understanding' },
  mem0:       { displayName: 'Mem0',       keyEnvVar: 'MEM0_API_KEY',       urlEnvVar: 'MEM0_API_URL',       urlPlaceholder: 'https://api.mem0.ai/v1',         description: 'Persistent app-isolated memory' },
  graphiti:   { displayName: 'Graphiti',   keyEnvVar: 'GRAPHITI_API_KEY',   urlEnvVar: 'GRAPHITI_API_URL',   urlPlaceholder: '',                               description: 'Knowledge graph for app relationships' },
  litellm:    { displayName: 'LiteLLM',    keyEnvVar: 'LITELLM_API_KEY',    urlEnvVar: 'LITELLM_API_URL',    urlPlaceholder: '',                               description: 'Unified provider proxy for cost-aware routing' },
  posthog:    { displayName: 'PostHog',    keyEnvVar: 'POSTHOG_API_KEY',    urlEnvVar: 'POSTHOG_HOST',       urlPlaceholder: 'https://us.i.posthog.com',       description: 'Analytics and observability' },
  langgraph:  { displayName: 'LangGraph',  keyEnvVar: 'LANGGRAPH_API_KEY',  urlEnvVar: 'LANGGRAPH_API_URL',  urlPlaceholder: '',                               description: 'Durable workflow orchestration' },
  qdrant:     { displayName: 'Qdrant',     keyEnvVar: 'QDRANT_API_KEY',     urlEnvVar: 'QDRANT_URL',         urlPlaceholder: 'http://localhost:6333',           description: 'Vector database for semantic search and RAG' },
  huggingface:{ displayName: 'HuggingFace',keyEnvVar: 'HUGGINGFACE_API_KEY',                                                                                   description: 'Emotion enrichment and open-source models' },
}

/** Mask an API key: first 4 chars + "..." + last 4 (or all "*" if short) */
function maskKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 10) return '•'.repeat(raw.length)
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

/** Derive effective value: DB row takes priority over env var */
function getEnvFallback(integrationKey: string): { apiKey: string; apiUrl: string } {
  const meta = KNOWN_INTEGRATIONS[integrationKey]
  if (!meta) return { apiKey: '', apiUrl: '' }
  return {
    apiKey: (meta.keyEnvVar ? (process.env[meta.keyEnvVar] ?? '') : ''),
    apiUrl: (meta.urlEnvVar ? (process.env[meta.urlEnvVar] ?? '') : ''),
  }
}

const upsertSchema = z.object({
  key: z.string().min(1).max(64),
  displayName: z.string().min(1).max(100).optional(),
  apiKey: z.string().default(''),
  apiUrl: z.string().default(''),
  enabled: z.boolean().default(true),
  notes: z.string().default(''),
})

/** GET /api/admin/integration-keys */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch DB rows
  const rows = await prisma.integrationConfig.findMany({ orderBy: { key: 'asc' } })
  const rowByKey = new Map(rows.map(r => [r.key, r]))

  const result = Object.entries(KNOWN_INTEGRATIONS).map(([key, meta]) => {
    const row = rowByKey.get(key)
    const env = getEnvFallback(key)

    // Determine effective key source: DB > env var
    let effectiveKey = ''
    let source: 'database' | 'env' | 'none' = 'none'
    if (row?.apiKey) {
      try {
        const decrypted = decryptVaultKey(row.apiKey)
        effectiveKey = decrypted ?? ''
      } catch {
        // Decryption failed — treat as unconfigured rather than expose encrypted bytes
        effectiveKey = ''
      }
      if (effectiveKey) source = 'database'
    }
    if (!effectiveKey && env.apiKey) {
      effectiveKey = env.apiKey
      source = 'env'
    }

    const effectiveUrl = row?.apiUrl || env.apiUrl || meta.urlPlaceholder || ''

    return {
      key,
      displayName: row?.displayName ?? meta.displayName,
      description: meta.description,
      maskedKey: maskKey(effectiveKey),
      apiUrl: effectiveUrl,
      enabled: row?.enabled ?? true,
      notes: row?.notes ?? '',
      source,
      configured: !!effectiveKey,
      keyEnvVar: meta.keyEnvVar,
      urlEnvVar: meta.urlEnvVar ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    }
  })

  return NextResponse.json({ integrations: result })
}

/** POST /api/admin/integration-keys — create or update */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = upsertSchema.parse(body)

    const meta = KNOWN_INTEGRATIONS[data.key]
    const displayName = data.displayName ?? meta?.displayName ?? data.key

    // Encrypt the API key if provided
    const encryptedKey = data.apiKey ? encryptVaultKey(data.apiKey) : ''

    const row = await prisma.integrationConfig.upsert({
      where: { key: data.key },
      update: {
        displayName,
        ...(data.apiKey ? { apiKey: encryptedKey } : {}),
        apiUrl: data.apiUrl,
        enabled: data.enabled,
        notes: data.notes,
      },
      create: {
        key: data.key,
        displayName,
        apiKey: encryptedKey,
        apiUrl: data.apiUrl,
        enabled: data.enabled,
        notes: data.notes,
      },
    })

    return NextResponse.json({
      success: true,
      key: row.key,
      displayName: row.displayName,
      // Only mask the freshly submitted key — if no new key was provided we can't
      // reconstruct it (it's encrypted in the DB), so return empty string.
      maskedKey: data.apiKey ? maskKey(data.apiKey) : '',
      configured: !!(data.apiKey || row.apiKey),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to save integration config' }, { status: 500 })
  }
}

/** DELETE /api/admin/integration-keys?key=xxx */
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  try {
    await prisma.integrationConfig.delete({ where: { key } })
    return NextResponse.json({ success: true })
  } catch {
    // If row doesn't exist, treat as success
    return NextResponse.json({ success: true })
  }
}
