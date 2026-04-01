/**
 * POST /api/voice/tts — Convenience voice TTS endpoint
 *
 * Thin wrapper around /api/brain/tts for cleaner voice API surface.
 * Supports Groq (low-cost) and OpenAI (premium) TTS providers.
 *
 * See /api/brain/tts for full parameter documentation.
 */
export { POST } from '@/app/api/brain/tts/route';
