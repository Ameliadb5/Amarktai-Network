/**
 * HuggingFace Emotion Enrichment — AmarktAI Network
 *
 * Calls HuggingFace Inference API models for emotion classification
 * when HUGGINGFACE_API_KEY is configured.  Merges results with the
 * internal fast emotion engine using weighted blending.
 *
 * Models used:
 *   - SamLowe/roberta-base-go_emotions         (primary — 28 GoEmotions labels)
 *   - j-hartmann/emotion-english-distilroberta-base (secondary — 7 Ekman emotions)
 *
 * Graceful degradation:
 *   - No API key → returns null (internal engine is sole source)
 *   - API error  → returns null (fallback to internal engine)
 *   - Timeout    → returns null (latency budget exceeded)
 *
 * Blending:
 *   final_score = internal_weight * internal_score + hf_weight * hf_score
 *   Default weights: internal=0.6, hf=0.4 (internal engine is trusted baseline)
 */

import type { EmotionAnalysis, EmotionScore, EmotionType } from './emotion-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HFClassificationResult {
  label: string
  score: number
}

export interface HFEnrichmentResult {
  model: string
  raw: HFClassificationResult[]
  mapped: EmotionScore[]
  latencyMs: number
}

export interface BlendedEmotionResult {
  analysis: EmotionAnalysis
  enrichment: HFEnrichmentResult | null
  blendApplied: boolean
}

// ─── Config ─────────────────────────────────────────────────────────────────

const HF_API_URL = 'https://api-inference.huggingface.co/models'
const REQUEST_TIMEOUT_MS = 3000 // 3 second hard timeout
const INTERNAL_WEIGHT = 0.6
const HF_WEIGHT = 0.4

// Model configuration
const MODELS = {
  primary: 'SamLowe/roberta-base-go_emotions',
  secondary: 'j-hartmann/emotion-english-distilroberta-base',
} as const

// ─── GoEmotions Label → EmotionType Mapping ─────────────────────────────────

const GO_EMOTIONS_MAP: Record<string, EmotionType> = {
  // Direct mappings
  joy: 'joy',
  love: 'affection',
  admiration: 'affection',
  amusement: 'joy',
  gratitude: 'joy',
  optimism: 'anticipation',
  pride: 'joy',
  relief: 'joy',
  approval: 'trust',
  caring: 'affection',
  desire: 'longing',
  excitement: 'excitement',
  curiosity: 'anticipation',
  // Negative mappings
  sadness: 'sadness',
  grief: 'sadness',
  disappointment: 'sadness',
  remorse: 'sadness',
  anger: 'anger',
  annoyance: 'frustration',
  disapproval: 'frustration',
  disgust: 'disgust',
  fear: 'fear',
  nervousness: 'fear',
  embarrassment: 'fear',
  confusion: 'confusion',
  surprise: 'surprise',
  realization: 'surprise',
  neutral: 'neutral',
}

// Ekman (j-hartmann) label mapping
const EKMAN_MAP: Record<string, EmotionType> = {
  joy: 'joy',
  sadness: 'sadness',
  anger: 'anger',
  fear: 'fear',
  surprise: 'surprise',
  disgust: 'disgust',
  neutral: 'neutral',
}

// ─── API Call ───────────────────────────────────────────────────────────────

/**
 * Check if HuggingFace enrichment is available (API key configured).
 */
export function isHFEnrichmentAvailable(): boolean {
  return !!process.env.HUGGINGFACE_API_KEY
}

/**
 * Call a HuggingFace classification model.
 */
async function callHFModel(
  modelId: string,
  text: string,
): Promise<HFClassificationResult[] | null> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${HF_API_URL}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json()

    // HF returns [[{label, score}]] for text-classification
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0] as HFClassificationResult[]
    }
    if (Array.isArray(data)) {
      return data as HFClassificationResult[]
    }
    return null
  } catch {
    clearTimeout(timeout)
    return null
  }
}

/**
 * Map HuggingFace classification results to our EmotionScore format.
 */
