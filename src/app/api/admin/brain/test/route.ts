import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { callProvider, logBrainEvent } from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'
import { POST as handleBrainTTS } from '@/app/api/brain/tts/route'
import { POST as handleBrainImage } from '@/app/api/brain/image/route'
import { POST as handleBrainImageEdit } from '@/app/api/brain/image-edit/route'
import { POST as handleBrainSuggestiveImage } from '@/app/api/brain/suggestive-image/route'
import { POST as handleBrainAdultImage } from '@/app/api/brain/adult-image/route'
import { POST as handleBrainResearch } from '@/app/api/brain/research/route'
import { POST as handleBrainVideoGenerate } from '@/app/api/brain/video-generate/route'
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
  type CapabilityClass,
} from '@/lib/capability-engine'
import { getAppSafetyConfig } from '@/lib/content-filter'
import { syncProviderHealthFromDB } from '@/lib/sync-provider-health'
import { recordUsage } from '@/lib/usage-meter'

const testSchema = z.object({
  message: z.string().min(1).max(16_000),
  taskType: z.string().default('chat'),
  providerKey: z.string().optional(),
  modelId: z.string().optional(),
  appSlug: z.string().optional(),
  voiceId: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  accent: z.string().optional(),
  ttsProvider: z.string().optional(),
})

/** Capability classes that indicate an image-generation request. */
const IMAGE_CAPABILITY_CLASSES = new Set([
  'image', 'image_generation', 'image_gen', 'generate_image', 'create_image',
])

/** Capability classes that indicate a voice/TTS request. */
const TTS_CAPABILITY_CLASSES = new Set(['tts', 'voice', 'voice_output'])

/** Capability classes that indicate a STT request. */
const STT_CAPABILITY_CLASSES = new Set(['stt', 'voice_input'])

/** Capability classes that indicate a research request. */
const RESEARCH_CAPABILITY_CLASSES = new Set(['research', 'research_search', 'deep_research'])

/** Capability classes that indicate a video request. */
const VIDEO_CAPABILITY_CLASSES = new Set(['video', 'video_generation', 'video_planning'])

/**
 * Resolve the effective specialist type from both the explicit taskType AND
 * the detected capabilities array. This ensures that when a user sends
 * taskType="chat" but the message contains "create an image of a sunset",
 * the detected `image_generation` capability routes to the image handler
 * instead of falling through to the text orchestrator.
 */
function resolveSpecialistType(
  taskType: string,
  capabilities: string[],
): 'image' | 'image_editing' | 'suggestive' | 'adult_image' | 'tts' | 'stt' | 'research' | 'video' | null {
  // Explicit taskType always wins
  if (IMAGE_CAPABILITY_CLASSES.has(taskType)) return 'image'
  if (taskType === 'image_editing') return 'image_editing'
  if (['suggestive', 'suggestive_image'].includes(taskType)) return 'suggestive'
  if (['adult_image', 'adult_18plus_image'].includes(taskType)) return 'adult_image'
  if (TTS_CAPABILITY_CLASSES.has(taskType)) return 'tts'
  if (STT_CAPABILITY_CLASSES.has(taskType)) return 'stt'
  if (RESEARCH_CAPABILITY_CLASSES.has(taskType)) return 'research'
  if (VIDEO_CAPABILITY_CLASSES.has(taskType)) return 'video'

  // Fallback: infer from detected capabilities (message-based detection)
  for (const cap of capabilities) {
    if (IMAGE_CAPABILITY_CLASSES.has(cap) || cap === 'image_generation') return 'image'
    if (cap === 'image_editing') return 'image_editing'
    if (['suggestive_image_generation', 'suggestive_image'].includes(cap)) return 'suggestive'
    if (TTS_CAPABILITY_CLASSES.has(cap)) return 'tts'
    if (STT_CAPABILITY_CLASSES.has(cap)) return 'stt'
    if (RESEARCH_CAPABILITY_CLASSES.has(cap)) return 'research'
    if (VIDEO_CAPABILITY_CLASSES.has(cap)) return 'video'
  }

  return null
}

