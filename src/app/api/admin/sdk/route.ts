/**
 * GET /api/admin/sdk?appSlug=xxx
 *
 * Returns ready-to-copy SDK integration snippets for the given app.
 * Includes TypeScript, Python, cURL, and signed-request examples.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appSlug = request.nextUrl.searchParams.get('appSlug') ?? 'YOUR_APP_SLUG'
  const baseUrl = request.nextUrl.origin

  const snippets = {
    typescript: buildTypeScriptSnippet(baseUrl, appSlug),
    python: buildPythonSnippet(baseUrl, appSlug),
    curl: buildCurlSnippet(baseUrl, appSlug),
    streaming: buildStreamSnippet(baseUrl, appSlug),
    agent: buildAgentSnippet(baseUrl, appSlug),
  }

  return NextResponse.json({ appSlug, baseUrl, snippets })
}

function buildTypeScriptSnippet(baseUrl: string, appSlug: string): string {
  return `import { AmarktAIClient } from '@amarktai/sdk'

const ai = new AmarktAIClient({
  baseUrl: '${baseUrl}',
  appId: '${appSlug}',
  appSecret: 'YOUR_APP_SECRET',
})

// Text generation
const res = await ai.execute({
  taskType: 'chat',
  message: 'Hello, AmarktAI!',
})
console.log(res.output)

// Image generation
const img = await ai.image({
  message: 'A futuristic cityscape at sunset',
})
console.log(img.output)

// TTS
const audio = await ai.tts('Welcome to the future.', { emotionAware: true })

// Heartbeat check
const health = await ai.heartbeat()
console.log(health.status)`
}

function buildPythonSnippet(baseUrl: string, appSlug: string): string {
  return `import requests

BASE_URL = "${baseUrl}"
APP_ID = "${appSlug}"
APP_SECRET = "YOUR_APP_SECRET"

# Text generation
res = requests.post(f"{BASE_URL}/api/brain/execute", json={
    "appId": APP_ID,
    "appSecret": APP_SECRET,
    "taskType": "chat",
    "message": "Hello from Python!",
})
print(res.json()["output"])

# Image generation
img = requests.post(f"{BASE_URL}/api/brain/execute", json={
    "appId": APP_ID,
    "appSecret": APP_SECRET,
    "taskType": "image_generation",
    "message": "A mountain landscape",
})
print(img.json()["output"])

# Heartbeat
hb = requests.post(f"{BASE_URL}/api/integrations/heartbeat", json={
    "appId": APP_ID,
    "appSecret": APP_SECRET,
})
print(hb.json())`
}

function buildCurlSnippet(baseUrl: string, appSlug: string): string {
  return `# Text generation
curl -X POST ${baseUrl}/api/brain/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${appSlug}",
    "appSecret": "YOUR_APP_SECRET",
    "taskType": "chat",
    "message": "Hello from cURL!"
  }'

# Image generation
curl -X POST ${baseUrl}/api/brain/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${appSlug}",
    "appSecret": "YOUR_APP_SECRET",
    "taskType": "image_generation",
    "message": "A beautiful sunset"
  }'

# Heartbeat
curl -X POST ${baseUrl}/api/integrations/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${appSlug}",
    "appSecret": "YOUR_APP_SECRET"
  }'`
}

function buildStreamSnippet(baseUrl: string, appSlug: string): string {
  return `// SSE streaming (TypeScript)
const res = await fetch('${baseUrl}/api/brain/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appId: '${appSlug}',
    appSecret: 'YOUR_APP_SECRET',
    taskType: 'chat',
    message: 'Tell me a story',
  }),
})

const reader = res.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value, { stream: true })
  for (const line of text.split('\\n')) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) process.stdout.write(content)
      } catch { /* skip */ }
    }
  }
}`
}

function buildAgentSnippet(baseUrl: string, appSlug: string): string {
  return `// Agent dispatch (TypeScript)
const res = await fetch('${baseUrl}/api/brain/agent/dispatch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appId: '${appSlug}',
    appSecret: 'YOUR_APP_SECRET',
    agentType: 'creative',
    message: 'Write a catchy tagline for a coffee brand',
  }),
})
const data = await res.json()
console.log(data.output)

# Python
import requests
res = requests.post("${baseUrl}/api/brain/agent/dispatch", json={
    "appId": "${appSlug}",
    "appSecret": "YOUR_APP_SECRET",
    "agentType": "creative",
    "message": "Write a catchy tagline for a coffee brand",
})
print(res.json()["output"])`
}
