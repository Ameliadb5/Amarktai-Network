# AmarktAI Realtime Voice Service

Standalone Node.js WebSocket server that enables bidirectional audio streaming for the `realtime_voice` capability.

## Architecture

```
Browser/Client  <──WS──>  This service  <──WS──>  OpenAI Realtime API
                                ↑
                     POST /api/realtime/session
                     (generates session config)
```

## Quick Start

```bash
cd services/realtime
npm install
OPENAI_API_KEY=sk-... node server.js
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | — | OpenAI API key with Realtime API access |
| `PORT` | No | `8765` | Port to listen on |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated allowed CORS origins |
| `SESSION_HMAC_SECRET` | No | — | HMAC secret for session token validation (must match main app) |

## Setting `REALTIME_SERVICE_URL` in the main app

After starting this service, set the environment variable in the main Next.js app:

```bash
# .env.local (main app)
REALTIME_SERVICE_URL=http://localhost:8765
```

This allows the capability engine to mark `realtime_voice` as AVAILABLE.

## Client Integration

1. Call `POST /api/realtime/session` from the main app to get a session config:

```json
{
  "sessionId": "...",
  "wsUrl": "ws://localhost:8765/session/<sessionId>?token=<token>",
  "sessionToken": "...",
  "expiresAt": "..."
}
```

2. Open a WebSocket connection to `wsUrl`.

3. Send/receive OpenAI Realtime API events (see OpenAI Realtime API docs).

## Session Lifecycle

- Session created → `{ type: "session.created", sessionId }`
- Audio streaming → bidirectional proxying to OpenAI
- Session ended → `{ type: "session.ended", code, reason }`
- Session timeout (30 min) → `{ type: "session.timeout" }`
- Provider error → `{ type: "error", error: { code, message } }`

## Health Check

```bash
curl http://localhost:8765/health
```

Returns:
```json
{
  "status": "ok",
  "service": "amarktai-realtime",
  "version": "1.0.0",
  "activeSessions": 0,
  "openaiKeyConfigured": true,
  "uptime": 42.5
}
```

## Production Deployment

For production on a VPS:

```bash
# Using PM2
npm install -g pm2
cd services/realtime
npm install
pm2 start server.js --name amarktai-realtime --env production
pm2 save

# Set in main app
REALTIME_SERVICE_URL=http://your-vps-ip:8765
```

Ensure port 8765 is accessible from the main app server (firewall rules as needed).
