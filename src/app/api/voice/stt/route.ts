/**
 * POST /api/voice/stt — Convenience voice STT endpoint
 *
 * Thin wrapper around /api/brain/stt for cleaner voice API surface.
 * Supports Groq (low-cost) and OpenAI (premium) STT providers.
 *
 * See /api/brain/stt for full parameter documentation.
 */
export { POST } from '@/app/api/brain/stt/route';
