/**
 * Admin API — Job Queue Status
 *
 * GET /api/admin/jobs → Returns queue health, job counts, and recent failures
 *
 * Provides operator visibility into background processing: video generation,
 * batch inference, learning cycles, and other async tasks.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getQueue, isJobQueueHealthy } from '@/lib/job-queue'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const queueHealthy = await isJobQueueHealthy()

    // Get job counts from BullMQ if available
    let jobCounts: Record<string, number> = {}
    const queue = getQueue()
    if (queue) {
      try {
        jobCounts = await queue.getJobCounts() as Record<string, number>
      } catch {
        // Redis may be unavailable
      }
    }

    // Get batch job stats from DB
    let batchStats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    try {
      const [total, pending, processing, completed, failed] = await Promise.all([
        prisma.batchJob.count(),
        prisma.batchJob.count({ where: { status: 'pending' } }),
        prisma.batchJob.count({ where: { status: 'processing' } }),
        prisma.batchJob.count({ where: { status: 'completed' } }),
        prisma.batchJob.count({ where: { status: 'failed' } }),
      ])
      batchStats = { total, pending, processing, completed, failed }
    } catch {
      // DB may not have batch tables yet
    }

    // Get video job stats from DB
    let videoStats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    try {
      const [total, pending, processing, completed, failed] = await Promise.all([
        prisma.videoGenerationJob.count(),
        prisma.videoGenerationJob.count({ where: { status: 'pending' } }),
        prisma.videoGenerationJob.count({ where: { status: 'processing' } }),
        prisma.videoGenerationJob.count({ where: { status: 'succeeded' } }),
        prisma.videoGenerationJob.count({ where: { status: 'failed' } }),
      ])
      videoStats = { total, pending, processing, completed, failed }
    } catch {
      // DB may not have video tables yet
    }

    // Get recent learning cycles
    let learningStats = { totalCycles: 0, recentCycles: 0, lastCycleAt: null as string | null }
    try {
      const totalCycles = await prisma.appAgentLearningLog.count()
      const recentCycles = await prisma.appAgentLearningLog.count({
        where: { cycleDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      })
      const lastCycle = await prisma.appAgentLearningLog.findFirst({
        orderBy: { cycleDate: 'desc' },
        select: { cycleDate: true },
      })
      learningStats = {
        totalCycles,
        recentCycles,
        lastCycleAt: lastCycle?.cycleDate?.toISOString() ?? null,
      }
    } catch {
      // DB may not have learning tables yet
    }

    return NextResponse.json({
      queue: {
        healthy: queueHealthy,
        backendAvailable: !!queue,
        counts: jobCounts,
      },
      batch: batchStats,
      video: videoStats,
      learning: learningStats,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get job status' },
      { status: 500 },
    )
  }
}
