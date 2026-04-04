/**
 * Plugin System — Extensible Capability Framework
 *
 * Allows third-party and custom plugins to extend AmarktAI's capabilities.
 * Plugins can add new tools, processors, guardrails, or custom routes.
 *
 * Truthful: Only registered and active plugins are executed.
 * Plugin lifecycle is tracked honestly.
 */

import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  /** Plugin type determines where it hooks in */
  type: PluginType
  /** Plugin status */
  status: 'installed' | 'active' | 'disabled' | 'error'
  /** Configuration schema */
  configSchema: PluginConfigField[]
  /** Current configuration */
  config: Record<string, unknown>
  /** Plugin capabilities */
  capabilities: string[]
  /** Hook registrations */
  hooks: PluginHook[]
  /** Install metadata */
  installedAt: string
  lastActivatedAt?: string
  errorMessage?: string
}

export type PluginType =
  | 'tool'           // Adds tools to the tool runtime
  | 'processor'      // Pre/post-processes AI requests
  | 'guardrail'      // Adds custom guardrail checks
  | 'provider'       // Adds a new AI provider
  | 'transformer'    // Transforms data between pipeline stages
  | 'integration'    // External service integration
  | 'analytics'      // Custom analytics/reporting

export interface PluginConfigField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  description: string
  required: boolean
  defaultValue?: unknown
}

export interface PluginHook {
  event: HookEvent
  priority: number // Lower = earlier execution
  handler: HookHandler
}

export type HookEvent =
  | 'request.before'      // Before AI request is processed
  | 'request.after'       // After AI response received
  | 'request.error'       // On request error
  | 'route.before'        // Before model routing
  | 'route.after'         // After model selected
  | 'output.validate'     // Output validation
  | 'output.transform'    // Output transformation
  | 'metrics.record'      // When metrics are recorded
  | 'health.check'        // During health checks

export type HookHandler = (context: HookContext) => Promise<HookResult>

export interface HookContext {
  event: HookEvent
  data: Record<string, unknown>
  pluginId: string
  pluginConfig: Record<string, unknown>
}

export interface HookResult {
  modified: boolean
  data?: Record<string, unknown>
  error?: string
  /** Whether to continue to next hook (default true) */
  continueChain?: boolean
}

// ── Plugin Registry ──────────────────────────────────────────────────────────

const plugins = new Map<string, Plugin>()
const hookRegistry = new Map<HookEvent, Array<{ pluginId: string; priority: number; handler: HookHandler }>>()

// ── Plugin Management ────────────────────────────────────────────────────────

/** Install a plugin. */
export function installPlugin(input: {
  name: string
  version: string
  description: string
  author: string
  type: PluginType
  configSchema?: PluginConfigField[]
  capabilities?: string[]
  hooks?: PluginHook[]
  config?: Record<string, unknown>
}): Plugin {
  const plugin: Plugin = {
    id: randomUUID(),
    name: input.name,
    version: input.version,
    description: input.description,
    author: input.author,
    type: input.type,
    status: 'installed',
    configSchema: input.configSchema ?? [],
    config: input.config ?? {},
    capabilities: input.capabilities ?? [],
    hooks: input.hooks ?? [],
    installedAt: new Date().toISOString(),
  }

  plugins.set(plugin.id, plugin)
  return plugin
}

/** Activate a plugin and register its hooks. */
export function activatePlugin(pluginId: string): boolean {
  const plugin = plugins.get(pluginId)
  if (!plugin || plugin.status === 'active') return false

  // Validate required config
  for (const field of plugin.configSchema) {
    if (field.required && plugin.config[field.name] === undefined) {
      plugin.status = 'error'
      plugin.errorMessage = `Missing required config: ${field.name}`
      return false
    }
  }

  // Register hooks
  for (const hook of plugin.hooks) {
    if (!hookRegistry.has(hook.event)) {
      hookRegistry.set(hook.event, [])
    }
    hookRegistry.get(hook.event)!.push({
      pluginId: plugin.id,
      priority: hook.priority,
      handler: hook.handler,
    })
    // Sort by priority
    hookRegistry.get(hook.event)!.sort((a, b) => a.priority - b.priority)
  }

  plugin.status = 'active'
  plugin.lastActivatedAt = new Date().toISOString()
  plugin.errorMessage = undefined
  return true
}

