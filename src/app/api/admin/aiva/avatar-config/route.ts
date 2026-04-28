import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const VALID_STATES = ['idle', 'listening', 'thinking', 'speaking', 'error'] as const
type AvatarState = (typeof VALID_STATES)[number]

/**
 * GET /api/admin/aiva/avatar-config
 *
 * Returns the current Aiva avatar configuration for all 5 states.
 * Used by AivaAssistant to load dynamically-generated image URLs.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await prisma.aivaAvatarConfig.findMany()
    const config: Record<string, { artifactId: string | null; imageUrl: string; prompt: string }> = {}
    for (const state of VALID_STATES) {
      const row = rows.find(r => r.state === state)
      config[state] = {
        artifactId: row?.artifactId ?? null,
        imageUrl: row?.imageUrl ?? '',
        prompt: row?.prompt ?? '',
      }
    }
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ config: buildEmptyConfig() })
  }
}

/**
 * POST /api/admin/aiva/avatar-config
 *
 * Upsert the avatar config for one or all states.
 *
 * Body:
 *   { state: "idle" | "listening" | ..., imageUrl: "...", artifactId?: "...", prompt?: "..." }
 *   OR
 *   { configs: [{ state, imageUrl, artifactId?, prompt? }, ...] }
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const items: Array<{ state: AvatarState; imageUrl: string; artifactId?: string | null; prompt?: string }> =
      Array.isArray(body.configs) ? body.configs : [body]

    const saved = []
    for (const item of items) {
      if (!VALID_STATES.includes(item.state as AvatarState)) continue
      const row = await prisma.aivaAvatarConfig.upsert({
        where: { state: item.state },
        update: {
          imageUrl: item.imageUrl ?? '',
          artifactId: item.artifactId ?? null,
          prompt: item.prompt ?? '',
        },
        create: {
          state: item.state,
          imageUrl: item.imageUrl ?? '',
          artifactId: item.artifactId ?? null,
          prompt: item.prompt ?? '',
        },
      })
      saved.push(row)
    }

    return NextResponse.json({ success: true, saved })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save avatar config' },
      { status: 500 },
    )
  }
}

function buildEmptyConfig() {
  const config: Record<string, { artifactId: null; imageUrl: string; prompt: string }> = {}
  for (const state of VALID_STATES) {
    config[state] = { artifactId: null, imageUrl: '', prompt: '' }
  }
  return config
}
