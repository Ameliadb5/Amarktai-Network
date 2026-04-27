/**
 * GET    /api/admin/settings/providers  — List all fallback/specialist AI providers with status
 * POST   /api/admin/settings/providers  — Save a provider key/URL
 * DELETE /api/admin/settings/providers?provider=xxx — Remove a provider key
 *
 * POST /api/admin/settings/providers/test — Test a provider connection
 *
 * Each provider key is encrypted at rest via crypto-vault.
 * Raw keys are never returned — only masked previews.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encryptVaultKey, decryptVaultKey } from '@/lib/crypto-vault'
import { z } from 'zod'

// ── Provider registry ─────────────────────────────────────────────────────────

export interface ProviderMeta {
  id: string
  displayName: string
  description: string
  dbKey: string             // key in IntegrationConfig table
  envKeyVar: string
  envUrlVar: string | null
  defaultUrl: string
  capabilities: string[]
  requiredScopes: string[]
  testEndpoint: string | null // relative path to call for a test ping
  testMethod: 'GET' | 'POST'
  testBody?: Record<string, unknown>
  testExpect: 'ok' | 'json_models'
}

export const PROVIDER_REGISTRY: ProviderMeta[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'GPT-4o, GPT-4.1, TTS, STT, image generation fallback',
    dbKey: 'provider_openai',
    envKeyVar: 'OPENAI_API_KEY',
    envUrlVar: null,
    defaultUrl: 'https://api.openai.com/v1',
    capabilities: ['chat', 'code', 'reasoning', 'tts', 'stt', 'image_generation', 'embeddings'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini 2.0 / 1.5 Pro, multimodal, long context',
    dbKey: 'provider_gemini',
    envKeyVar: 'GEMINI_API_KEY',
    envUrlVar: 'GEMINI_API_URL',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    capabilities: ['chat', 'code', 'reasoning', 'multimodal', 'embeddings'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    description: 'Ultra-fast inference — Llama 3, Mixtral, Whisper STT',
    dbKey: 'provider_groq',
    envKeyVar: 'GROQ_API_KEY',
    envUrlVar: null,
    defaultUrl: 'https://api.groq.com/openai/v1',
    capabilities: ['chat', 'code', 'reasoning', 'stt'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'qwen',
    displayName: 'Qwen / DashScope',
    description: 'Alibaba Qwen 2.5 — cost-effective, multilingual',
    dbKey: 'provider_qwen',
    envKeyVar: 'DASHSCOPE_API_KEY',
    envUrlVar: 'DASHSCOPE_API_URL',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    capabilities: ['chat', 'code', 'reasoning', 'multimodal'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'huggingface',
    displayName: 'HuggingFace',
    description: 'Inference API — specialist/fine-tuned models, emotion models',
    dbKey: 'provider_huggingface',
    envKeyVar: 'HUGGINGFACE_API_KEY',
    envUrlVar: null,
    defaultUrl: 'https://api-inference.huggingface.co',
    capabilities: ['chat', 'embeddings', 'stt', 'tts', 'image_generation'],
    requiredScopes: [],
    testEndpoint: null, // HF Inference is model-specific; test via /whoami
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'together',
    displayName: 'Together AI',
    description: 'Open-source model hosting — Llama 3, Mistral, specialist tasks',
    dbKey: 'provider_together',
    envKeyVar: 'TOGETHER_API_KEY',
    envUrlVar: null,
    defaultUrl: 'https://api.together.xyz/v1',
    capabilities: ['chat', 'code', 'reasoning', 'image_generation'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
  {
    id: 'xai',
    displayName: 'xAI (Grok)',
    description: 'Grok 3 — fast reasoning and coding fallback',
    dbKey: 'provider_xai',
    envKeyVar: 'XAI_API_KEY',
    envUrlVar: null,
    defaultUrl: 'https://api.x.ai/v1',
    capabilities: ['chat', 'code', 'reasoning'],
    requiredScopes: [],
    testEndpoint: '/models',
    testMethod: 'GET',
    testExpect: 'ok',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskKey(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 8) return '•'.repeat(raw.length)
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`
}

async function resolveProviderKey(meta: ProviderMeta): Promise<string> {
  try {
    const row = await prisma.integrationConfig.findUnique({ where: { key: meta.dbKey } })
    if (row?.apiKey) {
      const dec = decryptVaultKey(row.apiKey)
      if (dec) return dec
    }
  } catch { /* ignore */ }
  return process.env[meta.envKeyVar] ?? ''
}

