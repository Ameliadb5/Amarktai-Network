/**
 * Admin API — Emotional Intelligence Dashboard Data (v2)
 *
 * GET  /api/admin/emotions         — Dashboard summary + transitions
 * POST /api/admin/emotions         — Admin actions (get_profile, get_drift, get_transitions, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getEmotionDashboardSummary,
  getEmotionalProfile,
  getEmotionalDrift,
  getEmotionHistory,
  getLearningState,
  getConversationContext,
  getTopTransitions,
  recordLearningSignal,
  type LearningSignal,
  type PersonalityType,
} from '@/lib/emotion-engine'

export async function GET() {
  try {
    const summary = getEmotionDashboardSummary()
    const transitions = getTopTransitions(10)
    return NextResponse.json({ success: true, ...summary, transitions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get emotion dashboard'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    switch (action) {
      case 'get_profile': {
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        const profile = getEmotionalProfile(userId)
        return NextResponse.json({ success: true, profile })
      }

      case 'get_drift': {
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        const drift = getEmotionalDrift(userId)
        return NextResponse.json({ success: true, drift })
      }

      case 'get_history': {
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        const limit = body.limit || 20
        const history = getEmotionHistory(userId, limit)
        return NextResponse.json({ success: true, history })
      }

      case 'get_learning': {
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        const learning = getLearningState(userId)
        return NextResponse.json({ success: true, learning })
      }

      case 'get_context': {
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
        const context = getConversationContext(userId)
        return NextResponse.json({ success: true, context })
      }

      case 'get_transitions': {
        const fromEmotion = body.fromEmotion
        const transitions = getTopTransitions(body.limit || 20)
        const filtered = fromEmotion
          ? transitions.filter(t => t.from === fromEmotion)
          : transitions
        return NextResponse.json({ success: true, transitions: filtered })
      }

      case 'record_signal': {
        const signal: LearningSignal = {
          userId: body.userId,
          responseId: body.responseId || `sig_${Date.now()}`,
          signalType: body.signalType || 'neutral',
          emotionAtTime: body.emotionAtTime || 'neutral',
          personalityUsed: (body.personalityUsed as PersonalityType) || 'professional',
          engagementScore: body.engagementScore ?? 0.5,
        }
        recordLearningSignal(signal)
        return NextResponse.json({ success: true, recorded: true })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: get_profile, get_drift, get_history, get_learning, get_context, get_transitions, record_signal` },
          { status: 400 },
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin emotion action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
