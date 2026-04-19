import { NextRequest, NextResponse } from 'next/server'
import { POST as handleAdminBrainTest } from '@/app/api/admin/brain/test/route'

interface ComparisonResult {
  provider: string
  model: string
  output: string
  latencyMs: number
  success: boolean
  error: string | null
  tokensUsed: number | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, models, capability, appSlug } = body

    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    }

    const modelsToCompare = models || []
    if (modelsToCompare.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 models required for comparison' },
        { status: 400 },
      )
    }

    const results: ComparisonResult[] = []
    const compareId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const promises = modelsToCompare.map(async (m: { provider: string; model: string }) => {
      const start = Date.now()
      try {
        const internalReq = new NextRequest(new URL('/api/admin/brain/test', req.url).toString(), {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify({
            message: prompt,
            taskType: capability || 'chat',
            providerKey: m.provider,
            modelId: m.model,
            appSlug: appSlug || '__admin_test__',
          }),
        })
        const response = await handleAdminBrainTest(internalReq)
        const data = await response.json()
        const latencyMs = Date.now() - start

        results.push({
          provider: m.provider,
          model: m.model,
          output: data.output || data.error || 'No output',
          latencyMs,
          success: data.success !== false,
          error: data.error || null,
          tokensUsed: data.tokensUsed || null,
        })
      } catch (err) {
        results.push({
          provider: m.provider,
          model: m.model,
          output: '',
          latencyMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : 'Comparison request failed',
          tokensUsed: null,
        })
      }
    })

    await Promise.all(promises)

    results.sort((a, b) => a.latencyMs - b.latencyMs)

    return NextResponse.json({
      success: true,
      compareId,
      prompt,
      results,
      summary: {
        totalModels: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        fastestModel: results[0]?.model || null,
        avgLatencyMs: Math.round(
          results.reduce((s, r) => s + r.latencyMs, 0) / results.length,
        ),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Comparison failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
