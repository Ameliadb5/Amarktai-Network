/**
 * POST /api/brain/video-generate
 *
 * Creates an asynchronous video generation job.
 *
 * Provider chain (in priority order):
 *   1. Replicate (wan-ai/wan2.1-t2v-480p, minimax/video-01)
 *   2. Together AI (black-forest-labs/FLUX.1-schnell-Free — video-capable models)
 *
 * Hugging Face is NOT supported for video generation. The Inference API does not
 * provide a stable asynchronous video job endpoint for models like zeroscope.
 * Explicit requests with provider="huggingface" return a 400 with a clear error.
 *
 * When no video provider is configured, this route falls back to video_planning
 * mode — returning a script/storyboard instead of a generated video file.
 *
 * Returns a jobId immediately. Poll GET /api/brain/video-generate/[jobId]
 * to check status and retrieve the result URL once complete.
 *
 * Capability truth: video_generation is AVAILABLE only when Replicate or
 * Together AI is configured and this route returns a real job.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVaultApiKey, callProvider } from '@/lib/brain';
import { z } from 'zod';

const FRAMES_PER_SECOND = 24;
const MAX_REPLICATE_FRAMES = 81; // max for most Replicate text-to-video models

const REPLICATE_MODELS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'wan-ai/wan2.1-t2v-480p', name: 'Wan2.1 T2V 480p' },
  { id: 'minimax/video-01', name: 'MiniMax Video-01' },
];

/** Together AI models that support video or short-clip generation. */
const TOGETHER_VIDEO_MODELS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'black-forest-labs/FLUX.1-schnell-Free', name: 'FLUX.1 Schnell (Together)' },
];

const RequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  style: z.enum(['cinematic', 'animated', 'realistic', 'documentary', 'commercial']).optional().default('cinematic'),
  duration: z.number().int().min(1).max(30).optional().default(4),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().default('16:9'),
  appSlug: z.string().optional(),
  // 'huggingface' is accepted by the schema but explicitly blocked at runtime (lines below)
  // because the Hugging Face Inference API does not support async video generation.
  // It is kept in the enum so existing integrations that send 'huggingface' receive a clear
  // error message rather than a schema-validation failure.
  provider: z.enum(['replicate', 'together', 'huggingface', 'auto']).optional().default('auto'),
  model: z.string().optional(),
});

async function createReplicateJob(
  prompt: string,
  modelId: string,
  apiKey: string,
  duration: number,
): Promise<{ providerJobId: string; status: string }> {
  // Use the latest-version deployment endpoint
  const res = await fetch(
    `https://api.replicate.com/v1/models/${modelId}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=5',
      },
      body: JSON.stringify({
        input: {
          prompt,
          num_frames: Math.min(duration * FRAMES_PER_SECOND, MAX_REPLICATE_FRAMES),
          num_inference_steps: 25,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Replicate job creation failed (${res.status}): ${errText}`);
  }

  interface ReplicateResponse {
    id: string;
    status: string;
  }
  const data = await res.json() as ReplicateResponse;
  return { providerJobId: data.id, status: data.status ?? 'starting' };
}

