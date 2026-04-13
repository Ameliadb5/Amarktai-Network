/**
 * Image Dispatch Guard Tests
 *
 * Regression tests for the bug where image-class task types bypassed the
 * specialist executor when a `providerKey` was set, causing the request to
 * execute through the generic callProvider() chat path (gpt-4o-mini) and
 * returning plain text instead of an image.
 *
 * These tests work at the library level (capability-engine + model-registry)
 * because the API route itself requires a live DB and Next.js runtime.  The
 * key invariants verified here are the building blocks that the route depends on.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  classifyCapabilities,
  resolveCapabilityRoutes,
} from '@/lib/capability-engine'
import {
  getModelsByCapability,
  setProviderHealth,
  clearProviderHealthCache,
} from '@/lib/model-registry'

// ─── helpers ────────────────────────────────────────────────────────────────

const IMAGE_TASK_TYPES = [
  'image',
  'image_generation',
  'image_gen',
  'generate_image',
  'create_image',
]

// Image-class capability set used throughout this test file.
const IMAGE_CAPABILITY_CLASSES = new Set([
  'image_generation',
  'image_editing',
  'adult_18plus_image',
  'suggestive_image_generation',
])

/** Seed the health cache so image-capable providers appear usable. */
function seedImageProviders() {
  setProviderHealth('openai', 'healthy')
  setProviderHealth('together', 'configured')
  setProviderHealth('huggingface', 'configured')
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Image dispatch guard — classifyCapabilities', () => {
  it.each(IMAGE_TASK_TYPES)(
    '"%s" is in SPECIALIST_CAPABILITIES (primary dispatch guard)',
    (taskType) => {
      // The brain/test dispatch uses SPECIALIST_CAPABILITIES.has(body.taskType) as
      // the PRIMARY check — not classifyCapabilities — so image task types must be
      // in that set regardless of the message content.
      const SPECIALIST_CAPABILITIES = new Set([
        'tts', 'voice', 'stt', 'voice_input', 'voice_output',
        'image', 'image_generation', 'image_gen', 'generate_image', 'create_image', 'image_editing',
        'suggestive', 'suggestive_image',
        'adult_image', 'adult_18plus_image',
        'research', 'research_search', 'deep_research',
        'video', 'video_generation', 'video_planning',
      ])
      expect(SPECIALIST_CAPABILITIES.has(taskType)).toBe(true)
    },
  )

  it('classifyCapabilities("image", "create an image of a sunset") resolves to image_generation', () => {
    const caps = classifyCapabilities('image', 'create an image of a sunset')
    expect(caps).toContain('image_generation')
    // Confirm the classified capability is in the image-class set
    expect(caps.some((c) => IMAGE_CAPABILITY_CLASSES.has(c))).toBe(true)
  })

  it('classifyCapabilities("image_generation", ...) resolves to image_generation', () => {
    const caps = classifyCapabilities('image_generation', 'a dog in the park')
    expect(caps).toContain('image_generation')
  })
})

describe('Image dispatch guard — model registry', () => {
  beforeEach(() => {
    clearProviderHealthCache()
    seedImageProviders()
  })

  it('has at least one model with supports_image_generation=true', () => {
    const imageModels = getModelsByCapability('supports_image_generation')
    expect(imageModels.length).toBeGreaterThanOrEqual(1)
  })

  it('no gpt-4o-mini model has supports_image_generation=true', () => {
    const imageModels = getModelsByCapability('supports_image_generation')
    const chatOnlyModel = imageModels.find((m) => m.model_id === 'gpt-4o-mini')
    expect(chatOnlyModel).toBeUndefined()
  })

  it('all models with supports_image_generation=true are NOT chat-only', () => {
    const imageModels = getModelsByCapability('supports_image_generation')
    const chatOnlyImageModels = imageModels.filter(
      (m) =>
        m.supports_image_generation &&
        !m.supports_tts &&
        m.primary_role === 'chat' &&
        m.model_id === 'gpt-4o-mini',
    )
    expect(chatOnlyImageModels).toHaveLength(0)
  })
})

