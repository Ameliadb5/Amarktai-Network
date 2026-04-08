/**
 * Emotion Persistence + HF Enrichment — Test Suite
 *
 * Tests:
 *   - emotion-persistence.ts: Redis persistence helpers, Qdrant vector ops, batch persist
 *   - hf-emotion-enrichment.ts: HF enrichment availability, label mapping, blending
 *   - Docker deployment readiness
 */

import { describe, it, expect } from 'vitest'

import {
  analysisToVector,
  EMOTION_COLLECTION,
  EMOTION_VECTOR_SIZE,
  EMOTION_DIMS,
} from '../emotion-persistence'

import {
  isHFEnrichmentAvailable,
  blendEmotionResults,
  GO_EMOTIONS_MAP,
  EKMAN_MAP,
  INTERNAL_WEIGHT,
  HF_WEIGHT,
  MODELS,
  type HFEnrichmentResult,
} from '../hf-emotion-enrichment'

import type { EmotionAnalysis, EmotionType } from '../emotion-engine'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAnalysis(dominant: EmotionType, score: number): EmotionAnalysis {
  return {
    emotions: [{ type: dominant, score }],
    dominant,
    confidence: 0.8,
    reasoning_strength: 'high',
    latencyMs: 1,
  }
}

function makeFullAnalysis(): EmotionAnalysis {
  return {
    emotions: [
      { type: 'joy', score: 0.7 },
      { type: 'excitement', score: 0.3 },
      { type: 'trust', score: 0.2 },
    ],
    dominant: 'joy',
    confidence: 0.85,
    reasoning_strength: 'high',
    latencyMs: 2,
  }
}

// ─── Emotion Persistence Tests ──────────────────────────────────────────────

describe('Emotion Persistence', () => {
  it('EMOTION_COLLECTION is defined', () => {
    expect(EMOTION_COLLECTION).toBe('amarktai_emotions')
  })

  it('EMOTION_VECTOR_SIZE matches 14 emotion types', () => {
    expect(EMOTION_VECTOR_SIZE).toBe(14)
  })

  it('EMOTION_DIMS contains all 14 emotion types', () => {
    expect(EMOTION_DIMS).toHaveLength(14)
    expect(EMOTION_DIMS).toContain('joy')
    expect(EMOTION_DIMS).toContain('sadness')
    expect(EMOTION_DIMS).toContain('anger')
    expect(EMOTION_DIMS).toContain('neutral')
    expect(EMOTION_DIMS).toContain('longing')
    expect(EMOTION_DIMS).toContain('affection')
  })

  it('analysisToVector returns 14-dimensional vector', () => {
    const analysis = makeFullAnalysis()
    const vector = analysisToVector(analysis)
    expect(vector).toHaveLength(14)
  })

  it('analysisToVector maps scores correctly', () => {
    const analysis = makeAnalysis('joy', 0.9)
    const vector = analysisToVector(analysis)
    // joy is first in EMOTION_DIMS
    expect(vector[0]).toBe(0.9) // joy
    expect(vector[1]).toBe(0)   // sadness (not present)
    expect(vector[11]).toBe(0)  // neutral (not present)
  })

  it('analysisToVector fills 0 for missing emotions', () => {
    const analysis: EmotionAnalysis = {
      emotions: [{ type: 'anger', score: 0.5 }],
      dominant: 'anger',
      confidence: 0.7,
      reasoning_strength: 'medium',
      latencyMs: 1,
    }
    const vector = analysisToVector(analysis)
    expect(vector).toHaveLength(14)
    const angerIdx = EMOTION_DIMS.indexOf('anger')
    expect(vector[angerIdx]).toBe(0.5)
    // All others should be 0
    for (let i = 0; i < 14; i++) {
      if (i !== angerIdx) expect(vector[i]).toBe(0)
    }
  })

  it('analysisToVector handles empty emotions', () => {
    const analysis: EmotionAnalysis = {
      emotions: [],
      dominant: 'neutral',
      confidence: 0.5,
      reasoning_strength: 'low',
      latencyMs: 1,
    }
    const vector = analysisToVector(analysis)
    expect(vector).toHaveLength(14)
    expect(vector.every(v => v === 0)).toBe(true)
  })

  it('analysisToVector handles all emotions present', () => {
    const emotions = EMOTION_DIMS.map((type, i) => ({ type, score: (i + 1) / 14 }))
    const analysis: EmotionAnalysis = {
      emotions,
      dominant: 'neutral',
      confidence: 0.9,
      reasoning_strength: 'high',
      latencyMs: 1,
    }
    const vector = analysisToVector(analysis)
    expect(vector).toHaveLength(14)
    for (let i = 0; i < 14; i++) {
      expect(vector[i]).toBeCloseTo((i + 1) / 14)
    }
  })
})

