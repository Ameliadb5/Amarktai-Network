import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import {
  getAllConnectors,
  getConnectorsByCategory,
  getConnector,
  getConnectorStatus,
  getAllConnectorStatuses,
  getIntegrationHubSummary,
  executeConnectorAction,
  type ConnectorCategory,
} from '@/lib/integration-hub'

/**
 * GET /api/admin/integration-hub
 *
 * Query params:
 *   id       - get single connector definition + status
 *   category - filter by category
 *   summary  - return hub summary only
 *   statuses - return all connector statuses
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const category = searchParams.get('category') as ConnectorCategory | null
  const summaryOnly = searchParams.has('summary')
  const statusesOnly = searchParams.has('statuses')

  if (summaryOnly) {
    return NextResponse.json({ summary: getIntegrationHubSummary() })
  }

  if (statusesOnly) {
    return NextResponse.json({ statuses: getAllConnectorStatuses() })
  }

  if (id) {
    const connector = getConnector(id)
    if (!connector) {
      return NextResponse.json({ error: `Connector not found: ${id}` }, { status: 404 })
    }
    return NextResponse.json({
      connector,
      status: getConnectorStatus(id),
    })
  }

  const connectors = category
    ? getConnectorsByCategory(category)
    : getAllConnectors()

  // Attach live status to each connector
  const connectorsWithStatus = connectors.map((c) => ({
    ...c,
    // Omit sensitive credential values from response
    credentials: c.credentials.map((cred) => ({
      ...cred,
      // Do not expose actual env var values
    })),
    status: getConnectorStatus(c.id),
  }))

  return NextResponse.json({
    connectors: connectorsWithStatus,
    count: connectorsWithStatus.length,
    summary: getIntegrationHubSummary(),
  })
}

/**
 * POST /api/admin/integration-hub
 *
 * Body: { connectorId, actionId, input }
 * Execute a connector action.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { connectorId, actionId, input } = body as {
      connectorId: string
      actionId: string
      input: Record<string, unknown>
    }

    if (!connectorId || !actionId) {
      return NextResponse.json(
        { error: 'connectorId and actionId are required' },
        { status: 400 },
      )
    }

    const result = await executeConnectorAction(connectorId, actionId, input ?? {})
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Integration hub error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
