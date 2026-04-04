import { NextRequest, NextResponse } from 'next/server'

// Fine-tuning job types
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

const jobs = new Map<string, FineTuneJob>()

function generateId(): string {
  return `ft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

      const job: FineTuneJob = {
        id: generateId(),
        provider,
        status: 'pending',
        baseModel,
        trainingFile: typeof trainingData === 'string' ? trainingData : `upload_${Date.now()}`,
        hyperparameters: hyperparameters || { epochs: 3, learning_rate_multiplier: 1.0 },
        createdAt: new Date().toISOString(),
        finishedAt: null,
        trainedTokens: null,
        resultModel: null,
        error: null,
      }

      jobs.set(job.id, job)

      // Simulate async training start
      setTimeout(() => {
        const j = jobs.get(job.id)
        if (j && j.status === 'pending') {
          j.status = 'running'
        }
      }, 2000)

      return NextResponse.json({ success: true, job })
    }

    if (action === 'cancel') {
      const { jobId } = body
      if (!jobId) {
        return NextResponse.json({ error: 'jobId required' }, { status: 400 })
      }
      const job = jobs.get(jobId)
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (job.status === 'succeeded' || job.status === 'failed') {
        return NextResponse.json({ error: 'Cannot cancel completed job' }, { status: 400 })
      }
      job.status = 'cancelled'
      return NextResponse.json({ success: true, job })
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
      const job = jobs.get(jobId)
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json({ job })
    }

    let allJobs = Array.from(jobs.values())
    if (provider) {
      allJobs = allJobs.filter(j => j.provider === provider)
    }

    return NextResponse.json({
      jobs: allJobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      total: allJobs.length,
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