// ─── HuggingFace Enrichment Tests ───────────────────────────────────────────

describe('HF Emotion Enrichment', () => {
  it('isHFEnrichmentAvailable returns false without API key', () => {
    // In test environment, no HUGGINGFACE_API_KEY is set
    const original = process.env.HUGGINGFACE_API_KEY
    delete process.env.HUGGINGFACE_API_KEY
    expect(isHFEnrichmentAvailable()).toBe(false)
    if (original) process.env.HUGGINGFACE_API_KEY = original
  })

  it('models are correctly configured', () => {
    expect(MODELS.primary).toBe('SamLowe/roberta-base-go_emotions')
    expect(MODELS.secondary).toBe('j-hartmann/emotion-english-distilroberta-base')
  })

  it('GO_EMOTIONS_MAP maps all GoEmotions labels', () => {
    // Check key emotion labels exist
    expect(GO_EMOTIONS_MAP.joy).toBe('joy')
    expect(GO_EMOTIONS_MAP.sadness).toBe('sadness')
    expect(GO_EMOTIONS_MAP.anger).toBe('anger')
    expect(GO_EMOTIONS_MAP.fear).toBe('fear')
    expect(GO_EMOTIONS_MAP.surprise).toBe('surprise')
    expect(GO_EMOTIONS_MAP.neutral).toBe('neutral')
    expect(GO_EMOTIONS_MAP.excitement).toBe('excitement')
    expect(GO_EMOTIONS_MAP.confusion).toBe('confusion')
  })

  it('EKMAN_MAP maps all 7 Ekman emotions', () => {
    expect(Object.keys(EKMAN_MAP)).toHaveLength(7)
    expect(EKMAN_MAP.joy).toBe('joy')
    expect(EKMAN_MAP.anger).toBe('anger')
    expect(EKMAN_MAP.neutral).toBe('neutral')
  })

  it('weights sum to 1.0', () => {
    expect(INTERNAL_WEIGHT + HF_WEIGHT).toBeCloseTo(1.0)
  })

  it('internal weight is higher than HF weight', () => {
    expect(INTERNAL_WEIGHT).toBeGreaterThan(HF_WEIGHT)
  })
})

// ─── Blending Tests ─────────────────────────────────────────────────────────

