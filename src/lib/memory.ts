/**
 * Amarktai Network — Memory Layer
 *
 * Server-side only. Provides save, retrieve, and status operations for the
 * MemoryEntry table. All functions catch and log DB errors gracefully so a
 * missing table (before migration) never crashes the gateway.
 */

import { prisma } from '@/lib/prisma'

export type MemoryType = 'event' | 'summary' | 'context' | 'learned' | 'profile'

export interface MemorySaveInput {
  appSlug: string
  memoryType: MemoryType
  content: string
  key?: string
  importance?: number
  ttlDays?: number   // if set, the entry expires after N days
}

export interface MemoryEntry {
  id: number
  appSlug: string
  memoryType: string
  key: string
  content: string
  importance: number
  createdAt: Date
}

export interface MemoryStatus {
  /** true when the memory_entries table is reachable */
  available: boolean
  /** total entries across all apps */
  totalEntries: number
  /** slugs of apps that have stored memories */
  appSlugs: string[]
  /** human-readable status label */
  statusLabel: 'saving' | 'empty' | 'not_configured'
  error: string | null
}

/**
 * Save a memory entry for the given app.
 * Returns true on success, false on any DB error.
 */
export async function saveMemory(input: MemorySaveInput): Promise<boolean> {
  try {
    const expiresAt = input.ttlDays
      ? new Date(Date.now() + input.ttlDays * 86_400_000)
      : null

    await prisma.memoryEntry.create({
      data: {
        appSlug:    input.appSlug,
        memoryType: input.memoryType,
        key:        input.key ?? '',
        content:    input.content,
        importance: input.importance ?? 0.5,
        expiresAt,
      },
    })
    return true
  } catch (err) {
    console.warn('[memory] saveMemory failed:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Retrieve the most important / most recent memories for an app.
 * Returns an empty array on any DB error.
 */
export async function retrieveMemory(appSlug: string, limit = 10): Promise<MemoryEntry[]> {
  try {
    return await prisma.memoryEntry.findMany({
      where: {
        appSlug,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true, appSlug: true, memoryType: true, key: true,
        content: true, importance: true, createdAt: true,
      },
    })
  } catch (err) {
    console.warn('[memory] retrieveMemory failed:', err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Returns the current memory layer status for the admin dashboard.
 * Never throws.
 */
export async function getMemoryStatus(): Promise<MemoryStatus> {
  try {
    const totalEntries = await prisma.memoryEntry.count()
    const apps = await prisma.memoryEntry.findMany({
      select: { appSlug: true },
      distinct: ['appSlug'],
    })
    return {
      available:   true,
      totalEntries,
      appSlugs:    apps.map(a => a.appSlug),
      statusLabel: totalEntries > 0 ? 'saving' : 'empty',
      error:       null,
    }
  } catch (err) {
    return {
      available:   false,
      totalEntries: 0,
      appSlugs:    [],
      statusLabel: 'not_configured',
      error:       err instanceof Error ? err.message : 'Memory table unavailable — run migration',
    }
  }
}

// ── Profile Memory & Companion Mode ──────────────────────────────────────────

/**
 * Save or update a profile memory entry (user preferences, personality traits,
 * recurring topics). Only one profile entry per app+key combination.
 */
export async function saveProfileMemory(
  appSlug: string,
  key: string,
  content: string,
): Promise<boolean> {
  try {
    // Upsert: if a profile entry with this key already exists, update it
    const existing = await prisma.memoryEntry.findFirst({
      where: { appSlug, memoryType: 'profile', key },
    })
    if (existing) {
      await prisma.memoryEntry.update({
        where: { id: existing.id },
        data: { content, importance: 0.9 },
      })
    } else {
      await prisma.memoryEntry.create({
        data: {
          appSlug,
          memoryType: 'profile',
          key,
          content,
          importance: 0.9,
          expiresAt: null,  // profile memories never expire
        },
      })
    }
    return true
  } catch (err) {
    console.warn('[memory] saveProfileMemory failed:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Retrieve profile memories for an app.
 */
export async function getProfileMemories(appSlug: string): Promise<MemoryEntry[]> {
  try {
    return await prisma.memoryEntry.findMany({
      where: { appSlug, memoryType: 'profile' },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, appSlug: true, memoryType: true, key: true,
        content: true, importance: true, createdAt: true,
      },
    })
  } catch (err) {
    console.warn('[memory] getProfileMemories failed:', err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Build companion mode system prompt from profile + top memories.
 * Returns a string suitable for injecting into the LLM system prompt.
 */
export async function buildCompanionContext(appSlug: string): Promise<string> {
  const sections: string[] = []

  // 1. Load profile memories
  const profiles = await getProfileMemories(appSlug)
  if (profiles.length > 0) {
    sections.push('[User Profile]')
    for (const p of profiles) {
      sections.push(`${p.key}: ${p.content}`)
    }
  }

  // 2. Load top memories (recent + important)
  const memories = await retrieveMemory(appSlug, 10)
  const nonProfileMemories = memories.filter(m => m.memoryType !== 'profile')
  if (nonProfileMemories.length > 0) {
    sections.push('\n[Relevant Memories]')
    for (const m of nonProfileMemories.slice(0, 5)) {
      sections.push(`- ${m.content}`)
    }
  }

  return sections.length > 0
    ? sections.join('\n')
    : ''
}

/**
 * Export all memory entries for an app as a structured JSON object.
 */
export async function exportMemories(appSlug: string): Promise<{
  appSlug: string
  exportedAt: string
  entries: MemoryEntry[]
}> {
  const entries = await prisma.memoryEntry.findMany({
    where: { appSlug },
    orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, appSlug: true, memoryType: true, key: true,
      content: true, importance: true, createdAt: true,
    },
  })
  return {
    appSlug,
    exportedAt: new Date().toISOString(),
    entries,
  }
}

/**
 * Clear all memory entries for an app. Returns the count of deleted entries.
 */
export async function clearMemories(appSlug: string): Promise<number> {
  try {
    const result = await prisma.memoryEntry.deleteMany({ where: { appSlug } })
    return result.count
  } catch (err) {
    console.warn('[memory] clearMemories failed:', err instanceof Error ? err.message : err)
    return 0
  }
}
