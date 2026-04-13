import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { callProvider, logBrainEvent } from '@/lib/brain'
import { orchestrate } from '@/lib/orchestrator'
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
} from '@/lib/capability-engine'
import { getAppSafetyConfig } from '@/lib/content-filter'
import { syncProviderHealthFromDB } from '@/lib/sync-provider-health'

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

const SPECIALIST_CAPABILITIES = new Set([
  'tts', 'voice', 'stt', 'voice_input', 'voice_output',
  'image', 'image_generation', 'image_gen', 'generate_image', 'create_image', 'image_editing',
  'suggestive', 'suggestive_image',
  'adult_image', 'adult_18plus_image',
  'research', 'research_search', 'deep_research',
  'video', 'video_generation', 'video_planning',
])

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start = Date.now()
  const traceId = randomUUID()

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

  const isSpecialist = SPECIALIST_CAPABILITIES.has(body.taskType) ||
    capabilities.some(c => SPECIALIST_CAPABILITIES.has(c))

  // Specialist tasks (image, TTS, STT, research, video, …) ALWAYS use the
  // correct specialist executor — even when the caller forces a providerKey.
  // Passing providerKey to callProvider for image tasks would silently route
  // to the default chat model (e.g. gpt-4o-mini) instead of the image API.
  if (isSpecialist) {
    // Use a safe, hardcoded internal origin to prevent SSRF via Host header manipulation
    const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
      || process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
      || 'http://localhost:3000'

    if (['tts', 'voice', 'voice_output'].includes(body.taskType)) {
      const ttsRes = await fetch(`${origin}/api/brain/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: body.message,
          voiceId: body.voiceId,
          gender: body.gender,
          accent: body.accent,
          provider: body.ttsProvider ?? 'auto',
        }),
      })
      const latencyMs = Date.now() - start
      if (ttsRes.ok) {
        const buffer = await ttsRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const audioUrl = `data:audio/mpeg;base64,${base64}`
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
    }

    if (['stt', 'voice_input'].includes(body.taskType)) {
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

    if (['image', 'image_generation', 'image_gen', 'generate_image', 'create_image'].includes(body.taskType)) {
      const imageRes = await fetch(`${origin}/api/brain/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: body.message }),
      })
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageUrl?: string; imageBase64?: string; error?: string; provider?: string; model?: string;
        code?: string; candidate_models?: unknown; rejection_reasons?: string[];
      }
      const imageSuccess = imageRes.ok && (!!imageData.imageUrl || !!imageData.imageBase64)
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
    }

    if (body.taskType === 'image_editing') {
      // Image editing requires an actual image to be provided. From the lab (text-only),
      // return a structured response explaining the required inputs rather than failing silently.
      const editRes = await fetch(`${origin}/api/brain/image-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: body.message }),
      })
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

    if (['suggestive', 'suggestive_image'].includes(body.taskType)) {
      const imageRes = await fetch(`${origin}/api/brain/suggestive-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: body.message, appSlug: body.appSlug }),
      })
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageUrl?: string; imageBase64?: string; error?: string; provider?: string; model?: string
      }
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

    if (['adult_image', 'adult_18plus_image'].includes(body.taskType)) {
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
      const imageRes = await fetch(`${origin}/api/brain/adult-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: body.message, appSlug: body.appSlug }),
      })
      const latencyMs = Date.now() - start
      const imageData = await imageRes.json().catch(() => ({})) as {
        imageBase64?: string; error?: string; provider?: string; model?: string;
        code?: string; gating_required?: boolean
      }
      const imageSuccess = imageRes.ok && !!imageData.imageBase64
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

    if (['research', 'research_search', 'deep_research'].includes(body.taskType)) {
      const depth = body.taskType === 'deep_research' ? 'deep' : 'shallow'
      const researchRes = await fetch(`${origin}/api/brain/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: body.message, depth }),
      })
      const latencyMs = Date.now() - start
      const rd = await researchRes.json().catch(() => ({})) as {
        answer?: string; sources?: string[]; reasoning?: string[];
        provider?: string; model?: string; error?: string
      }
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

    if (['video', 'video_generation', 'video_planning'].includes(body.taskType)) {
      return NextResponse.json({
        success: false, executed: false, traceId, output: null, videoStatus: 'unavailable',
        capability: capabilities, routedProvider: null, routedModel: null,
        executionMode: 'specialist', fallback_used: false,
        error: 'Video generation requires a Replicate API key. Use POST /api/brain/video-generate.',
        latencyMs: Date.now() - start, timestamp: new Date().toISOString(),
      })
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
}
