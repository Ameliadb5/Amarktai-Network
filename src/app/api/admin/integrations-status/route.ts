/**
 * Admin API — Integrations Status
 *
 * GET /api/admin/integrations-status → Status of all external integrations
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getFirecrawlStatus } from '@/lib/firecrawl'
import { getMem0Status } from '@/lib/mem0-client'
import { getGraphitiStatus } from '@/lib/graphiti-client'
import { getLiteLLMStatus } from '@/lib/litellm-client'
import { getPostHogStatus } from '@/lib/posthog-client'
import { getLangGraphStatus } from '@/lib/langgraph-client'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const qdrantUrl = process.env.QDRANT_URL || ''
  const redisUrl = process.env.REDIS_URL || ''

  return NextResponse.json({
    integrations: {
      firecrawl: getFirecrawlStatus(),
      qdrant: {
        available: !!qdrantUrl,
        url: qdrantUrl || null,
        error: qdrantUrl ? null : 'QDRANT_URL not configured',
      },
      mem0: getMem0Status(),
      graphiti: getGraphitiStatus(),
      litellm: getLiteLLMStatus(),
      posthog: getPostHogStatus(),
      langgraph: getLangGraphStatus(),
      redis: {
        available: !!redisUrl,
        url: redisUrl ? '(configured)' : null,
        error: redisUrl ? null : 'REDIS_URL not configured',
      },
    },
  })
}
