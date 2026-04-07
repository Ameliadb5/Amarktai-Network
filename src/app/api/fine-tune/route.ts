import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

interface FineTuneJob {
  id: string
  provider: 'openai' | 'together' | 'qwen'
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  baseModel: string
  trainingFile: string
  hyperparameters: Record<string, unknown>
  createdAt: string
  finishedAt: string | null
  trainedTokens: number | null
  resultModel: string | null
  error: string | null
}

// ── DB helpers ───────────────────────────────────────────────────────────────

function rowToJob(row: {
  jobId: string
  provider: string
  status: string
  baseModel: string
  trainingFile: string
  hyperparameters: string
  createdAt: Date
  finishedAt: Date | null
  trainedTokens: number | null
  resultModel: string | null
  error: string | null
}): FineTuneJob {
  return {
    id: row.jobId,
    provider: row.provider as FineTuneJob['provider'],
    status: row.status as FineTuneJob['status'],
    baseModel: row.baseModel,
    trainingFile: row.trainingFile,
    hyperparameters: JSON.parse(row.hyperparameters) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    trainedTokens: row.trainedTokens,
    resultModel: row.resultModel,
    error: row.error,
  }
}

function generateId(): string {
  return `ft_${Date.now()}_${randomUUID().slice(0, 8)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { provider, baseModel, trainingData, hyperparameters } = body
      if (!provider || !baseModel || !trainingData) {
        return NextResponse.json(
          { error: 'provider, baseModel, and trainingData required' },
          { status: 400 },
        )
      }

      const supportedProviders = ['openai', 'together', 'qwen']
      if (!supportedProviders.includes(provider)) {
        return NextResponse.json(
          { error: `Unsupported provider. Use: ${supportedProviders.join(', ')}` },
          { status: 400 },
        )
      }

      const jobId = generateId()
      const row = await prisma.fineTuneJob.create({
        data: {
          jobId,
          provider,
          status: 'pending',
          baseModel,
          trainingFile: typeof trainingData === 'string' ? trainingData : `upload_${Date.now()}`,
          hyperparameters: JSON.stringify(hyperparameters || { epochs: 3, learning_rate_multiplier: 1.0 }),
        },
      })

      return NextResponse.json({ success: true, job: rowToJob(row) })
    }

    if (action === 'cancel') {
      const { jobId } = body
      if (!jobId) {
        return NextResponse.json({ error: 'jobId required' }, { status: 400 })
      }
      const row = await prisma.fineTuneJob.findUnique({ where: { jobId } })
      if (!row) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (row.status === 'succeeded' || row.status === 'failed') {
        return NextResponse.json({ error: 'Cannot cancel completed job' }, { status: 400 })
      }
      const updated = await prisma.fineTuneJob.update({
        where: { jobId },
        data: { status: 'cancelled' },
      })
      return NextResponse.json({ success: true, job: rowToJob(updated) })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: create, cancel' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fine-tune operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    const provider = searchParams.get('provider')

    if (jobId) {
      const row = await prisma.fineTuneJob.findUnique({ where: { jobId } })
      if (!row) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json({ job: rowToJob(row) })
    }

    const rows = await prisma.fineTuneJob.findMany({
      where: provider ? { provider } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      jobs: rows.map(rowToJob),
      total: rows.length,
      supportedProviders: ['openai', 'together', 'qwen'],
      supportedModels: {
        openai: ['gpt-4o-mini-2024-07-18', 'gpt-3.5-turbo-0125'],
        together: ['meta-llama/Llama-3-8b', 'mistralai/Mixtral-8x7B-v0.1'],
        qwen: ['qwen-turbo', 'qwen-plus'],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list fine-tune jobs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
