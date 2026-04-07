# AmarktAI Network — Documentation

## Table of Contents

1. [Adding a New Provider](./adding-a-provider.md)
2. [Registering New Models](./registering-models.md)
3. [Configuring App Profiles](./configuring-app-profiles.md)
4. [Brain API Reference](./brain-api.md)
5. [Budget Management](./budget-management.md)
6. [Health Monitoring](./health-monitoring.md)
7. [Safety & Content Policies](./safety-policies.md)
8. [Developer Guide — SDK & Integration](./developer-guide.md)

---

## Quick Start

The AmarktAI Network is an AI Operating System that orchestrates multiple
AI providers, manages per-app routing, budgets, and self-healing across
a connected ecosystem of applications.

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database
- At least one AI provider API key (e.g. OpenAI)

### Setup

```bash
# Clone the repository
git clone <repo-url> && cd Amarktai-Network

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, SESSION_SECRET, and provider keys

# Push database schema
npx prisma db push

# Seed initial data (optional)
npm run db:seed

# Start development server
npm run dev
```

### Key URLs

| URL                       | Description               |
| ------------------------- | ------------------------- |
| `/`                       | Public marketing site     |
| `/admin/login`            | Admin authentication      |
| `/admin/dashboard`        | Admin dashboard           |
| `/api/brain/request`      | Brain API gateway         |
| `/api/brain/tts`          | Text-to-Speech endpoint   |
| `/api/brain/stt`          | Speech-to-Text endpoint   |

---

## Architecture Overview

```
┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
│  App / UI   │──▶│  Brain API   │──▶│   Orchestrator   │
└─────────────┘   └──────────────┘   └──────┬───────────┘
                                            │
                       ┌────────────────────┼───────────────┐
                       ▼                    ▼               ▼
               ┌──────────────┐   ┌─────────────┐   ┌────────────┐
               │ Routing Eng. │   │ Memory/RAG  │   │  Agents    │
               └──────┬───────┘   └─────────────┘   └────────────┘
                      ▼
          ┌───────────────────────┐
          │  Provider Selection   │
          │ (OpenAI, Groq, etc.)  │
          └───────────────────────┘
```

The system processes every request through:

1. **Authentication** — Validates app credentials
2. **Profile Lookup** — Loads the app's routing preferences
3. **Task Classification** — Determines complexity and type
4. **Routing Decision** — Selects provider, model, and execution mode
5. **Execution** — Calls the chosen provider
6. **Memory** — Stores the outcome for future learning
7. **Content Filter** — Scans output for policy violations
