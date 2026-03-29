# Registering New Models

This guide explains how to add new AI models to the AmarktAI Network registry.

## Model Registry Structure

Models are defined in `src/lib/model-registry.ts` in the `MODEL_REGISTRY` array.

### Required Fields

| Field              | Type     | Description                                          |
| ------------------ | -------- | ---------------------------------------------------- |
| `provider`         | string   | Provider key (e.g. `openai`, `groq`)                 |
| `model_id`         | string   | Unique model identifier                              |
| `display_name`     | string   | Human-readable name                                  |
| `cost_tier`        | enum     | `free` \| `low` \| `medium` \| `high`                |
| `latency_tier`     | enum     | `ultra_low` \| `fast` \| `moderate` \| `slow`        |
| `context_window`   | number   | Maximum token context window                         |
| `roles`            | array    | Supported roles (see below)                          |
| `capabilities`     | object   | Boolean capability flags                             |
| `enabled`          | boolean  | Whether the model is active                          |

### Model Roles

- `chat` — Conversational AI
- `code` — Code generation and analysis
- `reasoning` — Complex reasoning tasks
- `creative` — Creative writing and content
- `embedding` — Text embeddings
- `image_generation` — Image creation (DALL-E, etc.)
- `tts` — Text-to-speech synthesis
- `voice_interaction` — Voice-based interactions
- `vision` — Image understanding
- `moderation` — Content moderation

### Capabilities

```typescript
{
  supports_vision: boolean,
  supports_image_generation: boolean,
  supports_function_calling: boolean,
  supports_streaming: boolean,
  supports_json_mode: boolean,
  supports_tts: boolean,
  supports_voice_interaction: boolean,
}
```

## Example: Adding a New Model

```typescript
// In MODEL_REGISTRY array:
{
  provider: 'openai',
  model_id: 'gpt-5',
  display_name: 'GPT-5',
  cost_tier: 'high',
  latency_tier: 'moderate',
  context_window: 256000,
  roles: ['chat', 'code', 'reasoning', 'creative'] as ModelRole[],
  capabilities: {
    supports_vision: true,
    supports_image_generation: false,
    supports_function_calling: true,
    supports_streaming: true,
    supports_json_mode: true,
  },
  enabled: true,
}
```

## Updating the Default Model Map

If you want the new model to be a default for its provider, update
`DEFAULT_MODEL_MAP` in the same file:

```typescript
export const DEFAULT_MODEL_MAP: Record<string, string> = {
  openai: 'gpt-4o',        // default OpenAI model
  groq: 'llama-3.3-70b-versatile',
  // ... add your new default here
};
```

## Verifying

After adding a model:

1. The model appears in **Admin Dashboard → Model Registry**
2. Run `npx vitest run src/lib/__tests__/model-registry.test.ts` to validate
3. The routing engine will include it in eligible models for matching apps