/** Disable a plugin and unregister its hooks. */
export function disablePlugin(pluginId: string): boolean {
  const plugin = plugins.get(pluginId)
  if (!plugin) return false

  // Unregister hooks
  for (const [event, handlers] of hookRegistry.entries()) {
    hookRegistry.set(event, handlers.filter((h) => h.pluginId !== pluginId))
  }

  plugin.status = 'disabled'
  return true
}

/** Uninstall a plugin completely. */
export function uninstallPlugin(pluginId: string): boolean {
  disablePlugin(pluginId)
  return plugins.delete(pluginId)
}

/** Get a plugin by ID. */
export function getPlugin(pluginId: string): Plugin | null {
  return plugins.get(pluginId) ?? null
}

/** List all plugins. */
export function listPlugins(filter?: { type?: PluginType; status?: Plugin['status'] }): Plugin[] {
  let result = Array.from(plugins.values())
  if (filter?.type) result = result.filter((p) => p.type === filter.type)
  if (filter?.status) result = result.filter((p) => p.status === filter.status)
  return result
}

/** Update plugin configuration. */
export function configurePlugin(pluginId: string, config: Record<string, unknown>): boolean {
  const plugin = plugins.get(pluginId)
  if (!plugin) return false
  plugin.config = { ...plugin.config, ...config }
  return true
}

// ── Hook Execution ───────────────────────────────────────────────────────────

/**
 * Execute all registered hooks for an event.
 * Hooks are executed in priority order. Each hook can modify the data.
 */
export async function executeHooks(
  event: HookEvent,
  data: Record<string, unknown>,
): Promise<{ data: Record<string, unknown>; results: Array<{ pluginId: string; modified: boolean; error?: string }> }> {
  const handlers = hookRegistry.get(event) ?? []
  let currentData = { ...data }
  const results: Array<{ pluginId: string; modified: boolean; error?: string }> = []

  for (const handler of handlers) {
    const plugin = plugins.get(handler.pluginId)
    if (!plugin || plugin.status !== 'active') continue

    try {
      const context: HookContext = {
        event,
        data: currentData,
        pluginId: handler.pluginId,
        pluginConfig: plugin.config,
      }

      const result = await Promise.race([
        handler.handler(context),
        new Promise<HookResult>((_, reject) =>
          setTimeout(() => reject(new Error('Hook execution timed out')), 5000),
        ),
      ])

      results.push({ pluginId: handler.pluginId, modified: result.modified, error: result.error })

      if (result.modified && result.data) {
        currentData = result.data
      }

      if (result.continueChain === false) break
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown hook error'
      results.push({ pluginId: handler.pluginId, modified: false, error: errorMsg })
      // Don't break chain on error — continue to next plugin
    }
  }

  return { data: currentData, results }
}

/** Get count of hooks registered per event. */
export function getHookCounts(): Record<HookEvent, number> {
  const counts: Partial<Record<HookEvent, number>> = {}
  for (const [event, handlers] of hookRegistry.entries()) {
    counts[event] = handlers.length
  }
  return counts as Record<HookEvent, number>
}

// ── Exports for Testing ──────────────────────────────────────────────────────
export const PLUGIN_TYPES: PluginType[] = ['tool', 'processor', 'guardrail', 'provider', 'transformer', 'integration', 'analytics']
export const HOOK_EVENTS: HookEvent[] = ['request.before', 'request.after', 'request.error', 'route.before', 'route.after', 'output.validate', 'output.transform', 'metrics.record', 'health.check']
