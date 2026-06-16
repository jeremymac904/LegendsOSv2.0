# GOAT Command API

**External Custom GPT Actions API — not used by the LegendsOS UI.**

These 14 endpoints power the GOAT Architect Custom GPT in ChatGPT. They are
authenticated via `GOAT_COMMAND_API_KEY` (not Supabase session auth) and
operate on their own `goat_*` tables (service-role only).

No LegendsOS page, component, or client-side code calls these routes. They
exist solely as an external API contract for the Custom GPT.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/goat/health` | GET | Liveness check |
| `/api/goat/capabilities` | GET | List available tools |
| `/api/goat/openapi` | GET | OpenAPI spec for GPT Actions |
| `/api/goat/agent/execute` | POST | Execute an agent action |
| `/api/goat/agent/plan` | POST | Create an execution plan |
| `/api/goat/memory` | GET/POST | Read/write GOAT memory |
| `/api/goat/memory/search` | POST | Search GOAT memory |
| `/api/goat/projects` | GET/POST | List/create projects |
| `/api/goat/projects/search` | POST | Search projects |
| `/api/goat/repo/status` | GET | Git repo status |
| `/api/goat/research/ai-news` | GET | AI news feed |
| `/api/goat/research/github` | GET | GitHub research |
| `/api/goat/runs/[runId]` | GET | Get run status |
| `/api/goat/secrets/prepare` | POST | Prepare secrets for deploy |

## Key env var

`GOAT_COMMAND_API_KEY` — shared secret between this API and the Custom GPT.

## Lib

Business logic lives in `lib/goat/` (~979 LOC).
