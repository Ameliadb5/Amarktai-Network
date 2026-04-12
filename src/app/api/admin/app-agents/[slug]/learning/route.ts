/**
 * Admin API — App Agent Learning
 *
 * GET  /api/admin/app-agents/[slug]/learning → Get learning status & history
 * POST /api/admin/app-agents/[slug]/learning → Trigger manual learning cycle
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { runDailyLearningCycle } from '@/lib/daily-learning'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  const agent = await prisma.appAgent.findUnique({
    where: { appSlug: slug },
    select: {
      learningEnabled: true,
      autoImprovementEnabled: true,
      adminReviewRequired: true,
      lastLearningCycleAt: true,
      specialtyProfile: true,
      weakAreas: true,
    },
  })

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const logs = await prisma.appAgentLearningLog.findMany({
    where: { agent: { appSlug: slug } },
    orderBy: { cycleDate: 'desc' },
    take: 10,
  })

  return NextResponse.json({
    learning: {
      enabled: agent.learningEnabled,
      autoImprovement: agent.autoImprovementEnabled,
      adminReviewRequired: agent.adminReviewRequired,
      lastCycle: agent.lastLearningCycleAt,
      specialtyProfile: safeJsonParse(agent.specialtyProfile, {}),
      weakAreas: safeJsonParse(agent.weakAreas, []),
    },
    history: logs.map(l => ({
      id: l.id,
      cycleDate: l.cycleDate,
      cycleType: l.cycleType,
      summary: l.summary,
      improvements: safeJsonParse(l.improvements, []),
      metrics: safeJsonParse(l.metrics, {}),
      status: l.status,
    })),
  })
}

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  try {
    const result = await runDailyLearningCycle(slug)
    return NextResponse.json({ result })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Learning cycle failed',
    }, { status: 500 })
  }
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T } catch { return fallback }
}
