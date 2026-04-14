/**
 * @module integration-hub
 * @description Integration Hub — Connector abstractions for external services.
 *
 * Provides a unified, extensible registry of integration connectors that
 * AmarktAI workflows and agents can use to interact with external services.
 *
 * Architecture:
 *   - Each connector declares its capabilities, required credentials, and
 *     a set of named actions.
 *   - Connectors are registered in the HUB_REGISTRY.
 *   - At runtime, a connector action is resolved via executeConnectorAction().
 *   - Connectors without configured credentials return a NOT_CONFIGURED error
 *     rather than silently failing.
 *
 * Categories:
 *   - Email (Gmail, Outlook, Fastmail)
 *   - Calendar (Google Calendar, Outlook Calendar)
 *   - Tasks / Todo (Todoist, Notion, Asana)
 *   - Messaging (Slack, Telegram, Discord, WhatsApp)
 *   - Documents (Notion, Google Docs, Obsidian)
 *   - Developer (GitHub, Jira, Linear)
 *   - Automation (Zapier, Make, n8n webhooks)
 *   - Storage (Google Drive, Dropbox, S3)
 *
 * Server-side only.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorCategory =
  | 'email'
  | 'calendar'
  | 'tasks'
  | 'messaging'
  | 'documents'
  | 'developer'
  | 'automation'
  | 'storage'
  | 'crm'
  | 'analytics'

export type ConnectorStatus =
  | 'configured'
  | 'not_configured'
  | 'degraded'
  | 'error'

export interface ConnectorCredential {
  key: string
  label: string
  type: 'api_key' | 'oauth_token' | 'webhook_url' | 'connection_string' | 'basic_auth'
  required: boolean
  envVar: string
  description: string
}

export interface ConnectorAction {
  id: string
  name: string
  description: string
  inputSchema: Record<string, { type: string; required: boolean; description: string }>
  outputSchema: Record<string, { type: string; description: string }>
}

export interface ConnectorDefinition {
  id: string
  name: string
  description: string
  category: ConnectorCategory
  logoUrl?: string
  docsUrl?: string
  credentials: ConnectorCredential[]
  actions: ConnectorAction[]
  /** Whether this connector can receive webhooks from the external service */
  supportsWebhooks: boolean
  /** Whether this connector is launch-ready (has real implementation) */
  implementationState: 'implemented' | 'template' | 'stub'
}

export interface ConnectorActionResult {
  success: boolean
  data?: unknown
  error?: string
  connector: string
  action: string
  latencyMs: number
}

// ── Connector Registry ────────────────────────────────────────────────────────

