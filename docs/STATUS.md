# STATUS — LegendsOS 2.0

## Current phase

Phase 0 → Phase 7 scaffold complete. Clean v2 foundation is in place.
`npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Completed

### Repository & tooling
- Clean Next.js 14 (App Router) + TypeScript + Tailwind app at repo root.
- ESLint, PostCSS, Autoprefixer, Tailwind config with brand palette and components.
- `.env.example` documents every server and client env var.
- `netlify.toml` ready for Netlify with Next.js plugin, security headers.
- `.gitignore`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts` ready.

### Supabase
- Migration 1 (`init_schema`): 19 tables + `provider_credentials_public` view, 11 enums, `updated_at` triggers, helper functions (`current_role`, `is_owner`, `is_admin_or_owner`, `current_org_id`).
- Migration 2 (`rls_policies`): RLS enabled on every table; per-row owner/self policies; column-level revoke on `provider_credentials.encrypted_secret`.
- Migration 3 (`storage_buckets`): 4 buckets (`uploads`, `knowledge`, `generated_media`, `shared_resources`) with per-user folder policies.
- Migration 4 (`bootstrap`): default Legends org, `auth.users → profiles` trigger, owner auto-promotion for `NEXT_PUBLIC_OWNER_EMAIL`, `promote_owner(email)` helper, provider rows seeded.

### App shell
- Protected `(app)` layout group with Sidebar + TopBar + MobileNav.
- Role-aware navigation (`lib/navigation.ts`, `lib/permissions.ts`).
- `middleware.ts` enforces auth on every protected path; redirects to `/setup` if Supabase env missing.
- Auth pages: `/login` (password + magic-link), `/auth/callback`, `/setup`.

### Modules (UI + DB wiring)
- **Command Center** (`/dashboard`) — stats, quick launch, recent chats, provider status, drafts, imagery, owner-only automation table.
- **Atlas Chat** (`/atlas`, `/atlas/[threadId]`) — threads list, full conversation view, AtlasChatClient with attachments + provider toggle.
- **Source Knowledge** (`/knowledge`, `/knowledge/[collectionId]`) — private + team-shared collections, item creation, recent items.
- **Shared Resources** (`/shared`) — owner-managed prompts/templates/assets visible to all members.
- **Social Studio** (`/social`, `/social/[postId]`) — composer with 4 channels, schedule, queued automation job.
- **Image Studio** (`/images`) — brand presets, aspect ratio picker, Fal.ai generation, library grid.
- **Email Studio** (`/email`, `/email/[campaignId]`) — composer with draft/approve/request-send, status pills.
- **Calendar** (`/calendar`) — merged view of calendar items, scheduled social posts, scheduled emails.
- **Admin Center** (`/admin`, `/admin/users`, `/admin/usage`) — owner-only; team list, usage rollups, audit log, automation queue.
- **Settings** (`/settings`) — profile, safety flags, provider gateway snapshot, compliance line preview.

### AI Provider Gateway
- `lib/ai/providers.ts` — OpenRouter, DeepSeek, NVIDIA chat; Fal.ai image; system prompt with compliance line; normalized error shape.
- `/api/ai/chat` — auth check, daily cap enforcement, thread + message persistence, usage logging.
- `/api/ai/image` — auth, daily cap, queued media row, library writeback.
- `/api/ai/status` — provider configuration snapshot.

### Automation layer
- `lib/automation/n8n.ts` — HMAC-signed webhook dispatch with `dispatch=false` by default.
- `/api/social` — persist post, optionally enqueue social_publish job, audit log.
- `/api/email` — persist campaign, optionally enqueue email_send job, audit log.
- `/api/automation/callback` — HMAC-verified callback that updates jobs and propagates status to social_posts / email_campaigns.

### Safety
- Hard gates on live external actions via `ALLOW_LIVE_SOCIAL_PUBLISH`, `ALLOW_LIVE_EMAIL_SEND`, `ALLOW_PAID_IMAGE_GENERATION`, `ALLOW_PAID_TEXT_GENERATION` — default `false`.
- Provider secrets never reach the browser. UI reads from `provider_credentials_public` view only.

### Documentation
- `README.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/AUTOMATION.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/NEXT_ACTIONS.md`, `docs/CHANGELOG.md`.

## In progress

Nothing actively in progress at end of this pass.

## Blocked

Nothing technically blocked. Live action enabling depends on Jeremy explicitly setting:
- `OPENROUTER_API_KEY` + `ALLOW_PAID_TEXT_GENERATION=true`
- `FAL_KEY` + `ALLOW_PAID_IMAGE_GENERATION=true`
- `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, individual webhook URLs + `ALLOW_LIVE_*` flags

## Verification (this pass)

- `npm install` ✓
- `npx tsc --noEmit` ✓ exit 0
- `npm run lint` ✓ no warnings or errors
- `npm run build` ✓ 18 routes, middleware compiled, no errors
- Playwright config + smoke test authored (not yet run; requires browser install)

## Next highest value task

1. Push to `github.com/jeremymac904/LegendsOSv2.0`.
2. Create Supabase project, apply migrations 1–4 in order.
3. Wire env vars in Netlify and deploy.
4. Sign in with `jeremy@mcdonald-mtg.com` and confirm `/dashboard` renders for the owner role.
5. After verification, run the DeepSeek and Codex prompts from the source pack against the new repo.

## Risks

- **Owner auto-promotion** depends on the bootstrap migration being applied before first login. If a user signs up before migration runs, run `select public.promote_owner('jeremy@mcdonald-mtg.com');` manually.
- **Daily caps** use a 24h rolling window via `usage_events`. If the table is heavily seeded with old test data, caps may misfire; truncate test data before going live.
- **Compliance line** is auto-applied in the Atlas system prompt; the social and email composers expect the user to paste it manually for now (planned for next pass via the `shared_resources` template loader).
- **No email HTML rendering yet** — campaigns persist plaintext; HTML body field exists but UI is text-only this pass.

## Last updated

2026-05-12