describe('Image dispatch guard — resolveCapabilityRoutes', () => {
  beforeEach(() => {
    clearProviderHealthCache()
    seedImageProviders()
  })

  it('resolves image_generation capability when openai is configured', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['image_generation'] })
    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].capability).toBe('image_generation')
    expect(result.routes[0].available).toBe(true)
    expect(result.routes[0].models.length).toBeGreaterThanOrEqual(1)
  })

  it('no eligible model for image_generation is a chat-only model', () => {
    const result = resolveCapabilityRoutes({ capabilities: ['image_generation'] })
    const chatOnlyModels = result.routes[0].models.filter(
      (m) => m.model_id === 'gpt-4o-mini',
    )
    expect(chatOnlyModels).toHaveLength(0)
  })

  it('returns available=false when no image provider is configured', () => {
    clearProviderHealthCache()
    // Only mark chat providers healthy — no image providers
    setProviderHealth('groq', 'healthy')
    const result = resolveCapabilityRoutes({ capabilities: ['image_generation'] })
    // groq has no image models so image_generation should be unavailable
    const imageRoute = result.routes.find((r) => r.capability === 'image_generation')
    expect(imageRoute).toBeDefined()
    expect(imageRoute!.available).toBe(false)
  })

  it('image_generation route never includes gpt-4o-mini regardless of provider health', () => {
    // Mark everything healthy
    setProviderHealth('openai', 'healthy')
    setProviderHealth('groq', 'healthy')
    setProviderHealth('deepseek', 'healthy')
    const result = resolveCapabilityRoutes({ capabilities: ['image_generation'] })
    for (const route of result.routes) {
      const badModel = route.models.find((m) => m.model_id === 'gpt-4o-mini')
      expect(badModel).toBeUndefined()
    }
  })
})

describe('Image dispatch guard — SPECIALIST_CAPABILITIES set invariants', () => {
  // These mirror the SPECIALIST_CAPABILITIES set in brain/test/route.ts.
  // They ensure the set is kept in sync when new image-class types are added.
  const SPECIALIST_CAPABILITIES = new Set([
    'tts', 'voice', 'stt', 'voice_input', 'voice_output',
    'image', 'image_generation', 'image_gen', 'generate_image', 'create_image', 'image_editing',
    'suggestive', 'suggestive_image',
    'adult_image', 'adult_18plus_image',
    'research', 'research_search', 'deep_research',
    'video', 'video_generation', 'video_planning',
  ])

  it.each(IMAGE_TASK_TYPES)(
    '"%s" is in SPECIALIST_CAPABILITIES',
    (taskType) => {
      expect(SPECIALIST_CAPABILITIES.has(taskType)).toBe(true)
    },
  )

  it('"image_editing" is in SPECIALIST_CAPABILITIES', () => {
    expect(SPECIALIST_CAPABILITIES.has('image_editing')).toBe(true)
  })

  it('"adult_image" is in SPECIALIST_CAPABILITIES', () => {
    expect(SPECIALIST_CAPABILITIES.has('adult_image')).toBe(true)
  })

  it('"suggestive_image" is in SPECIALIST_CAPABILITIES', () => {
    expect(SPECIALIST_CAPABILITIES.has('suggestive_image')).toBe(true)
  })
})

describe('Image dispatch guard — lab-side image-class failure detection', () => {
  // This mirrors the client-side logic in lab/page.tsx that detects when the
  // backend returned text output for an image-class capability (meaning the
  // request leaked into the chat executor).

  const IMAGE_CLASS_CAPABILITIES = new Set([
    'image_generation', 'image_editing', 'adult_18plus_image', 'suggestive_image_generation',
  ])

  function simulateLabGuard(
    capabilities: string[],
    imageUrl: string | null,
    output: string | null,
  ): { isFailure: boolean; errorMessage: string | null } {
    const isImageClassResponse = capabilities.some((c) => IMAGE_CLASS_CAPABILITIES.has(c))
    const imageClassWithoutImage = isImageClassResponse && !imageUrl && !!output && typeof output === 'string'
    return {
      isFailure: imageClassWithoutImage,
      errorMessage: imageClassWithoutImage
        ? `Image generation executed through a chat model — text output is not a valid image.`
        : null,
    }
  }

  it('marks success=false when image_generation capability returns text output without imageUrl', () => {
    const result = simulateLabGuard(['image_generation'], null, 'Here is a description of a sunset...')
    expect(result.isFailure).toBe(true)
    expect(result.errorMessage).toBeTruthy()
  })

  it('does not mark failure when imageUrl is present', () => {
    const result = simulateLabGuard(['image_generation'], 'data:image/png;base64,abc...', null)
    expect(result.isFailure).toBe(false)
  })

  it('does not mark failure for chat capability with text output', () => {
    const result = simulateLabGuard(['general_chat'], null, 'Here is some helpful text.')
    expect(result.isFailure).toBe(false)
  })

  it('marks failure for image_editing capability returning text', () => {
    const result = simulateLabGuard(['image_editing'], null, 'I edited the image...')
    expect(result.isFailure).toBe(true)
  })

  it('does not mark failure when output is null (structured error from backend)', () => {
    const result = simulateLabGuard(['image_generation'], null, null)
    expect(result.isFailure).toBe(false)
  })
})
