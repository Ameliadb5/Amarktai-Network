/**
 * Amarktai Network — AI Provider Vault Utilities
 *
 * Server-side only helper functions for AI provider key masking and health checks.
 * This file MUST NOT be imported from client components.
 */

import { decryptVaultKey } from '@/lib/crypto-vault'

/**
 * Generate a safe masked preview of an API key.
 * Shows prefix (up to 8 chars or up to the first '-') and last 4 chars.
 * Example: "sk-proj-••••••••••••abcd"
 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••••'
  // Try to preserve the common prefix pattern (e.g. "sk-", "sk-proj-", "Bearer ")
  const dashIdx = trimmed.lastIndexOf('-', 10) // search only the first ~10 chars for a prefix separator
  const prefixLen = dashIdx > 0 ? dashIdx + 1 : Math.min(7, trimmed.length - 4)
  const prefix = trimmed.substring(0, prefixLen)
  const suffix = trimmed.slice(-4)
  return `${prefix}${'•'.repeat(12)}${suffix}`
}

export interface HealthCheckResult {
  status: 'healthy' | 'configured' | 'degraded' | 'error' | 'unconfigured' | 'disabled'
  message: string
}

export type ProviderOperationalState = 'WORKING' | 'MISCONFIGURED' | 'UNAVAILABLE'

export function mapHealthStatusToTruthState(
  status: HealthCheckResult['status'],
): ProviderOperationalState {
  if (status === 'healthy') return 'WORKING'
  if (status === 'error' || status === 'unconfigured') return 'MISCONFIGURED'
  return 'UNAVAILABLE'
}

const BEARER_PREFIX = 'bearer '

function normalizeApiKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.toLowerCase().startsWith(BEARER_PREFIX)) {
    return trimmed.slice(BEARER_PREFIX.length).trim()
  }
  return trimmed
}

function resolveStoredApiKey(rawStoredKey: string): string {
  const decrypted = decryptVaultKey(rawStoredKey)
  if (decrypted === null && rawStoredKey.startsWith('v1:')) {
    console.warn('[providers] Encrypted provider key could not be decrypted for health check.')
  }
  const candidate = decrypted ?? rawStoredKey
  return normalizeApiKey(candidate)
}

const HF_HEALTHCHECK_MODEL = 'distilbert-base-uncased-finetuned-sst-2-english'

/**
 * Run a live health check for the given provider.
 * Returns a truthful status — never fakes healthy.
 */
