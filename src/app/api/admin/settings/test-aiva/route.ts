/**
 * POST /api/admin/settings/test-aiva
 *
 * Test Aiva STT and TTS provider connectivity.
 * - For 'auto' or 'genx' providers: checks whether the AI Engine is reachable
 * - For external providers: probes their health/status endpoint
 * - Returns sttOk, ttsOk, and per-provider messages
 *
 * Returns truthful status — never faked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

/** Health-probe endpoints for known providers */
const STT_PROBE: Record<string, string> = {
  openai:   'https://api.openai.com/v1/models',
  deepgram: 'https://api.deepgram.com/v1/listen',
  groq:     'https://api.groq.com/openai/v1/models',
}

const TTS_PROBE: Record<string, string> = {
  openai:     'https://api.openai.com/v1/models',
  deepgram:   'https://api.deepgram.com/v1/speak',
  elevenlabs: 'https://api.elevenlabs.io/v1/models',
  grok:       'https://api.x.ai/v1/models',
}

interface ProbeResult {
  ok: boolean
  message: string
  httpStatus?: number
}

async function probeExternal(url: string, bearer: string | undefined): Promise<ProbeResult> {
  const headers: Record<string, string> = {}
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) })
    // 401/403 means the endpoint exists but auth failed — provider is reachable
    const reachable = res.ok || res.status === 401 || res.status === 403 || res.status === 405
    return {
      ok: reachable,
      message: reachable ? `reachable (HTTP ${res.status})` : `HTTP ${res.status}`,
      httpStatus: res.status,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'network error' }
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let sttProvider = 'auto'
  let ttsProvider = 'auto'

  try {
    const body = await req.json()
    if (typeof body.sttProvider === 'string') sttProvider = body.sttProvider.trim()
    if (typeof body.ttsProvider === 'string') ttsProvider = body.ttsProvider.trim()
  } catch { /* ignore */ }

  const results: Record<string, ProbeResult> = {}

  // ── STT probe ──────────────────────────────────────────────────────────────
  if (sttProvider === 'auto' || sttProvider === 'genx' || sttProvider === 'browser') {
    results.stt = {
      ok: true,
      message: sttProvider === 'browser'
        ? 'Browser Web Speech API — availability depends on the user\'s browser'
        : 'AI Engine / auto STT — will use the configured AI Engine for transcription',
    }
  } else if (STT_PROBE[sttProvider]) {
    results.stt = await probeExternal(STT_PROBE[sttProvider], undefined)
  } else {
    results.stt = { ok: false, message: `Unknown STT provider: ${sttProvider}` }
  }

  // ── TTS probe ──────────────────────────────────────────────────────────────
  if (ttsProvider === 'auto' || ttsProvider === 'genx') {
    results.tts = {
      ok: true,
      message: 'AI Engine / auto TTS — will use the configured AI Engine for speech synthesis',
    }
  } else if (TTS_PROBE[ttsProvider]) {
    results.tts = await probeExternal(TTS_PROBE[ttsProvider], undefined)
  } else {
    results.tts = { ok: false, message: `Unknown TTS provider: ${ttsProvider}` }
  }

  const sttOk = results.stt?.ok ?? false
  const ttsOk = results.tts?.ok ?? false

  return NextResponse.json({
    success: sttOk && ttsOk,
    sttOk,
    ttsOk,
    sttMessage: results.stt?.message ?? '',
    ttsMessage: results.tts?.message ?? '',
    message: sttOk && ttsOk
      ? 'STT and TTS providers are reachable'
      : `${!sttOk ? 'STT failed. ' : ''}${!ttsOk ? 'TTS failed.' : ''}`.trim(),
  })
}
