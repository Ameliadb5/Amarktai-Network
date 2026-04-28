/**
 * GET /api/admin/aiva/context
 *
 * Returns live system-state data for Aiva's awareness panel.
 * Requires an active admin session.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getGenXStatusAsync } from '@/lib/genx-client'
import { getStorageStatus } from '@/lib/storage-driver'
import { getVaultApiKey } from '@/lib/brain'

const PROVIDER_KEYS: Record<string, string> = {
  genx: 'GENX_API_KEY',
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  grok: 'GROK_API_KEY',
  firecrawl: 'FIRECRAWL_API_KEY',
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── GenX status ───────────────────────────────────────────────────────────
    let genxStatus: { available: boolean; error: string | null; modelCount: number } = {
      available: false,
      error: null,
      modelCount: 0,
    }
    try {
      const status = await getGenXStatusAsync()
      let modelCount = 0
      if (status.available) {
        try {
          const { listGenXModels } = await import('@/lib/genx-client')
          const models = await listGenXModels()
          modelCount = models.length
        } catch {
          modelCount = 0
        }
      }
      genxStatus = { available: status.available, error: status.error, modelCount }
    } catch (e) {
      genxStatus = { available: false, error: e instanceof Error ? e.message : 'Unknown error', modelCount: 0 }
    }

    // ── Missing provider keys ─────────────────────────────────────────────────
    const missingKeys: string[] = []
    for (const [provider, envKey] of Object.entries(PROVIDER_KEYS)) {
      try {
        const val = process.env[envKey] ?? (await getVaultApiKey(provider))
        if (!val) missingKeys.push(provider)
      } catch {
        missingKeys.push(provider)
      }
    }

    // ── Storage status ────────────────────────────────────────────────────────
    let storagePersistent = false
    try {
      const storage = getStorageStatus()
      storagePersistent = storage.driver === 's3' || storage.driver === 'r2'
    } catch {
      storagePersistent = false
    }

    // ── Firecrawl status ──────────────────────────────────────────────────────
    const firecrawlStatus = !missingKeys.includes('firecrawl')

    // ── Artifact count ────────────────────────────────────────────────────────
    let artifactCount = 0
    try {
      artifactCount = await prisma.artifact.count()
    } catch {
      artifactCount = 0
    }

    // ── Last artifact ─────────────────────────────────────────────────────────
    let lastArtifact: { id: string; type: string; title: string; createdAt: string } | null = null
    try {
      const art = await prisma.artifact.findFirst({ orderBy: { createdAt: 'desc' } })
      if (art) {
        lastArtifact = { id: art.id, type: art.type, title: art.title, createdAt: art.createdAt.toISOString() }
      }
    } catch {
      lastArtifact = null
    }

    // ── Recent failures ───────────────────────────────────────────────────────
    let recentFailures: unknown[] = []
    try {
      recentFailures = await prisma.brainEvent.findMany({
        where: { success: false },
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: {
          id: true,
          traceId: true,
          appSlug: true,
          taskType: true,
          errorMessage: true,
          timestamp: true,
          routedProvider: true,
        },
      })
    } catch {
      recentFailures = []
    }

    // ── Fallback usage last 24h ───────────────────────────────────────────────
    let fallbackUsage = 0
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      fallbackUsage = await prisma.brainEvent.count({
        where: {
          timestamp: { gte: since },
          executionMode: { not: 'direct' },
        },
      })
    } catch {
      fallbackUsage = 0
    }

    // ── Last capability used ──────────────────────────────────────────────────
    let lastCapabilityUsed: string | null = null
    try {
      const lastEvent = await prisma.brainEvent.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { taskType: true },
      })
      lastCapabilityUsed = lastEvent?.taskType ?? null
    } catch {
      lastCapabilityUsed = null
    }

    return NextResponse.json({
      genxStatus,
      missingKeys,
      artifactCount,
      recentFailures,
      fallbackUsage,
      firecrawlStatus,
      storagePersistent,
      // Emotion state is managed by the in-memory emotion engine (src/lib/emotion-engine.ts).
      // When REDIS_URL is configured, emotion state can survive restarts via Redis.
      // Without it, all emotion memory resets on server restart.
      emotionPersistence: process.env.REDIS_URL ? 'redis' : 'in_memory',
      aivaChatReady: true,
      aivaVoiceReady: genxStatus.available,
      lastCapabilityUsed,
      lastArtifact,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
