/**
 * POST /api/admin/settings/test-adult
 *
 * Test the adult content specialist provider — performs a REAL generation test,
 * not just a connection probe.
 *
 * The AI Engine (GenX) is NEVER used for adult content generation.
 * Only specialist providers are supported: xAI/Grok, Together AI, HuggingFace, Custom.
 *
 * Returns:
 *   { provider, model, success, outputType, status, error_category?, message, latencyMs }
 *
 * error_category values:
 *   missing_key | provider_policy_block | model_not_supported |
 *   endpoint_error | guardrail_block | unknown
 *
 * Returns truthful status — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptVaultKey } from '@/lib/crypto-vault'
import { getVaultApiKey } from '@/lib/brain'

type ProviderType = 'together' | 'huggingface' | 'xai' | 'custom'

type ErrorCategory =
  | 'missing_key'
  | 'provider_policy_block'
  | 'model_not_supported'
  | 'endpoint_error'
  | 'guardrail_block'
  | 'unknown'

/** Classify an HTTP status into a structured error category */
function classifyHttpError(status: number, body: string): ErrorCategory {
  if (status === 401 || status === 403) return 'missing_key'
  if (status === 404) return 'model_not_supported'
  if (status === 429) return 'endpoint_error'
  if (status === 422) {
    const lower = body.toLowerCase()
    if (lower.includes('safety') || lower.includes('policy') || lower.includes('content')) return 'provider_policy_block'
    return 'model_not_supported'
  }
  if (status >= 500) return 'endpoint_error'
  return 'unknown'
}

/** Safe test prompt used for all adult generation tests — not stored after test */
const ADULT_TEST_PROMPT = 'a tasteful artistic portrait of a woman in soft studio lighting'

