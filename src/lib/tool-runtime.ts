/**
 * Tool Runtime — Function Calling / Tool Use Framework
 *
 * Defines tool schemas, executes tools, and injects results back into
 * the AI conversation loop. Enables AI agents to actually DO things:
 * search, calculate, query APIs, read files, etc.
 *
 * Truthful: Only tools that are registered and executable are available.
 */

// ── Tool Schema ──────────────────────────────────────────────────────────────

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  enum?: string[]
  default?: unknown
}

export interface ToolDefinition {
  name: string
  description: string
  category: 'search' | 'calculation' | 'data' | 'api' | 'system' | 'custom'
  parameters: ToolParameter[]
  /** Max execution time in ms (default 30000) */
  timeout?: number
  /** Whether this tool requires user confirmation before execution */
  requiresConfirmation?: boolean
}

export interface ToolCall {
  id: string
  toolName: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  callId: string
  toolName: string
  success: boolean
  output: unknown
  error?: string
  executionMs: number
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

// ── Built-in Tools ───────────────────────────────────────────────────────────

const BUILTIN_TOOLS: Record<string, { definition: ToolDefinition; executor: ToolExecutor }> = {
  calculator: {
    definition: {
      name: 'calculator',
      description: 'Evaluate a mathematical expression safely. Supports +, -, *, /, ^, sqrt, sin, cos, tan, log, abs, round, ceil, floor.',
      category: 'calculation',
      parameters: [
        { name: 'expression', type: 'string', description: 'Mathematical expression to evaluate', required: true },
      ],
    },
    executor: async (args) => {
      const expr = String(args.expression)
      // Safe math evaluation — no eval()
      const sanitized = expr.replace(/[^0-9+\-*/().^,\s]/g, (match) => {
        const allowed = ['sqrt', 'sin', 'cos', 'tan', 'log', 'abs', 'round', 'ceil', 'floor', 'PI', 'E', 'pow', 'min', 'max']
        if (allowed.some(fn => match.startsWith(fn))) return `Math.${match}`
        return ''
      })
      // Replace ^ with **
      const processed = sanitized.replace(/\^/g, '**')
        .replace(/\bsqrt\b/g, 'Math.sqrt')
        .replace(/\bsin\b/g, 'Math.sin')
        .replace(/\bcos\b/g, 'Math.cos')
        .replace(/\btan\b/g, 'Math.tan')
        .replace(/\blog\b/g, 'Math.log')
        .replace(/\babs\b/g, 'Math.abs')
        .replace(/\bround\b/g, 'Math.round')
        .replace(/\bceil\b/g, 'Math.ceil')
        .replace(/\bfloor\b/g, 'Math.floor')
        .replace(/\bPI\b/g, 'Math.PI')
        .replace(/\bE\b/g, 'Math.E')
        .replace(/\bpow\b/g, 'Math.pow')
        .replace(/\bmin\b/g, 'Math.min')
        .replace(/\bmax\b/g, 'Math.max')
      // Validate only safe characters remain
      if (!/^[0-9+\-*/().Math,\s]*$/.test(processed)) {
        throw new Error('Unsafe expression detected')
      }
      // Use Function constructor with restricted scope
      const fn = new Function('Math', `"use strict"; return (${processed})`)
      const result = fn(Math)
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Expression did not produce a finite number')
      }
      return { result, expression: expr }
    },
  },

  current_time: {
    definition: {
      name: 'current_time',
      description: 'Get the current date and time in ISO format, or in a specified timezone.',
      category: 'system',
      parameters: [
        { name: 'timezone', type: 'string', description: 'IANA timezone (e.g., America/New_York)', required: false, default: 'UTC' },
      ],
    },
    executor: async (args) => {
      const tz = String(args.timezone || 'UTC')
      const now = new Date()
      try {
        const formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' })
        return { iso: now.toISOString(), formatted, timezone: tz }
      } catch {
        return { iso: now.toISOString(), formatted: now.toUTCString(), timezone: 'UTC' }
      }
    },
  },

  json_extract: {
    definition: {
      name: 'json_extract',
      description: 'Extract a value from a JSON string using a dot-notation path.',
      category: 'data',
      parameters: [
        { name: 'json', type: 'string', description: 'JSON string to parse', required: true },
        { name: 'path', type: 'string', description: 'Dot-notation path (e.g., "data.users.0.name")', required: true },
      ],
    },
    executor: async (args) => {
      const obj = JSON.parse(String(args.json))
      const path = String(args.path).split('.')
      let current: unknown = obj
      for (const key of path) {
        if (current === null || current === undefined) return { value: null, found: false }
        current = (current as Record<string, unknown>)[key]
      }
      return { value: current, found: current !== undefined }
    },
  },

