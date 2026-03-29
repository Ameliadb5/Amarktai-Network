# Safety & Content Policies

The AmarktAI Network implements a content filter pipeline to ensure all
AI-generated outputs comply with safety guidelines and legal requirements.

## Content Filter Pipeline

Located in `src/lib/content-filter.ts`, the filter scans all outputs for:

### Blocked Categories

| Category           | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `csam`             | Child sexual abuse material                          |
| `non_consensual`   | Non-consensual explicit content                      |
| `hate_speech`      | Content promoting hatred against protected groups    |
| `violence`         | Instructions for weapons, explosives, or bioweapons  |
| `self_harm`        | Content promoting self-harm or suicide               |

### How It Works

1. **Scan** — Every AI output passes through `scanContent()` before delivery
2. **Flag** — If policy-violating patterns are detected, content is flagged
3. **Block** — Flagged content is blocked and never delivered to the user
4. **Alert** — A moderation alert is generated with the trace ID and category
5. **Explain** — The user receives a clear explanation of why content was blocked

### User-Facing Messages

When content is blocked, users see:

> This content has been blocked by our safety filter. If you believe this is
> an error, please contact support with your trace ID to request a review.

Followed by specific reasons:

> • Content involving minors in sexual contexts is strictly prohibited.

### Appeals Process

If a user believes their content was incorrectly blocked:

1. Note the **trace ID** from the error response
2. Contact support via the contact form at `/contact`
3. Include the trace ID and a description of the request
4. The team will review within 24 hours
5. If it was a false positive, the filter will be updated

## NSFW Gating

Adult content features are gated behind age verification:

- NSFW capabilities are hidden by default
- Users must pass age verification to access adult content
- Session must have `age_verified: true` flag
- Adult-only models are tagged in the model registry

## Compliance Checklist

- [x] CSAM detection and blocking
- [x] Non-consensual content filtering
- [x] Hate speech detection
- [x] Violence/weapons instruction blocking
- [x] Self-harm content blocking
- [x] User-facing explanation messages
- [x] Appeals process for false positives
- [x] Trace ID for all moderation events
- [x] NSFW age-gating

## Extending the Filter

To add new categories or improve detection:

1. Edit `CATEGORY_PATTERNS` in `src/lib/content-filter.ts`
2. Add new `FlagCategory` values
3. Add corresponding explanation text in `blockedExplanation()`
4. Test with `npx vitest run src/lib/__tests__/content-filter.test.ts`

### Using the OpenAI Moderation API

For production deployments, we recommend augmenting the keyword filter
with the OpenAI Moderation API:

```typescript
const response = await fetch('https://api.openai.com/v1/moderations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ input: text }),
});
const result = await response.json();
// Map result.results[0].categories to FlagCategory
```

## Reporting

All moderation events are logged and can be reviewed in:

- **Admin Dashboard → Events & Logs** — with trace ID lookup
- **Admin Dashboard → Alerts** — for critical safety violations
