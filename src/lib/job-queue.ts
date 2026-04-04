/**
 * Job Queue — AmarktAI Network
 *
 * BullMQ-backed background job processing for async tasks like
 * video generation, batch processing, and scheduled operations.
 *
 * When REDIS_URL is not configured, queue operations degrade gracefully
 * (jobs run inline or are skipped) so the platform keeps working.
 *
 * Server-side only.
 */

import { Queue, Worker, type Job } from 'bullmq'

// ── Connection config ────────────────────────────────────────────────────────

function getConnection() {
  const url = process.env.REDIS_URL
  if (!url) return null
  // Parse the Redis URL for BullMQ connection options
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    }
  } catch {
    return null
  }
}

// ── Queue registry ──────────────────────────────────────────────────────────

const _queues = new Map<string, Queue>()

const JOB_QUEUE_NAME = 'amarktai-jobs'

/**
 * Get or create a named queue. Returns `null` if Redis is unavailable.
 */
export function getQueue(name: string = JOB_QUEUE_NAME): Queue | null {
  if (_queues.has(name)) return _queues.get(name)!
  const connection = getConnection()
  if (!connection) return null
  const queue = new Queue(name, { connection })
  _queues.set(name, queue)
  return queue
}

// ── Job types ───────────────────────────────────────────────────────────────

export type JobType =
  | 'video_generation'
  | 'batch_inference'
  | 'memory_summarization'
  | 'health_sync'
  | 'budget_reconciliation'

export interface JobPayload {
  type: JobType
  appSlug?: string
  data: Record<string, unknown>
}

/**
 * Enqueue a background job. Returns the job ID or `null` if queuing is unavailable.
 */
export async function enqueueJob(
  payload: JobPayload,
  opts?: { delay?: number; priority?: number },
): Promise<string | null> {
  const queue = getQueue(JOB_QUEUE_NAME)
  if (!queue) return null
  try {
    const job = await queue.add(payload.type, payload, {
      delay: opts?.delay,
      priority: opts?.priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })
    return job.id ?? null
  } catch {
    return null
  }
}

/**
 * Create a worker that processes jobs from the queue.
 * Returns `null` if Redis is unavailable.
 */
export function createWorker(
  processor: (job: Job<JobPayload>) => Promise<void>,
): Worker | null {
  const connection = getConnection()
  if (!connection) return null
  const worker = new Worker<JobPayload>(JOB_QUEUE_NAME, processor, {
    connection,
    concurrency: 5,
  })
  worker.on('failed', (job, err) => {
    console.error(`[JobQueue] Job ${job?.id} failed:`, err.message)
  })
  return worker
}

/**
 * Returns true when the job queue backend is available.
 */
export async function isJobQueueHealthy(): Promise<boolean> {
  const queue = getQueue(JOB_QUEUE_NAME)
  if (!queue) return false
  try {
    await queue.getJobCounts()
    return true
  } catch {
    return false
  }
}
