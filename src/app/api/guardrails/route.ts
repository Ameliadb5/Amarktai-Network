import { NextRequest, NextResponse } from 'next/server'
import {
  runGuardrails,
  detectPII,
  redactPII,
  type GuardrailPolicy,
  GUARDRAIL_CATEGORIES,
} from '@/lib/guardrails'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, policy } = body

    if (!text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    const result = runGuardrails(text, policy as GuardrailPolicy | undefined)

    return NextResponse.json({
      success: true,
      passed: result.passed,
      checks: result.checks,
      blockedCategories: result.blockedCategories,
      redactedOutput: result.redactedOutput,
      metadata: result.metadata,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Guardrails validation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      categories: GUARDRAIL_CATEGORIES,
      utilities: {
        detectPII: 'POST with { text } to detect PII patterns',
        redactPII: 'POST with { text } to redact PII from text',
        runGuardrails: 'POST with { text, policy? } to run full guardrails',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get guardrails info'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
