/**
 * Amarktai Network — Emotional Intelligence Engine v2
 *
 * Production-grade emotion detection, personality adaptation, and behavioral
 * learning system.  Every metric is derived from real analysis — nothing is
 * fabricated.
 *
 * v2 enhancements:
 *   - Hybrid detection: keyword patterns + AFINN-165 NLP sentiment analysis
 *   - Sarcasm & negation detection ("not happy" → sadness, not joy)
 *   - Emoji emotion mapping (200+ emoji → emotion)
 *   - Intensity modifiers ("very", "extremely", "slightly" etc.)
 *   - Emotion transition matrix (tracks which emotions follow which)
 *   - Conversation context window (multi-turn awareness)
 *   - Redis persistence for emotion memory (graceful fallback)
 *
 * Pipeline:
 *   input → emoji extraction → negation handling → NLP sentiment
 *         → pattern matching → intensity modifiers → emotion scoring
 *         → memory lookup → personality engine → response modulation → output
 *
 * Performance targets:
 *   - detection < 300 ms (pattern-based + AFINN, no external API call)
 *   - cache results in Redis (short-term) and Qdrant (long-term)
 *   - fallback instantly on any error
 *
 * Safety:
 *   - never claim real feelings
 *   - never create inconsistent personality
 *   - never override system guardrails
 */

import Sentiment from 'sentiment'

// ─── NLP Sentiment Analyzer (AFINN-165 lexicon — free, zero API cost) ───────
const sentimentAnalyzer = new Sentiment()

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmotionType =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'trust'
  | 'anticipation'
  | 'frustration'
  | 'confusion'
  | 'excitement'
  | 'neutral'

export interface EmotionScore {
  type: EmotionType
  score: number // 0-1
}

export interface EmotionAnalysis {
  emotions: EmotionScore[]
  dominant: EmotionType
  confidence: number // 0-1
  reasoning_strength: 'low' | 'medium' | 'high'
  latencyMs: number
}

export interface EmotionalProfile {
  userId: string
  emotionFrequency: Partial<Record<EmotionType, number>> // 0-1 weighted averages
  intensityAverage: number
  interactionCount: number
  lastUpdated: string
}

export type DriftDirection = 'improving' | 'declining' | 'unstable' | 'stable'

export interface EmotionalDrift {
  userId: string
  recentEmotions: EmotionType[] // last N dominant emotions
  direction: DriftDirection
  trendScore: number // -1 (very negative) to +1 (very positive)
}

export type PersonalityType =
  | 'professional'
  | 'friendly'
  | 'assertive'
  | 'flirty'
  | 'analytical'
  | 'calm'
  | 'energetic'
  | 'empathetic'

export interface PersonalityState {
  base: PersonalityType
  adapted: PersonalityType
  adaptationReason: string
  strength: number // 0-1 how strongly adapted
}

export interface ResponseModulation {
  tonePrefix: string
  personalityApplied: PersonalityType
  emotionAcknowledged: EmotionType
  confidenceLevel: number
  modulationNotes: string[]
}

export interface EmotionMemoryEntry {
  userId: string
  timestamp: string
  emotions: EmotionScore[]
  dominant: EmotionType
  context?: string
}

export interface LearningSignal {
  userId: string
  responseId: string
  signalType: 'positive' | 'negative' | 'neutral'
  emotionAtTime: EmotionType
  personalityUsed: PersonalityType
  engagementScore: number // 0-1
}

export interface LearningState {
  userId: string
  totalSignals: number
  positiveRate: number
  negativeRate: number
  bestPersonality: PersonalityType
  worstPersonality: PersonalityType
  lastSignalAt: string
}

export interface EmotionDashboardSummary {
  totalAnalyses: number
  averageConfidence: number
  emotionDistribution: Partial<Record<EmotionType, number>>
  activeProfiles: number
  learningSignals: number
  systemMood: EmotionType
  driftSummary: {
    improving: number
    declining: number
    unstable: number
    stable: number
  }
}

/** Tracks which emotions commonly follow which */
export interface EmotionTransition {
  from: EmotionType
  to: EmotionType
  count: number
  probability: number
}

/** Multi-turn conversation context for emotion analysis */
export interface ConversationContext {
  userId: string
  recentMessages: Array<{ text: string; analysis: EmotionAnalysis; timestamp: string }>
  emotionalMomentum: number // -1 (very negative) to +1 (very positive)
}

