# Health Monitoring

The AmarktAI Network includes a self-healing engine that continuously monitors
provider health, detects failures, and can automatically respond to issues.

## Self-Healing Engine

Located in `src/lib/self-healing.ts`, the engine runs the following detections:

### Detection Functions

1. **Provider Failures** — Checks BrainEvent history for providers with high
   failure rates (> 50% in the last hour)
2. **Missing Credentials** — Identifies enabled providers without API keys
3. **Fallback Overuse** — Detects when fallback models are used more than
   primary models (indicating primary failures)
4. **Broken App Routing** — Finds apps whose preferred providers are all
   unhealthy

### Health Score

The system produces a health score from 0–100:

- **80–100** (🟢) — System is healthy
- **50–79** (🟡) — Degraded, some issues detected
- **0–49** (🔴) — Critical issues require attention

### Issue Severities

| Severity   | Description                                      |
| ---------- | ------------------------------------------------ |
| `critical` | Immediate action required (provider down, no fallback) |
| `warning`  | Performance degraded but still operational        |
| `info`     | Informational (credential missing but not in use) |

## Provider Health Cache

The model registry maintains a provider health cache
(`src/lib/model-registry.ts`) with these states:

| Status         | Routing Behaviour                        |
| -------------- | ---------------------------------------- |
| `healthy`      | Normal routing                           |
| `configured`   | API key present, not yet health-checked  |
| `degraded`     | Deprioritised in fallback order          |
| `error`        | Excluded from routing                    |
| `unconfigured` | No API key, excluded from routing        |

## Dashboard

The **Self-Healing** page in the admin dashboard shows:

- Overall health score with colour-coded bar
- Issue list with severity, description, and affected resource
- Auto-healed items marked with a ⚡ indicator
- Metrics: total issues, critical count, warnings, auto-healed

## Readiness Audit

The **Go-Live Readiness** page runs 18 comprehensive checks:

1. `db_config` — Database configuration validity
2. `providers` — At least one provider configured
3. `models` — Models registered in the registry
4. `routing_wired` — Routing engine properly wired
5. `execution_modes` — All execution modes reachable
6. `memory` — Memory layer operational
7. `retrieval` — Retrieval engine functional
8. ... and more

## Alerts

When the system detects changes:

- Provider status change (healthy → error): models disabled, alert raised
- Budget exceeded: alert logged, app status updated
- Credentials missing: warning issued

Alerts are visible in **Admin Dashboard → Alerts** and **Events & Logs**.

## Health Synchronisation Schedule

The health sync job can be deployed on a schedule:

```bash
# Run the healing check manually
curl http://localhost:3000/api/admin/healing

# Automate with cron (every 5 minutes)
*/5 * * * * curl -s http://localhost:3000/api/admin/healing > /dev/null
```

The memory summarisation job can also be scheduled:

```bash
# Run memory summarisation (monthly recommended)
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/memory-summarise.ts

# Cron (first day of each month)
0 0 1 * * cd /path/to/project && npx ts-node ... scripts/memory-summarise.ts
```
