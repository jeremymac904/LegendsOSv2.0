# Actions — LegendsOS Setup Coach

## Recommendation: NO ACTIONS in this release

This GPT does not need GPT Actions. The knowledge files are sufficient
for a setup walkthrough. Adding Actions right now would expand attack
surface without adding value.

## Why not

- **No anonymous read endpoint exists today** that the GPT could call.
  - `/api/health` is public but only returns `{ ok, supabaseConfigured, time }` — not useful for setup coaching.
  - `/api/ai/status`, `/api/integrations/status`, `/api/atlas/connectors`, `/api/admin/*` all require an authenticated user session. A GPT cannot carry a user's cookie session.
- **GPT Actions cannot hold secrets safely.** Any API key embedded in the GPT becomes visible to anyone who can talk to the GPT. We do not embed keys.
- **No live actions are appropriate here.** This GPT does not send email, publish social, or activate workflows. That guardrail is intentional.

## Safe read-only endpoints that COULD be added later (server-side work first)

If Jeremy wants to add GPT Actions in a future release, these endpoints
would be safe candidates *after* LegendsOS adds an anonymous, rate-limited,
JSON-only route that does NOT leak provider keys or user data:

| Proposed endpoint | What it returns | Why it's safe |
|---|---|---|
| `GET /api/coach/setup-guide` | A flat JSON copy of the setup checklist (same content as `knowledge/LEGENDSOS_SETUP_OVERVIEW.md`) | Static content, no user data |
| `GET /api/coach/approved-credentials` | List of approved tool names and credential types (no secrets) | Static list |
| `GET /api/coach/provider-status` | `{ providerName: "configured" \| "missing" \| "disabled" }` per provider, env var NAME only, never values | No secrets ever |
| `GET /api/coach/tutorial-index` | List of `{ title, slug, url }` for each tutorial page | Public marketing-style content |
| `GET /api/coach/image-prompt-templates` | A few sample image prompts (also useful for the Marketing Image Coach) | Static |

Each would need:
- Server-side `Cache-Control: public` with a short max-age.
- Strict request-rate limiting (e.g. 60 req/min/IP).
- No secrets in payload.
- No user identification.
- A clearly published OpenAPI schema.

Until those endpoints exist, **Actions stay off** for this GPT.

## If Jeremy ever wants to enable Actions

When the endpoints above are live, drop in:

- `actions/openapi_schema.json` (machine-readable spec)
- `actions/ACTIONS_SETUP_GUIDE.md` (how to add the spec to GPT Builder, what auth header to set — which is **none** for the proposed routes)

Until then, this file IS the action documentation.
