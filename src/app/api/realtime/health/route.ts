/**
 * GET /api/realtime/health
 *
 * Checks whether the separate realtime WebSocket service is running
 * and reachable from the main application.
 *
 * Returns:
 *   { serviceRunning: true/false, serviceUrl, openaiConfigured: true/false, ready: true/false }
 *
 * This endpoint drives the capability truth for realtime_voice:
 * the capability is AVAILABLE only when ready: true.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  const realtimeServiceUrl = process.env.REALTIME_SERVICE_URL ?? null;

  // Check OpenAI configured
  const openaiProvider = await prisma.aiProvider.findFirst({
    where: { providerKey: 'openai', enabled: true },
    select: { apiKey: true, healthStatus: true },
  });

  const openaiConfigured =
    !!openaiProvider?.apiKey &&
    openaiProvider.healthStatus !== 'error' &&
    openaiProvider.healthStatus !== 'disabled';

  if (!realtimeServiceUrl) {
    return NextResponse.json({
      capability: 'realtime_voice',
      serviceRunning: false,
      serviceUrl: null,
      openaiConfigured,
      ready: false,
      reason: 'REALTIME_SERVICE_URL not set. Deploy services/realtime/ and set the env var.',
    });
  }

  // Ping the realtime service health endpoint
  let serviceRunning = false;
  let serviceVersion: string | undefined;
  let pingError: string | undefined;

  try {
    const healthUrl = `${realtimeServiceUrl.replace(/\/$/, '')}/health`;
    const res = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5_000),
    });

    if (res.ok) {
      serviceRunning = true;
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      serviceVersion = typeof data.version === 'string' ? data.version : undefined;
    } else {
      pingError = `Service returned HTTP ${res.status}`;
    }
  } catch (err) {
    pingError = err instanceof Error ? err.message : 'Connection refused';
  }

  const ready = serviceRunning && openaiConfigured;

  return NextResponse.json({
    capability: 'realtime_voice',
    serviceRunning,
    serviceUrl: realtimeServiceUrl,
    serviceVersion: serviceVersion ?? null,
    openaiConfigured,
    ready,
    reason: ready
      ? null
      : !serviceRunning
        ? (pingError ?? 'Realtime service not reachable')
        : 'OpenAI provider not configured or unhealthy',
  });
}