/** Invoke an internal route handler directly (no network self-fetch). */
function buildInternalJsonRequest(
  request: NextRequest,
  path: string,
  body: Record<string, unknown>,
): NextRequest {
  return new NextRequest(new URL(path, request.url).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * GET /api/admin/brain/test — Returns capability availability status.
 * Used by the TestAI tab on initial load to show which capabilities are
 * available / unavailable before any execution request is made.
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await syncProviderHealthFromDB()
    const allCapabilities = [
      'chat', 'code', 'reasoning', 'image', 'image_editing', 'video', 'video_planning',
      'tts', 'stt', 'vision', 'embeddings', 'reranking', 'research', 'suggestive',
      'adult_image', 'app_builder',
    ]
    const capabilityMap: Record<string, string> = {
      chat: 'general_chat', code: 'coding', reasoning: 'deep_reasoning',
      image: 'image_generation', image_editing: 'image_editing',
      video: 'video_generation', video_planning: 'video_planning',
      tts: 'voice_output', stt: 'voice_input', vision: 'multimodal_understanding',
      embeddings: 'embeddings', reranking: 'reranking', research: 'research_search',
      suggestive: 'suggestive_image_generation', adult_image: 'adult_18plus_image',
      app_builder: 'app_analysis',
    }
    const capabilities = allCapabilities.map(cap => {
      const internalCap = capabilityMap[cap] ?? cap
      const routes = resolveCapabilityRoutes({ capabilities: [internalCap as CapabilityClass] })
      const route = routes.routes[0]
      return {
        capability: cap,
        available: route?.available ?? false,
        reason: route?.missingMessage ?? null,
        routeExists: route?.available ?? false,
      }
    })
    return NextResponse.json({ capabilities })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load capabilities', code: 'CAPABILITY_LOAD_ERROR' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start = Date.now()
  const traceId = randomUUID()
  const usageAppSlug = 'workspace'

  try {

  // Sync the in-process provider health cache from DB before any capability
  // resolution. Without this, resolveCapabilityRoutes() calls getUsableModels()
  // against an empty cache on cold-start and returns all capabilities as
  // unavailable — causing a false 503 before the request reaches orchestrate().
  await syncProviderHealthFromDB()

  let body: z.infer<typeof testSchema>
  try {
    body = testSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request' },
      { status: 422 },
    )
  }

  const capabilities = classifyCapabilities(body.taskType, body.message)
  const safetyConfig = body.appSlug ? getAppSafetyConfig(body.appSlug) : undefined
  const capabilityRoutes = resolveCapabilityRoutes({
    capabilities,
    adultMode: safetyConfig?.adultMode,
    safeMode: safetyConfig?.safeMode,
  })

  // Resolve specialist type from BOTH taskType AND detected capabilities.
  // This prevents the critical bug where taskType="chat" + message="create an image"
  // detects image_generation capability but no specialist handler matches, causing
  // fallthrough to orchestrate() which routes to gpt-4o-mini for a text response.
  const specialistType = resolveSpecialistType(body.taskType, capabilities)
  const isSpecialist = specialistType !== null

  // Specialist tasks (image, TTS, STT, research, video, …) ALWAYS use the
  // correct specialist executor — even when the caller forces a providerKey.
  // Passing providerKey to callProvider for image tasks would silently route
  // to the default chat model (e.g. gpt-4o-mini) instead of the image API.
  if (isSpecialist) {
    if (specialistType === 'tts') {
      try {
      const ttsReq = buildInternalJsonRequest(request, '/api/brain/tts', {
        text: body.message,
        voiceId: body.voiceId,
        gender: body.gender,
        accent: body.accent,
        provider: body.ttsProvider ?? 'auto',
      })
      const ttsRes = await handleBrainTTS(ttsReq)
      const latencyMs = Date.now() - start
      if (ttsRes.ok) {
        const buffer = await ttsRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const audioUrl = `data:audio/mpeg;base64,${base64}`
        await recordUsage({
          appSlug: usageAppSlug,
          capability: 'tts',
          provider: ttsRes.headers.get('X-Provider') ?? 'unknown',
          model: ttsRes.headers.get('X-Model') ?? '',
          success: true,
          latencyMs,
          artifactCreated: true,
        })
        return NextResponse.json({
          success: true, executed: true, traceId,
          output: '[TTS audio generated]', audioUrl,
          capability: capabilities,
          routedProvider: ttsRes.headers.get('X-Provider') ?? 'auto',
          routedModel: ttsRes.headers.get('X-Model') ?? null,
          executionMode: 'specialist', fallback_used: false, latencyMs,
          timestamp: new Date().toISOString(),
        })
      }
      const ttsErr = await ttsRes.json().catch(() => ({})) as { error?: string }
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'tts',
        provider: 'unknown',
        model: '',
        success: false,
        latencyMs,
      })
      return NextResponse.json(
        {
          success: false, executed: false, traceId, output: null, audioUrl: null,
          capability: capabilities, routedProvider: null, routedModel: null,
          executionMode: 'specialist', fallback_used: false,
          error: ttsErr.error ?? `TTS failed: HTTP ${ttsRes.status}`,
          latencyMs, timestamp: new Date().toISOString(),
        },
        { status: ttsRes.status },
      )
      } catch (fetchErr) {
        const latencyMs = Date.now() - start
        return NextResponse.json(
          {
            success: false, executed: false, traceId, output: null, audioUrl: null,
            capability: capabilities, routedProvider: null, routedModel: null,
            executionMode: 'specialist', fallback_used: false,
            error: `Voice synthesis service unavailable: ${fetchErr instanceof Error ? fetchErr.message : 'connection failed'}. Configure a TTS provider in Admin → AI Providers.`,
            latencyMs, timestamp: new Date().toISOString(),
          },
          { status: 503 },
        )
      }
    }

    if (specialistType === 'stt') {
      return NextResponse.json(
        {
          success: false, executed: false, traceId, output: null,
          capability: capabilities, routedProvider: null, routedModel: null,
          executionMode: 'specialist', fallback_used: false,
          error: 'STT requires an audio file upload. Use POST /api/brain/stt with multipart/form-data.',
          latencyMs: Date.now() - start, timestamp: new Date().toISOString(),
        },
        { status: 400 },
      )
    }

    if (specialistType === 'image') {
      try {
      const imageReq = buildInternalJsonRequest(request, '/api/brain/image', {
        prompt: body.message,
      })
      const imageRes = await handleBrainImage(imageReq)
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageUrl?: string; imageBase64?: string; error?: string; provider?: string; model?: string;
        code?: string; candidate_models?: unknown; rejection_reasons?: string[];
      }
      const imageSuccess = imageRes.ok && (!!imageData.imageUrl || !!imageData.imageBase64)
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'image_generation',
        provider: imageData.provider ?? 'unknown',
        model: imageData.model ?? '',
        success: imageSuccess,
        latencyMs,
        artifactCreated: imageSuccess,
      })
      return NextResponse.json(
        {
          success: imageSuccess,
          executed: imageSuccess, traceId,
          output: imageSuccess ? '[Image generated]' : null,
          imageUrl: imageData.imageUrl ?? imageData.imageBase64 ?? null,
          capability: capabilities, routedProvider: imageData.provider ?? null,
          routedModel: imageData.model ?? null, executionMode: 'specialist', fallback_used: false,
          error: imageData.error ?? null,
          code: imageData.code ?? null,
          candidateModels: imageData.candidate_models ?? null,
          latencyMs, timestamp: new Date().toISOString(),
        },
        { status: imageSuccess ? 200 : (imageRes.ok ? 503 : imageRes.status) },
      )
      } catch (fetchErr) {
        const latencyMs = Date.now() - start
        return NextResponse.json(
          {
            success: false, executed: false, traceId,
            output: null, imageUrl: null,
            capability: capabilities, routedProvider: null, routedModel: null,
            executionMode: 'specialist', fallback_used: false,
            error: `Image generation handler invocation failed: ${fetchErr instanceof Error ? fetchErr.message : 'unknown error'}`,
            code: 'image_service_unavailable',
            latencyMs, timestamp: new Date().toISOString(),
          },
          { status: 503 },
        )
      }
    }

    if (specialistType === 'image_editing') {
      // Image editing requires an actual image to be provided. From the lab (text-only),
      // return a structured response explaining the required inputs rather than failing silently.
      const editReq = buildInternalJsonRequest(request, '/api/brain/image-edit', {
        prompt: body.message,
      })
      const editRes = await handleBrainImageEdit(editReq)
      const latencyMs = Date.now() - start
      const editData = await editRes.json().catch(() => ({})) as {
        executed?: boolean; imageUrl?: string; imageBase64?: string;
        error?: string; provider?: string; model?: string; code?: string;
      }
      const editSuccess = editRes.ok && (!!editData.imageUrl || !!editData.imageBase64)
      return NextResponse.json(
        {
          success: editSuccess,
          executed: editSuccess, traceId,
          output: editSuccess
            ? '[Image edited]'
            : null,
          imageUrl: editData.imageUrl ?? editData.imageBase64 ?? null,
          capability: capabilities, routedProvider: editData.provider ?? null,
          routedModel: editData.model ?? null, executionMode: 'specialist', fallback_used: false,
          error: editData.error ?? (editSuccess ? null : 'Image editing requires an image. Provide a base64 PNG in the "image" field of POST /api/brain/image-edit.'),
          code: editData.code ?? null,
          hint: 'Image editing requires: prompt (what to change) + image (base64 PNG of the original). ' +
                'Optional: mask (base64 PNG, white=edit area). ' +
                'API: POST /api/brain/image-edit',
          latencyMs, timestamp: new Date().toISOString(),
        },
        { status: editSuccess ? 200 : 400 },
      )
    }

    if (specialistType === 'suggestive') {
      const suggestiveReq = buildInternalJsonRequest(request, '/api/brain/suggestive-image', {
        prompt: body.message,
        appSlug: body.appSlug,
      })
      const imageRes = await handleBrainSuggestiveImage(suggestiveReq)
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageUrl?: string; imageBase64?: string; error?: string; provider?: string; model?: string
      }
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'suggestive_image_generation',
        provider: imageData.provider ?? 'unknown',
        model: imageData.model ?? '',
        success: imageRes.ok && (!!imageData.imageUrl || !!imageData.imageBase64),
        latencyMs,
        artifactCreated: imageRes.ok && (!!imageData.imageUrl || !!imageData.imageBase64),
      })
      return NextResponse.json(
        {
          success: imageRes.ok && (!!imageData.imageUrl || !!imageData.imageBase64),
          executed: imageRes.ok, traceId,
          output: imageRes.ok ? '[Image generated]' : null,
          imageUrl: imageData.imageUrl ?? imageData.imageBase64 ?? null,
          capability: capabilities, routedProvider: imageData.provider ?? null,
          routedModel: imageData.model ?? null, executionMode: 'specialist', fallback_used: false,
          error: imageData.error ?? null, latencyMs, timestamp: new Date().toISOString(),
        },
        { status: imageRes.ok ? 200 : imageRes.status },
      )
    }

    if (specialistType === 'adult_image') {
      if (!body.appSlug) {
        return NextResponse.json(
          {
            success: false, executed: false, traceId, output: null,
            capability: capabilities, routedProvider: null, routedModel: null,
            executionMode: 'specialist', fallback_used: false,
            error: 'Adult 18+ image generation requires appSlug. Set an app slug with adultMode=true enabled.',
            latencyMs: Date.now() - start, timestamp: new Date().toISOString(),
          },
          { status: 400 },
        )
      }
      const adultReq = buildInternalJsonRequest(request, '/api/brain/adult-image', {
        prompt: body.message,
        appSlug: body.appSlug,
      })
      const imageRes = await handleBrainAdultImage(adultReq)
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageBase64?: string; error?: string; provider?: string; model?: string;
        code?: string; gating_required?: boolean
      }
      const imageSuccess = imageRes.ok && !!imageData.imageBase64
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'adult_image_generation',
        provider: imageData.provider ?? 'unknown',
        model: imageData.model ?? '',
        success: imageSuccess,
        latencyMs,
        artifactCreated: imageSuccess,
      })
      return NextResponse.json(
        {
          success: imageSuccess, executed: imageSuccess, traceId,
          output: imageSuccess ? '[Adult image generated]' : null,
          imageUrl: imageData.imageBase64 ?? null,
          capability: capabilities, routedProvider: imageData.provider ?? null,
          routedModel: imageData.model ?? null, executionMode: 'specialist', fallback_used: false,
          error: imageData.error ?? null,
          code: imageData.code ?? null,
          gating_required: imageData.gating_required ?? false,
          latencyMs, timestamp: new Date().toISOString(),
        },
        { status: imageSuccess ? 200 : (imageRes.ok ? 503 : imageRes.status) },
      )
    }

    if (specialistType === 'research') {
      const depth = body.taskType === 'deep_research' ? 'deep' : 'shallow'
      const researchReq = buildInternalJsonRequest(request, '/api/brain/research', {
        query: body.message,
        depth,
      })
      const researchRes = await handleBrainResearch(researchReq)
      const latencyMs = Date.now() - start
      const rd = await researchRes.json().catch(() => ({})) as {
        answer?: string; sources?: string[]; reasoning?: string[];
        provider?: string; model?: string; error?: string
      }
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'research',
        provider: rd.provider ?? 'unknown',
        model: rd.model ?? '',
        success: researchRes.ok,
        latencyMs,
      })
      return NextResponse.json(
        {
          success: researchRes.ok, executed: researchRes.ok, traceId,
          output: rd.answer ?? null, capability: capabilities,
          routedProvider: rd.provider ?? null, routedModel: rd.model ?? null,
          executionMode: 'specialist', fallback_used: false,
          sources: rd.sources, reasoning: rd.reasoning,
          error: rd.error ?? null, latencyMs, timestamp: new Date().toISOString(),
        },
        { status: researchRes.ok ? 200 : researchRes.status },
      )
    }

    if (specialistType === 'video') {
      const videoReq = buildInternalJsonRequest(request, '/api/brain/video-generate', {
        prompt: body.message,
        appSlug: body.appSlug ?? 'workspace',
        provider: body.providerKey === 'auto' ? undefined : body.providerKey,
        model: body.modelId,
      })
      const videoRes = await handleBrainVideoGenerate(videoReq)
      const latencyMs = Date.now() - start
      const videoData = await videoRes.json().catch(() => ({})) as {
        executed?: boolean
        error?: string
        provider?: string
        model?: string
        jobId?: string
        status?: string
      }
      await recordUsage({
        appSlug: usageAppSlug,
        capability: 'video_generation',
        provider: videoData.provider ?? 'unknown',
        model: videoData.model ?? '',
        success: videoRes.ok && !!videoData.executed,
        latencyMs,
      })
      return NextResponse.json(
        {
          success: videoRes.ok && !!videoData.executed,
          executed: videoRes.ok && !!videoData.executed,
          traceId,
          output: videoData.executed ? '[Video generation job created]' : null,
          videoStatus: videoData.status ?? null,
          videoJobId: videoData.jobId ?? null,
          capability: capabilities,
          routedProvider: videoData.provider ?? null,
          routedModel: videoData.model ?? null,
          executionMode: 'specialist',
          fallback_used: false,
          error: videoData.error ?? null,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: videoRes.ok ? 202 : videoRes.status },
      )
    }
  }

  const unavailable = capabilityRoutes.routes.filter(r => !r.available)
  if (unavailable.length > 0 && !body.providerKey) {
    const latencyMs = Date.now() - start
    const reasons = unavailable.map(r => r.missingMessage ?? 'Capability unavailable').filter(Boolean)
    return NextResponse.json(
      {
        success: false, executed: false, traceId, output: null, capability: capabilities,
        capabilityRoutes: capabilityRoutes.routes.map(r => ({
          capability: r.capability, available: r.available, reason: r.missingMessage,
        })),
        routedProvider: null, routedModel: null, executionMode: null, fallback_used: false,
        routingReason: reasons.join(' '), error: reasons[0] ?? 'Required capability is not available',
        latencyMs, timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  // Direct provider call — only for non-specialist (text) tasks.
  // Image, TTS, STT, research, and video tasks are already handled above.
  if (body.providerKey && !isSpecialist) {
    const result = await callProvider(body.providerKey, body.modelId ?? '', body.message)
    const latencyMs = Date.now() - start
    await logBrainEvent({
      traceId, productId: null, appSlug: '__admin_test__', taskType: body.taskType,
      executionMode: 'direct', classificationJson: JSON.stringify({ capabilities }),
      routedProvider: body.providerKey, routedModel: result.model,
      validationUsed: false, consensusUsed: false, confidenceScore: null,
      success: result.ok, errorMessage: result.error ?? null, warningsJson: '[]', latencyMs,
    })
    await recordUsage({
      appSlug: usageAppSlug,
      capability: body.taskType,
      provider: body.providerKey,
      model: result.model,
      success: result.ok,
      latencyMs,
    })
    return NextResponse.json(
      {
        success: result.ok, executed: result.ok, traceId, output: result.output,
        capability: capabilities, routedProvider: body.providerKey, routedModel: result.model,
        executionMode: 'direct', confidenceScore: null, fallbackUsed: false, fallback_used: false,
        error: result.error ?? null, latencyMs, timestamp: new Date().toISOString(),
      },
      { status: result.ok ? 200 : 502 },
    )
  }

  const orchResult = await orchestrate({
    appCategory: 'generic', taskType: body.taskType, message: body.message,
  })
  const latencyMs = Date.now() - start
  const success = orchResult.errors.length === 0 && orchResult.output !== null

  if (!success && orchResult.routedProvider === null) {
    return NextResponse.json(
      {
        success: false, executed: false, traceId, output: null, capability: capabilities,
        routedProvider: null, routedModel: null, executionMode: orchResult.executionMode,
        fallback_used: false,
        routingReason: orchResult.routingReason ?? orchResult.errors[0] ?? 'No AI provider is configured and enabled',
        error: orchResult.errors[0] ?? 'No AI provider is configured and enabled',
        latencyMs, timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  await logBrainEvent({
    traceId, productId: null, appSlug: '__admin_test__', taskType: body.taskType,
    executionMode: orchResult.executionMode,
    classificationJson: JSON.stringify({ capabilities, ...orchResult.classification }),
    routedProvider: orchResult.routedProvider, routedModel: orchResult.routedModel,
    validationUsed: orchResult.validationUsed, consensusUsed: orchResult.consensusUsed,
    confidenceScore: orchResult.confidenceScore, success,
    errorMessage: orchResult.errors.length > 0 ? orchResult.errors.join('; ') : null,
    warningsJson: JSON.stringify(orchResult.warnings), latencyMs,
  })
  await recordUsage({
    appSlug: usageAppSlug,
    capability: body.taskType,
    provider: orchResult.routedProvider ?? 'unknown',
    model: orchResult.routedModel ?? '',
    success,
    latencyMs,
  })

  return NextResponse.json(
    {
      success, executed: success, traceId, output: orchResult.output,
      capability: capabilities, routedProvider: orchResult.routedProvider,
      routedModel: orchResult.routedModel, executionMode: orchResult.executionMode,
      confidenceScore: orchResult.confidenceScore,
      validationUsed: orchResult.validationUsed, consensusUsed: orchResult.consensusUsed,
      fallbackUsed: orchResult.fallbackUsed, fallback_used: orchResult.fallbackUsed,
      warnings: orchResult.warnings, routingReason: orchResult.routingReason,
      error: orchResult.errors[0] ?? null, latencyMs, timestamp: new Date().toISOString(),
    },
    { status: success ? 200 : 502 },
  )

  } catch (err) {
    const latencyMs = Date.now() - start
    return NextResponse.json(
      {
        success: false, executed: false, traceId, output: null,
        error: err instanceof Error ? err.message : 'Internal server error',
        latencyMs, timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
