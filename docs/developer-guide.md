# AmarktAI Developer Guide — SDK & Integration

This guide explains how external applications authenticate, call the Brain API,
and integrate with the AmarktAI Network.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [First-Run Setup](#first-run-setup)
3. [Calling the Brain API](#calling-the-brain-api)
4. [Streaming Responses](#streaming-responses)
5. [Test Mode (`__admin_test__`)](#test-mode)
6. [Error Handling](#error-handling)
7. [Capabilities](#capabilities)

---

## Authentication Flow

Every Brain API request requires two credentials:

| Field       | Description                                      |
| ----------- | ------------------------------------------------ |
| `appId`     | Your app's slug (e.g. `my-trading-app`)          |
| `appSecret` | A 64-character hex secret issued by the admin    |

### How secrets work

1. An admin creates your app via **Admin Dashboard → Apps**
2. The admin navigates to **Apps → [your-app] → Agents tab**
3. Clicks **Generate Secret** — this produces a `randomBytes(32)` hex string
4. The secret is stored hashed (bcrypt) in the database
5. On every API call, the submitted `appSecret` is compared using
   `timingSafeEqual` to prevent timing attacks

### Rotating a secret

```bash
# Via API (admin session required)
curl -X PATCH http://localhost:3000/api/admin/products/<id> \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session>' \
  -d '{ "regenerateSecret": true }'
# → Returns { ..., "appSecret": "<new-64-char-hex>" }
```

The old secret is immediately invalidated.

---

## First-Run Setup

After deploying the AmarktAI Network for the first time:

### 1. Seed the database

```bash
npx prisma db push          # Create tables
npm run db:seed              # Seed 14 providers + admin user
```

Default admin credentials: `admin@amarktai.com` / `admin123!`

### 2. Add at least one API key

Navigate to **Admin Dashboard → AI Providers** and enter an API key
for at least one provider (we recommend starting with OpenAI or Groq).
Click **Test Connection** to verify.

### 3. Register your first app

Go to **Admin Dashboard → App Onboarding** and follow the 4-step wizard.
This creates a `Product` record and an `AppAiProfile` with routing
preferences.

### 4. Generate an app secret

Navigate to your app's page → **Agents tab** → **Generate Secret**.
Save this secret securely — it's only shown once.

### 5. Make your first call

```bash
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "your-app-slug",
    "appSecret": "your-64-char-hex-secret",
    "message": "Hello, world!",
    "taskType": "chat"
  }'
```

---

## Calling the Brain API

### POST `/api/brain/request`

The main gateway for all AI tasks (chat, code, reasoning, image, video, etc.).

```typescript
// TypeScript example
const response = await fetch('https://your-domain.com/api/brain/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appId: 'my-app',
    appSecret: 'abc123...',
    message: 'Write a Python function to sort a list',
    taskType: 'code',                    // chat | code | reasoning | creative | image | video | etc.
    externalUserId: 'user-42',           // optional — enables per-user emotion + memory
    context: { language: 'python' },     // optional — task-specific context
  }),
})

const data = await response.json()
// {
//   success: true,
//   traceId: "uuid",
//   output: "def sort_list(arr): ...",
//   routedProvider: "openai",
//   routedModel: "gpt-4o-mini",
//   executionMode: "specialist",
//   confidenceScore: 0.92,
//   latencyMs: 1200,
// }
```

### POST `/api/brain/execute`

Direct execution endpoint that bypasses the orchestrator classification step.
Requires the same `appId` + `appSecret` credentials.

```bash
curl -X POST http://localhost:3000/api/brain/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "my-app",
    "appSecret": "secret",
    "message": "Summarise this document",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile"
  }'
```

---

## Streaming Responses

### POST `/api/brain/stream`

Server-Sent Events (SSE) endpoint for real-time token streaming.
Supports all 14 providers.

```typescript
const response = await fetch('https://your-domain.com/api/brain/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appId: 'my-app',
    appSecret: 'secret',
    taskType: 'chat',
    message: 'Tell me a story',
    provider: 'openai',        // optional — auto-selects if omitted
    model: 'gpt-4o-mini',     // optional
    systemPrompt: 'You are a storyteller.',  // optional
  }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value)
  // Parse SSE events
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6))
      if (event.type === 'chunk') process.stdout.write(event.content)
      if (event.type === 'done') console.log('\n[Done]', event)
      if (event.type === 'error') console.error('[Error]', event.message)
    }
  }
}
```

---

## Test Mode

The `__admin_test__` app slug is a special bypass that allows admin users
to test the Brain API without registering a real app.

### How it works

1. In `/api/brain/request`, if `appId === '__admin_test__'`:
   - The secret check is skipped
   - A virtual app object is created
   - Events are logged with `appSlug: '__admin_test__'`
2. The admin dashboard **Lab** page uses this mode
3. Dashboard metrics and events **exclude** `__admin_test__` data

### Usage

```bash
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "__admin_test__",
    "appSecret": "__admin_test__",
    "message": "Test prompt",
    "taskType": "chat"
  }'
```

> ⚠️ Test mode should be disabled in production by removing the bypass
> or restricting it to admin-session-authenticated requests.

---

## Error Handling

| Status | Meaning                                     | Action                          |
| ------ | ------------------------------------------- | ------------------------------- |
| 200    | Success                                     | Parse `output` field            |
| 400    | Missing or invalid fields                   | Check request body              |
| 401    | Invalid `appId` or `appSecret`              | Check credentials               |
| 403    | Content blocked by safety filter            | Review `categories` in response |
| 422    | Request validation failed (schema)          | Check field types/lengths       |
| 429    | Rate limit or all providers over budget     | Wait and retry                  |
| 500    | Internal server error                       | Check server logs               |
| 503    | No providers configured                     | Add API keys via admin          |

### Retry strategy

```typescript
async function callBrain(body: object, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch('/api/brain/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status !== 429 && res.status !== 503) return res
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))  // exponential backoff
  }
  throw new Error('Brain API unavailable after retries')
}
```

---

## Capabilities

The Brain API supports these task types:

| Task Type         | Description                               | Example Provider |
| ----------------- | ----------------------------------------- | ---------------- |
| `chat`            | Conversational AI                         | OpenAI, Groq     |
| `code`            | Code generation/analysis                  | OpenAI, DeepSeek |
| `reasoning`       | Complex logical reasoning                 | OpenAI o1        |
| `creative`        | Creative writing                          | Anthropic        |
| `image`           | Image generation                          | OpenAI DALL-E    |
| `image_editing`   | Image modification                        | OpenAI           |
| `video`           | Video generation (async, returns jobId)   | Replicate        |
| `video_planning`  | Video script/storyboard planning          | Any text model   |
| `tts`             | Text-to-speech                            | OpenAI           |
| `stt`             | Speech-to-text                            | OpenAI Whisper   |
| `embeddings`      | Text embeddings                           | OpenAI, HF       |
| `vision`          | Image understanding                       | OpenAI GPT-4o    |

### Multimodal endpoints

| Endpoint                           | Method | Purpose              |
| ---------------------------------- | ------ | -------------------- |
| `/api/brain/tts`                   | POST   | Text-to-speech       |
| `/api/brain/stt`                   | POST   | Speech-to-text       |
| `/api/brain/video-generate`        | POST   | Start video job      |
| `/api/brain/video-generate/[jobId]`| GET    | Poll video job status|

---

## Rate Limits

Rate limits are enforced per app, per provider, and globally:

- **Per app**: Configurable in AppAiProfile
- **Per provider**: Budget thresholds (warning at 75%, critical at 90%)
- **Global**: Configurable in environment variables

When a provider exceeds its budget critical threshold, it's excluded from
routing. If ALL providers are over budget, the API returns 429.

---

## App AI Profiles

Each app can have a customised AI profile that controls:

- **Routing strategy**: `balanced` | `cheapest` | `fastest` | `quality`
- **Allowed providers**: Restrict which providers can be used
- **Base personality**: Override the emotion engine's default tone
- **Emotion context window**: How many messages to consider for emotion
- **Cost mode**: `cheap` | `balanced` | `premium`
- **Safety settings**: `safeMode`, `adultMode`, `suggestiveMode`

Configure via **Admin Dashboard → Apps → [app] → AI Stack** tab or via API:

```bash
curl -X POST http://localhost:3000/api/admin/app-profiles \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session>' \
  -d '{
    "action": "upsert",
    "appSlug": "my-app",
    "appName": "My App",
    "routingStrategy": "fastest",
    "basePersonality": "friendly",
    "emotionContextWindow": 10,
    "allowedProviders": "[\"openai\",\"groq\"]"
  }'
```
