/**
 * GET /api/brain/video-generate/[jobId]
 *
 * Polls the status of an async video generation job.
 *
 * Response status field:
 *   pending     — job accepted, not yet started
 *   processing  — provider is generating
 *   succeeded   — generation complete; resultUrl contains the video URL
 *   failed      — generation failed; errorMessage explains why
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVaultApiKey } from '@/lib/brain';
import { dispatchEvent } from '@/lib/webhook-manager';

async function pollReplicateJob(
  predictionId: string,
  apiKey: string,
): Promise<{ status: string; resultUrl?: string; error?: string; meta?: string }> {
  const res = await fetch(
    `https://api.replicate.com/v1/predictions/${predictionId}`,
    {
      headers: { Authorization: `Token ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Replicate poll failed (${res.status}): ${errText}`);
  }

  interface ReplicatePrediction {
    id: string;
    status: string;
    output?: unknown;
    error?: string;
    logs?: string;
  }
  const data = await res.json() as ReplicatePrediction;

  // Replicate statuses: starting | processing | succeeded | failed | canceled
  const normalised =
    data.status === 'succeeded'
      ? 'succeeded'
      : data.status === 'failed' || data.status === 'canceled'
        ? 'failed'
        : 'processing';

  let resultUrl: string | undefined;
  if (data.status === 'succeeded' && data.output) {
    // Output is typically an array of URLs or a single URL string
    const out = data.output;
    if (typeof out === 'string') {
      resultUrl = out;
    } else if (Array.isArray(out) && typeof out[0] === 'string') {
      resultUrl = out[0] as string;
    }
  }

  return {
    status: normalised,
    resultUrl,
    error: data.error ?? undefined,
    meta: JSON.stringify({ logs: data.logs }),
  };
}

async function pollQwenWanJob(
  providerJobId: string,
  apiKey: string,
): Promise<{ status: string; resultUrl?: string; error?: string }> {
  // providerJobId format: "qwen-wan:<task_id>"
  const taskId = providerJobId.replace(/^qwen-wan:/, '');
  if (!taskId) throw new Error('Invalid Qwen Wan providerJobId format');

  const res = await fetch(
    `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${taskId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Qwen Wan poll failed (${res.status}): ${errText}`);
  }

  interface QwenTaskResult {
    output?: {
      task_status?: string;
      video_url?: string;
      results?: Array<{ url?: string; video_url?: string }>;
      message?: string;
    };
  }
  const data = await res.json() as QwenTaskResult;
  const taskStatus = data?.output?.task_status ?? 'RUNNING';

  if (taskStatus === 'SUCCEEDED') {
    // Result may be in video_url or results[0].url/video_url
    const resultUrl =
      data.output?.video_url ??
      data.output?.results?.[0]?.video_url ??
      data.output?.results?.[0]?.url;
    return { status: 'succeeded', resultUrl };
  }
  if (taskStatus === 'FAILED') {
    return { status: 'failed', error: data.output?.message ?? 'Qwen Wan video generation failed' };
  }
  // PENDING | RUNNING | SUSPENDED
  return { status: 'processing' };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await prisma.videoGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // If job is already terminal, return stored state
  if (job.status === 'succeeded' || job.status === 'failed') {
    return NextResponse.json({
      capability: 'video_generation',
      jobId: job.id,
      status: job.status,
      provider: job.provider,
      model: job.modelId,
      prompt: job.prompt,
      resultUrl: job.resultUrl ?? null,
      errorMessage: job.errorMessage ?? null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  }

  // Poll provider for live status update
  let updated: { status: string; resultUrl?: string; error?: string; meta?: string } | null = null;

  try {
    if (job.provider === 'replicate' && job.providerJobId) {
      const apiKey = await getVaultApiKey('replicate');
      if (apiKey) {
        updated = await pollReplicateJob(job.providerJobId, apiKey);
      }
    } else if (job.provider === 'together' && job.providerJobId) {
      // Together AI synchronous jobs carry the result URL in the providerJobId itself.
      // Format: "together-sync:<jobId>:<resultUrl>" when already complete.
      if (job.providerJobId.startsWith('together-sync:')) {
        const parts = job.providerJobId.split(':');
        const resultUrl = parts.slice(2).join(':') || undefined;
        updated = { status: 'succeeded', resultUrl };
      } else {
        // Async Together jobs — mark as processing (no dedicated poll API available).
        updated = { status: 'processing' };
      }
    } else if (job.provider === 'qwen' && job.providerJobId) {
      const apiKey = await getVaultApiKey('qwen');
      if (apiKey) {
        updated = await pollQwenWanJob(job.providerJobId, apiKey);
      }
    } else if (job.provider === 'huggingface') {
      // Hugging Face video generation is no longer supported. Any legacy jobs that
      // were created via HF are marked failed with an actionable error message.
      updated = {
        status: 'failed',
        error:
          'Video generation via Hugging Face is not supported. ' +
          'Re-submit your request using Replicate or Together AI.',
      };
    }
  } catch {
    // Poll error — return current DB state without failing
    return NextResponse.json({
      capability: 'video_generation',
      jobId: job.id,
      status: job.status,
      provider: job.provider,
      model: job.modelId,
      prompt: job.prompt,
      resultUrl: job.resultUrl ?? null,
      errorMessage: 'Provider polling temporarily unavailable',
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  }

  // Update DB with latest status
  if (updated) {
    const dbUpdated = await prisma.videoGenerationJob.update({
      where: { id: jobId },
      data: {
        status: updated.status,
        resultUrl: updated.resultUrl ?? job.resultUrl ?? null,
        errorMessage: updated.error ?? job.errorMessage ?? null,
        resultMeta: updated.meta ?? job.resultMeta ?? null,
      },
    });

    // Dispatch webhook notification when job reaches terminal state
    if (
      (dbUpdated.status === 'succeeded' || dbUpdated.status === 'failed') &&
      job.status !== 'succeeded' && job.status !== 'failed' &&
      dbUpdated.appSlug
    ) {
      const eventType = dbUpdated.status === 'succeeded'
        ? 'video.generation.completed' as const
        : 'video.generation.failed' as const;
      dispatchEvent(dbUpdated.appSlug, eventType, {
        jobId: dbUpdated.id,
        status: dbUpdated.status,
        provider: dbUpdated.provider,
        model: dbUpdated.modelId,
        resultUrl: dbUpdated.resultUrl ?? null,
        errorMessage: dbUpdated.errorMessage ?? null,
      }).catch(() => {
        // Webhook dispatch is best-effort; never block the poll response
      });
    }

    return NextResponse.json({
      capability: 'video_generation',
      jobId: dbUpdated.id,
      status: dbUpdated.status,
      provider: dbUpdated.provider,
      model: dbUpdated.modelId,
      prompt: dbUpdated.prompt,
      resultUrl: dbUpdated.resultUrl ?? null,
      errorMessage: dbUpdated.errorMessage ?? null,
      createdAt: dbUpdated.createdAt,
      updatedAt: dbUpdated.updatedAt,
    });
  }

  return NextResponse.json({
    capability: 'video_generation',
    jobId: job.id,
    status: job.status,
    provider: job.provider,
    model: job.modelId,
    prompt: job.prompt,
    resultUrl: job.resultUrl ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}
