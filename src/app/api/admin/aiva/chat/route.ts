/**
 * POST /api/admin/aiva/chat
 *
 * Persisted Aiva conversation endpoint. Requires an active admin session.
 * Auto-detects capability from message text when not explicitly provided,
 * calls executeCapability() server-side, and saves both user + assistant
 * messages to the DB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { executeCapability } from '@/lib/capability-router'
import { prisma } from '@/lib/prisma'

// ── Capability Detection ───────────────────────────────────────────────────────

function detectCapabilityFromMessage(text: string): string {
  const t = text.toLowerCase()

  if (/create image|generate image|\bdraw\b/.test(t)) return 'image_generation'
  if (/edit image|image edit/.test(t)) return 'image_edit'
  if (/create video|generate video|make video/.test(t)) return 'video_generation'
  if (/create music|generate music|\bcompose\b/.test(t)) return 'music_generation'
  if (/text to speech|speak this|say this|\btts\b/.test(t)) return 'tts'
  if (/transcribe|speech to text|\bstt\b/.test(t)) return 'stt'
  if (/\bscrape\b|crawl website|fetch website/.test(t)) return 'scrape_website'
  if (/write code|create code|fix code|\bdebug\b/.test(t)) return 'code'
  if (/deploy plan|deployment plan/.test(t)) return 'deploy_plan'
  if (/analyze file|file analysis/.test(t)) return 'file_analysis'

  return 'chat'
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      message,
      conversationId: existingConvId,
      capability: explicitCapability,
      providerOverride,
      modelOverride,
      saveArtifact,
      files,
    } = body as {
      message: string
      conversationId?: string
      capability?: string
      providerOverride?: string
      modelOverride?: string
      saveArtifact?: boolean
      files?: string[]
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    const capability = explicitCapability || detectCapabilityFromMessage(message)

    // ── Resolve or create conversation ───────────────────────────────────────
    let conversationId = existingConvId
    try {
      if (conversationId) {
        // Verify it exists
        const existing = await prisma.aivaConversation.findUnique({ where: { id: conversationId } })
        if (!existing) conversationId = undefined
      }
      if (!conversationId) {
        const conv = await prisma.aivaConversation.create({
          data: { title: message.slice(0, 60) || 'New Conversation' },
        })
        conversationId = conv.id
      }
    } catch {
      // DB table may not exist yet — continue without persistence
      conversationId = existingConvId ?? `ephemeral-${Date.now()}`
    }

    // ── Save user message ─────────────────────────────────────────────────────
    let userMsgId: string | undefined
    try {
      if (!conversationId) throw new Error('No conversationId')
      const userMsg = await prisma.aivaMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: message,
          capability,
        },
      })
      userMsgId = userMsg.id
    } catch {
      // Graceful degradation — table may not exist yet
    }

    // ── Execute capability ────────────────────────────────────────────────────
    const result = await executeCapability({
      input: message,
      capability,
      files,
      providerOverride,
      modelOverride,
      saveArtifact,
      traceId: `aiva-chat-${Date.now()}`,
    })

    // ── Save assistant message ────────────────────────────────────────────────
    let assistantMsgId: string | undefined
    try {
      if (!conversationId) throw new Error('No conversationId')
      const assistantMsg = await prisma.aivaMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: typeof result.output === 'string' ? result.output : JSON.stringify(result.output),
          capability: result.capability ?? capability,
          provider: result.provider ?? '',
          model: result.model ?? '',
          outputType: result.outputType ?? 'text',
          artifactId: result.artifactId ?? null,
          fallbackUsed: result.fallbackUsed ?? false,
          warning: result.warning ?? null,
          errorMessage: result.success ? null : (result.error ?? null),
        },
      })
      assistantMsgId = assistantMsg.id
    } catch {
      // Graceful degradation
    }

    return NextResponse.json({
      conversationId,
      userMessageId: userMsgId,
      messageId: assistantMsgId,
      output: result.output,
      capability: result.capability ?? capability,
      provider: result.provider,
      model: result.model,
      outputType: result.outputType,
      artifactId: result.artifactId,
      fallbackUsed: result.fallbackUsed,
      warning: result.warning,
      error: result.success ? undefined : result.error,
      success: result.success,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
