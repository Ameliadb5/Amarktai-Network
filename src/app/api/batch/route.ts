import { NextRequest, NextResponse } from 'next/server'
import {
  createBatchJob,
  submitBatchJob,
  getBatchJob,
  getBatchResult,
  cancelBatchJob,
  listBatchJobs,
} from '@/lib/batch-processor'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'submit') {
      const { appSlug, items, config } = body
      if (!items?.length) {
        return NextResponse.json({ error: 'items array required' }, { status: 400 })
      }
      const job = await createBatchJob({
        appSlug: appSlug || 'default',
        items,
        config,
      })
      await submitBatchJob(job.id)
      return NextResponse.json({ success: true, job })
    }

    if (action === 'cancel') {
      const { jobId } = body
      if (!jobId) {
        return NextResponse.json({ error: 'jobId required' }, { status: 400 })
      }
      const cancelled = await cancelBatchJob(jobId)
      return NextResponse.json({ success: cancelled })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: submit, cancel' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    const appSlug = searchParams.get('appSlug') || 'default'

    if (jobId) {
      const job = await getBatchJob(jobId)
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      const result = await getBatchResult(jobId)
      return NextResponse.json({ job, result })
    }

    const jobs = await listBatchJobs(appSlug)
    return NextResponse.json({ jobs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get batch status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
