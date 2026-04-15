/**
 * Event Bus — AmarktAI Network
 *
 * In-process pub/sub for system events. Used by SSE endpoint
 * and internal components to broadcast events to the dashboard.
 *
 * Server-side only.
 */

// ── Event Types ──────────────────────────────────────────────────────────────

export type SystemEventType =
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'artifact_created'
  | 'artifact_failed'
  | 'alert_created'
  | 'alert_resolved'
  | 'provider_state_change'
  | 'manager_action'
  | 'learning_cycle'
  | 'health_update'
  | 'heartbeat'

export interface SystemEvent {
  type: SystemEventType
  data: Record<string, unknown>
  timestamp: string
  appSlug?: string
}

// ── Event Bus ────────────────────────────────────────────────────────────────

type EventListener = (event: SystemEvent) => void
const listeners = new Set<EventListener>()

/**
 * Emit an event to all connected SSE clients and internal listeners.
 */
export function emitSystemEvent(
  type: SystemEventType,
  data: Record<string, unknown>,
  appSlug?: string,
): void {
  const event: SystemEvent = {
    type,
    data,
    timestamp: new Date().toISOString(),
    appSlug,
  }

  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      listeners.delete(listener)
    }
  }
}

/**
 * Subscribe to system events. Returns an unsubscribe function.
 */
export function subscribe(listener: EventListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Get connected listener count.
 */
export function getEventListenerCount(): number {
  return listeners.size
}
