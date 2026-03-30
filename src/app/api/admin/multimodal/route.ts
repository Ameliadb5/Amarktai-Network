import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getMultimodalStatus } from '@/lib/multimodal-router'
import { getModelRegistry } from '@/lib/model-registry'
import { getAppSafetyConfig } from '@/lib/content-filter'

/**
 * GET /api/admin/multimodal — returns multimodal capabilities in dashboard format.
 *
 * Maps the internal MultimodalStatus into the shape the Media dashboard page expects:
 *   { capabilities: ModalityCapability[], routes: [], stats: {} }
 */
export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await getMultimodalStatus()
    const models = getModelRegistry()

    // Build provider/model lists per modality from the model registry
    const textProviders = new Set<string>()
    const textModels = new Set<string>()
    const imageProviders = new Set<string>()
    const imageModels = new Set<string>()
    const voiceProviders = new Set<string>()
    const voiceModels = new Set<string>()
    const videoProviders = new Set<string>()
    const videoModels = new Set<string>()

    for (const m of models) {
      const caps = m.capabilities ?? []
      const name = m.model_name ?? m.model_id

      if (caps.includes('chat') || caps.includes('code') || caps.includes('reasoning')) {
        textProviders.add(m.provider)
        textModels.add(name)
      }
      if (caps.includes('image') || caps.includes('vision')) {
        imageProviders.add(m.provider)
        imageModels.add(name)
      }
      if (caps.includes('tts') || caps.includes('stt')) {
        voiceProviders.add(m.provider)
        voiceModels.add(name)
      }
      if (caps.includes('video')) {
        videoProviders.add(m.provider)
        videoModels.add(name)
      }
    }

    // Adult 18+ safety config status
    const defaultSafety = getAppSafetyConfig('__default__')

    const capabilities = [
      {
        modality: 'text',
        providers: Array.from(textProviders),
        models: Array.from(textModels),
        status: status.textGenerationReady ? 'active' as const : 'offline' as const,
      },
      {
        modality: 'image',
        providers: Array.from(imageProviders),
        models: Array.from(imageModels),
        status: status.imagePromptReady ? 'active' as const : 'offline' as const,
      },
      {
        modality: 'voice',
        providers: Array.from(voiceProviders),
        models: Array.from(voiceModels),
        status: status.voiceReady ? 'active' as const : 'offline' as const,
      },
      {
        modality: 'video',
        providers: Array.from(videoProviders),
        models: Array.from(videoModels),
        status: status.videoConceptReady ? 'active' as const : 'offline' as const,
      },
    ]

    const allProviders = new Set([...textProviders, ...imageProviders, ...voiceProviders, ...videoProviders])
    const activeModalities = capabilities.filter(c => c.status === 'active').length

    return NextResponse.json({
      capabilities,
      stats: {
        availableModalities: activeModalities,
        activeRoutes: capabilities.reduce((sum, c) => sum + c.models.length, 0),
        supportedProviders: allProviders.size,
        requestVolume: 0,
      },
      adultMode: {
        available: true,
        enabled: defaultSafety.adultMode,
        safeMode: defaultSafety.safeMode,
        note: 'Adult 18+ content is gated per-app. CSAM/violence/self-harm always blocked.',
      },
      statusLabel: status.statusLabel,
    })
  } catch (err) {
    console.error('[multimodal] GET error:', err)
    return NextResponse.json({
      capabilities: [],
      stats: { availableModalities: 0, activeRoutes: 0, supportedProviders: 0, requestVolume: 0 },
      adultMode: { available: false, enabled: false, safeMode: true, note: 'Error loading status' },
      statusLabel: 'not_configured',
    })
  }
}
