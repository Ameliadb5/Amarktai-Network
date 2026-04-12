/**
 * Admin API — App Agents
 *
 * GET  /api/admin/app-agents        → List all app agents
 * POST /api/admin/app-agents        → Create a new app agent
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createAppAgent, listAppAgents, syncAdminNotesToRules } from '@/lib/app-agent'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const agents = await listAppAgents()
    return NextResponse.json({ agents })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to list agents' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as {
      appSlug: string
      appName: string
      appUrl?: string
      appType?: string
      purpose?: string
      adminNotes?: string
      tone?: string
      responseLength?: string
      creativity?: string
      budgetMode?: string
      allowedCapabilities?: string[]
      adultMode?: boolean
      sensitiveTopicMode?: string
      mustHandoffSeriousTopics?: boolean
      mustShowSourceForQuotes?: boolean
      mustUseTrustedSources?: boolean
      religiousMode?: string
      religiousBranch?: string
      learningEnabled?: boolean
      [key: string]: unknown
    }

    if (!body.appSlug || !body.appName) {
      return NextResponse.json({ error: 'appSlug and appName are required' }, { status: 422 })
    }

    const agent = await createAppAgent({
      appSlug: body.appSlug,
      appName: body.appName,
      appUrl: body.appUrl,
      appType: body.appType,
      purpose: body.purpose,
    })

    // Apply additional configuration fields via update
    const updateData: Record<string, unknown> = {}
    if (body.tone) updateData.tone = body.tone
    if (body.responseLength) updateData.responseLength = body.responseLength
    if (body.creativity) updateData.creativity = body.creativity
    if (body.budgetMode) updateData.budgetMode = body.budgetMode
    if (body.allowedCapabilities) updateData.allowedCapabilities = JSON.stringify(body.allowedCapabilities)
    if (body.adultMode !== undefined) updateData.adultMode = body.adultMode
    if (body.sensitiveTopicMode) updateData.sensitiveTopicMode = body.sensitiveTopicMode
    if (body.mustHandoffSeriousTopics !== undefined) updateData.mustHandoffSeriousTopics = body.mustHandoffSeriousTopics
    if (body.mustShowSourceForQuotes !== undefined) updateData.mustShowSourceForQuotes = body.mustShowSourceForQuotes
    if (body.mustUseTrustedSources !== undefined) updateData.mustUseTrustedSources = body.mustUseTrustedSources
    if (body.religiousMode) updateData.religiousMode = body.religiousMode
    if (body.religiousBranch) updateData.religiousBranch = body.religiousBranch
    if (body.learningEnabled !== undefined) updateData.learningEnabled = body.learningEnabled

    if (Object.keys(updateData).length > 0) {
      await prisma.appAgent.update({ where: { appSlug: body.appSlug }, data: updateData })
    }

    // If admin notes provided, parse them into structured rules
    if (body.adminNotes) {
      await syncAdminNotesToRules(agent.appSlug, body.adminNotes)
    }

    return NextResponse.json({ agent }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agent'
    const isDuplicate = message.includes('Unique constraint')
    return NextResponse.json(
      { error: isDuplicate ? 'An agent already exists for this app' : message },
      { status: isDuplicate ? 409 : 500 },
    )
  }
}