/** Block SSRF: only allow http/https and block private/loopback in production */
function validateUrl(raw: string): { url: URL; error: string | null } {
  let url: URL
  try { url = new URL(raw) } catch { return { url: new URL('about:blank'), error: 'Invalid URL' } }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { url, error: 'URL must use http or https' }
  }
  const h = url.hostname.toLowerCase()
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(h) && process.env.NODE_ENV === 'production') {
    return { url, error: 'Private or loopback URLs are not allowed' }
  }
  return { url, error: null }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse request body ──
  let inlineMode         = ''
  let inlineProviderType = ''
  let inlineEndpoint     = ''
  let inlineKey          = ''
  let inlineModel        = ''

  try {
    const body = await req.json()
    inlineMode         = typeof body.mode         === 'string' ? body.mode.trim()         : ''
    inlineProviderType = typeof body.providerType === 'string' ? body.providerType.trim() : ''
    inlineEndpoint     = typeof body.endpoint     === 'string' ? body.endpoint.trim()     : ''
    inlineKey          = typeof body.apiKey       === 'string' ? body.apiKey.trim()       : ''
    inlineModel        = typeof body.model        === 'string' ? body.model.trim()        : ''
  } catch { /* ignore */ }

  // ── Resolve from DB if not provided inline ──
  let mode         = inlineMode
  let providerType = inlineProviderType as ProviderType
  let endpoint     = inlineEndpoint
  let apiKey       = inlineKey
  let providerModel = inlineModel

  if (!mode) {
    try {
      const row = await prisma.integrationConfig.findUnique({ where: { key: 'adult_mode' } })
      if (row) {
        let notes: Record<string, string> = {}
        try { notes = JSON.parse(row.notes) } catch { /* ignore */ }
        if (!mode)         mode         = notes.mode             || ''
        if (!providerType) providerType = (notes.providerType || 'together') as ProviderType
        if (!endpoint)     endpoint     = notes.specialistEndpoint || ''
        if (!providerModel) providerModel = notes.providerModel   || ''
        if (!apiKey && row.apiKey) apiKey = decryptVaultKey(row.apiKey) ?? ''
      }
    } catch { /* ignore */ }
  }

  if (!mode) mode = 'disabled'

  // ── Vault key fallback ──────────────────────────────────────────────────────
  // When no inline key and no key in the adult_mode integration config, check
  // the provider vault (aiProvider table — shared key store for all features).
  // This lets users reuse the same Together/HuggingFace/xAI key they already
  // saved in Admin → AI Providers, without entering it a second time.
  if (!apiKey && mode === 'specialist') {
    if (!providerType) providerType = 'together'
    const vaultKeyMap: Record<string, string> = {
      xai: 'grok',  // xAI/Grok uses the 'grok' vault key; all other provider types share their own key name
    }
    // 'custom' has no corresponding vault key — skip vault lookup for it
    if (providerType !== 'custom') {
      const vaultKey = vaultKeyMap[providerType] ?? providerType
      const resolved = await getVaultApiKey(vaultKey).catch(() => null)
      if (resolved) apiKey = resolved
    }
  }

  // ── Disabled ──
  if (mode === 'disabled') {
    return NextResponse.json({
      mode: 'disabled',
      supported: false,
      status: 'disabled',
      message: 'Adult Creative Mode is disabled. Enable a specialist provider in Settings to use adult content generation.',
    })
  }

  if (mode !== 'specialist') {
    return NextResponse.json({
      mode,
      supported: false,
      status: 'unknown_mode',
      message: `Unknown mode "${mode}". Only "specialist" is supported. The AI Engine is never used for adult content.`,
    })
  }

  // ── Specialist provider ──
  if (!providerType) providerType = 'together'

  // ── Together AI — real generation test ──
  if (providerType === 'together') {
    if (!apiKey) {
      return NextResponse.json({
        provider: 'together',
        mode: 'specialist', providerType: 'together',
        success: false, supported: false, status: 'not_configured',
        outputType: 'image',
        error_category: 'missing_key' as ErrorCategory,
        message: 'Together AI API key is required. Enter it here or save it via Admin → AI Providers → Together AI.',
      })
    }

    const testModel = providerModel || 'black-forest-labs/FLUX.1-schnell-Free'
    const start = Date.now()
    try {
      // Real generation test: attempt a minimal 512×512 image with a safe suggestive-adjacent prompt.
      // disable_safety_checker is sent so we can verify adult content support.
      // Test output is NOT stored — discarded immediately after status check.
      // lgtm[js/request-forgery] — hardcoded Together AI URL; admin-only endpoint
      const res = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: testModel,
          prompt: ADULT_TEST_PROMPT,
          n: 1,
          steps: 4,
          width: 512,
          height: 512,
          disable_safety_checker: true,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      const latencyMs = Date.now() - start
      const bodyText = await res.text().catch(() => '')

      if (res.ok) {
        let imageGenerated = false
        try {
          const parsed = JSON.parse(bodyText) as { data?: Array<{ url?: string; b64_json?: string }> }
          imageGenerated = !!(parsed.data?.[0]?.url || parsed.data?.[0]?.b64_json)
        } catch { /* non-JSON ok response */ }

        return NextResponse.json({
          provider: 'together',
          model: testModel,
          success: imageGenerated,
          supported: true,
          status: imageGenerated ? 'ready' : 'connected_no_output',
          outputType: 'image',
          mode: 'specialist', providerType: 'together',
          message: imageGenerated
            ? `Together AI generation test passed — image returned (${latencyMs}ms)`
            : `Together AI connected but no image data returned (${latencyMs}ms) — model may not support image output`,
          error_category: imageGenerated ? undefined : ('model_not_supported' as ErrorCategory),
          latencyMs,
        })
      }

      const errCat = classifyHttpError(res.status, bodyText)
      let errMsg = `Together AI generation test failed (HTTP ${res.status}, ${latencyMs}ms)`
      if (errCat === 'missing_key') errMsg += ' — authentication failed, check API key'
      else if (errCat === 'provider_policy_block') errMsg += ' — provider safety policy blocked the test prompt'
      else if (errCat === 'model_not_supported') errMsg += ' — model does not support this operation or disable_safety_checker is not allowed'
      else if (errCat === 'endpoint_error') errMsg += ' — Together AI server error'

      return NextResponse.json({
        provider: 'together',
        model: testModel,
        success: false,
        supported: false,
        status: errCat,
        outputType: 'image',
        mode: 'specialist', providerType: 'together',
        error_category: errCat,
        message: errMsg,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        provider: 'together',
        model: testModel,
        success: false,
        supported: false,
        status: 'unreachable',
        outputType: 'image',
        mode: 'specialist', providerType: 'together',
        error_category: 'endpoint_error' as ErrorCategory,
        message: `Cannot reach Together AI: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── HuggingFace private endpoint — real generation test ──
  if (providerType === 'huggingface') {
    if (!endpoint) {
      return NextResponse.json({
        provider: 'huggingface',
        model: providerModel || 'private-endpoint',
        success: false,
        supported: false,
        status: 'not_configured',
        outputType: 'image',
        mode: 'specialist', providerType: 'huggingface',
        error_category: 'missing_key' as ErrorCategory,
        message: 'HuggingFace private endpoint URL is required for adult generation. For unrestricted adult content, use a private HuggingFace Inference Endpoint (not the public API).',
      })
    }

    const { url: hfUrl, error: hfErr } = validateUrl(endpoint)
    if (hfErr) {
      return NextResponse.json({
        provider: 'huggingface',
        model: providerModel || 'private-endpoint',
        success: false,
        supported: false,
        status: 'invalid',
        outputType: 'image',
        mode: 'specialist', providerType: 'huggingface',
        error_category: 'endpoint_error' as ErrorCategory,
        message: hfErr,
      })
    }

    const testModel = providerModel || hfUrl.href
    const start = Date.now()
    try {
      const hHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) hHeaders['Authorization'] = `Bearer ${apiKey}`
      // Real generation test: send a minimal image generation prompt.
      // Test output is NOT stored — discarded immediately after status check.
      // lgtm[js/request-forgery] — URL validated above; admin-only endpoint
      const res = await fetch(hfUrl.href, {
        method: 'POST',
        headers: hHeaders,
        body: JSON.stringify({ inputs: ADULT_TEST_PROMPT, parameters: { num_inference_steps: 4 } }),
        signal: AbortSignal.timeout(60_000),
      })
      const latencyMs = Date.now() - start
      const bodyBuf = await res.arrayBuffer().catch(() => new ArrayBuffer(0))
      const bodyText = Buffer.from(bodyBuf).toString('utf8', 0, 500)

      if (res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        const imageGenerated = contentType.startsWith('image/') || contentType === 'application/octet-stream'
          ? bodyBuf.byteLength > 0
          : false

        return NextResponse.json({
          provider: 'huggingface',
          model: testModel,
          success: imageGenerated,
          supported: true,
          status: imageGenerated ? 'ready' : 'connected_no_image',
          outputType: 'image',
          mode: 'specialist', providerType: 'huggingface',
          error_category: imageGenerated ? undefined : ('model_not_supported' as ErrorCategory),
          message: imageGenerated
            ? `HuggingFace endpoint generation test passed — image returned (${latencyMs}ms)`
            : `HuggingFace endpoint reachable but returned non-image response (content-type: ${contentType}) — verify model supports image generation`,
          latencyMs,
        })
      }

      const errCat = classifyHttpError(res.status, bodyText)
      return NextResponse.json({
        provider: 'huggingface',
        model: testModel,
        success: false,
        supported: false,
        status: errCat,
        outputType: 'image',
        mode: 'specialist', providerType: 'huggingface',
        error_category: errCat,
        message: `HuggingFace endpoint generation test failed (HTTP ${res.status}, ${latencyMs}ms)`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        provider: 'huggingface',
        model: testModel,
        success: false,
        supported: false,
        status: 'unreachable',
        outputType: 'image',
        mode: 'specialist', providerType: 'huggingface',
        error_category: 'endpoint_error' as ErrorCategory,
        message: `Cannot reach HuggingFace endpoint: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── xAI / Grok Imagine — real generation test ──
  if (providerType === 'xai') {
    if (!apiKey) {
      return NextResponse.json({
        provider: 'xai',
        model: providerModel || 'grok-2-image',
        success: false,
        supported: false,
        status: 'not_configured',
        outputType: 'image',
        mode: 'specialist', providerType: 'xai',
        error_category: 'missing_key' as ErrorCategory,
        message: 'xAI API key is required. Enter it here or save it via Admin → AI Providers → xAI / Grok.',
      })
    }

    const testModel = providerModel || 'grok-2-image'
    const start = Date.now()
    try {
      // Real generation test with a safe test prompt.
      // Test output is NOT stored — discarded immediately after status check.
      // lgtm[js/request-forgery] — hardcoded xAI URL; admin-only endpoint
      const res = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: testModel, prompt: ADULT_TEST_PROMPT, n: 1 }),
        signal: AbortSignal.timeout(30_000),
      })
      const latencyMs = Date.now() - start
      const bodyText = await res.text().catch(() => '')

      if (res.ok) {
        let imageGenerated = false
        try {
          const parsed = JSON.parse(bodyText) as { data?: Array<{ url?: string; b64_json?: string }> }
          imageGenerated = !!(parsed.data?.[0]?.url || parsed.data?.[0]?.b64_json)
        } catch { /* non-JSON ok response */ }

        return NextResponse.json({
          provider: 'xai',
          model: testModel,
          success: imageGenerated,
          supported: true,
          status: imageGenerated ? 'ready' : 'connected_no_output',
          outputType: 'image',
          mode: 'specialist', providerType: 'xai',
          error_category: imageGenerated ? undefined : ('model_not_supported' as ErrorCategory),
          message: imageGenerated
            ? `xAI/Grok generation test passed — image returned (${latencyMs}ms)`
            : `xAI/Grok connected but no image data returned (${latencyMs}ms)`,
          latencyMs,
        })
      }

      const errCat = classifyHttpError(res.status, bodyText)
      let errMsg = `xAI/Grok generation test failed (HTTP ${res.status}, ${latencyMs}ms)`
      if (errCat === 'missing_key') errMsg += ' — authentication failed, check API key'
      else if (errCat === 'provider_policy_block') errMsg += ' — xAI safety policy blocked the test prompt; adult access may not be enabled for this key'
      else if (errCat === 'model_not_supported') errMsg += ` — model "${testModel}" may not be available for this key`

      return NextResponse.json({
        provider: 'xai',
        model: testModel,
        success: false,
        supported: false,
        status: errCat,
        outputType: 'image',
        mode: 'specialist', providerType: 'xai',
        error_category: errCat,
        message: errMsg,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        provider: 'xai',
        model: testModel,
        success: false,
        supported: false,
        status: 'unreachable',
        outputType: 'image',
        mode: 'specialist', providerType: 'xai',
        error_category: 'endpoint_error' as ErrorCategory,
        message: `Cannot reach xAI API: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  // ── Custom (OpenAI-compatible) — real generation test ──
  if (providerType === 'custom') {
    if (!endpoint) {
      return NextResponse.json({
        provider: 'custom',
        model: providerModel || 'custom',
        success: false,
        supported: false,
        status: 'not_configured',
        outputType: 'image',
        mode: 'specialist', providerType: 'custom',
        error_category: 'missing_key' as ErrorCategory,
        message: 'Custom provider endpoint URL is required.',
      })
    }

    const { url: customUrl, error: customErr } = validateUrl(endpoint)
    if (customErr) {
      return NextResponse.json({
        provider: 'custom',
        model: providerModel || 'custom',
        success: false,
        supported: false,
        status: 'invalid',
        outputType: 'image',
        mode: 'specialist', providerType: 'custom',
        error_category: 'endpoint_error' as ErrorCategory,
        message: customErr,
      })
    }

    const testModel = providerModel || 'default'
    const start = Date.now()
    try {
      const cHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) cHeaders['Authorization'] = `Bearer ${apiKey}`
      // Real generation test.
      // Test output is NOT stored — discarded immediately after status check.
      // lgtm[js/request-forgery] — URL validated above; admin-only endpoint
      const res = await fetch(customUrl.href, {
        method: 'POST',
        headers: cHeaders,
        body: JSON.stringify({ prompt: ADULT_TEST_PROMPT, model: testModel, n: 1 }),
        signal: AbortSignal.timeout(30_000),
      })
      const latencyMs = Date.now() - start
      const bodyText = await res.text().catch(() => '')

      if (res.ok) {
        return NextResponse.json({
          provider: 'custom',
          model: testModel,
          success: true,
          supported: true,
          status: 'ready',
          outputType: 'image',
          mode: 'specialist', providerType: 'custom',
          message: `Custom endpoint generation test passed (HTTP 200, ${latencyMs}ms)`,
          latencyMs,
        })
      }

      const errCat = classifyHttpError(res.status, bodyText)
      return NextResponse.json({
        provider: 'custom',
        model: testModel,
        success: false,
        supported: errCat !== 'missing_key' && errCat !== 'endpoint_error',
        status: errCat,
        outputType: 'image',
        mode: 'specialist', providerType: 'custom',
        error_category: errCat,
        message: `Custom endpoint generation test failed (HTTP ${res.status}, ${latencyMs}ms)`,
        latencyMs,
      })
    } catch (err) {
      return NextResponse.json({
        provider: 'custom',
        model: testModel,
        success: false,
        supported: false,
        status: 'unreachable',
        outputType: 'image',
        mode: 'specialist', providerType: 'custom',
        error_category: 'endpoint_error' as ErrorCategory,
        message: `Cannot reach custom endpoint: ${err instanceof Error ? err.message : 'network error'}`,
        latencyMs: Date.now() - start,
      })
    }
  }

  return NextResponse.json({
    provider: null,
    model: null,
    success: false,
    supported: false,
    status: 'unknown_provider',
    outputType: 'image',
    mode: 'specialist',
    error_category: 'unknown' as ErrorCategory,
    message: `Unknown provider type: ${providerType}. Supported: xai, together, huggingface, custom`,
  })
}