async function resolveProviderUrl(meta: ProviderMeta): Promise<string> {
  if (!meta.envUrlVar) return meta.defaultUrl
  try {
    const row = await prisma.integrationConfig.findUnique({ where: { key: meta.dbKey } })
    if (row?.apiUrl) return row.apiUrl
  } catch { /* ignore */ }
  return process.env[meta.envUrlVar] ?? meta.defaultUrl
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.integrationConfig
    .findMany({ where: { key: { in: PROVIDER_REGISTRY.map(p => p.dbKey) } } })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.integrationConfig.findMany>>)

  const rowByKey = new Map(rows.map(r => [r.key, r]))

  const providers = await Promise.all(
    PROVIDER_REGISTRY.map(async (meta) => {
      const row = rowByKey.get(meta.dbKey)
      const envKey = process.env[meta.envKeyVar] ?? ''

      let dbKey = ''
      if (row?.apiKey) {
        try { dbKey = decryptVaultKey(row.apiKey) ?? '' } catch { /* ignore */ }
      }

      const effectiveKey = dbKey || envKey
      const source = dbKey ? 'database' : (envKey ? 'env' : 'none')

      const dbUrl = row?.apiUrl ?? ''
      const envUrl = meta.envUrlVar ? (process.env[meta.envUrlVar] ?? '') : ''
      const effectiveUrl = dbUrl || envUrl || meta.defaultUrl

      return {
        id: meta.id,
        displayName: meta.displayName,
        description: meta.description,
        capabilities: meta.capabilities,
        configured: !!effectiveKey,
        maskedKey: maskKey(effectiveKey),
        source,
        apiUrl: effectiveUrl,
        defaultUrl: meta.defaultUrl,
        hasCustomUrl: !!meta.envUrlVar,
        status: row ? (row.notes || 'unchecked') : 'unchecked',
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      }
    }),
  )

  return NextResponse.json({ providers })
}

// ── POST (save) ───────────────────────────────────────────────────────────────

const saveSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  apiUrl: z.string().optional(),
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

  const { provider, apiKey, apiUrl } = parsed.data
  const meta = PROVIDER_REGISTRY.find(p => p.id === provider)
  if (!meta) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  const encryptedKey = apiKey ? encryptVaultKey(apiKey) : undefined

  try {
    await prisma.integrationConfig.upsert({
      where: { key: meta.dbKey },
      update: {
        ...(encryptedKey !== undefined ? { apiKey: encryptedKey } : {}),
        ...(apiUrl !== undefined ? { apiUrl } : {}),
        notes: 'saved',
      },
      create: {
        key: meta.dbKey,
        displayName: meta.displayName,
        apiKey: encryptedKey ?? '',
        apiUrl: apiUrl ?? meta.defaultUrl,
        enabled: true,
        notes: 'saved',
      },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[settings/providers] POST error:', err)
    return NextResponse.json({ error: 'Failed to save provider config' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider query param required' }, { status: 400 })

  const meta = PROVIDER_REGISTRY.find(p => p.id === provider)
  if (!meta) return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })

  try {
    await prisma.integrationConfig.delete({ where: { key: meta.dbKey } }).catch(() => null)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[settings/providers] DELETE error:', err)
    return NextResponse.json({ error: 'Failed to remove provider config' }, { status: 500 })
  }
}