export async function runProviderHealthCheck(
  providerKey: string,
  apiKey: string,
  baseUrl: string,
): Promise<HealthCheckResult> {
  if (!apiKey) return { status: 'unconfigured', message: 'No API key configured' }
  const resolvedApiKey = resolveStoredApiKey(apiKey)
  if (!resolvedApiKey || resolvedApiKey.startsWith('v1:')) {
    return {
      status: 'error',
      message: 'Stored API key could not be decrypted. Verify VAULT_ENCRYPTION_KEY configuration.',
    }
  }

  const timeout = 10_000 // 10 s

  try {
    switch (providerKey) {
      case 'openai': {
        const endpoint = `${baseUrl || 'https://api.openai.com'}/v1/chat/completions`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${resolvedApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'health check' }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · chat execution path responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429) · key valid but quota exceeded' }
        return { status: 'degraded', message: `HTTP ${res.status} from OpenAI chat execution path` }
      }

      case 'groq': {
        const endpoint = `${baseUrl || 'https://api.groq.com/openai'}/v1/chat/completions`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${resolvedApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: 'health check' }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Groq execution path responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Groq API` }
      }

      case 'deepseek': {
        const endpoint = `${baseUrl || 'https://api.deepseek.com'}/v1/models`
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · DeepSeek API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 402) return { status: 'error', message: 'Insufficient balance (402)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from DeepSeek API` }
      }

      case 'openrouter': {
        const endpoint = `${baseUrl || 'https://openrouter.ai/api'}/v1/models`
        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${resolvedApiKey}`,
            'HTTP-Referer': 'https://amarktai.network',
            'X-Title': 'AmarktAI Network',
          },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · OpenRouter API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from OpenRouter API` }
      }

      case 'together': {
        const endpoint = `${baseUrl || 'https://api.together.xyz'}/v1/models`
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Together AI API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Together AI API` }
      }

      case 'gemini': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(resolvedApiKey)}`,
          { signal: AbortSignal.timeout(timeout) },
        )
        if (res.ok) return { status: 'healthy', message: 'Connected · Gemini API responding' }
        if (res.status === 400 || res.status === 403) return { status: 'error', message: 'Invalid API key' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Gemini API` }
      }

      case 'grok': {
        const endpoint = `${baseUrl || 'https://api.x.ai'}/v1/models`
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · xAI API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from xAI API` }
      }

      case 'huggingface': {
        const whoamiRes = await fetch('https://huggingface.co/api/whoami-v2', {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (whoamiRes.ok) {
          return { status: 'healthy', message: 'Connected · Hugging Face account endpoint responding' }
        }

        // Some tokens can run inference even when whoami is restricted; verify
        // the exact path used by runtime image/audio routes before marking invalid.
        const inferenceRes = await fetch(
          `https://api-inference.huggingface.co/models/${HF_HEALTHCHECK_MODEL}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resolvedApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: 'health check' }),
            signal: AbortSignal.timeout(timeout),
          },
        )

        if (inferenceRes.ok || inferenceRes.status === 503) {
          return {
            status: 'degraded',
            message:
              `Account endpoint HTTP ${whoamiRes.status}, but inference access is valid. ` +
              'Token is usable for runtime Hugging Face inference routes.',
          }
        }
        if (inferenceRes.status === 401 || inferenceRes.status === 403) {
          return {
            status: 'error',
            message:
              `Hugging Face token rejected by inference endpoint (HTTP ${inferenceRes.status}). ` +
              'Invalid token or missing model/inference access scope.',
          }
        }

        return {
          status: 'degraded',
          message:
            `Hugging Face health check mismatch: whoami HTTP ${whoamiRes.status}, ` +
            `inference HTTP ${inferenceRes.status}.`,
        }
      }

      case 'anthropic': {
        const endpoint = `${baseUrl || 'https://api.anthropic.com'}/v1/messages`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': resolvedApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Anthropic API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Anthropic API` }
      }

      case 'cohere': {
        const endpoint = `${baseUrl || 'https://api.cohere.com'}/v2/chat`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedApiKey}`,
          },
          body: JSON.stringify({
            model: 'command-r',
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Cohere API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Cohere API` }
      }

      case 'qwen': {
        const endpoint = `${baseUrl || 'https://dashscope-intl.aliyuncs.com/compatible-mode'}/v1/models`
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Qwen/DashScope API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Qwen/DashScope API` }
      }

      case 'nvidia':
        // NVIDIA NIM — key can be validated but models list requires explicit access
        return { status: 'configured', message: 'Key configured · use Gateway Test to validate live inference' }

      case 'mistral': {
        const endpoint = `${baseUrl || 'https://api.mistral.ai'}/v1/models`
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${resolvedApiKey}` },
          signal: AbortSignal.timeout(timeout),
        })
        if (res.ok) return { status: 'healthy', message: 'Connected · Mistral AI API responding' }
        if (res.status === 401) return { status: 'error', message: 'Invalid API key (401 Unauthorized)' }
        if (res.status === 429) return { status: 'degraded', message: 'Rate limited (429)' }
        return { status: 'degraded', message: `HTTP ${res.status} from Mistral AI API` }
      }

      default:
        return { status: 'configured', message: 'Key configured · connectivity not validated' }
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { status: 'degraded', message: 'Health check timed out (>10 s)' }
      }
      return { status: 'degraded', message: `Health check failed: ${err.message}` }
    }
    return { status: 'degraded', message: 'Health check failed: unknown error' }
  }
}
