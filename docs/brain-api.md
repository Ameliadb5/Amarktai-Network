# Brain API Reference

The Brain API is the main gateway for AI task execution in the AmarktAI Network.

## Base URL

```
POST /api/brain/request
```

## Authentication

Every request must include `appId` and `appSecret` in the request body.
These credentials are issued when an app is registered via the admin dashboard.

## Request Format

```json
{
  "appId": "your-app-slug",
  "appSecret": "your-app-secret",
  "prompt": "Your task prompt",
  "taskType": "chat",
  "context": {},
  "options": {}
}
```

## Response Format

```json
{
  "success": true,
  "traceId": "uuid-trace-id",
  "output": "The AI response text",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "confidenceScore": 0.92,
  "latencyMs": 1200,
  "cached": false
}
```

---

## Examples

### Chat

```bash
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "my-app",
    "appSecret": "secret123",
    "prompt": "Explain quantum computing in simple terms",
    "taskType": "chat"
  }'
```

### Code Generation

```bash
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "my-app",
    "appSecret": "secret123",
    "prompt": "Write a Python function to sort a list using merge sort",
    "taskType": "code",
    "context": { "language": "python" }
  }'
```

### Image Generation

```bash
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{
    "appId": "my-app",
    "appSecret": "secret123",
    "prompt": "A futuristic city skyline at sunset, digital art",
    "taskType": "image",
    "options": { "size": "1024x1024" }
  }'
```

### Voice (Text-to-Speech)

```bash
curl -X POST http://localhost:3000/api/brain/tts \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Hello, welcome to AmarktAI Network!",
    "voiceId": "alloy",
    "model": "tts-1",
    "speed": 1.0
  }' \
  --output speech.mp3
```

Available voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

### Voice (Speech-to-Text)

```bash
curl -X POST http://localhost:3000/api/brain/stt \
  -F "file=@recording.webm" \
  -F "model=whisper-1" \
  -F "language=en"
```

Response:
```json
{
  "transcript": "The transcribed text from the audio file",
  "model": "whisper-1",
  "language": "en"
}
```

### Video Generation

Dedicated video generation endpoint:

```bash
curl -X POST http://localhost:3000/api/brain/video \
  -H 'Content-Type: application/json' \
  -d '{
    "script": "A 15-second product showcase for a new smartphone",
    "style": "cinematic",
    "duration": 15,
    "aspectRatio": "16:9"
  }'
```

Parameters:
- `script` (string, required) — video description or script
- `style` (string) — `cinematic` | `animated` | `realistic` (default: `cinematic`)
- `duration` (number) — 1–120 seconds (default: 15)
- `aspectRatio` (string) — `16:9` | `9:16` | `1:1` (default: `16:9`)

Response:
```json
{
  "status": "submitted",
  "jobId": "vid_1234_abc",
  "estimatedCompletionSeconds": 60,
  "params": { "script": "...", "style": "cinematic", "duration": 15, "aspectRatio": "16:9" }
}
```

---

## Memory Management

### Export Memories

```bash
curl -X POST 'http://localhost:3000/api/admin/memory/manage?appSlug=my-app' \
  -H 'Cookie: session=...'
```

### Clear Memories

```bash
curl -X DELETE 'http://localhost:3000/api/admin/memory/manage?appSlug=my-app' \
  -H 'Cookie: session=...'
```

---

## Error Responses

| Status | Meaning                                |
| ------ | -------------------------------------- |
| 400    | Invalid request (missing fields)       |
| 401    | Invalid app credentials                |
| 403    | Content blocked by safety filter       |
| 429    | Rate limit or budget exceeded          |
| 500    | Internal server error                  |
| 503    | Provider unavailable                   |

### Content Filter Block (403)

```json
{
  "success": false,
  "error": "Content blocked by safety filter",
  "categories": ["hate_speech"],
  "message": "Your request was blocked for the following reason(s):...",
  "traceId": "uuid"
}
```
