# Configuring App Profiles

App profiles control how the AmarktAI Network routes, escalates, and manages
requests for each connected application.

## Profile Structure

Each app has a profile with these settings:

| Section              | Fields                                                            |
| -------------------- | ----------------------------------------------------------------- |
| **Identity**         | `app_id`, `app_name`, `app_type`, `domain`                       |
| **Routing**          | `default_routing_mode`, `allowed_providers`, `allowed_models`, `preferred_models` |
| **Escalation**       | `escalation_rules` — when to upgrade to premium models            |
| **Validation**       | `validator_rules` — when to require a second opinion              |
| **Permissions**      | `agent_permissions`, `multimodal_permissions`                     |
| **Memory**           | `memory_namespace`, `retrieval_namespace`                         |
| **Operational**      | `budget_sensitivity`, `latency_sensitivity`, `logging_privacy_rules` |

## Routing Modes

| Mode          | Description                                              |
| ------------- | -------------------------------------------------------- |
| `direct`      | Single model call, no validation                         |
| `specialist`  | Single model with specialist system prompt               |
| `review`      | Primary + validator from a different provider            |
| `consensus`   | Two independent generations, best-of selection           |

## Creating a Profile via Admin UI

1. Navigate to **Admin Dashboard → App Onboarding**
2. Follow the 4-step wizard:
   - **Step 1**: App name, slug, type, category
   - **Step 2**: Allowed providers, preferred models, sensitivity settings
   - **Step 3**: Capabilities (vision, voice, image gen, etc.)
   - **Step 4**: Review and submit
3. The profile is saved via `POST /api/admin/app-profiles`

## Creating a Profile via API

```bash
curl -X POST http://localhost:3000/api/admin/app-profiles \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session>' \
  -d '{
    "app_id": "my-new-app",
    "app_name": "My New App",
    "app_type": "web_app",
    "domain": "productivity",
    "default_routing_mode": "specialist",
    "allowed_providers": ["openai", "groq", "deepseek"],
    "allowed_models": ["gpt-4o-mini", "llama-3.3-70b-versatile"],
    "preferred_models": ["gpt-4o-mini"],
    "escalation_rules": [
      {
        "when_complexity": ["complex"],
        "when_task_types": ["code", "reasoning"],
        "escalate_to_provider": "openai",
        "escalate_to_model": "gpt-4o"
      }
    ],
    "validator_rules": [],
    "agent_permissions": ["chat", "summarise", "agent:planner"],
    "multimodal_permissions": [],
    "memory_namespace": "my-new-app",
    "retrieval_namespace": "my-new-app",
    "budget_sensitivity": "medium",
    "latency_sensitivity": "medium",
    "logging_privacy_rules": ["mask_pii"]
  }'
```

## Escalation Rules

Escalation rules define when a task should be upgraded to a more powerful model:

```typescript
{
  when_complexity: ['moderate', 'complex'],  // Complexity triggers
  when_task_types: ['code', 'reasoning'],    // Task type triggers
  escalate_to_provider: 'openai',            // Target provider
  escalate_to_model: 'gpt-4o'               // Target model
}
```

## Validator Rules

Validator rules define when a second opinion is required:

```typescript
{
  when_task_types: ['financial', 'medical'], // Sensitive task types
  min_complexity: 'moderate',                // Minimum complexity
  validator_models: ['gpt-4o', 'o1-mini']   // Models that can validate
}
```

## Default Profiles

The system includes pre-configured profiles for:

- `amarktai-network` — Platform admin (full permissions)
- `amarktai-crypto` — Trading/finance (review mode)
- `amarktai-marketing` — Creative/content (specialist mode)
- `amarktai-travel` — Travel planning
- `equiprofile` — Equine specialist
- `amarktai-online` — General purpose

Unknown apps receive a minimal `DEFAULT_PROFILE` with basic permissions.
