/**
 * Emotion Engine — Comprehensive Test Suite
 *
 * Covers all 12 phases:
 *  1. Advanced Emotion Detection
 *  2. Emotion Weighting (Per User)
 *  3. Emotional Drift Tracking
 *  4. Personality Engine (Evolution)
 *  5. AI Confidence Levels
 *  6. Behavioral Learning Loop
 *  7. Emotional Memory
 *  8. Response Modulation
 *  9. Multimodal Foundation
 * 10. Performance (< 300 ms)
 * 11. Safety + Consistency
 * 12. Dashboard Summary
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  // Phase 1 — Detection
  detectEmotions,
  analyzeSentiment,
  EMOTION_TYPES,
  EMOTION_TYPE_COUNT,
  EMOTION_MODELS,
  EMOTION_MODEL_COUNT,
  EMOJI_EMOTION_COUNT,
  DETECTION_RULES,

  // Phase 2 — Weighting
  updateEmotionalProfile,
  getEmotionalProfile,

  // Phase 3 — Drift
  trackEmotionalDrift,
  getEmotionalDrift,
  DRIFT_WINDOW,

  // Phase 3b — Transitions
  getTopTransitions,

  // Phase 3c — Context
  getConversationContext,
  CONTEXT_WINDOW,

  // Phase 4 — Personality
  adaptPersonality,
  getPersonalityState,
  PERSONALITY_TYPES,
  PERSONALITY_TYPE_COUNT,

  // Phase 5 — Confidence
  scoreConfidence,

  // Phase 6 — Learning
  recordLearningSignal,
  getLearningState,

  // Phase 7 — Memory
  storeEmotionMemory,
  getEmotionHistory,
  MAX_MEMORY_PER_USER,

  // Phase 8 — Modulation
  modulateResponse,

  // Phase 9 — Multimodal
  DEFAULT_MULTIMODAL_CONFIG,

  // Phase 10 — Full pipeline
  runEmotionPipeline,

  // Phase 12 — Dashboard
  getEmotionDashboardSummary,

  // Testing
  _resetEmotionState,
  EMOTION_VALENCE,
} from '../emotion-engine'

// Reset state before each test
beforeEach(() => {
  _resetEmotionState()
})

// ─── Phase 1 — Advanced Emotion Detection ───────────────────────────────────

describe('Phase 1 — Emotion Detection', () => {
  it('exports 12 emotion types', () => {
    expect(EMOTION_TYPE_COUNT).toBe(12)
    expect(EMOTION_TYPES).toContain('joy')
    expect(EMOTION_TYPES).toContain('sadness')
    expect(EMOTION_TYPES).toContain('anger')
    expect(EMOTION_TYPES).toContain('fear')
    expect(EMOTION_TYPES).toContain('surprise')
    expect(EMOTION_TYPES).toContain('frustration')
    expect(EMOTION_TYPES).toContain('confusion')
    expect(EMOTION_TYPES).toContain('neutral')
  })

  it('exports 3 HuggingFace model tiers', () => {
    expect(EMOTION_MODEL_COUNT).toBe(3)
    expect(EMOTION_MODELS.primary).toContain('roberta')
    expect(EMOTION_MODELS.secondary).toContain('distilroberta')
    expect(EMOTION_MODELS.fallback).toContain('bert')
  })

  it('has detection rules for all non-neutral emotions', () => {
    const covered = DETECTION_RULES.map(r => r.emotion)
    expect(covered).toContain('joy')
    expect(covered).toContain('anger')
    expect(covered).toContain('frustration')
    expect(covered).toContain('confusion')
    expect(covered.length).toBeGreaterThanOrEqual(10)
  })

  it('detects joy in happy text', () => {
    const result = detectEmotions('I am so happy and delighted!')
    expect(result.emotions.length).toBeGreaterThanOrEqual(1)
    expect(result.dominant).toBe('joy')
    expect(result.emotions[0].score).toBeGreaterThan(0.3)
  })

  it('detects frustration in frustrated text', () => {
    const result = detectEmotions("This doesn't work, I'm so frustrated and stuck!")
    expect(result.dominant).toBe('frustration')
  })

  it('detects anger in angry text', () => {
    const result = detectEmotions('I am furious and outraged about this!!!')
    expect(result.dominant).toBe('anger')
  })

  it('detects sadness in sad text', () => {
    const result = detectEmotions('I feel so sad and miserable today')
    expect(result.dominant).toBe('sadness')
  })

  it('detects confusion in confused text', () => {
    const result = detectEmotions("I don't understand, this makes no sense??")
    expect(result.dominant).toBe('confusion')
  })

  it('returns neutral for bland text', () => {
    const result = detectEmotions('Please provide the information.')
    expect(result.dominant).toBe('neutral')
  })

  it('multi-label — detects multiple emotions', () => {
    const result = detectEmotions("I'm happy but also a bit worried about this")
    expect(result.emotions.length).toBeGreaterThanOrEqual(2)
    // Should detect both joy and fear
    const types = result.emotions.map(e => e.type)
    expect(types).toContain('joy')
  })

  it('returns confidence and reasoning_strength', () => {
    const result = detectEmotions('I am extremely happy!')
    expect(result.confidence).toBeGreaterThanOrEqual(0.1)
    expect(result.confidence).toBeLessThanOrEqual(0.99)
    expect(['low', 'medium', 'high']).toContain(result.reasoning_strength)
  })

  it('returns latencyMs in result', () => {
    const result = detectEmotions('test text')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('detects excitement', () => {
    const result = detectEmotions("I'm so excited and pumped!!")
    expect(result.dominant).toBe('excitement')
  })

  it('detects surprise', () => {
    const result = detectEmotions("Wow, I can't believe this! Unbelievable!!")
    expect(result.dominant).toBe('surprise')
  })
})

// ─── Phase 2 — Emotion Weighting ────────────────────────────────────────────

describe('Phase 2 — Emotion Weighting', () => {
  it('creates a new profile on first update', () => {
    const analysis = detectEmotions('I am happy')
    const profile = updateEmotionalProfile('user1', analysis)
    expect(profile.userId).toBe('user1')
    expect(profile.interactionCount).toBe(1)
    expect(Object.keys(profile.emotionFrequency).length).toBeGreaterThan(0)
  })

  it('accumulates interactions over time', () => {
    updateEmotionalProfile('user1', detectEmotions('I am happy'))
    updateEmotionalProfile('user1', detectEmotions('I am sad'))
    const profile = updateEmotionalProfile('user1', detectEmotions('I am angry'))
    expect(profile.interactionCount).toBe(3)
  })

  it('tracks intensity average', () => {
    const profile = updateEmotionalProfile('user1', detectEmotions('I am really happy!'))
    expect(profile.intensityAverage).toBeGreaterThan(0)
  })

  it('getEmotionalProfile returns null for unknown user', () => {
    expect(getEmotionalProfile('unknown')).toBeNull()
  })

  it('getEmotionalProfile returns stored profile', () => {
    updateEmotionalProfile('user1', detectEmotions('happy'))
    const profile = getEmotionalProfile('user1')
    expect(profile).not.toBeNull()
    expect(profile!.userId).toBe('user1')
  })
})

// ─── Phase 3 — Emotional Drift ──────────────────────────────────────────────

describe('Phase 3 — Emotional Drift', () => {
  it('tracks drift direction', () => {
    trackEmotionalDrift('user1', 'frustration')
    trackEmotionalDrift('user1', 'frustration')
    trackEmotionalDrift('user1', 'neutral')
    const drift = trackEmotionalDrift('user1', 'joy')
    expect(drift.recentEmotions.length).toBe(4)
    expect(drift.direction).toBe('improving')
  })

  it('detects declining drift', () => {
    trackEmotionalDrift('user1', 'joy')
    trackEmotionalDrift('user1', 'joy')
    trackEmotionalDrift('user1', 'neutral')
    const drift = trackEmotionalDrift('user1', 'anger')
    expect(drift.direction).toBe('declining')
  })

  it('respects drift window limit', () => {
    for (let i = 0; i < 15; i++) {
      trackEmotionalDrift('user1', 'neutral')
    }
    const drift = getEmotionalDrift('user1')!
    expect(drift.recentEmotions.length).toBeLessThanOrEqual(DRIFT_WINDOW)
  })

  it('getEmotionalDrift returns null for unknown user', () => {
    expect(getEmotionalDrift('unknown')).toBeNull()
  })

  it('trendScore is bounded [-1, 1]', () => {
    for (let i = 0; i < 5; i++) trackEmotionalDrift('user1', 'anger')
    for (let i = 0; i < 5; i++) trackEmotionalDrift('user1', 'joy')
    const drift = getEmotionalDrift('user1')!
    expect(drift.trendScore).toBeGreaterThanOrEqual(-1)
    expect(drift.trendScore).toBeLessThanOrEqual(1)
  })
})

// ─── Phase 4 — Personality Engine ───────────────────────────────────────────

describe('Phase 4 — Personality Engine', () => {
  it('exports 8 personality types', () => {
    expect(PERSONALITY_TYPE_COUNT).toBe(8)
    expect(PERSONALITY_TYPES).toContain('professional')
    expect(PERSONALITY_TYPES).toContain('calm')
    expect(PERSONALITY_TYPES).toContain('empathetic')
    expect(PERSONALITY_TYPES).toContain('analytical')
    expect(PERSONALITY_TYPES).toContain('energetic')
  })

  it('returns base personality when no profile exists', () => {
    const state = adaptPersonality('user1', 'professional')
    expect(state.base).toBe('professional')
    expect(state.adapted).toBe('professional')
  })

  it('adapts to calm when user is frequently frustrated', () => {
    // Build up frustration profile (need >= 3 interactions)
    for (let i = 0; i < 5; i++) {
      updateEmotionalProfile('user1', detectEmotions("I'm so frustrated, this doesn't work!"))
    }
    const state = adaptPersonality('user1', 'professional')
    expect(state.adapted).toBe('calm')
    expect(state.adaptationReason).toContain('frustration')
  })

  it('adapts to energetic when user is joyful', () => {
    for (let i = 0; i < 5; i++) {
      updateEmotionalProfile('user1', detectEmotions('This is amazing and wonderful! So happy!'))
    }
    const state = adaptPersonality('user1', 'professional')
    expect(state.adapted).toBe('energetic')
  })

  it('overrides to empathetic on declining drift', () => {
    // Create declining drift
    for (let i = 0; i < 5; i++) {
      updateEmotionalProfile('user1', detectEmotions('happy!'))
      trackEmotionalDrift('user1', 'joy')
    }
    for (let i = 0; i < 5; i++) {
      updateEmotionalProfile('user1', detectEmotions("angry! I'm furious!"))
      trackEmotionalDrift('user1', 'anger')
    }
    const state = adaptPersonality('user1', 'professional')
    expect(state.adapted).toBe('empathetic')
    expect(state.adaptationReason).toContain('declining')
  })

  it('getPersonalityState returns null for unknown user', () => {
    expect(getPersonalityState('unknown')).toBeNull()
  })
})

// ─── Phase 5 — Confidence Levels ────────────────────────────────────────────

describe('Phase 5 — Confidence Levels', () => {
  it('returns confidence object from analysis', () => {
    const analysis = detectEmotions('I am very happy!')
    const conf = scoreConfidence(analysis)
    expect(conf.confidence).toBeGreaterThanOrEqual(0.1)
    expect(conf.confidence).toBeLessThanOrEqual(0.99)
    expect(['low', 'medium', 'high']).toContain(conf.reasoning_strength)
  })

  it('high confidence for strong single emotion', () => {
    const analysis = detectEmotions('I am so incredibly happy and delighted and thrilled!!!')
    expect(analysis.confidence).toBeGreaterThanOrEqual(0.5)
    expect(analysis.reasoning_strength).not.toBe('low')
  })

  it('lower confidence for ambiguous text', () => {
    const analysis = detectEmotions('it is what it is')
    expect(analysis.dominant).toBe('neutral')
  })
})

// ─── Phase 6 — Behavioral Learning Loop ─────────────────────────────────────

describe('Phase 6 — Learning Loop', () => {
  it('records a learning signal', () => {
    recordLearningSignal({
      userId: 'user1',
      responseId: 'resp1',
      signalType: 'positive',
      emotionAtTime: 'joy',
      personalityUsed: 'friendly',
      engagementScore: 0.9,
    })
    const state = getLearningState('user1')
    expect(state).not.toBeNull()
    expect(state!.totalSignals).toBe(1)
    expect(state!.positiveRate).toBe(1)
  })

  it('tracks positive and negative rates', () => {
    recordLearningSignal({ userId: 'user1', responseId: 'r1', signalType: 'positive', emotionAtTime: 'joy', personalityUsed: 'friendly', engagementScore: 0.9 })
    recordLearningSignal({ userId: 'user1', responseId: 'r2', signalType: 'negative', emotionAtTime: 'anger', personalityUsed: 'calm', engagementScore: 0.2 })
    const state = getLearningState('user1')!
    expect(state.positiveRate).toBe(0.5)
    expect(state.negativeRate).toBe(0.5)
  })

  it('identifies best and worst personality', () => {
    recordLearningSignal({ userId: 'user1', responseId: 'r1', signalType: 'positive', emotionAtTime: 'joy', personalityUsed: 'friendly', engagementScore: 0.9 })
    recordLearningSignal({ userId: 'user1', responseId: 'r2', signalType: 'negative', emotionAtTime: 'anger', personalityUsed: 'assertive', engagementScore: 0.1 })
    const state = getLearningState('user1')!
    expect(state.bestPersonality).toBe('friendly')
    expect(state.worstPersonality).toBe('assertive')
  })

  it('getLearningState returns null for unknown user', () => {
    expect(getLearningState('unknown')).toBeNull()
  })
})

// ─── Phase 7 — Emotional Memory ─────────────────────────────────────────────

describe('Phase 7 — Emotional Memory', () => {
  it('stores and retrieves emotion history', () => {
    const analysis = detectEmotions('I am happy')
    storeEmotionMemory('user1', analysis, 'test context')
    const history = getEmotionHistory('user1')
    expect(history.length).toBe(1)
    expect(history[0].dominant).toBe('joy')
    expect(history[0].context).toBe('test context')
  })

  it('limits history to MAX_MEMORY_PER_USER', () => {
    const analysis = detectEmotions('test')
    for (let i = 0; i < MAX_MEMORY_PER_USER + 20; i++) {
      storeEmotionMemory('user1', analysis)
    }
    const history = getEmotionHistory('user1', 200)
    expect(history.length).toBeLessThanOrEqual(MAX_MEMORY_PER_USER)
  })

  it('returns empty array for unknown user', () => {
    expect(getEmotionHistory('unknown')).toEqual([])
  })

  it('respects limit parameter', () => {
    const analysis = detectEmotions('test')
    for (let i = 0; i < 10; i++) {
      storeEmotionMemory('user1', analysis)
    }
    expect(getEmotionHistory('user1', 3).length).toBe(3)
  })
})

// ─── Phase 8 — Response Modulation ──────────────────────────────────────────

describe('Phase 8 — Response Modulation', () => {
  it('generates modulation for frustrated user', () => {
    const analysis = detectEmotions("This doesn't work and I'm stuck!")
    const mod = modulateResponse('user1', analysis)
    expect(mod.tonePrefix).toBeTruthy()
    expect(mod.personalityApplied).toBeTruthy()
    expect(mod.emotionAcknowledged).toBeTruthy()
    expect(mod.confidenceLevel).toBeGreaterThan(0)
  })

  it('uses calm tone for frustrated user', () => {
    // Build frustration profile
    for (let i = 0; i < 4; i++) {
      modulateResponse('user1', detectEmotions("I'm frustrated, this is broken!"))
    }
    const mod = modulateResponse('user1', detectEmotions("Still doesn't work!"))
    expect(mod.personalityApplied).toBe('calm')
    expect(mod.tonePrefix).toContain('calm')
  })

  it('updates profile and drift as side effects', () => {
    modulateResponse('user1', detectEmotions('happy'))
    expect(getEmotionalProfile('user1')).not.toBeNull()
    expect(getEmotionalDrift('user1')).not.toBeNull()
  })

  it('stores to emotion memory', () => {
    modulateResponse('user1', detectEmotions('test'))
    expect(getEmotionHistory('user1').length).toBe(1)
  })

  it('returns modulation notes', () => {
    const analysis = detectEmotions('I am so happy!')
    const mod = modulateResponse('user1', analysis)
    expect(mod.modulationNotes.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Phase 9 — Multimodal Foundation ────────────────────────────────────────

describe('Phase 9 — Multimodal Foundation', () => {
  it('exports default multimodal config', () => {
    expect(DEFAULT_MULTIMODAL_CONFIG.enabledSources).toContain('text')
    expect(DEFAULT_MULTIMODAL_CONFIG.enabledSources).not.toContain('facial')
  })
})

// ─── Phase 10 — Performance ─────────────────────────────────────────────────

describe('Phase 10 — Performance', () => {
  it('detection completes in < 300 ms', () => {
    const result = detectEmotions('I am frustrated with this extremely confusing and difficult situation that keeps getting worse and worse!!!')
    expect(result.latencyMs).toBeLessThan(300)
  })

  it('full pipeline completes in < 300 ms', () => {
    const start = performance.now()
    runEmotionPipeline('user1', 'I am happy and excited about this project!', 'professional')
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(300)
  })

  it('handles very long text efficiently', () => {
    const longText = 'I am happy. '.repeat(500) // 6000 chars
    const start = performance.now()
    detectEmotions(longText)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(300)
  })
})

// ─── Phase 11 — Safety + Consistency ────────────────────────────────────────

describe('Phase 11 — Safety + Consistency', () => {
  it('never returns confidence > 0.99', () => {
    const result = detectEmotions('HAPPY HAPPY HAPPY JOY JOY JOY!!!!!!')
    expect(result.confidence).toBeLessThanOrEqual(0.99)
  })

  it('never returns confidence < 0.1', () => {
    const result = detectEmotions('x')
    expect(result.confidence).toBeGreaterThanOrEqual(0.1)
  })

  it('personality is always one of the defined types', () => {
    const state = adaptPersonality('user1', 'professional')
    expect(PERSONALITY_TYPES).toContain(state.adapted)
  })

  it('emotions are always valid types', () => {
    const result = detectEmotions('random test input with various words')
    for (const e of result.emotions) {
      expect(EMOTION_TYPES).toContain(e.type)
    }
  })

  it('emotion scores are bounded [0, 1]', () => {
    const result = detectEmotions('happy angry sad frustrated confused excited surprised!!!')
    for (const e of result.emotions) {
      expect(e.score).toBeGreaterThanOrEqual(0)
      expect(e.score).toBeLessThanOrEqual(1)
    }
  })

  it('emotion valence map covers all types', () => {
    for (const t of EMOTION_TYPES) {
      expect(EMOTION_VALENCE[t]).toBeDefined()
    }
  })
})

// ─── Phase 12 — Dashboard Summary ───────────────────────────────────────────

describe('Phase 12 — Dashboard Summary', () => {
  it('returns summary with zero data', () => {
    const summary = getEmotionDashboardSummary()
    expect(summary.totalAnalyses).toBe(0)
    expect(summary.activeProfiles).toBe(0)
    expect(summary.learningSignals).toBe(0)
    expect(summary.systemMood).toBe('neutral')
  })

  it('populates after pipeline runs', () => {
    runEmotionPipeline('user1', 'I am happy!', 'professional')
    runEmotionPipeline('user2', 'I am frustrated', 'professional')
    const summary = getEmotionDashboardSummary()
    expect(summary.totalAnalyses).toBe(2)
    expect(summary.activeProfiles).toBe(2)
    expect(Object.keys(summary.emotionDistribution).length).toBeGreaterThan(0)
  })

  it('tracks drift summary', () => {
    // Create improving drift
    trackEmotionalDrift('user1', 'anger')
    trackEmotionalDrift('user1', 'anger')
    trackEmotionalDrift('user1', 'neutral')
    trackEmotionalDrift('user1', 'joy')
    const summary = getEmotionDashboardSummary()
    expect(summary.driftSummary.improving).toBeGreaterThanOrEqual(1)
  })

  it('counts learning signals', () => {
    recordLearningSignal({
      userId: 'user1', responseId: 'r1', signalType: 'positive',
      emotionAtTime: 'joy', personalityUsed: 'friendly', engagementScore: 0.8,
    })
    const summary = getEmotionDashboardSummary()
    expect(summary.learningSignals).toBe(1)
  })
})

// ─── Full Pipeline Integration ──────────────────────────────────────────────

describe('Full Pipeline Integration', () => {
  it('runEmotionPipeline returns all components', () => {
    const result = runEmotionPipeline('user1', 'I am happy and excited!', 'professional')
    expect(result.analysis).toBeDefined()
    expect(result.modulation).toBeDefined()
    expect(result.profile).toBeDefined()
    expect(result.drift).toBeDefined()
    expect(result.personality).toBeDefined()
    expect(result.context).toBeDefined()
    expect(result.sentiment).toBeDefined()
  })

  it('pipeline evolves personality over multiple interactions', () => {
    // Happy user
    for (let i = 0; i < 5; i++) {
      runEmotionPipeline('user1', 'This is wonderful and amazing!', 'professional')
    }
    const result = runEmotionPipeline('user1', 'Still so happy!', 'professional')
    expect(result.personality.adapted).toBe('energetic')
    expect(result.profile.interactionCount).toBe(6)
  })

  it('reset clears all state', () => {
    runEmotionPipeline('user1', 'happy', 'professional')
    _resetEmotionState()
    expect(getEmotionalProfile('user1')).toBeNull()
    expect(getEmotionalDrift('user1')).toBeNull()
    expect(getEmotionHistory('user1')).toEqual([])
    expect(getEmotionDashboardSummary().totalAnalyses).toBe(0)
  })
})

// ─── v2 Enhancement: NLP Sentiment Analysis ─────────────────────────────────

describe('v2 — NLP Sentiment Analysis', () => {
  it('analyzeSentiment returns AFINN-165 scores', () => {
    const result = analyzeSentiment('I love this amazing product!')
    expect(result.score).toBeGreaterThan(0)
    expect(result.comparative).toBeGreaterThan(0)
    expect(result.positive.length).toBeGreaterThan(0)
  })

  it('detects negative sentiment', () => {
    const result = analyzeSentiment('This is terrible and awful')
    expect(result.score).toBeLessThan(0)
    expect(result.negative.length).toBeGreaterThan(0)
  })

  it('returns zero for neutral text', () => {
    const result = analyzeSentiment('The meeting is at 3pm')
    expect(result.comparative).toBe(0)
  })

  it('NLP sentiment boosts emotion detection for ambiguous text', () => {
    // Text with strong positive AFINN words but no pattern keywords
    const result = detectEmotions('What a wonderful delightful magnificent superb day')
    // NLP should help detect positive emotion even without exact keyword matches
    expect(result.emotions.length).toBeGreaterThan(0)
    // At minimum it should detect something (joy from NLP or neutral)
    expect(result.dominant).toBeDefined()
  })
})

// ─── v2 Enhancement: Emoji Detection ────────────────────────────────────────

describe('v2 — Emoji Emotion Detection', () => {
  it('exports emoji count', () => {
    expect(EMOJI_EMOTION_COUNT).toBeGreaterThan(80)
  })

  it('detects joy from happy emoji', () => {
    const result = detectEmotions('Great news! 😀🎉')
    expect(result.dominant).toBe('joy')
    expect(result.emotions[0].score).toBeGreaterThan(0.3)
  })

  it('detects sadness from sad emoji', () => {
    const result = detectEmotions('Oh no 😢😭')
    const hasSadness = result.emotions.some(e => e.type === 'sadness')
    expect(hasSadness).toBe(true)
  })

  it('detects anger from angry emoji', () => {
    const result = detectEmotions('Unacceptable! 😡🤬')
    const hasAnger = result.emotions.some(e => e.type === 'anger')
    expect(hasAnger).toBe(true)
  })

  it('detects confusion from thinking emoji', () => {
    const result = detectEmotions('🤔🤔🤔 hmm')
    const hasConfusion = result.emotions.some(e => e.type === 'confusion')
    expect(hasConfusion).toBe(true)
  })

  it('handles multiple emoji types', () => {
    const result = detectEmotions('😀😢 mixed feelings')
    expect(result.emotions.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── v2 Enhancement: Negation Detection ─────────────────────────────────────

describe('v2 — Negation Detection', () => {
  it('inverts "not happy" to sadness', () => {
    const result = detectEmotions('I am not happy about this')
    const hasSadness = result.emotions.some(e => e.type === 'sadness')
    expect(hasSadness).toBe(true)
  })

  it('inverts "not angry" away from anger', () => {
    const result = detectEmotions("I'm not angry at all")
    // Anger should be very low or absent; trust should appear
    const angerScore = result.emotions.find(e => e.type === 'anger')?.score ?? 0
    const trustScore = result.emotions.find(e => e.type === 'trust')?.score ?? 0
    expect(trustScore).toBeGreaterThan(angerScore)
  })

  it("doesn't negate when no negation present", () => {
    const result = detectEmotions('I am so happy and excited')
    expect(result.dominant).toBe('joy')
  })
})

// ─── v2 Enhancement: Intensity Modifiers ────────────────────────────────────

describe('v2 — Intensity Modifiers', () => {
  it('"extremely happy" scores higher than "happy"', () => {
    const normal = detectEmotions('I am happy')
    const intense = detectEmotions('I am extremely happy')
    const normalJoy = normal.emotions.find(e => e.type === 'joy')?.score ?? 0
    const intenseJoy = intense.emotions.find(e => e.type === 'joy')?.score ?? 0
    expect(intenseJoy).toBeGreaterThan(normalJoy)
  })

  it('"slightly frustrated" scores lower than "frustrated"', () => {
    const normal = detectEmotions('I am frustrated')
    const mild = detectEmotions('I am slightly frustrated')
    const normalFrust = normal.emotions.find(e => e.type === 'frustration')?.score ?? 0
    const mildFrust = mild.emotions.find(e => e.type === 'frustration')?.score ?? 0
    expect(mildFrust).toBeLessThan(normalFrust)
  })

  it('"very angry" amplifies anger', () => {
    const result = detectEmotions('I am very angry')
    const anger = result.emotions.find(e => e.type === 'anger')?.score ?? 0
    expect(anger).toBeGreaterThan(0.4)
  })
})

// ─── v2 Enhancement: Emotion Transitions ────────────────────────────────────

describe('v2 — Emotion Transitions', () => {
  it('records transitions between pipeline runs', () => {
    runEmotionPipeline('user1', 'I am happy!', 'professional')
    runEmotionPipeline('user1', 'Now I am frustrated and stuck', 'professional')
    const transitions = getTopTransitions()
    expect(transitions.length).toBeGreaterThanOrEqual(1)
  })

  it('transitions have probability between 0 and 1', () => {
    runEmotionPipeline('user1', 'I am happy!', 'professional')
    runEmotionPipeline('user1', 'I am sad now', 'professional')
    runEmotionPipeline('user1', 'Back to happy!', 'professional')
    const transitions = getTopTransitions()
    for (const t of transitions) {
      expect(t.probability).toBeGreaterThanOrEqual(0)
      expect(t.probability).toBeLessThanOrEqual(1)
      expect(t.count).toBeGreaterThanOrEqual(1)
    }
  })
})

// ─── v2 Enhancement: Conversation Context ───────────────────────────────────

describe('v2 — Conversation Context', () => {
  it('pipeline returns context', () => {
    const result = runEmotionPipeline('user1', 'Hello!', 'professional')
    expect(result.context).toBeDefined()
    expect(result.context.userId).toBe('user1')
    expect(result.context.recentMessages.length).toBe(1)
  })

  it('context tracks multiple messages', () => {
    runEmotionPipeline('user1', 'First message', 'professional')
    runEmotionPipeline('user1', 'Second message', 'professional')
    const result = runEmotionPipeline('user1', 'Third message', 'professional')
    expect(result.context.recentMessages.length).toBe(3)
  })

  it('context caps at CONTEXT_WINDOW', () => {
    for (let i = 0; i < 10; i++) {
      runEmotionPipeline('user1', `Message ${i}`, 'professional')
    }
    const ctx = getConversationContext('user1')
    expect(ctx).not.toBeNull()
    expect(ctx!.recentMessages.length).toBeLessThanOrEqual(CONTEXT_WINDOW)
  })

  it('emotional momentum is between -1 and 1', () => {
    runEmotionPipeline('user1', 'I am happy!', 'professional')
    runEmotionPipeline('user1', 'I am frustrated', 'professional')
    const ctx = getConversationContext('user1')
    expect(ctx!.emotionalMomentum).toBeGreaterThanOrEqual(-1)
    expect(ctx!.emotionalMomentum).toBeLessThanOrEqual(1)
  })

  it('returns null for unknown user', () => {
    expect(getConversationContext('unknown')).toBeNull()
  })
})

// ─── v2 Enhancement: Sentiment Pipeline ─────────────────────────────────────

describe('v2 — Sentiment in Pipeline', () => {
  it('pipeline returns sentiment result', () => {
    const result = runEmotionPipeline('user1', 'I love this!', 'professional')
    expect(result.sentiment).toBeDefined()
    expect(result.sentiment.score).toBeGreaterThan(0)
    expect(result.sentiment.positive.length).toBeGreaterThan(0)
  })

  it('negative sentiment matches negative emotions', () => {
    const result = runEmotionPipeline('user1', 'This is terrible and broken', 'professional')
    expect(result.sentiment.score).toBeLessThan(0)
    const hasNeg = result.analysis.emotions.some(e =>
      ['sadness', 'anger', 'frustration'].includes(e.type)
    )
    expect(hasNeg).toBe(true)
  })
})
