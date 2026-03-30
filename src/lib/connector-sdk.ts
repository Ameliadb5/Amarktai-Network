/**
 * AmarktAI Network — App Connector SDK
 *
 * Lightweight TypeScript/JavaScript SDK that any connected app can install
 * to integrate with the AmarktAI super brain.
 *
 * Usage:
 *   import { AmarktAIConnector } from '@amarktai/connector-sdk';
 *   const brain = new AmarktAIConnector({
 *     brainUrl: 'https://your-amarktai-instance.com',
 *     appId: 'your-app-id',
 *     appSecret: 'your-app-secret',
 *   });
 *   await brain.connect();
 *   const result = await brain.request({ taskType: 'general_chat', message: 'Hello!' });
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ConnectorConfig {
  brainUrl: string;
  appId: string;
  appSecret: string;
  /** Heartbeat interval in seconds (default: 60) */
  heartbeatInterval?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** App version string */
  version?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface BrainTaskRequest {
  taskType: string;
  message: string;
  metadata?: Record<string, unknown>;
  preference?: 'cheap' | 'balanced' | 'premium';
  capabilities?: string[];
}

export interface BrainTaskResponse {
  success: boolean;
  result?: string;
  model?: string;
  provider?: string;
  traceId?: string;
  latencyMs?: number;
  error?: string;
}

export interface MetricReport {
  activeUsers?: number;
  newUsers?: number;
  revenue?: number;
  requestVolume?: number;
  errorCount?: number;
  conversionRate?: number;
  customKpis?: Record<string, unknown>;
}

export interface EventReport {
  eventType: string;
  payload?: Record<string, unknown>;
}

export interface KpiReport {
  [metric: string]: number;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'offline';
  uptime?: number;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// SDK class
// ---------------------------------------------------------------------------

export class AmarktAIConnector {
  private config: Required<ConnectorConfig>;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private startedAt = Date.now();

  constructor(config: ConnectorConfig) {
    this.config = {
      heartbeatInterval: 60,
      timeout: 30000,
      version: '1.0.0',
      debug: false,
      ...config,
    };
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  async connect(): Promise<boolean> {
    try {
      await this.sendHeartbeat('healthy');
      this.connected = true;
      this.startHeartbeatLoop();
      this.log('Connected to AmarktAI brain');
      return true;
    } catch (err) {
      this.log('Failed to connect', err);
      return false;
    }
  }

  disconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.connected = false;
    this.log('Disconnected from AmarktAI brain');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // -------------------------------------------------------------------------
  // AI Task requests
  // -------------------------------------------------------------------------

  async request(task: BrainTaskRequest): Promise<BrainTaskResponse> {
    const start = Date.now();
    try {
      const res = await this.fetch('/api/brain/request', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.config.appId,
          appSecret: this.config.appSecret,
          taskType: task.taskType,
          message: task.message,
          metadata: task.metadata,
          preference: task.preference,
          capabilities: task.capabilities,
        }),
      });

      const data = await res.json();
      return {
        success: res.ok,
        result: data.result ?? data.response,
        model: data.model,
        provider: data.provider,
        traceId: data.traceId,
        latencyMs: Date.now() - start,
        error: data.error,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Request failed',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  async sendHeartbeat(status: HealthReport['status'] = 'healthy'): Promise<void> {
    await this.fetch('/api/integrations/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        appSlug: this.config.appId,
        status,
        version: this.config.version,
        uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      }),
    });
  }

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(
      () => {
        this.sendHeartbeat('healthy').catch((err) => {
          this.log('Heartbeat failed', err);
        });
      },
      this.config.heartbeatInterval * 1000,
    );
  }

  // -------------------------------------------------------------------------
  // Metrics reporting
  // -------------------------------------------------------------------------

  async reportMetrics(metrics: MetricReport): Promise<boolean> {
    try {
      await this.fetch('/api/integrations/metrics', {
        method: 'POST',
        body: JSON.stringify({
          appSlug: this.config.appId,
          ...metrics,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Event reporting
  // -------------------------------------------------------------------------

  async reportEvent(event: EventReport): Promise<boolean> {
    try {
      await this.fetch('/api/integrations/events', {
        method: 'POST',
        body: JSON.stringify({
          appSlug: this.config.appId,
          eventType: event.eventType,
          payload: event.payload,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // KPI reporting (feeds strategy engine)
  // -------------------------------------------------------------------------

  async reportKpis(kpis: KpiReport): Promise<boolean> {
    try {
      await this.fetch('/api/integrations/metrics', {
        method: 'POST',
        body: JSON.stringify({
          appSlug: this.config.appId,
          customKpis: kpis,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Health reporting
  // -------------------------------------------------------------------------

  async reportHealth(report: HealthReport): Promise<boolean> {
    try {
      await this.sendHeartbeat(report.status);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Outcome reporting (feeds learning engine)
  // -------------------------------------------------------------------------

  async reportOutcome(outcome: {
    traceId: string;
    success: boolean;
    feedback?: string;
    businessMetric?: string;
    businessValue?: number;
  }): Promise<boolean> {
    try {
      await this.fetch('/api/integrations/events', {
        method: 'POST',
        body: JSON.stringify({
          appSlug: this.config.appId,
          eventType: 'outcome_report',
          payload: outcome,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.config.brainUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const res = await globalThis.fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': this.config.appId,
          ...(init.headers as Record<string, string>),
        },
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[AmarktAI SDK]', ...args);
    }
  }
}

// ---------------------------------------------------------------------------
// SDK snippet generator (for dashboard use)
// ---------------------------------------------------------------------------

export function generateConnectorSnippet(
  brainUrl: string,
  appId: string,
  appSecret: string,
): string {
  return `// AmarktAI Network — App Connector
// Install: npm install @amarktai/connector-sdk (or copy this snippet)

import { AmarktAIConnector } from '@amarktai/connector-sdk';

const brain = new AmarktAIConnector({
  brainUrl: '${brainUrl}',
  appId: '${appId}',
  appSecret: '${appSecret}',
  heartbeatInterval: 60,
  debug: false,
});

// Connect to the brain (starts heartbeat)
await brain.connect();

// Make an AI request
const result = await brain.request({
  taskType: 'general_chat',
  message: 'Hello from my app!',
  preference: 'balanced',
});
console.log(result);

// Report business metrics
await brain.reportMetrics({
  activeUsers: 150,
  revenue: 1200,
  requestVolume: 500,
});

// Report KPIs (feeds strategy engine)
await brain.reportKpis({
  conversion_rate: 3.5,
  csat: 4.2,
});

// Report an outcome (feeds learning engine)
await brain.reportOutcome({
  traceId: result.traceId!,
  success: true,
  businessMetric: 'conversion',
  businessValue: 1,
});

// Report events
await brain.reportEvent({
  eventType: 'user_signup',
  payload: { plan: 'premium' },
});

// Disconnect when done
brain.disconnect();
`;
}