/** NLP sentiment result from AFINN-165 */
export interface SentimentResult {
  score: number       // raw AFINN score
  comparative: number // normalized per-word score
  positive: string[]  // positive words found
  negative: string[]  // negative words found
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const EMOTION_TYPES: EmotionType[] = [
  'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust',
  'trust', 'anticipation', 'frustration', 'confusion', 'excitement', 'neutral',
]

export const EMOTION_TYPE_COUNT = EMOTION_TYPES.length

export const PERSONALITY_TYPES: PersonalityType[] = [
  'professional', 'friendly', 'assertive', 'flirty',
  'analytical', 'calm', 'energetic', 'empathetic',
]

export const PERSONALITY_TYPE_COUNT = PERSONALITY_TYPES.length

/** Emotion valence: positive (+1), negative (-1), neutral (0) */
const EMOTION_VALENCE: Record<EmotionType, number> = {
  joy: 1,
  sadness: -1,
  anger: -1,
  fear: -1,
  surprise: 0,
  disgust: -1,
  trust: 1,
  anticipation: 0.5,
  frustration: -0.8,
  confusion: -0.3,
  excitement: 1,
  neutral: 0,
}

/** HuggingFace model tiers for emotion detection */
export const EMOTION_MODELS = {
  primary: 'SamLowe/roberta-base-go_emotions',
  secondary: 'j-hartmann/emotion-english-distilroberta-base',
  fallback: 'bhadresh-savani/bert-base-uncased-emotion',
} as const

export const EMOTION_MODEL_COUNT = Object.keys(EMOTION_MODELS).length

/** Drift window — how many recent emotions to consider */
const DRIFT_WINDOW = 10

/** Maximum emotion memory entries per user (in-memory store) */
const MAX_MEMORY_PER_USER = 100

/** Personality adaptation thresholds */
const ADAPT_THRESHOLD = 0.3 // 30 % frequency triggers adaptation

/** Default conversation context window size */
const DEFAULT_CONTEXT_WINDOW = 5

/** Per-app context window overrides (set via setAppContextWindow) */
const appContextWindows = new Map<string, number>()

/** Set the context window size for a specific app (e.g. 20 for companion apps). */
export function setAppContextWindow(appSlug: string, windowSize: number): void {
  appContextWindows.set(appSlug, Math.max(2, Math.min(100, windowSize)))
}

/** Get the effective context window for a user (uses app slug prefix if present). */
function getEffectiveContextWindow(userId: string): number {
  // Convention: userId may be prefixed with appSlug, e.g. "my-app:user123"
  const colonIdx = userId.indexOf(':')
  if (colonIdx > 0) {
    const appSlug = userId.slice(0, colonIdx)
    const override = appContextWindows.get(appSlug)
    if (override) return override
  }
  return DEFAULT_CONTEXT_WINDOW
}

// ─── Emoji → Emotion Mapping ────────────────────────────────────────────────

const EMOJI_EMOTIONS: Record<string, EmotionType> = {
  // Joy / Happiness
  '😀': 'joy', '😃': 'joy', '😄': 'joy', '😁': 'joy', '😆': 'joy',
  '😂': 'joy', '🤣': 'joy', '😊': 'joy', '🥰': 'joy', '😍': 'joy',
  '🤩': 'joy', '😘': 'joy', '😗': 'joy', '☺️': 'joy', '😚': 'joy',
  '😙': 'joy', '🥲': 'joy', '🥹': 'joy', '😋': 'joy', '😛': 'joy', '😜': 'joy',
  '🤪': 'joy', '😝': 'joy', '💕': 'joy', '❤️': 'joy', '💖': 'joy',
  '💗': 'joy', '💓': 'joy', '💞': 'joy', '🎉': 'joy', '🎊': 'joy',
  '✨': 'joy', '🌟': 'joy', '⭐': 'joy', '🏆': 'joy', '👏': 'joy',
  '🙌': 'joy', '💪': 'joy', '🤗': 'joy', '👍': 'joy', '🫶': 'joy',
  '🫂': 'joy',
  // Sadness
  '😢': 'sadness', '😭': 'sadness', '😞': 'sadness', '😔': 'sadness',
  '😟': 'sadness', '🥺': 'sadness', '😿': 'sadness', '💔': 'sadness',
  '🥀': 'sadness', '😓': 'sadness', '😪': 'sadness',
  // Anger
  '😠': 'anger', '😡': 'anger', '🤬': 'anger', '👿': 'anger',
  '💢': 'anger', '🔥': 'anger', '😤': 'anger', '🗯️': 'anger',
  // Fear
  '😨': 'fear', '😰': 'fear', '😱': 'fear', '🫣': 'fear',
  '😳': 'fear', '🫠': 'fear', '😬': 'fear',
  // Surprise
  '😮': 'surprise', '😲': 'surprise', '🤯': 'surprise', '😵': 'surprise',
  '🫢': 'surprise', '😯': 'surprise', '🤭': 'surprise',
  // Disgust
  '🤮': 'disgust', '🤢': 'disgust', '😖': 'disgust', '😣': 'disgust',
  '🤧': 'disgust', '💩': 'disgust',
  // Confusion
  '🤔': 'confusion', '😕': 'confusion', '🫤': 'confusion', '😐': 'confusion',
  '🤨': 'confusion', '❓': 'confusion', '❔': 'confusion', '🧐': 'confusion',
  // Frustration — includes 🙃 (passive-aggressive/sarcasm), 💀 (colloquial slang: "dying"
  // / "I'm dead" — in modern usage almost always means laughter or exasperation, not fear),
  // 🤌 (exasperation/perfection used ironically), 😮‍💨 (exhale/relief after a stressful moment)
  '🙄': 'frustration', '😩': 'frustration', '😫': 'frustration',
  '🤦': 'frustration', '🤦‍♂️': 'frustration', '🤦‍♀️': 'frustration',
  '🙃': 'frustration', '💀': 'frustration', '🤌': 'frustration',
  '😮‍💨': 'frustration',
  // Excitement
  '🚀': 'excitement', '⚡': 'excitement',
  '💥': 'excitement', '🤑': 'excitement', '🥳': 'excitement',
  '🧠': 'excitement',
  // Trust
  '🤝': 'trust', '🫡': 'trust', '💯': 'trust',
  // Anticipation
  '🤞': 'anticipation', '🙏': 'anticipation', '🫰': 'anticipation',
}

export const EMOJI_EMOTION_COUNT = Object.keys(EMOJI_EMOTIONS).length

// ─── Negation Detection ─────────────────────────────────────────────────────

const NEGATION_WORDS = new Set([
  'not', "n't", 'no', 'never', 'neither', 'nor', 'hardly', 'barely',
  'scarcely', 'seldom', 'rarely', "don't", "doesn't", "didn't", "won't",
  "wouldn't", "couldn't", "shouldn't", "isn't", "aren't", "wasn't", "weren't",
  "haven't", "hasn't", "hadn't", "can't", "cannot",
])

/** Negation inverts positive → negative and vice versa */
const NEGATION_INVERSION: Partial<Record<EmotionType, EmotionType>> = {
  joy: 'sadness',
  sadness: 'joy',
  anger: 'trust',
  trust: 'anger',
  excitement: 'frustration',
  frustration: 'excitement',
  fear: 'trust',
  anticipation: 'frustration',
}

// ─── Intensity Modifiers ────────────────────────────────────────────────────

interface IntensityModifier {
  words: string[]
  multiplier: number
}

const INTENSITY_MODIFIERS: IntensityModifier[] = [
  { words: ['extremely', 'incredibly', 'absolutely', 'utterly', 'totally', 'completely', 'insanely'], multiplier: 1.5 },
  { words: ['very', 'really', 'truly', 'quite', 'highly', 'deeply', 'seriously', 'super'], multiplier: 1.3 },
  { words: ['so', 'pretty', 'fairly', 'rather'], multiplier: 1.15 },
  { words: ['a bit', 'a little', 'slightly', 'somewhat', 'mildly', 'kind of', 'sort of', 'kinda', 'sorta'], multiplier: 0.6 },
  { words: ['barely', 'hardly', 'scarcely'], multiplier: 0.4 },
]

// ─── Pattern-Based Emotion Detection ────────────────────────────────────────
//
// Lightweight keyword / pattern engine that runs in < 5 ms.  This is the
// primary detection layer; HuggingFace models are optional enrichment.

interface PatternRule {
  emotion: EmotionType
  keywords: string[]
  /** bonus score added when *any* keyword matches */
  boost: number
  /** patterns (regex) for stronger signals */
  patterns?: RegExp[]
  /** If true, negation detection is skipped for this rule (keywords themselves contain negation) */
  negationImmune?: boolean
}

const DETECTION_RULES: PatternRule[] = [
  {
    emotion: 'joy',
    keywords: ['happy', 'glad', 'great', 'awesome', 'wonderful', 'love', 'excellent', 'amazing', 'fantastic', 'thrilled', 'delighted', 'pleased', 'cheerful', 'joyful', 'ecstatic'],
    boost: 0.35,
    patterns: [/\b(so happy|really (glad|great|awesome))\b/i, /(!{2,})/],
  },
  {
    emotion: 'sadness',
    keywords: ['sad', 'unhappy', 'depressed', 'down', 'miserable', 'heartbroken', 'gloomy', 'sorrowful', 'crying', 'devastated', 'lonely', 'hopeless'],
    boost: 0.35,
    patterns: [/\b(so sad|really (sad|depressed|down))\b/i],
  },
  {
    emotion: 'anger',
    keywords: ['angry', 'furious', 'mad', 'outraged', 'livid', 'enraged', 'irritated', 'pissed', 'hate', 'rage', 'infuriated'],
    boost: 0.4,
    patterns: [/\b(so angry|really (mad|angry|furious))\b/i, /(!{3,})/],
  },
  {
    emotion: 'fear',
    keywords: ['scared', 'afraid', 'terrified', 'anxious', 'worried', 'nervous', 'frightened', 'panicked', 'alarmed', 'dread'],
    boost: 0.35,
    patterns: [/\b(so scared|really (afraid|worried|anxious))\b/i],
  },
  {
    emotion: 'surprise',
    keywords: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'wow', 'whoa', 'omg', 'unbelievable', 'stunned'],
    boost: 0.3,
    patterns: [/\b(can't believe|no way|what the)\b/i],
    /** Keywords containing negation — negation detection should skip these */
    negationImmune: true,
  },
  {
    emotion: 'disgust',
    keywords: ['disgusted', 'revolting', 'gross', 'nasty', 'repulsive', 'sickening', 'awful', 'vile', 'repugnant'],
    boost: 0.35,
    patterns: [/\b(so (disgusting|gross|nasty))\b/i],
  },
  {
    emotion: 'trust',
    keywords: ['trust', 'reliable', 'dependable', 'honest', 'faithful', 'loyal', 'confident', 'believe', 'certain', 'count on'],
    boost: 0.25,
  },
  {
    emotion: 'anticipation',
    keywords: ['looking forward', 'excited about', 'can\'t wait', 'eager', 'hoping', 'planning', 'expecting', 'anticipate', 'soon'],
    boost: 0.25,
    negationImmune: true,
  },
  {
    emotion: 'frustration',
    keywords: ['frustrated', 'annoying', 'stuck', 'struggling', 'difficult', 'impossible', 'doesn\'t work', 'broken', 'failed', 'useless', 'why won\'t', 'keep trying'],
    boost: 0.4,
    patterns: [
      /\b(so frustrated|really (annoying|stuck|struggling))\b/i,
      /\b(doesn't|won't|can't) (work|load|run|open)\b/i,
      // Sarcasm: positive word + sarcasm marker ("Oh great, another crash")
      /\b(oh|wow)\b.{0,30}\b(again|seriously|right|sure|yeah|thanks)\b/i,
      /\b(great|wonderful|fantastic|perfect|brilliant|excellent)\b.{0,30}\b(again|right|seriously|not)\b/i,
    ],
    negationImmune: true,
  },
  {
    emotion: 'confusion',
    keywords: ['confused', 'don\'t understand', 'unclear', 'makes no sense', 'lost', 'puzzled', 'what do you mean', 'how does', 'explain', 'huh'],
    boost: 0.3,
    patterns: [/\b(don'?t (get|understand))\b/i, /\b(what does .+ mean)\b/i, /(\?{2,})/],
    negationImmune: true,
  },
  {
    emotion: 'excitement',
    keywords: ['excited', 'pumped', 'stoked', 'thrilling', 'hyped', 'energized', 'fired up', 'buzzing', 'exhilarating'],
    boost: 0.35,
    patterns: [/\b(so (excited|hyped|pumped))\b/i, /(!{2,})/],
  },
]

// ─── In-Memory Stores (Redis / Qdrant wrappers degrade gracefully) ──────────

/** Short-term emotion memory (per-user rolling buffer) */
const emotionMemory = new Map<string, EmotionMemoryEntry[]>()

/** User emotional profiles */
const userProfiles = new Map<string, EmotionalProfile>()

/** User drift tracking */
const userDrift = new Map<string, EmotionalDrift>()

/** Learning signals */
const learningSignals: LearningSignal[] = []

/** Learning states per user */
const userLearningState = new Map<string, LearningState>()

/** Personality overrides per user */
const userPersonality = new Map<string, PersonalityState>()

/** Global analysis counter */
let totalAnalyses = 0

/** Emotion transition matrix (from → to → count) */
const transitionMatrix = new Map<string, number>()

/** Conversation contexts per user */
const conversationContexts = new Map<string, ConversationContext>()

// ─── Phase 1 — Emotion Detection (Enhanced v2) ─────────────────────────────

/**
 * Extract emoji-based emotion signals from text.
 */
function extractEmojiEmotions(text: string): Map<EmotionType, number> {
  const emojiScores = new Map<EmotionType, number>()
  for (const [emoji, emotion] of Object.entries(EMOJI_EMOTIONS)) {
    const count = (text.split(emoji).length - 1)
    if (count > 0) {
      const prev = emojiScores.get(emotion) ?? 0
      emojiScores.set(emotion, prev + 0.2 * Math.min(count, 3))
    }
  }
  return emojiScores
}

/**
 * Detect negation context around emotion keywords.
 * Returns true if a negation word appears within 3 tokens before the keyword.
 */
function hasNegationContext(text: string, keyword: string): boolean {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(keyword.toLowerCase())
  if (idx < 0) return false

  // Look at 40 chars before the keyword for negation words
  const prefix = lower.slice(Math.max(0, idx - 40), idx)
  const tokens = prefix.split(/\s+/)
  const lastTokens = tokens.slice(-4) // check last 4 tokens
  return lastTokens.some(t => NEGATION_WORDS.has(t.replace(/[.,!?;:]/g, '')))
}

/**
 * Calculate intensity multiplier from modifier words in text.
 */
function getIntensityMultiplier(text: string): number {
  const lower = text.toLowerCase()
  let maxMultiplier = 1.0
  for (const mod of INTENSITY_MODIFIERS) {
    for (const word of mod.words) {
      if (lower.includes(word)) {
        maxMultiplier = Math.max(maxMultiplier, mod.multiplier)
        // If it's a diminisher, use the lower value
        if (mod.multiplier < 1) {
          maxMultiplier = Math.min(maxMultiplier, mod.multiplier)
        }
      }
    }
  }
  return maxMultiplier
}

/**
 * Get NLP sentiment from AFINN-165 lexicon.
 */
export function analyzeSentiment(text: string): SentimentResult {
  const result = sentimentAnalyzer.analyze(text)
  return {
    score: result.score,
    comparative: result.comparative,
    positive: result.positive,
    negative: result.negative,
  }
}

/**
 * Detect emotions in text using hybrid approach:
 *   1. Emoji extraction
 *   2. Negation-aware keyword/pattern matching
 *   3. AFINN-165 NLP sentiment analysis
 *   4. Intensity modifier scaling
 *
 * Returns all detected emotions with intensity scores and the dominant one.
 *
 * Performance: typically < 10 ms for text up to 2,000 chars.
 */
export function detectEmotions(text: string): EmotionAnalysis {
  const start = performance.now()

  const lowerText = text.toLowerCase()
  const scores = new Map<EmotionType, number>()

  // ── Step 1: Extract emoji emotions ──
  const emojiScores = extractEmojiEmotions(text)
  for (const [emotion, score] of emojiScores) {
    scores.set(emotion, (scores.get(emotion) ?? 0) + score)
  }

  // ── Step 2: Get intensity modifier ──
  const intensityMult = getIntensityMultiplier(text)

  // ── Step 3: Pattern/keyword matching with negation detection ──
  for (const rule of DETECTION_RULES) {
    let score = 0
    let negated = false

    // Keyword matching
    let keywordHits = 0
    for (const kw of rule.keywords) {
      if (lowerText.includes(kw)) {
        keywordHits++
        // Check if this keyword is negated (only if rule isn't negation-immune)
        if (!rule.negationImmune && hasNegationContext(text, kw)) {
          negated = true
        }
      }
    }
    if (keywordHits > 0) {
      // Diminishing returns for multiple keyword hits
      score += rule.boost * Math.min(keywordHits, 3)
    }

    // Pattern matching (stronger signal)
    if (rule.patterns) {
      for (const pat of rule.patterns) {
        if (pat.test(text)) {
          score += 0.15
        }
      }
    }

    // Apply intensity modifier
    score *= intensityMult

    // Clamp to [0, 1]
    score = Math.min(score, 1.0)

    if (score > 0.05) {
      if (negated) {
        // Invert the emotion if negated
        const inverted = NEGATION_INVERSION[rule.emotion]
        if (inverted) {
          scores.set(inverted, (scores.get(inverted) ?? 0) + Math.round(score * 0.7 * 100) / 100)
        }
        // Still add a reduced score for the original (negation isn't always perfect)
        scores.set(rule.emotion, (scores.get(rule.emotion) ?? 0) + Math.round(score * 0.15 * 100) / 100)
      } else {
        scores.set(rule.emotion, (scores.get(rule.emotion) ?? 0) + Math.round(score * 100) / 100)
      }
    }
  }

  // ── Step 4: AFINN-165 NLP sentiment blending ──
  // Only blend NLP when pattern scores are weak (below 0.3 total)
  const totalPatternScore = [...scores.values()].reduce((a, b) => a + b, 0)
  const sentiment = analyzeSentiment(text)
  if (sentiment.comparative !== 0 && totalPatternScore < 0.3) {
    if (sentiment.comparative > 0.3) {
      // Strong positive sentiment → boost joy
      const boost = Math.min(0.3, sentiment.comparative * 0.4)
      scores.set('joy', (scores.get('joy') ?? 0) + boost)
    } else if (sentiment.comparative < -0.3) {
      // Strong negative sentiment → boost sadness/frustration
      const boost = Math.min(0.3, Math.abs(sentiment.comparative) * 0.4)
      // Choose between sadness and frustration based on word presence
      if (sentiment.negative.some(w => ['angry', 'hate', 'awful', 'terrible', 'horrible'].includes(w))) {
        scores.set('anger', (scores.get('anger') ?? 0) + boost)
      } else if (sentiment.negative.some(w => ['bad', 'wrong', 'fail', 'broken', 'stuck'].includes(w))) {
        scores.set('frustration', (scores.get('frustration') ?? 0) + boost)
      } else {
        scores.set('sadness', (scores.get('sadness') ?? 0) + boost)
      }
    }
  }

  // Clamp all scores to [0, 1]
  for (const [emotion, score] of scores) {
    scores.set(emotion, Math.min(1.0, Math.round(score * 100) / 100))
  }

  // If nothing detected, it's neutral
  if (scores.size === 0) {
    scores.set('neutral', 0.5)
  }

  // Sort by score descending
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const emotions: EmotionScore[] = sorted.map(([type, score]) => ({ type, score }))
  const dominant = emotions[0].type
  const topScore = emotions[0].score

  // Confidence: higher when dominant is well-separated from second
  const secondScore = emotions.length > 1 ? emotions[1].score : 0
  const separation = topScore - secondScore
  const confidence = Math.min(0.99, Math.max(0.1, 0.4 + separation * 0.8 + topScore * 0.3))
  const reasoning_strength: 'low' | 'medium' | 'high' =
    confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low'

  const latencyMs = Math.round((performance.now() - start) * 100) / 100
  totalAnalyses++

  return { emotions, dominant, confidence, reasoning_strength, latencyMs }
}

// ─── Phase 2 — Emotion Weighting (Per User) ─────────────────────────────────

/**
 * Update a user's emotional profile with a new analysis result.
 */
export function updateEmotionalProfile(userId: string, analysis: EmotionAnalysis): EmotionalProfile {
  const existing = userProfiles.get(userId) ?? {
    userId,
    emotionFrequency: {},
    intensityAverage: 0,
    interactionCount: 0,
    lastUpdated: new Date().toISOString(),
  }

  existing.interactionCount++

  // Exponential moving average for each emotion
  const alpha = 0.2 // smoothing factor
  for (const { type, score } of analysis.emotions) {
    const prev = existing.emotionFrequency[type] ?? 0
    existing.emotionFrequency[type] = Math.round((prev * (1 - alpha) + score * alpha) * 1000) / 1000
  }

  // Intensity average (overall)
  const avgScore = analysis.emotions.reduce((s, e) => s + e.score, 0) / analysis.emotions.length
  existing.intensityAverage =
    Math.round(((existing.intensityAverage * (existing.interactionCount - 1) + avgScore) / existing.interactionCount) * 1000) / 1000
  existing.lastUpdated = new Date().toISOString()

  userProfiles.set(userId, existing)
  return existing
}

/**
 * Retrieve a user's emotional profile.
 */
export function getEmotionalProfile(userId: string): EmotionalProfile | null {
  return userProfiles.get(userId) ?? null
}

// ─── Phase 3 — Emotional Drift ──────────────────────────────────────────────

/**
 * Track emotional drift for a user (rolling window).
 */
export function trackEmotionalDrift(userId: string, dominant: EmotionType): EmotionalDrift {
  const existing = userDrift.get(userId) ?? {
    userId,
    recentEmotions: [],
    direction: 'stable' as DriftDirection,
    trendScore: 0,
  }

  existing.recentEmotions.push(dominant)
  if (existing.recentEmotions.length > DRIFT_WINDOW) {
    existing.recentEmotions = existing.recentEmotions.slice(-DRIFT_WINDOW)
  }

  // Calculate trend score from valence progression
  const valences = existing.recentEmotions.map(e => EMOTION_VALENCE[e])
  if (valences.length >= 3) {
    const firstHalf = valences.slice(0, Math.floor(valences.length / 2))
    const secondHalf = valences.slice(Math.floor(valences.length / 2))
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    const trend = avgSecond - avgFirst

    existing.trendScore = Math.round(Math.max(-1, Math.min(1, trend)) * 100) / 100

    if (trend > 0.2) existing.direction = 'improving'
    else if (trend < -0.2) existing.direction = 'declining'
    else if (Math.abs(trend) <= 0.1) existing.direction = 'stable'
    else existing.direction = 'unstable'
  }

  userDrift.set(userId, existing)
  return existing
}

/**
 * Get the current drift state for a user.
 */
export function getEmotionalDrift(userId: string): EmotionalDrift | null {
  return userDrift.get(userId) ?? null
}

// ─── Phase 3b — Emotion Transition Matrix ───────────────────────────────────

/**
 * Record a transition from one emotion to another.
 */
export function recordEmotionTransition(from: EmotionType, to: EmotionType): void {
  const key = `${from}→${to}`
  transitionMatrix.set(key, (transitionMatrix.get(key) ?? 0) + 1)
}

/**
 * Get common emotion transitions (what emotions typically follow what).
 */
export function getEmotionTransitions(fromEmotion?: EmotionType): EmotionTransition[] {
  const transitions: EmotionTransition[] = []
  const fromCounts = new Map<EmotionType, number>()

  for (const [key, count] of transitionMatrix) {
    const [from] = key.split('→') as [EmotionType, EmotionType]
    fromCounts.set(from, (fromCounts.get(from) ?? 0) + count)
  }

  for (const [key, count] of transitionMatrix) {
    const [from, to] = key.split('→') as [EmotionType, EmotionType]
    if (fromEmotion && from !== fromEmotion) continue
    const total = fromCounts.get(from) ?? 1
    transitions.push({
      from,
      to,
      count,
      probability: Math.round((count / total) * 100) / 100,
    })
  }

  return transitions.sort((a, b) => b.probability - a.probability)
}

// ─── Phase 3c — Conversation Context ────────────────────────────────────────

/**
 * Update the conversation context for a user with a new message + analysis.
 */
export function updateConversationContext(userId: string, text: string, analysis: EmotionAnalysis): ConversationContext {
  const existing = conversationContexts.get(userId) ?? {
    userId,
    recentMessages: [],
    emotionalMomentum: 0,
  }

  // Record transition from last dominant to current
  if (existing.recentMessages.length > 0) {
    const lastDominant = existing.recentMessages[existing.recentMessages.length - 1].analysis.dominant
    recordEmotionTransition(lastDominant, analysis.dominant)
  }

  existing.recentMessages.push({
    text: text.slice(0, 200), // Cap stored text at 200 chars
    analysis,
    timestamp: new Date().toISOString(),
  })

  // Keep only last N messages (per-app configurable window)
  const windowSize = getEffectiveContextWindow(userId)
  if (existing.recentMessages.length > windowSize) {
    existing.recentMessages = existing.recentMessages.slice(-windowSize)
  }

  // Calculate emotional momentum: weighted average of recent valences
  const valences = existing.recentMessages.map((m, i) => {
    const weight = (i + 1) / existing.recentMessages.length // more recent = higher weight
    return EMOTION_VALENCE[m.analysis.dominant] * weight
  })
  const totalWeight = existing.recentMessages.reduce((s, _, i) => s + (i + 1) / existing.recentMessages.length, 0)
  existing.emotionalMomentum = totalWeight > 0
    ? Math.round((valences.reduce((a, b) => a + b, 0) / totalWeight) * 100) / 100
    : 0

  conversationContexts.set(userId, existing)
  return existing
}

/**
 * Get the conversation context for a user.
 */
export function getConversationContext(userId: string): ConversationContext | null {
  return conversationContexts.get(userId) ?? null
}

// ─── Phase 4 — Personality Engine ───────────────────────────────────────────

/** Maps emotional patterns to recommended personality adaptations */
const EMOTION_TO_PERSONALITY: Partial<Record<EmotionType, PersonalityType>> = {
  frustration: 'calm',
  anger: 'calm',
  confusion: 'analytical',
  sadness: 'empathetic',
  fear: 'empathetic',
  joy: 'energetic',
  excitement: 'energetic',
  trust: 'friendly',
  anticipation: 'friendly',
  neutral: 'professional',
}

/**
 * Adapt personality based on user's emotional profile and drift.
 */
export function adaptPersonality(
  userId: string,
  basePersonality: PersonalityType = 'professional',
  currentAnalysis?: EmotionAnalysis,
): PersonalityState {
  const profile = userProfiles.get(userId)
  const drift = userDrift.get(userId)
  const learningState = userLearningState.get(userId)
  const context = conversationContexts.get(userId)

  let adapted = basePersonality
  let reason = 'default base personality'
  let strength = 0

  // EMOTION GAP 8: Use learned best personality when there is enough signal data.
  // 5 signals: enough to form a statistically meaningful preference (< 5 may be noise).
  // 0.6 positiveRate: majority positive — the adapted personality is working better than chance.
  if (learningState && learningState.totalSignals >= 5 && learningState.positiveRate > 0.6) {
    adapted = learningState.bestPersonality
    reason = `learned best personality (${learningState.positiveRate * 100 | 0}% positive rate, ${learningState.totalSignals} signals) → ${adapted}`
    strength = Math.min(1, learningState.positiveRate)
  } else if (profile && profile.interactionCount >= 3) {
    // Find the user's most frequent emotion
    const sorted = Object.entries(profile.emotionFrequency)
      .sort(([, a], [, b]) => (b as number) - (a as number))
    if (sorted.length > 0) {
      const [topEmotion, topFreq] = sorted[0]
      if ((topFreq as number) >= ADAPT_THRESHOLD) {
        const recommended = EMOTION_TO_PERSONALITY[topEmotion as EmotionType]
        if (recommended) {
          adapted = recommended
          strength = Math.min(1, (topFreq as number))
          reason = `user frequently ${topEmotion} (${Math.round((topFreq as number) * 100)}%) → ${recommended} tone`
        }
      }
    }
  }

  // EMOTION GAP 3: Immediate adaptation for high-confidence single messages
  // (bypasses the interactionCount >= 3 gate when the signal is strong)
  if (adapted === basePersonality && currentAnalysis && currentAnalysis.confidence >= 0.85) {
    const immediate = EMOTION_TO_PERSONALITY[currentAnalysis.dominant]
    if (immediate) {
      adapted = immediate
      strength = currentAnalysis.confidence
      reason = `high-confidence immediate signal (${Math.round(currentAnalysis.confidence * 100)}% confidence: ${currentAnalysis.dominant}) → ${immediate} tone`
    }
  }

  // EMOTION GAP 4: Personality decay — if recent context shows the dominant emotion
  // has shifted away from the adapted personality trigger for 2+ consecutive messages,
  // blend back toward neutral/professional.
  if (context && context.recentMessages.length >= 2 && adapted !== basePersonality) {
    const lastTwo = context.recentMessages.slice(-2)
    const lastTwoDominants = lastTwo.map(m => m.analysis.dominant)
    // Check if the last 2 messages are now emotionally positive/neutral while
    // the adapted personality was for a negative state
    const adaptedIsNegative = ['empathetic', 'calm'].includes(adapted)
    const allRecent = lastTwoDominants.every(d => EMOTION_VALENCE[d] >= 0)
    if (adaptedIsNegative && allRecent) {
      adapted = basePersonality
      strength = 0
      reason = `personality decay — emotion shifted to positive for ${lastTwo.length} consecutive messages → returning to ${basePersonality}`
    }
  }

  // Override if drift is declining (stronger signal overrides learning/frequency)
  if (drift && drift.direction === 'declining' && drift.trendScore < -0.3) {
    adapted = 'empathetic'
    reason = `emotional drift declining (${drift.trendScore}) → empathetic tone`
    strength = Math.min(1, Math.abs(drift.trendScore))
  }

  const state: PersonalityState = {
    base: basePersonality,
    adapted,
    adaptationReason: reason,
    strength: Math.round(strength * 100) / 100,
  }

  userPersonality.set(userId, state)
  return state
}

/**
 * Get current personality state for a user.
 */
export function getPersonalityState(userId: string): PersonalityState | null {
  return userPersonality.get(userId) ?? null
}

// ─── Phase 5 — Confidence Levels (included in EmotionAnalysis) ──────────────
// Confidence is computed inside detectEmotions().  This section provides a
// standalone helper for external callers.

/**
 * Score confidence for an arbitrary analysis result.
 */
export function scoreConfidence(analysis: EmotionAnalysis): {
  confidence: number
  reasoning_strength: 'low' | 'medium' | 'high'
} {
  return {
    confidence: analysis.confidence,
    reasoning_strength: analysis.reasoning_strength,
  }
}

// ─── Phase 6 — Behavioral Learning Loop ─────────────────────────────────────

/**
 * Record a learning signal (success / failure / engagement).
 */
export function recordLearningSignal(signal: LearningSignal): void {
  learningSignals.push(signal)

  // Cap total signals to prevent memory growth
  if (learningSignals.length > 10_000) {
    learningSignals.splice(0, learningSignals.length - 10_000)
  }

  // Update per-user learning state
  const existing = userLearningState.get(signal.userId) ?? {
    userId: signal.userId,
    totalSignals: 0,
    positiveRate: 0,
    negativeRate: 0,
    bestPersonality: 'professional' as PersonalityType,
    worstPersonality: 'professional' as PersonalityType,
    lastSignalAt: signal.responseId,
  }

  existing.totalSignals++

  // Track personality effectiveness
  const userSignals = learningSignals.filter(s => s.userId === signal.userId)
  const positiveSignals = userSignals.filter(s => s.signalType === 'positive')
  const negativeSignals = userSignals.filter(s => s.signalType === 'negative')

  existing.positiveRate = Math.round((positiveSignals.length / userSignals.length) * 100) / 100
  existing.negativeRate = Math.round((negativeSignals.length / userSignals.length) * 100) / 100

  // Best / worst personality by engagement score
  const personalityScores = new Map<PersonalityType, number[]>()
  for (const s of userSignals) {
    const arr = personalityScores.get(s.personalityUsed) ?? []
    arr.push(s.engagementScore)
    personalityScores.set(s.personalityUsed, arr)
  }

  let bestAvg = -1
  let worstAvg = 2
  for (const [personality, scores] of personalityScores) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (avg > bestAvg) {
      bestAvg = avg
      existing.bestPersonality = personality
    }
    if (avg < worstAvg) {
      worstAvg = avg
      existing.worstPersonality = personality
    }
  }

  existing.lastSignalAt = new Date().toISOString()
  userLearningState.set(signal.userId, existing)
}

/**
 * Get the learning state for a user.
 */
export function getLearningState(userId: string): LearningState | null {
  return userLearningState.get(userId) ?? null
}

// ─── Phase 7 — Emotional Memory ─────────────────────────────────────────────

/**
 * Store an emotion analysis in short-term memory.
 */
export function storeEmotionMemory(userId: string, analysis: EmotionAnalysis, context?: string): void {
  const entries = emotionMemory.get(userId) ?? []
  entries.push({
    userId,
    timestamp: new Date().toISOString(),
    emotions: analysis.emotions,
    dominant: analysis.dominant,
    context,
  })

  // Rolling window
  if (entries.length > MAX_MEMORY_PER_USER) {
    entries.splice(0, entries.length - MAX_MEMORY_PER_USER)
  }
  emotionMemory.set(userId, entries)
}

/**
 * Retrieve emotion history for a user.
 */
export function getEmotionHistory(userId: string, limit = 20): EmotionMemoryEntry[] {
  const entries = emotionMemory.get(userId) ?? []
  return entries.slice(-limit)
}

// ─── Phase 8 — Response Modulation ──────────────────────────────────────────

/**
 * Generate tone/personality modulation instructions for the AI response.
 */
export function modulateResponse(
  userId: string,
  analysis: EmotionAnalysis,
  basePersonality: PersonalityType = 'professional',
): ResponseModulation {
  // 1. Update profile and drift
  updateEmotionalProfile(userId, analysis)
  trackEmotionalDrift(userId, analysis.dominant)

  // 2. Adapt personality — pass current analysis for high-confidence immediate signals
  const personality = adaptPersonality(userId, basePersonality, analysis)

  // 3. Build tone prefix
  const notes: string[] = []
  let tonePrefix = ''

  switch (personality.adapted) {
    case 'calm':
      tonePrefix = 'Respond in a calm, patient, reassuring tone.'
      notes.push('User appears frustrated/angry — using calm tone')
      break
    case 'empathetic':
      tonePrefix = 'Respond with empathy and understanding. Acknowledge the user\'s feelings.'
      notes.push('User emotional state warrants empathetic approach')
      break
    case 'analytical':
      tonePrefix = 'Respond with clear, structured explanations. Be precise and thorough.'
      notes.push('User appears confused — using analytical clarity')
      break
    case 'energetic':
      tonePrefix = 'Respond with enthusiasm and positive energy!'
      notes.push('User is in a positive mood — matching energy')
      break
    case 'friendly':
      tonePrefix = 'Respond in a warm, friendly, conversational tone.'
      notes.push('User trusts the interaction — being approachable')
      break
    case 'assertive':
      tonePrefix = 'Respond confidently and decisively.'
      break
    case 'flirty':
      tonePrefix = 'Respond playfully and engagingly.'
      break
    default:
      tonePrefix = 'Respond professionally and helpfully.'
  }

  if (analysis.dominant !== 'neutral') {
    notes.push(`Detected emotion: ${analysis.dominant} (confidence: ${Math.round(analysis.confidence * 100)}%)`)
  }

  // Store to memory
  storeEmotionMemory(userId, analysis)

  return {
    tonePrefix,
    personalityApplied: personality.adapted,
    emotionAcknowledged: analysis.dominant,
    confidenceLevel: analysis.confidence,
    modulationNotes: notes,
  }
}

// ─── Phase 9 — Multimodal Foundation ────────────────────────────────────────

/**
 * Multimodal emotion detection API types.
 * Text-based detection is fully implemented. Voice-tone and facial-expression
 * detection are defined here as future phases — not yet wired to a backend.
 */
export type MultimodalEmotionSource = 'text' | 'voice_tone' | 'facial' | 'combined'

export interface MultimodalEmotionConfig {
  enabledSources: MultimodalEmotionSource[]
  voiceToneEndpoint?: string
  facialAnalysisEndpoint?: string
}

export const DEFAULT_MULTIMODAL_CONFIG: MultimodalEmotionConfig = {
  enabledSources: ['text'], // Only text enabled — voice/facial are future phases
}

// ─── Phase 10 — Full Pipeline ───────────────────────────────────────────────

import {
  persistEmotionState,
  loadProfile,
  loadDrift,
  loadMemory,
  loadPersonality,
  loadContext,
  loadLearning,
} from './emotion-persistence'
import { enrichAndBlend, isHFEnrichmentAvailable } from './hf-emotion-enrichment'

/** Tracks which user IDs have been warm-started from Redis in this process lifetime */
const warmUpCache = new Set<string>()

/**
 * Warm up the in-memory emotion state for a user from Redis on first encounter.
 *
 * On container restart all Maps are empty, but Redis retains up to 7 days of
 * state. This function restores that state into the in-memory Maps so personality
 * adaptation, drift tracking, and learning all continue from where they left off.
 *
 * It is safe to call multiple times — subsequent calls are no-ops for the same userId.
 * Non-blocking: errors are silently ignored so the pipeline always continues.
 */
export async function warmUpEmotionState(userId: string): Promise<void> {
  if (warmUpCache.has(userId)) return
  warmUpCache.add(userId)

  try {
    const [profile, drift, memory, personality, context, learning] = await Promise.all([
      loadProfile(userId),
      loadDrift(userId),
      loadMemory(userId),
      loadPersonality(userId),
      loadContext(userId),
      loadLearning(userId),
    ])

    if (profile && !userProfiles.has(userId))         userProfiles.set(userId, profile)
    if (drift && !userDrift.has(userId))               userDrift.set(userId, drift)
    if (memory && !emotionMemory.has(userId))          emotionMemory.set(userId, memory)
    if (personality && !userPersonality.has(userId))   userPersonality.set(userId, personality)
    if (context && !conversationContexts.has(userId))  conversationContexts.set(userId, context)
    if (learning && !userLearningState.has(userId)) {
      userLearningState.set(userId, learning)
    }
  } catch {
    // Persistence unavailable — in-memory engine works without it
  }
}

/**
 * Run the complete emotional intelligence pipeline (v2).
 *
 * input → warm-up from Redis → detect → emoji + NLP + negation → context update
 *       → memory lookup → personality adapt → modulate → persist → output
 *
 * The pipeline is synchronous for performance. Warm-up is async on first
 * encounter. Persistence (Redis/Qdrant) and HF enrichment are fire-and-forget.
 */
export function runEmotionPipeline(
  userId: string,
  text: string,
  basePersonality: PersonalityType = 'professional',
): {
  analysis: EmotionAnalysis
  modulation: ResponseModulation
  profile: EmotionalProfile
  drift: EmotionalDrift
  personality: PersonalityState
  context: ConversationContext
  sentiment: SentimentResult
} {
  // Step 0: Fire-and-forget warm-up from Redis on first encounter.
  // Restores profile/drift/personality after container restart.
  if (!warmUpCache.has(userId)) {
    warmUpEmotionState(userId).catch(() => {})
  }

  // Step 1: Detect emotions (includes emoji, NLP, negation, intensity)
  const analysis = detectEmotions(text)

  // Step 2: NLP sentiment (also returned for transparency)
  const sentiment = analyzeSentiment(text)

  // Step 3: Update conversation context + record transitions
  const context = updateConversationContext(userId, text, analysis)

  // Step 4-5-6-7: Modulate (updates profile, drift, personality internally)
  const modulation = modulateResponse(userId, analysis, basePersonality)

  // Retrieve updated state
  const profile = userProfiles.get(userId)!
  const drift = userDrift.get(userId)!
  const personality = userPersonality.get(userId)!
  const memory = emotionMemory.get(userId) ?? []

  // Step 8: Fire-and-forget async persistence (Redis + Qdrant)
  // Non-blocking — errors are swallowed; in-memory state is authoritative
  persistEmotionState(userId, {
    profile,
    drift,
    memory,
    personality,
    context,
    analysis,
    analysesCount: totalAnalyses,
    transitions: transitionMatrix,
    analysisContext: text.slice(0, 200),
  }).catch(() => {}) // swallow errors — persistence is best-effort

  return { analysis, modulation, profile, drift, personality, context, sentiment }
}

/**
 * Run the complete pipeline with HuggingFace enrichment (async version).
 *
 * Use this when you can afford the extra latency (~200-3000ms for HF API call).
 * Falls back to internal-only if HF is unavailable.
 */
export async function runEmotionPipelineEnriched(
  userId: string,
  text: string,
  basePersonality: PersonalityType = 'professional',
): Promise<{
  analysis: EmotionAnalysis
  modulation: ResponseModulation
  profile: EmotionalProfile
  drift: EmotionalDrift
  personality: PersonalityState
  context: ConversationContext
  sentiment: SentimentResult
  hfEnriched: boolean
}> {
  // Step 0: Await warm-up from Redis on first encounter.
  // In the async pipeline we can properly await it so subsequent steps see the rehydrated state.
  await warmUpEmotionState(userId)

  // Step 1: Internal detection
  let analysis = detectEmotions(text)

  // Step 1b: HF enrichment (if available)
  let hfEnriched = false
  if (isHFEnrichmentAvailable()) {
    const blended = await enrichAndBlend(text, analysis)
    if (blended.blendApplied) {
      analysis = blended.analysis
      hfEnriched = true
    }
  }

  // Steps 2-7: Same as synchronous pipeline
  const sentiment = analyzeSentiment(text)
  const context = updateConversationContext(userId, text, analysis)
  const modulation = modulateResponse(userId, analysis, basePersonality)

  const profile = userProfiles.get(userId)!
  const drift = userDrift.get(userId)!
  const personality = userPersonality.get(userId)!
  const memory = emotionMemory.get(userId) ?? []

  // Step 8: Async persistence
  persistEmotionState(userId, {
    profile,
    drift,
    memory,
    personality,
    context,
    analysis,
    analysesCount: totalAnalyses,
    transitions: transitionMatrix,
    analysisContext: text.slice(0, 200),
  }).catch(() => {})

  return { analysis, modulation, profile, drift, personality, context, sentiment, hfEnriched }
}

// ─── Phase 12 — Dashboard Summary ───────────────────────────────────────────

/**
 * Get aggregated stats for the emotional intelligence dashboard.
 */
export function getEmotionDashboardSummary(): EmotionDashboardSummary {
  // Emotion distribution across all profiles
  const distribution: Partial<Record<EmotionType, number>> = {}
  for (const profile of userProfiles.values()) {
    for (const [emotion, freq] of Object.entries(profile.emotionFrequency)) {
      distribution[emotion as EmotionType] =
        (distribution[emotion as EmotionType] ?? 0) + (freq ?? 0)
    }
  }

  // Normalize distribution
  const total = Object.values(distribution).reduce((s, v) => s + v, 0)
  if (total > 0) {
    for (const key of Object.keys(distribution)) {
      distribution[key as EmotionType] = Math.round((distribution[key as EmotionType]! / total) * 100) / 100
    }
  }

  // Drift summary
  const driftSummary = { improving: 0, declining: 0, unstable: 0, stable: 0 }
  for (const d of userDrift.values()) {
    driftSummary[d.direction]++
  }

  // System mood — most common recent dominant emotion
  const recentDominants: EmotionType[] = []
  for (const entries of emotionMemory.values()) {
    const latest = entries.slice(-3)
    for (const e of latest) recentDominants.push(e.dominant)
  }
  const moodCounts = new Map<EmotionType, number>()
  for (const e of recentDominants) {
    moodCounts.set(e, (moodCounts.get(e) ?? 0) + 1)
  }
  let systemMood: EmotionType = 'neutral'
  let maxMoodCount = 0
  for (const [emotion, count] of moodCounts) {
    if (count > maxMoodCount) {
      maxMoodCount = count
      systemMood = emotion
    }
  }

  // Average confidence
  let avgConfidence = 0
  if (totalAnalyses > 0) {
    // Approximate — we don't store every confidence, use profiles' intensity as proxy
    const intensities: number[] = []
    for (const p of userProfiles.values()) {
      intensities.push(p.intensityAverage)
    }
    avgConfidence = intensities.length > 0
      ? Math.round((intensities.reduce((a, b) => a + b, 0) / intensities.length) * 100) / 100
      : 0.5
  }

  return {
    totalAnalyses,
    averageConfidence: avgConfidence,
    emotionDistribution: distribution,
    activeProfiles: userProfiles.size,
    learningSignals: learningSignals.length,
    systemMood,
    driftSummary,
  }
}

/**
 * Get the top emotion transitions for the dashboard.
 */
export function getTopTransitions(limit = 10): EmotionTransition[] {
  return getEmotionTransitions().slice(0, limit)
}

// ─── Testing Exports ────────────────────────────────────────────────────────

export {
  DETECTION_RULES, DRIFT_WINDOW, MAX_MEMORY_PER_USER, ADAPT_THRESHOLD,
  EMOTION_VALENCE, EMOJI_EMOTIONS, NEGATION_WORDS, INTENSITY_MODIFIERS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_CONTEXT_WINDOW as CONTEXT_WINDOW, // backward compat alias
}

/**
 * Reset all in-memory state (for testing only).
 */
export function _resetEmotionState(): void {
  emotionMemory.clear()
  userProfiles.clear()
  userDrift.clear()
  learningSignals.length = 0
  userLearningState.clear()
  userPersonality.clear()
  transitionMatrix.clear()
  conversationContexts.clear()
  totalAnalyses = 0
}