const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  // ── EMAIL ─────────────────────────────────────────────────────────────────

  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read, send, and organize Gmail messages. Supports email triage, auto-replies, and label management.',
    category: 'email',
    docsUrl: 'https://developers.google.com/gmail/api',
    credentials: [
      {
        key: 'GMAIL_OAUTH_TOKEN',
        label: 'OAuth Token',
        type: 'oauth_token',
        required: true,
        envVar: 'GMAIL_OAUTH_TOKEN',
        description: 'OAuth2 access token from Google Cloud Console',
      },
      {
        key: 'GMAIL_REFRESH_TOKEN',
        label: 'Refresh Token',
        type: 'oauth_token',
        required: true,
        envVar: 'GMAIL_REFRESH_TOKEN',
        description: 'OAuth2 refresh token for token renewal',
      },
    ],
    actions: [
      {
        id: 'list_inbox',
        name: 'List Inbox',
        description: 'Fetch recent inbox messages',
        inputSchema: { maxResults: { type: 'number', required: false, description: 'Max messages to return (default: 10)' }, unreadOnly: { type: 'boolean', required: false, description: 'Return only unread messages' } },
        outputSchema: { messages: { type: 'array', description: 'Array of email message summaries' } },
      },
      {
        id: 'send_email',
        name: 'Send Email',
        description: 'Send an email from the configured account',
        inputSchema: { to: { type: 'string', required: true, description: 'Recipient email address' }, subject: { type: 'string', required: true, description: 'Email subject' }, body: { type: 'string', required: true, description: 'Email body (HTML or plain text)' }, cc: { type: 'string', required: false, description: 'CC recipients' } },
        outputSchema: { messageId: { type: 'string', description: 'Sent message ID' } },
      },
      {
        id: 'search_emails',
        name: 'Search Emails',
        description: 'Search emails using Gmail query syntax',
        inputSchema: { query: { type: 'string', required: true, description: 'Gmail search query (e.g. "from:boss@company.com is:unread")' }, maxResults: { type: 'number', required: false, description: 'Max results (default: 20)' } },
        outputSchema: { messages: { type: 'array', description: 'Matching messages' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'template',
  },

  {
    id: 'fastmail',
    name: 'Fastmail',
    description: 'Access Fastmail via JMAP API. Read, send, and manage email and contacts.',
    category: 'email',
    docsUrl: 'https://jmap.io/spec-mail.html',
    credentials: [
      {
        key: 'FASTMAIL_API_TOKEN',
        label: 'API Token',
        type: 'api_key',
        required: true,
        envVar: 'FASTMAIL_API_TOKEN',
        description: 'Fastmail API token from Settings → Security → API tokens',
      },
    ],
    actions: [
      { id: 'list_inbox', name: 'List Inbox', description: 'Fetch inbox messages via JMAP', inputSchema: { limit: { type: 'number', required: false, description: 'Max messages' } }, outputSchema: { messages: { type: 'array', description: 'Email messages' } } },
      { id: 'send_email', name: 'Send Email', description: 'Send email via JMAP', inputSchema: { to: { type: 'string', required: true, description: 'Recipient' }, subject: { type: 'string', required: true, description: 'Subject' }, body: { type: 'string', required: true, description: 'Body' } }, outputSchema: { messageId: { type: 'string', description: 'Message ID' } } },
    ],
    supportsWebhooks: false,
    implementationState: 'stub',
  },

  // ── CALENDAR ─────────────────────────────────────────────────────────────

  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Read and create calendar events. Supports smart scheduling, availability checks, and meeting summaries.',
    category: 'calendar',
    docsUrl: 'https://developers.google.com/calendar/api',
    credentials: [
      {
        key: 'GOOGLE_CALENDAR_TOKEN',
        label: 'OAuth Token',
        type: 'oauth_token',
        required: true,
        envVar: 'GOOGLE_CALENDAR_TOKEN',
        description: 'OAuth2 access token with calendar.events scope',
      },
    ],
    actions: [
      {
        id: 'list_events',
        name: 'List Events',
        description: 'Get upcoming calendar events',
        inputSchema: { timeMin: { type: 'string', required: false, description: 'ISO 8601 start time' }, timeMax: { type: 'string', required: false, description: 'ISO 8601 end time' }, maxResults: { type: 'number', required: false, description: 'Max events (default: 10)' } },
        outputSchema: { events: { type: 'array', description: 'Calendar events' } },
      },
      {
        id: 'create_event',
        name: 'Create Event',
        description: 'Create a new calendar event',
        inputSchema: { title: { type: 'string', required: true, description: 'Event title' }, start: { type: 'string', required: true, description: 'ISO 8601 start time' }, end: { type: 'string', required: true, description: 'ISO 8601 end time' }, description: { type: 'string', required: false, description: 'Event description' }, attendees: { type: 'array', required: false, description: 'List of attendee emails' } },
        outputSchema: { eventId: { type: 'string', description: 'Created event ID' } },
      },
      {
        id: 'check_availability',
        name: 'Check Availability',
        description: 'Check free/busy status for a time range',
        inputSchema: { timeMin: { type: 'string', required: true, description: 'Start of range' }, timeMax: { type: 'string', required: true, description: 'End of range' } },
        outputSchema: { slots: { type: 'array', description: 'Available time slots' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'template',
  },

  // ── TASKS / TODO ────────────────────────────────────────────────────────

  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and write Notion pages, databases, and blocks. Supports doc creation, task tracking, and knowledge base updates.',
    category: 'documents',
    docsUrl: 'https://developers.notion.com',
    credentials: [
      {
        key: 'NOTION_API_KEY',
        label: 'Integration Token',
        type: 'api_key',
        required: true,
        envVar: 'NOTION_API_KEY',
        description: 'Notion internal integration token from notion.so/my-integrations',
      },
    ],
    actions: [
      {
        id: 'create_page',
        name: 'Create Page',
        description: 'Create a new Notion page in a database or as a standalone doc',
        inputSchema: { parent_id: { type: 'string', required: true, description: 'Parent page or database ID' }, title: { type: 'string', required: true, description: 'Page title' }, content: { type: 'string', required: false, description: 'Page content in markdown' }, properties: { type: 'object', required: false, description: 'Database properties' } },
        outputSchema: { pageId: { type: 'string', description: 'Created page ID' }, url: { type: 'string', description: 'Page URL' } },
      },
      {
        id: 'query_database',
        name: 'Query Database',
        description: 'Query a Notion database with filters and sorts',
        inputSchema: { database_id: { type: 'string', required: true, description: 'Notion database ID' }, filter: { type: 'object', required: false, description: 'Notion filter object' }, sorts: { type: 'array', required: false, description: 'Sort specifications' } },
        outputSchema: { results: { type: 'array', description: 'Database rows' } },
      },
      {
        id: 'append_block',
        name: 'Append to Page',
        description: 'Append content blocks to an existing Notion page',
        inputSchema: { page_id: { type: 'string', required: true, description: 'Page ID' }, content: { type: 'string', required: true, description: 'Content to append (markdown)' } },
        outputSchema: { blockIds: { type: 'array', description: 'Created block IDs' } },
      },
    ],
    supportsWebhooks: false,
    implementationState: 'template',
  },

  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories: create issues, PRs, push code, and read repository data.',
    category: 'developer',
    docsUrl: 'https://docs.github.com/en/rest',
    credentials: [
      {
        key: 'GITHUB_TOKEN',
        label: 'Personal Access Token',
        type: 'api_key',
        required: true,
        envVar: 'GITHUB_TOKEN',
        description: 'GitHub PAT with repo scope from github.com/settings/tokens',
      },
    ],
    actions: [
      {
        id: 'create_issue',
        name: 'Create Issue',
        description: 'Create a GitHub issue',
        inputSchema: { owner: { type: 'string', required: true, description: 'Repo owner' }, repo: { type: 'string', required: true, description: 'Repo name' }, title: { type: 'string', required: true, description: 'Issue title' }, body: { type: 'string', required: false, description: 'Issue body' }, labels: { type: 'array', required: false, description: 'Labels' } },
        outputSchema: { issueNumber: { type: 'number', description: 'Created issue number' }, url: { type: 'string', description: 'Issue URL' } },
      },
      {
        id: 'list_issues',
        name: 'List Issues',
        description: 'List open issues in a repository',
        inputSchema: { owner: { type: 'string', required: true, description: 'Repo owner' }, repo: { type: 'string', required: true, description: 'Repo name' }, state: { type: 'string', required: false, description: 'open|closed|all' }, limit: { type: 'number', required: false, description: 'Max results' } },
        outputSchema: { issues: { type: 'array', description: 'Issue list' } },
      },
      {
        id: 'push_file',
        name: 'Push File',
        description: 'Create or update a file in a repository',
        inputSchema: { owner: { type: 'string', required: true, description: 'Repo owner' }, repo: { type: 'string', required: true, description: 'Repo name' }, path: { type: 'string', required: true, description: 'File path' }, content: { type: 'string', required: true, description: 'File content' }, message: { type: 'string', required: true, description: 'Commit message' }, branch: { type: 'string', required: false, description: 'Branch name (default: main)' } },
        outputSchema: { sha: { type: 'string', description: 'Commit SHA' }, url: { type: 'string', description: 'Commit URL' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'implemented',
  },

  // ── MESSAGING ─────────────────────────────────────────────────────────────

  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and notifications to Slack channels and users. Supports bot messaging and webhook delivery.',
    category: 'messaging',
    docsUrl: 'https://api.slack.com',
    credentials: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot Token',
        type: 'api_key',
        required: true,
        envVar: 'SLACK_BOT_TOKEN',
        description: 'Slack bot OAuth token (xoxb-...) from api.slack.com',
      },
      {
        key: 'SLACK_WEBHOOK_URL',
        label: 'Incoming Webhook URL',
        type: 'webhook_url',
        required: false,
        envVar: 'SLACK_WEBHOOK_URL',
        description: 'Slack incoming webhook URL for simpler message delivery',
      },
    ],
    actions: [
      {
        id: 'send_message',
        name: 'Send Message',
        description: 'Send a message to a Slack channel or DM',
        inputSchema: { channel: { type: 'string', required: true, description: 'Channel ID or user ID' }, text: { type: 'string', required: true, description: 'Message text (supports mrkdwn)' }, blocks: { type: 'array', required: false, description: 'Block Kit blocks for rich formatting' } },
        outputSchema: { ts: { type: 'string', description: 'Message timestamp (unique ID)' } },
      },
      {
        id: 'send_webhook',
        name: 'Send Webhook Message',
        description: 'Send a simple message via incoming webhook (no token required)',
        inputSchema: { text: { type: 'string', required: true, description: 'Message text' }, username: { type: 'string', required: false, description: 'Bot display name' } },
        outputSchema: { ok: { type: 'boolean', description: 'Success flag' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'template',
  },

  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Control AmarktAI workflows via Telegram. Send notifications, receive commands, and trigger AI tasks.',
    category: 'messaging',
    docsUrl: 'https://core.telegram.org/bots/api',
    credentials: [
      {
        key: 'TELEGRAM_BOT_TOKEN',
        label: 'Bot Token',
        type: 'api_key',
        required: true,
        envVar: 'TELEGRAM_BOT_TOKEN',
        description: 'Telegram bot token from @BotFather',
      },
    ],
    actions: [
      {
        id: 'send_message',
        name: 'Send Message',
        description: 'Send a message to a Telegram chat',
        inputSchema: { chat_id: { type: 'string', required: true, description: 'Telegram chat ID' }, text: { type: 'string', required: true, description: 'Message text (supports HTML/Markdown)' }, parse_mode: { type: 'string', required: false, description: 'HTML or Markdown' } },
        outputSchema: { message_id: { type: 'number', description: 'Sent message ID' } },
      },
      {
        id: 'send_photo',
        name: 'Send Photo',
        description: 'Send an image to a Telegram chat',
        inputSchema: { chat_id: { type: 'string', required: true, description: 'Chat ID' }, photo: { type: 'string', required: true, description: 'Photo URL or file_id' }, caption: { type: 'string', required: false, description: 'Caption text' } },
        outputSchema: { message_id: { type: 'number', description: 'Message ID' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'template',
  },

  {
    id: 'discord',
    name: 'Discord',
    description: 'Send messages to Discord channels via webhooks or bot API. Supports embeds and file uploads.',
    category: 'messaging',
    docsUrl: 'https://discord.com/developers/docs',
    credentials: [
      {
        key: 'DISCORD_BOT_TOKEN',
        label: 'Bot Token',
        type: 'api_key',
        required: false,
        envVar: 'DISCORD_BOT_TOKEN',
        description: 'Discord bot token from developer portal',
      },
      {
        key: 'DISCORD_WEBHOOK_URL',
        label: 'Webhook URL',
        type: 'webhook_url',
        required: false,
        envVar: 'DISCORD_WEBHOOK_URL',
        description: 'Discord webhook URL (no bot required)',
      },
    ],
    actions: [
      {
        id: 'send_webhook_message',
        name: 'Send Webhook Message',
        description: 'Post a message via Discord webhook',
        inputSchema: { content: { type: 'string', required: true, description: 'Message content' }, username: { type: 'string', required: false, description: 'Override username' }, embeds: { type: 'array', required: false, description: 'Discord embed objects' } },
        outputSchema: { id: { type: 'string', description: 'Message ID' } },
      },
    ],
    supportsWebhooks: true,
    implementationState: 'template',
  },

  // ── AUTOMATION ────────────────────────────────────────────────────────────

  {
    id: 'generic_webhook',
    name: 'Generic Webhook',
    description: 'Fire a webhook to any URL. Use this to connect AmarktAI to Zapier, Make, n8n, or any custom HTTP endpoint.',
    category: 'automation',
    credentials: [
      {
        key: 'WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'api_key',
        required: false,
        envVar: 'WEBHOOK_SECRET',
        description: 'Optional HMAC secret for payload signing',
      },
    ],
    actions: [
      {
        id: 'fire_webhook',
        name: 'Fire Webhook',
        description: 'POST a JSON payload to a URL',
        inputSchema: { url: { type: 'string', required: true, description: 'Webhook endpoint URL' }, payload: { type: 'object', required: true, description: 'JSON payload to send' }, method: { type: 'string', required: false, description: 'HTTP method (default: POST)' } },
        outputSchema: { status: { type: 'number', description: 'HTTP response status' }, body: { type: 'string', description: 'Response body' } },
      },
    ],
    supportsWebhooks: false,
    implementationState: 'implemented',
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────────

  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Track events and user behavior via PostHog. Capture custom events and retrieve analytics data.',
    category: 'analytics',
    docsUrl: 'https://posthog.com/docs',
    credentials: [
      {
        key: 'POSTHOG_API_KEY',
        label: 'API Key',
        type: 'api_key',
        required: true,
        envVar: 'POSTHOG_API_KEY',
        description: 'PostHog project API key',
      },
    ],
    actions: [
      {
        id: 'capture_event',
        name: 'Capture Event',
        description: 'Track a custom event',
        inputSchema: { distinctId: { type: 'string', required: true, description: 'User distinct ID' }, event: { type: 'string', required: true, description: 'Event name' }, properties: { type: 'object', required: false, description: 'Event properties' } },
        outputSchema: { ok: { type: 'boolean', description: 'Success flag' } },
      },
    ],
    supportsWebhooks: false,
    implementationState: 'implemented',
  },
]

// ── Runtime connector execution ───────────────────────────────────────────────

/**
 * Check if a connector has all required credentials set in the environment.
 */
export function getConnectorStatus(connectorId: string): ConnectorStatus {
  const connector = CONNECTOR_REGISTRY.find((c) => c.id === connectorId)
  if (!connector) return 'error'

  const required = connector.credentials.filter((c) => c.required)
  if (required.length === 0) return 'configured'

  const allSet = required.every((cred) => {
    const val = process.env[cred.envVar]
    return val && val.trim().length > 0
  })

  return allSet ? 'configured' : 'not_configured'
}

/**
 * Execute a connector action.
 *
 * Currently routes to real implementations for 'github' and 'generic_webhook'.
 * All other connectors return a structured NOT_CONFIGURED or TEMPLATE_ONLY
 * response rather than silently failing.
 */
export async function executeConnectorAction(
  connectorId: string,
  actionId: string,
  input: Record<string, unknown>,
): Promise<ConnectorActionResult> {
  const start = Date.now()
  const connector = CONNECTOR_REGISTRY.find((c) => c.id === connectorId)

  if (!connector) {
    return {
      success: false,
      error: `Unknown connector: ${connectorId}`,
      connector: connectorId,
      action: actionId,
      latencyMs: Date.now() - start,
    }
  }

  const status = getConnectorStatus(connectorId)
  if (status === 'not_configured') {
    const missingCreds = connector.credentials
      .filter((c) => c.required && !process.env[c.envVar]?.trim())
      .map((c) => `${c.label} (env: ${c.envVar})`)
    return {
      success: false,
      error: `Connector "${connector.name}" is not configured. Missing credentials: ${missingCreds.join(', ')}. Configure via Admin → Integration Hub.`,
      connector: connectorId,
      action: actionId,
      latencyMs: Date.now() - start,
    }
  }

  if (connector.implementationState === 'stub') {
    return {
      success: false,
      error: `Connector "${connector.name}" is registered as a stub (not yet fully implemented). Check the AmarktAI roadmap.`,
      connector: connectorId,
      action: actionId,
      latencyMs: Date.now() - start,
    }
  }

  // Route to implemented connectors
  if (connectorId === 'github') {
    return executeGitHubAction(actionId, input, start)
  }

  if (connectorId === 'generic_webhook') {
    return executeWebhookAction(input, start)
  }

  if (connectorId === 'posthog') {
    return executePostHogAction(actionId, input, start)
  }

  // Template connectors — not yet implemented at HTTP level
  return {
    success: false,
    error: `Connector "${connector.name}" is a template connector. Its actions are defined but the HTTP implementation requires additional configuration. Use the Generic Webhook connector to bridge to this service.`,
    connector: connectorId,
    action: actionId,
    latencyMs: Date.now() - start,
  }
}

// ── Implemented connector handlers ────────────────────────────────────────────

async function executeGitHubAction(
  actionId: string,
  input: Record<string, unknown>,
  start: number,
): Promise<ConnectorActionResult> {
  const token = process.env.GITHUB_TOKEN || ''
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'AmarktAI-Network/1.0',
  }

  try {
    if (actionId === 'create_issue') {
      const { owner, repo, title, body, labels } = input as Record<string, unknown>
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error(String(data.message ?? res.statusText))
      return { success: true, data: { issueNumber: data.number, url: data.html_url }, connector: 'github', action: actionId, latencyMs: Date.now() - start }
    }

    if (actionId === 'list_issues') {
      const { owner, repo, state = 'open', limit = 20 } = input as Record<string, unknown>
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`, { headers })
      const data = await res.json() as unknown[]
      if (!res.ok) throw new Error('GitHub API error')
      return { success: true, data: { issues: data }, connector: 'github', action: actionId, latencyMs: Date.now() - start }
    }

    if (actionId === 'push_file') {
      const { owner, repo, path, content, message, branch = 'main' } = input as Record<string, unknown>
      const encoded = Buffer.from(String(content)).toString('base64')
      // Check if file exists to get SHA
      let sha: string | undefined
      try {
        const check = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers })
        if (check.ok) {
          const existing = await check.json() as Record<string, unknown>
          sha = existing.sha as string
        }
      } catch { /* new file */ }
      const body: Record<string, unknown> = { message, content: encoded, branch }
      if (sha) body.sha = sha
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) throw new Error(String(data.message ?? 'GitHub push failed'))
      const commit = data.commit as Record<string, unknown> | undefined
      return { success: true, data: { sha: commit?.sha, url: commit?.html_url }, connector: 'github', action: actionId, latencyMs: Date.now() - start }
    }

    return { success: false, error: `Unknown GitHub action: ${actionId}`, connector: 'github', action: actionId, latencyMs: Date.now() - start }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'GitHub action failed', connector: 'github', action: actionId, latencyMs: Date.now() - start }
  }
}

async function executeWebhookAction(
  input: Record<string, unknown>,
  start: number,
): Promise<ConnectorActionResult> {
  const { url, payload, method = 'POST' } = input
  try {
    const res = await fetch(String(url), {
      method: String(method),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.text()
    return { success: res.ok, data: { status: res.status, body }, connector: 'generic_webhook', action: 'fire_webhook', latencyMs: Date.now() - start }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Webhook failed', connector: 'generic_webhook', action: 'fire_webhook', latencyMs: Date.now() - start }
  }
}

async function executePostHogAction(
  actionId: string,
  input: Record<string, unknown>,
  start: number,
): Promise<ConnectorActionResult> {
  const apiKey = process.env.POSTHOG_API_KEY || ''
  if (actionId === 'capture_event') {
    const { distinctId, event, properties = {} } = input
    try {
      const res = await fetch('https://app.posthog.com/capture/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId, event, properties }),
      })
      return { success: res.ok, data: { ok: res.ok }, connector: 'posthog', action: actionId, latencyMs: Date.now() - start }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'PostHog error', connector: 'posthog', action: actionId, latencyMs: Date.now() - start }
    }
  }
  return { success: false, error: `Unknown PostHog action: ${actionId}`, connector: 'posthog', action: actionId, latencyMs: Date.now() - start }
}

// ── Registry accessors ────────────────────────────────────────────────────────

/** Return all registered connectors */
export function getAllConnectors(): ConnectorDefinition[] {
  return CONNECTOR_REGISTRY
}

/** Return connectors filtered by category */
export function getConnectorsByCategory(category: ConnectorCategory): ConnectorDefinition[] {
  return CONNECTOR_REGISTRY.filter((c) => c.category === category)
}

/** Return a single connector definition by ID */
export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id)
}

/** Return the status for all connectors */
export function getAllConnectorStatuses(): Record<string, ConnectorStatus> {
  const result: Record<string, ConnectorStatus> = {}
  for (const c of CONNECTOR_REGISTRY) {
    result[c.id] = getConnectorStatus(c.id)
  }
  return result
}

/** Return summary stats for the integration hub */
export function getIntegrationHubSummary(): {
  total: number
  configured: number
  byCategory: Record<string, number>
  configuredConnectors: string[]
} {
  const byCategory: Record<string, number> = {}
  const configuredConnectors: string[] = []

  for (const c of CONNECTOR_REGISTRY) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1
    if (getConnectorStatus(c.id) === 'configured') {
      configuredConnectors.push(c.id)
    }
  }

  return {
    total: CONNECTOR_REGISTRY.length,
    configured: configuredConnectors.length,
    byCategory,
    configuredConnectors,
  }
}