  text_transform: {
    definition: {
      name: 'text_transform',
      description: 'Transform text: uppercase, lowercase, trim, word count, character count, reverse.',
      category: 'data',
      parameters: [
        { name: 'text', type: 'string', description: 'Text to transform', required: true },
        { name: 'operation', type: 'string', description: 'Operation to apply', required: true, enum: ['uppercase', 'lowercase', 'trim', 'word_count', 'char_count', 'reverse', 'slug'] },
      ],
    },
    executor: async (args) => {
      const text = String(args.text)
      switch (args.operation) {
        case 'uppercase': return { result: text.toUpperCase() }
        case 'lowercase': return { result: text.toLowerCase() }
        case 'trim': return { result: text.trim() }
        case 'word_count': return { result: text.split(/\s+/).filter(Boolean).length }
        case 'char_count': return { result: text.length }
        case 'reverse': return { result: text.split('').reverse().join('') }
        case 'slug': return { result: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
        default: throw new Error(`Unknown operation: ${args.operation}`)
      }
    },
  },

  http_fetch: {
    definition: {
      name: 'http_fetch',
      description: 'Fetch data from a public HTTP URL. Returns status, headers, and body (truncated to 4KB).',
      category: 'api',
      parameters: [
        { name: 'url', type: 'string', description: 'URL to fetch (must be HTTPS)', required: true },
        { name: 'method', type: 'string', description: 'HTTP method', required: false, enum: ['GET', 'POST'], default: 'GET' },
      ],
      timeout: 15_000,
      requiresConfirmation: true,
    },
    executor: async (args) => {
      const url = String(args.url)
      if (!url.startsWith('https://')) throw new Error('Only HTTPS URLs are allowed')
      const method = String(args.method || 'GET')
      const res = await fetch(url, {
        method,
        signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'AmarktAI-ToolRuntime/1.0' },
      })
      const text = await res.text()
      return {
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get('content-type'),
        body: text.slice(0, 4096),
        truncated: text.length > 4096,
      }
    },
  },
}

// ── Tool Registry ────────────────────────────────────────────────────────────

const customTools = new Map<string, { definition: ToolDefinition; executor: ToolExecutor }>()

/** Register a custom tool. */
export function registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
  customTools.set(definition.name, { definition, executor })
}

/** Unregister a custom tool. */
export function unregisterTool(name: string): boolean {
  return customTools.delete(name)
}

/** Get all available tool definitions (built-in + custom). */
export function getAvailableTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = []
  for (const t of Object.values(BUILTIN_TOOLS)) tools.push(t.definition)
  for (const t of customTools.values()) tools.push(t.definition)
  return tools
}

/** Get tool definitions in OpenAI function-calling format. */
export function getToolsAsOpenAIFunctions(): Array<{
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}> {
  return getAvailableTools().map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
              ...(p.default !== undefined ? { default: p.default } : {}),
            },
          ]),
        ),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }))
}

// ── Tool Execution ───────────────────────────────────────────────────────────

/** Execute a single tool call. */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const start = Date.now()
  const entry = BUILTIN_TOOLS[call.toolName] ?? customTools.get(call.toolName)
  if (!entry) {
    return {
      callId: call.id,
      toolName: call.toolName,
      success: false,
      output: null,
      error: `Tool "${call.toolName}" not found`,
      executionMs: Date.now() - start,
    }
  }

  const timeoutMs = entry.definition.timeout ?? 30_000
  try {
    const result = await Promise.race([
      entry.executor(call.arguments),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ])
    return {
      callId: call.id,
      toolName: call.toolName,
      success: true,
      output: result,
      executionMs: Date.now() - start,
    }
  } catch (err) {
    return {
      callId: call.id,
      toolName: call.toolName,
      success: false,
      output: null,
      error: err instanceof Error ? err.message : 'Unknown execution error',
      executionMs: Date.now() - start,
    }
  }
}

/** Execute multiple tool calls in parallel. */
export async function executeToolCalls(calls: ToolCall[]): Promise<ToolResult[]> {
  return Promise.all(calls.map(executeTool))
}

// ── Conversation Loop with Tools ─────────────────────────────────────────────

export interface ToolAugmentedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
  name?: string
}

/**
 * Process tool calls from an AI response and return the tool result messages
 * ready to be appended to the conversation for the next AI call.
 */
export async function processToolCallsFromResponse(
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
): Promise<ToolAugmentedMessage[]> {
  const calls: ToolCall[] = toolCalls.map((tc) => ({
    id: tc.id,
    toolName: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  }))

  const results = await executeToolCalls(calls)

  return results.map((r) => ({
    role: 'tool' as const,
    content: JSON.stringify(r.success ? r.output : { error: r.error }),
    tool_call_id: r.callId,
    name: r.toolName,
  }))
}

// ── Exports for Testing ──────────────────────────────────────────────────────

export const BUILTIN_TOOL_NAMES = Object.keys(BUILTIN_TOOLS)
export const BUILTIN_TOOL_COUNT = BUILTIN_TOOL_NAMES.length
