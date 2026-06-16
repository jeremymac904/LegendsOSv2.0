# GOAT Architect Command API

Backend for the **GOAT Architect** Custom GPT Action. Lives inside LegendsOS
under `app/api/goat/*`, deployed with the rest of the site on Netlify.

- **API base URL:** `https://legendsos.app`
- **OpenAPI schema (import this in GPT Builder):** `https://legendsos.app/api/goat/openapi`
- **Auth:** `Authorization: Bearer <GOAT_COMMAND_API_KEY>` on every endpoint
  except `get_health` and the schema itself.
- **API key env var (exact name):** `GOAT_COMMAND_API_KEY`
  - Local value: `.env.local` in the project root (never committed).
  - Production value: Netlify → Site configuration → Environment variables.
  - Routes fail closed: `503` when the var is unset, `401` on a bad token.

## Endpoints

| operationId | Method + path | Notes |
| --- | --- | --- |
| `get_health` | `GET /api/goat/health` | Public. Returns `status`, `version`, `message`. |
| `list_capabilities` | `GET /api/goat/capabilities` | Tools + agents from the live LegendsOS agent registry; MCP servers, repositories, memory stores. |
| `search_projects` | `GET /api/goat/projects/search?query=&limit=` | Keyword over name/description/slug + exact tag match. |
| `create_project` | `POST /api/goat/projects` | `409` on duplicate slug. |
| `search_memory` | `GET /api/goat/memory/search?query=&scope=&limit=` | Keyword over title/content + exact tag match. |
| `write_memory` | `POST /api/goat/memory` | Append-only. |
| `get_repo_status` | `GET /api/goat/repo/status` | Deployed commit/branch baked at build; live GitHub state when `GITHUB_TOKEN` is set. |
| `plan_agent_task` | `POST /api/goat/agent/plan` | Deterministic structured plan, persisted as a `goat_runs` row (`status=planned`). |
| `execute_agent_task` | `POST /api/goat/agent/execute` | `mode=queue` records a run for Claude Code to pick up; `mode=dry_run` completes immediately. Never runs code itself. |
| `get_run_status` | `GET /api/goat/runs/{run_id}` | Fetch any run. |
| `research_github` | `POST /api/goat/research/github` | GitHub repository search. |
| `research_ai_news` | `POST /api/goat/research/ai-news` | Recent AI stories (Hacker News index, keyless). |
| `prepare_secret_file` | `POST /api/goat/secrets/prepare` | Returns `OPEN_ME_ADD_KEYS.txt` content + steps. **Rejects anything that looks like a secret value.** |

All responses share one envelope: `{ ok: true, request_id, ... }` or
`{ ok: false, error, message, request_id }`.

## Storage

Three service-role-only Supabase tables (RLS enabled, zero policies):
`goat_projects`, `goat_memories`, `goat_runs` — created by
`supabase/migrations/20260612210000_goat_command_api.sql`.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GOAT_COMMAND_API_KEY` | yes | Bearer token for all command endpoints. |
| `SUPABASE_SECRET_KEY` | yes (already set) | Service-role DB access (shared with the rest of LegendsOS). |
| `GITHUB_TOKEN` | no | Live repo status + higher GitHub search rate limits. |
| `GOAT_GITHUB_REPO` | no | Override the default `jeremymac904/LegendsOSv2.0`. |
| `GOAT_PUBLIC_BASE_URL` | no | Override the server URL in the OpenAPI schema. |

## Smoke test (every endpoint)

```bash
# Production
GOAT_COMMAND_API_KEY=$(grep '^GOAT_COMMAND_API_KEY=' .env.local | cut -d= -f2) \
  ./scripts/goat-smoke.sh

# Local dev (npm run dev first)
GOAT_COMMAND_API_KEY=... ./scripts/goat-smoke.sh http://localhost:3000
```

The script exercises all 13 operations plus two negative checks (bad Bearer
token → 401, secret value sent to `prepare_secret_file` → 400) and exits
non-zero on any failure.

## GPT Builder setup

1. GPT → Configure → Actions → **Import from URL** →
   `https://legendsos.app/api/goat/openapi`.
2. Authentication: **API Key**, Auth Type **Bearer**, paste the
   `GOAT_COMMAND_API_KEY` value from `.env.local`.
3. Run the `get_health` test action — expect `status: "ok"`.

## Logging

Every request logs single-line JSON to the Netlify function logs with marker
`"src":"goat_api"`, a per-request `request_id` (also returned in the response
envelope), route, event, and status — so a failing GPT call can be traced by
its `request_id`.
