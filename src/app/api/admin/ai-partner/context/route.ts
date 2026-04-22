import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { retrieveMemory } from '@/lib/memory'
import { getAppUsageSummary } from '@/lib/usage-meter'

/**
 * GET /api/admin/ai-partner/context
 *
 * Returns recent workspace memories + 7-day usage snapshot to be injected
 * into the AI Partner system prompt, making replies memory-aware.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [memories, usage] = await Promise.allSettled([
    retrieveMemory('workspace', 8),
    getAppUsageSummary('workspace', 7),
  ])

  const memoryEntries = memories.status === 'fulfilled' ? memories.value : []
  const usageSummary = usage.status === 'fulfilled' ? usage.value : null

  // Build a concise memory context string for prompt injection
  const memoryLines = memoryEntries
    .filter((m) => m.content.trim().length > 0)
    .map((m) => `- [${m.memoryType}] ${m.content}`)

  // Build a concise usage context string
  const usageLines: string[] = []
  if (usageSummary) {
    if (usageSummary.totalRequests > 0) {
      usageLines.push(`Requests (7d): ${usageSummary.totalRequests}`)
    }
    if (usageSummary.totalCostCents > 0) {
      usageLines.push(`Cost (7d): $${(usageSummary.totalCostCents / 100).toFixed(4)}`)
    }
    const topCap = Object.entries(usageSummary.byCapability)
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, 3)
      .map(([cap, v]) => `${cap.replace(/_/g, ' ')} (${v.requests} req)`)
    if (topCap.length > 0) {
      usageLines.push(`Top capabilities: ${topCap.join(', ')}`)
    }
    const topProv = Object.entries(usageSummary.byProvider)
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, 2)
      .map(([p, v]) => `${p} (${v.requests} req)`)
    if (topProv.length > 0) {
      usageLines.push(`Top providers: ${topProv.join(', ')}`)
    }
  }

  return NextResponse.json({
    memoryLines,
    usageLines,
    memoryCount: memoryEntries.length,
  })
}
