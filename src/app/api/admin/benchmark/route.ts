import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { callProvider } from '@/lib/brain'
import { getModelRegistry } from '@/lib/model-registry'

const benchmarkSchema = z.object({
  message: z.string().min(1).max(4000),
  taskType: z.string().default('chat'),
  providerKeys: z.array(z.string()).min(1).max(10),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof benchmarkSchema>
  try {
    body = benchmarkSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request' }, { status: 422 })
  }

  const allModels = getModelRegistry()

  // Run all providers in parallel
  const results = await Promise.allSettled(
    body.providerKeys.map(async (providerKey) => {
      const start = Date.now()
      try {
        const model = allModels.find(m => m.provider === providerKey)
        // Pass empty string for model so callProvider resolves it from the vault's defaultModel
        const result = await callProvider(providerKey, '', body.message)
        return {
          providerKey,
          model: result.model ?? model?.model_name ?? providerKey,
          output: result.output,
          success: result.ok,
          error: result.error ?? null,
          latencyMs: Date.now() - start,
        }
      } catch (e) {
        return {
          providerKey,
          model: providerKey,
          output: null,
          success: false,
          error: e instanceof Error ? e.message : 'Failed',
          latencyMs: Date.now() - start,
        }
      }
    })
  )

  const benchmarkResults = results.map((r, i) => r.status === 'fulfilled' ? r.value : {
    providerKey: body.providerKeys[i] ?? 'unknown',
    model: body.providerKeys[i] ?? 'unknown',
    output: null,
    success: false,
    error: 'Request failed',
    latencyMs: 0,
  })

  return NextResponse.json({ results: benchmarkResults })
}
