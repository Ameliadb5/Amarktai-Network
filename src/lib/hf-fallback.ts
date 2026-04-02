/**
 * HuggingFace Fallback Adapter — capability reserve layer.
 *
 * When dedicated providers are unavailable for a capability, this adapter
 * provides fallback model suggestions from HuggingFace Inference API.
 *
 * Integrates with the Capability Engine and Routing Engine.
 */

import {
  type ModelEntry,
  getUsableModels,
  isProviderUsable,
} from './model-registry';
import type { CapabilityClass } from './capability-engine';

// ---------------------------------------------------------------------------
// HuggingFace model recommendations per capability class
// ---------------------------------------------------------------------------

interface HfFallbackSpec {
  model: string;
  label: string;
  notes: string;
}

const HF_FALLBACK_MODELS: Partial<Record<CapabilityClass, HfFallbackSpec[]>> = {
  image_generation: [
    { model: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base', notes: 'High-quality general image generation' },
    { model: 'runwayml/stable-diffusion-v1-5', label: 'SD v1.5', notes: 'Fast and reliable image generation' },
  ],
  // suggestive_image_generation uses safe-prompt-enforced diffusion models.
  // Prompts are validated and sanitized by validateSuggestivePrompt() before
  // being sent to any provider. No nudity or explicit content is allowed.
  suggestive_image_generation: [
    { model: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base', notes: 'Fashion/lifestyle image generation with safe-prompt enforcement' },
    { model: 'stabilityai/stable-diffusion-2-1', label: 'SD 2.1', notes: 'Reliable fallback with controlled prompts' },
  ],
  embeddings: [
    { model: 'sentence-transformers/all-MiniLM-L6-v2', label: 'MiniLM-L6', notes: 'Fast sentence embeddings' },
    { model: 'BAAI/bge-base-en-v1.5', label: 'BGE Base', notes: 'High-quality embeddings' },
  ],
  reranking: [
    { model: 'BAAI/bge-reranker-base', label: 'BGE Reranker', notes: 'Cross-encoder reranking' },
  ],
  multimodal_understanding: [
    { model: 'Salesforce/blip2-opt-2.7b', label: 'BLIP-2', notes: 'Vision-language understanding' },
  ],
  voice_input: [
    { model: 'openai/whisper-base', label: 'Whisper Base', notes: 'Speech-to-text transcription' },
    { model: 'openai/whisper-small', label: 'Whisper Small', notes: 'Higher accuracy STT, multilingual' },
    { model: 'openai/whisper-large-v3', label: 'Whisper Large v3', notes: 'Best accuracy STT, multilingual, slower' },
  ],
  voice_output: [
    { model: 'facebook/mms-tts-eng', label: 'MMS TTS English', notes: 'English text-to-speech' },
    { model: 'facebook/mms-tts-fra', label: 'MMS TTS French', notes: 'French text-to-speech' },
  ],
  general_chat: [
    { model: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B', notes: 'General instruction following' },
  ],
  coding: [
    { model: 'bigcode/starcoder2-7b', label: 'StarCoder2', notes: 'Code generation' },
  ],
  summarization: [
    { model: 'facebook/bart-large-cnn', label: 'BART CNN', notes: 'Summarization' },
  ],
  classification: [
    { model: 'facebook/bart-large-mnli', label: 'BART MNLI', notes: 'Zero-shot classification' },
  ],
  // adult_18plus_image: intentionally excluded — no HuggingFace model can reliably
  // serve lawful adult 18+ content without safety-bypass infrastructure that does
  // not exist on this platform. Do not add entries here unless a real, policy-compliant
  // provider route is implemented and gated through the adult mode enforcement pipeline.
};

// ---------------------------------------------------------------------------
// Fallback resolution
// ---------------------------------------------------------------------------

export interface HfFallbackResult {
  capability: CapabilityClass;
  available: boolean;
  models: HfFallbackSpec[];
  reason: string;
}

/**
 * Check whether HuggingFace can serve as a fallback for the given capability.
 * Returns available fallback models if HF is configured and the capability is
 * in the HF fallback catalog.
 */
export function getHfFallback(capability: CapabilityClass): HfFallbackResult {
  const hfUsable = isProviderUsable('huggingface');
  const specs = HF_FALLBACK_MODELS[capability];

  if (!hfUsable) {
    return {
      capability,
      available: false,
      models: [],
      reason: 'HuggingFace provider is not configured or not healthy. Add a HuggingFace API key to enable fallback.',
    };
  }

  if (!specs || specs.length === 0) {
    return {
      capability,
      available: false,
      models: [],
      reason: `No HuggingFace fallback models are cataloged for capability "${capability}".`,
    };
  }

  return {
    capability,
    available: true,
    models: specs,
    reason: `HuggingFace can serve as fallback for ${capability} using ${specs.length} model(s).`,
  };
}

/**
 * For a list of capabilities that have no primary provider, return HF fallback
 * options for each.
 */
export function getHfFallbacksForGaps(
  missingCapabilities: CapabilityClass[],
): HfFallbackResult[] {
  return missingCapabilities.map(getHfFallback);
}

/**
 * Get all HuggingFace models currently in the main model registry.
 */
export function getRegisteredHfModels(): ModelEntry[] {
  return getUsableModels().filter((m) => m.provider === 'huggingface');
}

/**
 * Summary of HuggingFace as a fallback reserve.
 */
export function getHfFallbackStatus(): {
  providerHealthy: boolean;
  registeredModels: number;
  fallbackCapabilities: CapabilityClass[];
} {
  const hfUsable = isProviderUsable('huggingface');
  const registeredModels = getRegisteredHfModels().length;
  const fallbackCapabilities = Object.keys(HF_FALLBACK_MODELS) as CapabilityClass[];

  return {
    providerHealthy: hfUsable,
    registeredModels,
    fallbackCapabilities,
  };
}

export { HF_FALLBACK_MODELS };