function mapToEmotionScores(
  results: HFClassificationResult[],
  labelMap: Record<string, EmotionType>,
): EmotionScore[] {
  const scoreMap = new Map<EmotionType, number>()

  for (const r of results) {
    const mapped = labelMap[r.label.toLowerCase()]
    if (mapped) {
      const prev = scoreMap.get(mapped) ?? 0
      // Aggregate labels that map to the same emotion
      scoreMap.set(mapped, Math.min(1, prev + r.score))
    }
  }

  return [...scoreMap.entries()]
    .map(([type, score]) => ({ type, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
}

// ─── Enrichment Pipeline ────────────────────────────────────────────────────

/**
 * Enrich emotion analysis with HuggingFace model(s).
 *
 * Tries primary model first, falls back to secondary on failure.
 * Returns null if HF is unavailable or both models fail.
 */
export async function enrichWithHF(text: string): Promise<HFEnrichmentResult | null> {
  if (!isHFEnrichmentAvailable()) return null

  const start = performance.now()

  // Try primary model (GoEmotions — 28 labels)
  let raw = await callHFModel(MODELS.primary, text)
  let modelUsed: string = MODELS.primary
  let labelMap: Record<string, EmotionType> = GO_EMOTIONS_MAP

  // Fallback to secondary (Ekman — 7 labels)
  if (!raw) {
    raw = await callHFModel(MODELS.secondary, text)
    modelUsed = MODELS.secondary
    labelMap = EKMAN_MAP
  }

  if (!raw || raw.length === 0) return null

  const latencyMs = Math.round((performance.now() - start) * 100) / 100
  const mapped = mapToEmotionScores(raw, labelMap)

  return { model: modelUsed, raw, mapped, latencyMs }
}

// ─── Blending ───────────────────────────────────────────────────────────────

/**
 * Blend internal emotion analysis with HuggingFace enrichment.
 *
 * Formula: final = INTERNAL_WEIGHT * internal + HF_WEIGHT * hf
 * If HF is unavailable, returns the internal analysis unchanged.
 */
export function blendEmotionResults(
  internal: EmotionAnalysis,
  enrichment: HFEnrichmentResult | null,
): EmotionAnalysis {
  if (!enrichment || enrichment.mapped.length === 0) return internal

  // Build score maps
  const internalMap = new Map(internal.emotions.map(e => [e.type, e.score]))
  const hfMap = new Map(enrichment.mapped.map(e => [e.type, e.score]))

  // Collect all emotion types
  const allTypes = new Set([...internalMap.keys(), ...hfMap.keys()])

  // Blend
  const blended: EmotionScore[] = []
  for (const type of allTypes) {
    const iScore = internalMap.get(type) ?? 0
    const hScore = hfMap.get(type) ?? 0
    const final = Math.round((INTERNAL_WEIGHT * iScore + HF_WEIGHT * hScore) * 100) / 100
    if (final > 0.01) {
      blended.push({ type, score: Math.min(1, final) })
    }
  }

  // Sort and determine dominant
  blended.sort((a, b) => b.score - a.score)
  if (blended.length === 0) {
    blended.push({ type: 'neutral', score: 0.5 })
  }

  const dominant = blended[0].type
  const topScore = blended[0].score
  const secondScore = blended.length > 1 ? blended[1].score : 0
  const separation = topScore - secondScore
  const confidence = Math.min(0.99, Math.max(0.1, 0.4 + separation * 0.8 + topScore * 0.3))
  const reasoning_strength: 'low' | 'medium' | 'high' =
    confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low'

  return {
    emotions: blended,
    dominant,
    confidence,
    reasoning_strength,
    latencyMs: internal.latencyMs + (enrichment.latencyMs ?? 0),
  }
}

/**
 * Full enrichment + blending pipeline.
 * Called after internal detection; returns blended result if HF available.
 */
export async function enrichAndBlend(
  text: string,
  internalAnalysis: EmotionAnalysis,
): Promise<BlendedEmotionResult> {
  const enrichment = await enrichWithHF(text)
  if (!enrichment) {
    return { analysis: internalAnalysis, enrichment: null, blendApplied: false }
  }

  const blended = blendEmotionResults(internalAnalysis, enrichment)
  return { analysis: blended, enrichment, blendApplied: true }
}

// ─── Exports for testing ────────────────────────────────────────────────────

export {
  HF_API_URL, REQUEST_TIMEOUT_MS, INTERNAL_WEIGHT, HF_WEIGHT,
  GO_EMOTIONS_MAP, EKMAN_MAP, MODELS,
}