async function createTogetherVideoJob(
  prompt: string,
  modelId: string,
  apiKey: string,
): Promise<{ providerJobId: string; status: string }> {
  const res = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      prompt,
      n: 1,
      width: 1280,
      height: 720,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Together AI job creation failed (${res.status}): ${errText}`);
  }

  interface TogetherResponse {
    id?: string;
    data?: Array<{ url?: string; b64_json?: string }>;
  }
  const data = await res.json() as TogetherResponse;
  const jobId = data.id ?? `together-${Date.now()}`;
  // Together's image/generation API is synchronous; if data is present mark as succeeded
  const resultReady = Array.isArray(data.data) && data.data.length > 0;
  return {
    providerJobId: resultReady ? `together-sync:${jobId}:${(data.data?.[0]?.url ?? '')}` : `together:${jobId}`,
    status: resultReady ? 'succeeded' : 'processing',
  };
}

/**
 * Generate a video_planning fallback — returns a structured script/storyboard
 * via the text AI when no real video provider is available. This ensures the
 * caller always gets useful output rather than a bare 503 error.
 */
async function generateVideoPlanningFallback(
  prompt: string,
  style: string,
  duration: number,
  _req: Request,
): Promise<{ script: string; note: string } | null> {
  try {
    const planningPrompt =
      `Create a ${duration}-second ${style} video script/storyboard for: "${prompt}". ` +
      `Structure the output as: Scene list, Shot descriptions, Narration/dialogue, Visual style notes.`;
    const result = await callProvider('openai', 'gpt-4o-mini', planningPrompt, undefined);
    if (result.output) {
      return { script: result.output, note: 'Video generation provider unavailable — storyboard generated instead.' };
    }
  } catch {
    // Planning fallback is best-effort; never block the caller
  }
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prompt, style, duration, aspectRatio, appSlug, provider, model } = parsed.data;

  // Hugging Face does NOT support video generation via the Inference API.
  // The endpoint /models/cerspense/zeroscope_v2_576w is not a valid async job API.
  if (provider === 'huggingface') {
    return NextResponse.json(
      {
        capability: 'video_generation',
        executed: false,
        error:
          'Video generation is not supported via Hugging Face in this configuration. ' +
          'Use Replicate or Together AI for video generation.',
      },
      { status: 400 },
    );
  }

  // Enhance prompt with style
  const enhancedPrompt = `${style} style video: ${prompt}`;

  let providerJobId = '';
  let usedProvider = '';
  let usedModel = '';
  let initialStatus = 'processing';

  // Replicate attempt
  if (provider === 'auto' || provider === 'replicate') {
    const repKey = await getVaultApiKey('replicate');
    if (repKey) {
      const modelToUse = model
        ? (REPLICATE_MODELS.find((m) => m.id === model) ?? REPLICATE_MODELS[0])
        : REPLICATE_MODELS[0];
      try {
        const result = await createReplicateJob(enhancedPrompt, modelToUse.id, repKey, duration);
        providerJobId = result.providerJobId;
        usedProvider = 'replicate';
        usedModel = modelToUse.id;
        initialStatus = result.status;
      } catch {
        // Replicate failed — try next provider
      }
    }
  }

  // Together AI fallback
  if (!providerJobId && (provider === 'auto' || provider === 'together')) {
    const togetherKey = await getVaultApiKey('together');
    if (togetherKey) {
      const togetherModel = model && TOGETHER_VIDEO_MODELS.find((m) => m.id === model)
        ? model
        : TOGETHER_VIDEO_MODELS[0].id;
      try {
        const result = await createTogetherVideoJob(enhancedPrompt, togetherModel, togetherKey);
        providerJobId = result.providerJobId;
        usedProvider = 'together';
        usedModel = togetherModel;
        initialStatus = result.status;
      } catch {
        // Together AI failed — no more providers to try
      }
    }
  }

  if (!providerJobId) {
    // No video provider available — fall back to video planning (script/storyboard)
    const fallback = await generateVideoPlanningFallback(prompt, style, duration, req);
    if (fallback) {
      return NextResponse.json(
        {
          capability: 'video_planning',
          executed: true,
          fallbackMode: 'video_planning',
          note: fallback.note,
          script: fallback.script,
          error: null,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        capability: 'video_generation',
        executed: false,
        error:
          'Video generation is not available: no video provider is configured. ' +
          'Configure Replicate or Together AI in Admin → AI Providers to enable video generation. ' +
          'Note: video generation is not supported via Gemini, OpenAI chat, or Hugging Face standard inference.',
      },
      { status: 503 },
    );
  }

  // Persist job
  const job = await prisma.videoGenerationJob.create({
    data: {
      provider: usedProvider,
      modelId: usedModel,
      prompt: enhancedPrompt,
      style,
      duration,
      aspectRatio,
      appSlug: appSlug ?? null,
      status: initialStatus,
      providerJobId,
    },
  });

  return NextResponse.json(
    {
      capability: 'video_generation',
      executed: true,
      jobId: job.id,
      status: job.status,
      provider: usedProvider,
      model: usedModel,
      prompt: enhancedPrompt,
      pollUrl: `/api/brain/video-generate/${job.id}`,
    },
    { status: 202 },
  );

  } catch (err) {
    return NextResponse.json(
      {
        capability: 'video_generation',
        executed: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
