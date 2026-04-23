import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getVaultApiKey } from '@/lib/brain'

/**
 * POST /api/admin/ai-partner/chat
 *
 * A lightweight multi-turn chat endpoint purpose-built for the AI Partner
 * widget. Unlike /api/admin/brain/test, this route accepts a structured
 * messages array (with conversation history) and a separate systemPrompt
 * so the system instructions are delivered as a proper role:"system" message
 * rather than being crammed into the user turn.
 *
 * Provider resolution order (first configured wins):
 *   1. Groq   — fast, low-latency, cheap
 *   2. OpenAI — high quality
 *   3. Gemini — free tier available
 *   4. Together AI
 *   5. Qwen / DashScope
 *   6. DeepSeek
 *   7. Mistral
 *
 * Request body:
 *   {
 *     messages:     Array<{ role: 'user' | 'assistant'; content: string }>
 *     systemPrompt: string  (injected as role:"system" turn 0)
 *     provider?:    string  (optional override — must be a configured key)
 *   }
 *
 * Response:
 *   { reply: string; provider: string; model: string }
 *   or { error: string; code: string } on failure
 */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages?: unknown
  systemPrompt?: unknown
  provider?: unknown
}

// Ordered list of chat-capable providers to try when provider='auto'
const CHAT_PROVIDER_PRIORITY = [
  { key: 'groq',      baseUrl: 'https://api.groq.com/openai', defaultModel: 'llama-3.3-70b-versatile' },
  { key: 'openai',    baseUrl: 'https://api.openai.com',      defaultModel: 'gpt-4o-mini' },
  { key: 'gemini',    baseUrl: null,                          defaultModel: 'gemini-2.0-flash' },
  { key: 'together',  baseUrl: 'https://api.together.xyz',    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { key: 'qwen',      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode', defaultModel: 'qwen-plus' },
  { key: 'deepseek',  baseUrl: 'https://api.deepseek.com',    defaultModel: 'deepseek-chat' },
  { key: 'mistral',   baseUrl: 'https://api.mistral.ai',      defaultModel: 'mistral-small-latest' },
] as const

type ProviderKey = typeof CHAT_PROVIDER_PRIORITY[number]['key']

async function callChatProvider(
  providerKey: ProviderKey,
  apiKey: string,
  baseUrl: string | null,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<string | null> {
  if (providerKey === 'gemini') {
    // Gemini uses a different API shape
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    // Map conversation history to Gemini contents format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    const body: Record<string, unknown> = { contents }
    if (systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] }
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
  }

  // OpenAI-compatible providers (Groq, OpenAI, Together, Qwen, DeepSeek, Mistral)
  const base = baseUrl ?? 'https://api.openai.com'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  const openAiMessages: Array<{ role: string; content: string }> = [
    ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: openAiMessages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) return null
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data?.choices?.[0]?.message?.content ?? null
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'invalid_json' }, { status: 400 })
  }

  // Validate messages
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required', code: 'invalid_messages' }, { status: 400 })
  }
  const messages = (body.messages as ChatMessage[]).filter(
    m => m && typeof m.role === 'string' && typeof m.content === 'string' &&
         (m.role === 'user' || m.role === 'assistant') && m.content.trim()
  )
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No valid messages in array', code: 'empty_messages' }, { status: 400 })
  }

  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : ''
  const requestedProvider = typeof body.provider === 'string' ? body.provider : 'auto'

  // If a specific provider is requested, try only that one
  if (requestedProvider !== 'auto') {
    const providerDef = CHAT_PROVIDER_PRIORITY.find(p => p.key === requestedProvider)
    if (!providerDef) {
      return NextResponse.json(
        { error: `Unknown provider: "${requestedProvider}"`, code: 'unknown_provider' },
        { status: 400 },
      )
    }
    const key = await getVaultApiKey(requestedProvider as ProviderKey)
    if (!key) {
      return NextResponse.json(
        {
          error: `Provider "${requestedProvider}" is not configured. Add an API key via Admin → AI Providers.`,
          code: 'provider_not_configured',
        },
        { status: 503 },
      )
    }
    const reply = await callChatProvider(
      requestedProvider as ProviderKey,
      key,
      providerDef.baseUrl,
      providerDef.defaultModel,
      systemPrompt,
      messages,
    ).catch(() => null)
    if (!reply) {
      return NextResponse.json(
        { error: `Provider "${requestedProvider}" call failed.`, code: 'provider_error' },
        { status: 502 },
      )
    }
    return NextResponse.json({ reply, provider: requestedProvider, model: providerDef.defaultModel })
  }

  // Auto-select: try each provider in priority order until one succeeds
  const errors: string[] = []
  for (const providerDef of CHAT_PROVIDER_PRIORITY) {
    const key = await getVaultApiKey(providerDef.key)
    if (!key) continue // not configured — skip silently

    try {
      const reply = await callChatProvider(
        providerDef.key,
        key,
        providerDef.baseUrl,
        providerDef.defaultModel,
        systemPrompt,
        messages,
      )
      if (reply) {
        return NextResponse.json({ reply, provider: providerDef.key, model: providerDef.defaultModel })
      }
      errors.push(`${providerDef.key}: call succeeded but returned empty reply`)
    } catch (err) {
      errors.push(`${providerDef.key}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }

  // No provider available
  return NextResponse.json(
    {
      error:
        'No chat provider is configured. ' +
        'Add at least one API key via Admin → AI Providers (Groq recommended for fast, low-cost chat).',
      code: 'no_provider_configured',
      providers_tried: errors,
    },
    { status: 503 },
  )
}
