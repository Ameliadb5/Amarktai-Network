/**
 * POST /api/realtime/session
 *
 * Creates a realtime voice session configuration.
 *
 * This endpoint generates a short-lived session token and returns the
 * WebSocket URL of the separate realtime streaming service. The client
 * connects to that URL to start bidirectional audio streaming.
 *
 * Architecture:
 *   Main app  →  POST /api/realtime/session  →  { wsUrl, sessionToken, sessionId }
 *   Client    →  WebSocket connect(wsUrl)    →  Realtime service
 *   Realtime  →  OpenAI Realtime API         →  Bidirectional voice stream
 *
 * Capability truth:
 *   realtime_voice is AVAILABLE only when:
 *     1. REALTIME_SERVICE_URL env var is set (service running)
 *     2. OpenAI provider is configured with a valid key
 *     3. This session endpoint can successfully create a config
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { z } from 'zod';
import crypto from 'crypto';

const RequestSchema = z.object({
  appSlug: z.string().optional(),
  voice: z.enum(['alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse']).optional().default('alloy'),
  instructions: z.string().max(4096).optional(),
  turnDetection: z.object({
    type: z.enum(['server_vad', 'none']).optional().default('server_vad'),
    threshold: z.number().min(0).max(1).optional().default(0.5),
    prefix_padding_ms: z.number().int().min(0).max(2000).optional().default(300),
    silence_duration_ms: z.number().int().min(0).max(4000).optional().default(500),
  }).optional(),
});

const SESSION_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: Request): Promise<NextResponse> {
  // Require admin session for session creation
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check realtime service is configured
  const realtimeServiceUrl = process.env.REALTIME_SERVICE_URL;
  if (!realtimeServiceUrl) {
    return NextResponse.json(
      {
        error: 'Realtime service not configured',
        detail:
          'Set REALTIME_SERVICE_URL in your environment to point to the running realtime WebSocket service. ' +
          'See services/realtime/README.md for setup instructions.',
      },
      { status: 503 },
    );
  }

  // Check OpenAI provider is configured
  const openaiProvider = await prisma.aiProvider.findFirst({
    where: { providerKey: 'openai', enabled: true },
    select: { apiKey: true, healthStatus: true },
  });

  if (!openaiProvider?.apiKey) {
    return NextResponse.json(
      {
        error: 'OpenAI provider not configured',
        detail: 'Realtime voice requires OpenAI to be configured with a valid API key.',
      },
      { status: 503 },
    );
  }

  if (openaiProvider.healthStatus === 'error' || openaiProvider.healthStatus === 'disabled') {
    return NextResponse.json(
      {
        error: 'OpenAI provider unhealthy',
        detail: `OpenAI health status: ${openaiProvider.healthStatus}. Check provider configuration.`,
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { appSlug, voice, instructions, turnDetection } = parsed.data;

  // Generate a short-lived session token (valid 5 minutes)
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto
    .createHmac('sha256', openaiProvider.apiKey)
    .update(`${sessionId}:${Date.now()}`)
    .digest('hex')
    .slice(0, 32);

  const expiresAt = new Date(Date.now() + SESSION_TOKEN_EXPIRY_MS);

  // Build WebSocket URL for the realtime service
  const wsUrl = realtimeServiceUrl.replace(/^http/, 'ws').replace(/\/$/, '');
  const sessionWsUrl = `${wsUrl}/session/${sessionId}?token=${sessionToken}`;

  // Session config to pass to the realtime service
  const sessionConfig = {
    sessionId,
    sessionToken,
    model: 'gpt-4o-realtime-preview',
    voice,
    instructions: instructions ?? 'You are a helpful voice assistant.',
    turnDetection: turnDetection ?? {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    appSlug: appSlug ?? null,
    expiresAt: expiresAt.toISOString(),
  };

  return NextResponse.json({
    capability: 'realtime_voice',
    sessionId,
    wsUrl: sessionWsUrl,
    sessionToken,
    sessionConfig,
    expiresAt: expiresAt.toISOString(),
    provider: 'openai',
    model: 'gpt-4o-realtime-preview',
    serviceUrl: realtimeServiceUrl,
  });
}
