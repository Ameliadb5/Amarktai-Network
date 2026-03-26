/**
 * Retrieval Engine Tests
 *
 * Validates retrieval scoring, freshness computation, and keyword relevance.
 */
import { describe, it, expect } from 'vitest'
import {
  computeFreshnessScore,
  computeKeywordRelevance,
} from '@/lib/retrieval-engine'

describe('Retrieval Engine', () => {
  describe('computeFreshnessScore', () => {
    it('returns ~1.0 for very recent entries', () => {
      const now = new Date()
      const score = computeFreshnessScore(now)
      expect(score).toBeGreaterThan(0.95)
    })

    it('returns lower score for older entries', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const score = computeFreshnessScore(thirtyDaysAgo)
      expect(score).toBeLessThan(0.6)
      expect(score).toBeGreaterThan(0)
    })

    it('returns very low score for very old entries', () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const score = computeFreshnessScore(ninetyDaysAgo)
      expect(score).toBeLessThan(0.2)
    })

    it('always returns between 0 and 1', () => {
      const dates = [
        new Date(),
        new Date(Date.now() - 1000),
        new Date(Date.now() - 86400000),
        new Date(Date.now() - 86400000 * 365),
      ]
      for (const date of dates) {
        const score = computeFreshnessScore(date)
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('computeKeywordRelevance', () => {
    it('returns high score for exact match', () => {
      const score = computeKeywordRelevance('bitcoin price', 'The current bitcoin price is $50,000')
      expect(score).toBeGreaterThan(0.5)
    })

    it('returns 0 for no match', () => {
      const score = computeKeywordRelevance('quantum physics', 'The weather is nice today')
      expect(score).toBe(0)
    })

    it('returns partial score for partial match', () => {
      const score = computeKeywordRelevance('bitcoin ethereum price', 'Bitcoin is a cryptocurrency')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(1)
    })

    it('handles empty inputs gracefully', () => {
      expect(computeKeywordRelevance('', 'some content')).toBe(0)
      expect(computeKeywordRelevance('query', '')).toBe(0)
      expect(computeKeywordRelevance('', '')).toBe(0)
    })

    it('is case insensitive', () => {
      const score1 = computeKeywordRelevance('Bitcoin', 'bitcoin trading')
      const score2 = computeKeywordRelevance('bitcoin', 'Bitcoin trading')
      expect(score1).toBe(score2)
    })
  })
})
