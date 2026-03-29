# Budget Management

The AmarktAI Network tracks AI spending per provider and enforces configurable
budget limits to prevent runaway costs.

## How It Works

1. Every Brain API call logs a `BrainEvent` with the provider and model used
2. The budget tracker estimates cost based on token usage and model pricing
3. Per-provider budgets can set monthly limits with warning/critical thresholds
4. When thresholds are exceeded, the system can auto-degrade or auto-suspend

## Setting Budgets

### Via Admin Dashboard

1. Navigate to **Admin Dashboard → Budgets**
2. Click **Edit** on any provider row
3. Set:
   - **Monthly Budget (USD)** — the spending cap
   - **Warning Threshold** — percentage that triggers a warning (default 75%)
   - **Critical Threshold** — percentage that triggers critical alerts (default 90%)
   - **Auto-degrade** — automatically switch to cheaper models at warning level
   - **Auto-suspend** — stop premium tasks when budget is fully used

### Via API

```bash
curl -X POST http://localhost:3000/api/admin/budgets \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin-session>' \
  -d '{
    "providerKey": "openai",
    "monthlyBudgetUsd": 100.00,
    "warningThresholdPct": 75,
    "criticalThresholdPct": 90
  }'
```

## Cost Estimation

The system estimates costs based on a built-in rate table in
`src/lib/budget-tracker.ts`. Current rates include:

| Model                  | Input/1K tokens | Output/1K tokens |
| ---------------------- | --------------- | ---------------- |
| gpt-4o                 | $0.0025         | $0.01            |
| gpt-4o-mini            | $0.00015        | $0.0006          |
| gpt-4-turbo            | $0.01           | $0.03            |
| o1                     | $0.015          | $0.06            |
| dall-e-3               | $0.04 per image | —                |
| llama-3.3-70b-versatile| $0.00059        | $0.00079         |
| deepseek-chat          | $0.00014        | $0.00028         |
| gemini-1.5-pro         | $0.00125        | $0.005           |

## Budget Statuses

| Status    | Meaning                                      |
| --------- | -------------------------------------------- |
| `ok`      | Spending is within normal range              |
| `warning` | Spending has exceeded the warning threshold  |
| `critical`| Spending has exceeded the critical threshold |
| `unknown` | No budget has been configured                |

## Auto-Degrade Behaviour

When enabled and the warning threshold is reached:

- The routing engine prefers cheaper model alternatives
- High-cost models are moved to the end of the fallback chain
- A warning alert is generated

## Auto-Suspend Behaviour

When enabled and the critical threshold is reached:

- Premium tasks (those requiring high-cost models) are rejected
- Essential tasks continue with budget-friendly models
- An alert is generated and logged

## Monitoring

The budget dashboard shows:

- **Estimated MTD Spend** — month-to-date spending estimate
- **Monthly Budget** — total configured budget across providers
- **At Warning** — number of providers in warning state
- **At Critical** — number of providers in critical state
- **Per-provider progress bars** — visual spending vs. budget comparison
