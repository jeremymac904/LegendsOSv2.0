# Actions — LegendsOS Marketing Image Coach

## Recommendation: NO ACTIONS in this release

This GPT generates **prompts**, not images. The image generation work
happens inside LegendsOS Image Studio, which is a Supabase-authenticated
surface that a public GPT cannot reach safely.

## Why not

- **Image generation costs money.** `/api/ai/image` is gated by
  `ALLOW_PAID_IMAGE_GENERATION` and requires an authenticated user. A GPT
  cannot carry the user's Supabase cookie session.
- **No safe anonymous read endpoint adds value here.** The GPT already
  knows the brand presets, aspect ratios, and prompt templates from
  knowledge files. There's nothing useful to fetch live without auth.
- **Actions can't hold secrets safely.** Any key embedded in the GPT is
  visible to anyone who can talk to the GPT.

## Safe read-only endpoints that COULD be added later

If Jeremy ever wants Actions on this GPT, these would be the safe
candidates *after* LegendsOS adds anonymous, rate-limited, JSON-only
routes:

| Proposed endpoint | What it returns | Why it's safe |
|---|---|---|
| `GET /api/coach/image-prompt-templates` | A flat list of `{ id, title, prompt, platform, aspect }` items | Static content |
| `GET /api/coach/brand-presets` | Names + descriptions of LegendsOS Image Studio brand presets | No secrets, no user data |
| `GET /api/coach/aspect-ratios` | Map of platform → recommended aspect ratio | Trivial reference data |
| `GET /api/coach/compliance-snippets` | NMLS / APR / substantiation snippets the GPT should append | Static disclosures |

Each would need:
- `Cache-Control: public` with a short max-age.
- Strict rate-limiting (e.g. 60 req/min/IP).
- No secrets in payload.
- No user identification.
- Published OpenAPI schema.

Until those endpoints exist, **Actions stay off** for this GPT.

## If Jeremy ever wants to enable Actions

When the endpoints above are live, drop in:

- `actions/openapi_schema.json` (machine-readable spec)
- `actions/ACTIONS_SETUP_GUIDE.md` (how to add to GPT Builder)

Auth header for the proposed routes: **none** (they are public read-only by design).

Until then, this file IS the action documentation.
