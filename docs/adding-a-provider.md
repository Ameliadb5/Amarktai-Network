# Adding a New AI Provider

This guide explains how to register a new AI provider in the AmarktAI Network.

## 1. Add to the Model Registry

Edit `src/lib/model-registry.ts` and add entries to the `MODEL_REGISTRY` array:

```typescript
{
  provider: 'your-provider',
  model_id: 'your-model-name',
  display_name: 'Your Model Display Name',
  cost_tier: 'low',       // free | low | medium | high
  latency_tier: 'fast',   // ultra_low | fast | moderate | slow
  context_window: 128000,
  roles: ['chat', 'code'] as ModelRole[],
  capabilities: {
    supports_vision: false,
    supports_image_generation: false,
    supports_function_calling: true,
    supports_streaming: true,
    supports_json_mode: true,
  },
  enabled: true,
}
```

## 2. Configure via Admin Dashboard

1. Navigate to **Admin Dashboard → AI Providers**
2. Click the provider card
3. Enter:
   - **API Key** — your provider's authentication key
   - **Base URL** — optional custom endpoint
   - **Default Model** — the primary model to use
   - **Fallback Model** — backup model for failures
4. Click **Save** then **Test Connection**

## 3. Add Health Check Support

Edit `src/lib/providers.ts` and add a case to `runProviderHealthCheck()`:

```typescript
case 'your-provider': {
  const res = await fetch('https://api.your-provider.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return {
    status: res.ok ? 'healthy' : 'error',
    message: res.ok ? 'Connected' : `HTTP ${res.status}`,
    checkedAt: new Date().toISOString(),
  };
}
```

## 4. Add Cost Rates

Edit `src/lib/budget-tracker.ts` and add entries to the `COST_RATES` map:

```typescript
['your-model-name', { inputPer1k: 0.001, outputPer1k: 0.002 }],
```

## 5. Update the Provider Catalogue

If the new provider should appear in the admin UI, add it to the
`PROVIDER_CATALOGUE` array in `src/app/admin/dashboard/ai-providers/page.tsx`.

## 6. Test

```bash
# Run health check
curl -X POST http://localhost:3000/api/admin/providers/your-provider/health-check

# Test via Brain API
curl -X POST http://localhost:3000/api/brain/request \
  -H 'Content-Type: application/json' \
  -d '{"appId":"your-app","appSecret":"secret","prompt":"Hello","provider":"your-provider"}'
```
