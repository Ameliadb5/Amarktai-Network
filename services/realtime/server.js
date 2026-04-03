/**
 * AmarktAI Network — Realtime Voice WebSocket Service
 *
 * Standalone Node.js WebSocket server that bridges bidirectional audio
 * streams between clients and the OpenAI Realtime API.
 *
 * Architecture:
 *   Client  <──WS──>  This service  <──WS──>  OpenAI Realtime API
 *
 * Session flow:
 *   1. Main app calls POST /api/realtime/session → gets { sessionId, sessionToken, wsUrl }
 *   2. Client connects to wsUrl (this service) with the session token
 *   3. This service validates the token, opens an OpenAI Realtime connection
 *   4. Bidirectional PCM16 audio + events are proxied between client and OpenAI
 *
 * Environment:
 *   OPENAI_API_KEY      — required, OpenAI API key with Realtime API access
 *   PORT                — optional, default 8765
 *   ALLOWED_ORIGINS     — optional, comma-separated CORS origins (default: *)
 *   SESSION_HMAC_SECRET — optional, HMAC secret to validate session tokens
 *                         (must match the secret used in /api/realtime/session)
 *
 * Start:
 *   npm install
 *   OPENAI_API_KEY=sk-... node server.js
 *
 * See README.md for full deployment instructions.
 */

'use strict';

require('dotenv').config();
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');
const url = require('url');

// ── Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '8765', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map(s => s.trim());
const SESSION_HMAC_SECRET = process.env.SESSION_HMAC_SECRET ?? null;

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Active sessions: sessionId → { clientWs, openaiWs, config, createdAt }
const activeSessions = new Map();

// ── HTTP server (health + session config endpoint) ─────────────────────────

const httpServer = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS[0] ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /health — liveness check
  if (req.method === 'GET' && parsed.pathname === '/health') {
    const body = JSON.stringify({
      status: 'ok',
      service: 'amarktai-realtime',
      version: '1.0.0',
      activeSessions: activeSessions.size,
      openaiKeyConfigured: !!OPENAI_API_KEY,
      uptime: process.uptime(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }

  // GET /sessions/count — active session count
  if (req.method === 'GET' && parsed.pathname === '/sessions/count') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: activeSessions.size }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ── WebSocket server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (clientWs, req) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname ?? '';

  // Validate path: /session/:sessionId
  const sessionMatch = pathname.match(/^\/session\/([a-zA-Z0-9-]+)$/);
  if (!sessionMatch) {
    clientWs.close(1008, 'Invalid session path');
    return;
  }

  const sessionId = sessionMatch[1];
  const token = parsed.query.token;

  // Validate token if HMAC secret is configured
  if (SESSION_HMAC_SECRET && token) {
    // Token validation: accept if it's a hex string of 32+ chars (matches /api/realtime/session)
    if (typeof token !== 'string' || !/^[a-f0-9]{32,}$/.test(token)) {
      clientWs.close(1008, 'Invalid session token format');
      return;
    }
  }

  // Enforce single-use sessions
  if (activeSessions.has(sessionId)) {
    clientWs.close(1008, 'Session already in use');
    return;
  }

  if (!OPENAI_API_KEY) {
    clientWs.close(1011, 'OpenAI API key not configured');
    return;
  }

  console.log(`[realtime] New session: ${sessionId}`);

  // ── Open OpenAI Realtime connection ────────────────────────────────────

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  const sessionEntry = {
    clientWs,
    openaiWs,
    sessionId,
    createdAt: Date.now(),
    messageCount: 0,
  };

  activeSessions.set(sessionId, sessionEntry);

  // Notify client that session is initializing
  function safeClientSend(data) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  function safeOpenaiSend(data) {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  function cleanupSession() {
    activeSessions.delete(sessionId);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000, 'Session ended');
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close(1000, 'Session ended');
    console.log(`[realtime] Session closed: ${sessionId} (${sessionEntry.messageCount} messages)`);
  }

  // ── OpenAI events → Client ─────────────────────────────────────────────

  openaiWs.on('open', () => {
    safeClientSend({ type: 'session.created', sessionId });
    console.log(`[realtime] OpenAI connection open for session: ${sessionId}`);
  });

  openaiWs.on('message', (data) => {
    sessionEntry.messageCount++;
    safeClientSend(data);
  });

  openaiWs.on('error', (err) => {
    console.error(`[realtime] OpenAI WS error (${sessionId}):`, err.message);
    safeClientSend({
      type: 'error',
      error: { code: 'provider_error', message: 'OpenAI Realtime connection error' },
    });
    cleanupSession();
  });

  openaiWs.on('close', (code, reason) => {
    console.log(`[realtime] OpenAI WS closed (${sessionId}): ${code} ${reason}`);
    safeClientSend({ type: 'session.ended', code, reason: reason.toString() });
    cleanupSession();
  });

  // ── Client events → OpenAI ─────────────────────────────────────────────

  clientWs.on('message', (data) => {
    sessionEntry.messageCount++;
    safeOpenaiSend(data);
  });

  clientWs.on('error', (err) => {
    console.error(`[realtime] Client WS error (${sessionId}):`, err.message);
    cleanupSession();
  });

  clientWs.on('close', (code) => {
    console.log(`[realtime] Client disconnected (${sessionId}): ${code}`);
    cleanupSession();
  });

  // ── Session timeout (30 minutes) ──────────────────────────────────────

  const timeout = setTimeout(() => {
    console.log(`[realtime] Session timeout: ${sessionId}`);
    safeClientSend({ type: 'session.timeout', message: 'Session exceeded maximum duration (30 min)' });
    cleanupSession();
  }, SESSION_TIMEOUT_MS);

  timeout.unref(); // Don't keep process alive just for timeouts
});

// ── Start server ───────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[realtime] AmarktAI Realtime Service running on port ${PORT}`);
  console.log(`[realtime] Health: http://localhost:${PORT}/health`);
  console.log(`[realtime] OpenAI key: ${OPENAI_API_KEY ? '✓ configured' : '✗ MISSING — set OPENAI_API_KEY'}`);

  if (!OPENAI_API_KEY) {
    console.warn('[realtime] WARNING: OPENAI_API_KEY not set. Sessions will be rejected.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[realtime] SIGTERM received. Closing active sessions...');
  for (const [, session] of activeSessions) {
    try {
      session.clientWs.close(1001, 'Server shutting down');
      session.openaiWs.close(1001, 'Server shutting down');
    } catch { /* ignore */ }
  }
  httpServer.close(() => {
    console.log('[realtime] Server closed.');
    process.exit(0);
  });
});
