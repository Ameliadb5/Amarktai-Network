/**
 * Multimodal Router Tests
 *
 * Validates multimodal content type handling, prompt building,
 * and supported types reporting.
 */
import { describe, it, expect } from 'vitest'
import {
  buildCreativePrompt,
  getSupportedContentTypes,
  type MultimodalRequest,
} from '@/lib/multimodal-router'

describe('Multimodal Router', () => {
  describe('getSupportedContentTypes', () => {
    it('returns all supported content types', () => {
      const types = getSupportedContentTypes()
      expect(types.length).toBeGreaterThan(0)
      expect(types).toContain('text')
      expect(types).toContain('image_prompt')
      expect(types).toContain('ad_concept')
      expect(types).toContain('social_post')
      expect(types).toContain('campaign_plan')
    })
  })

  describe('buildCreativePrompt', () => {
    it('builds text prompt', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'text',
        prompt: 'Write a blog post about AI',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toBeTruthy()
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('builds image prompt with visual direction', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'image_prompt',
        prompt: 'A professional photo for a tech startup',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toBeTruthy()
      expect(prompt.toLowerCase()).toContain('image')
    })

    it('builds ad concept with structure', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'ad_concept',
        prompt: 'Instagram ad for summer sale',
        targetPlatform: 'instagram',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toBeTruthy()
    })

    it('builds campaign plan prompt', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'campaign_plan',
        prompt: 'Q4 product launch campaign',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toBeTruthy()
    })

    it('includes brand voice when provided', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'social_post',
        prompt: 'Post about our new feature',
        brandVoice: 'Professional, innovative, friendly',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toContain('Professional, innovative, friendly')
    })

    it('includes target platform when provided', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'social_post',
        prompt: 'Post about AI trends',
        targetPlatform: 'linkedin',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt.toLowerCase()).toContain('linkedin')
    })

    it('handles reel concept type', () => {
      const request: MultimodalRequest = {
        appSlug: 'amarktai-marketing',
        contentType: 'reel_concept',
        prompt: 'Quick tutorial on using our app',
      }
      const prompt = buildCreativePrompt(request)
      expect(prompt).toBeTruthy()
    })
  })
})