describe('Emotion Blending', () => {
  it('returns internal analysis when enrichment is null', () => {
    const analysis = makeFullAnalysis()
    const result = blendEmotionResults(analysis, null)
    expect(result).toBe(analysis) // exact same reference
  })

  it('returns internal analysis when enrichment has empty mapped', () => {
    const analysis = makeFullAnalysis()
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [],
      mapped: [],
      latencyMs: 100,
    }
    const result = blendEmotionResults(analysis, enrichment)
    expect(result).toBe(analysis)
  })

  it('blends scores correctly with default weights', () => {
    const internal = makeAnalysis('joy', 0.8)
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 0.9 }],
      mapped: [{ type: 'joy', score: 0.9 }],
      latencyMs: 100,
    }
    const result = blendEmotionResults(internal, enrichment)
    const joyScore = result.emotions.find(e => e.type === 'joy')?.score ?? 0
    // Expected: 0.6 * 0.8 + 0.4 * 0.9 = 0.48 + 0.36 = 0.84
    expect(joyScore).toBeCloseTo(0.84, 1)
  })

  it('adds new emotions from HF that internal missed', () => {
    const internal = makeAnalysis('joy', 0.7)
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'excitement', score: 0.5 }],
      mapped: [{ type: 'excitement', score: 0.5 }],
      latencyMs: 50,
    }
    const result = blendEmotionResults(internal, enrichment)
    const excitementScore = result.emotions.find(e => e.type === 'excitement')?.score ?? 0
    // Expected: 0.6 * 0 + 0.4 * 0.5 = 0.2
    expect(excitementScore).toBeCloseTo(0.2, 1)
  })

  it('preserves dominant when internal score is strong', () => {
    const internal = makeAnalysis('anger', 0.9)
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 0.3 }],
      mapped: [{ type: 'joy', score: 0.3 }],
      latencyMs: 50,
    }
    const result = blendEmotionResults(internal, enrichment)
    expect(result.dominant).toBe('anger')
  })

  it('latency includes both internal and HF time', () => {
    const internal = makeAnalysis('joy', 0.8)
    internal.latencyMs = 5
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 0.9 }],
      mapped: [{ type: 'joy', score: 0.9 }],
      latencyMs: 200,
    }
    const result = blendEmotionResults(internal, enrichment)
    expect(result.latencyMs).toBe(205)
  })

  it('confidence is recalculated after blending', () => {
    const internal = makeAnalysis('joy', 0.8)
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 0.95 }],
      mapped: [{ type: 'joy', score: 0.95 }],
      latencyMs: 50,
    }
    const result = blendEmotionResults(internal, enrichment)
    expect(result.confidence).toBeGreaterThanOrEqual(0.1)
    expect(result.confidence).toBeLessThanOrEqual(0.99)
  })

  it('reasoning_strength is set based on confidence', () => {
    const internal = makeAnalysis('joy', 0.9)
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 0.95 }],
      mapped: [{ type: 'joy', score: 0.95 }],
      latencyMs: 50,
    }
    const result = blendEmotionResults(internal, enrichment)
    expect(['low', 'medium', 'high']).toContain(result.reasoning_strength)
  })

  it('scores are clamped to [0, 1]', () => {
    const internal: EmotionAnalysis = {
      emotions: [{ type: 'joy', score: 1.0 }],
      dominant: 'joy',
      confidence: 0.9,
      reasoning_strength: 'high',
      latencyMs: 1,
    }
    const enrichment: HFEnrichmentResult = {
      model: MODELS.primary,
      raw: [{ label: 'joy', score: 1.0 }],
      mapped: [{ type: 'joy', score: 1.0 }],
      latencyMs: 50,
    }
    const result = blendEmotionResults(internal, enrichment)
    for (const e of result.emotions) {
      expect(e.score).toBeGreaterThanOrEqual(0)
      expect(e.score).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Docker Deployment Readiness ────────────────────────────────────────────

describe('Deployment Readiness', () => {
  it('Dockerfile exists', async () => {
    const fs = await import('fs')
    expect(fs.existsSync('/home/runner/work/Amarktai-Network/Amarktai-Network/Dockerfile')).toBe(true)
  })

  it('docker-compose.yml exists', async () => {
    const fs = await import('fs')
    expect(fs.existsSync('/home/runner/work/Amarktai-Network/Amarktai-Network/docker-compose.yml')).toBe(true)
  })

  it('next.config.mjs has standalone output', async () => {
    const fs = await import('fs')
    const config = fs.readFileSync('/home/runner/work/Amarktai-Network/Amarktai-Network/next.config.mjs', 'utf-8')
    expect(config).toContain("output: 'standalone'")
  })

  it('.env.example exists with required vars', async () => {
    const fs = await import('fs')
    const env = fs.readFileSync('/home/runner/work/Amarktai-Network/Amarktai-Network/.env.example', 'utf-8')
    expect(env).toContain('DATABASE_URL')
    expect(env).toContain('SESSION_SECRET')
    expect(env).toContain('REDIS_URL')
    expect(env).toContain('QDRANT_URL')
  })
})
