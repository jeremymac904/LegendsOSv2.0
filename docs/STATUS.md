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

## Premium command-center sprint — 2026-05-14 (commit 2b93c40)

Lead integrator dispatched four parallel agents and merged the output.
Lint / typecheck / build all clean at 20 routes; live deploy serving the new
build (verified `text-gold-gradient` + "Your command center awaits" in the
live HTML; build id `bgSwkiYKKXnUYLkAT81dN`).

- **Atlas Hermes-style tool router** — `lib/atlas/intentDetection.ts` +
  `lib/atlas/toolRouter.ts`. `/api/ai/chat` now intercepts intents like
  "draft a Facebook post about X", "write a newsletter about Y",
  "schedule team standup on Monday" and inserts a draft row in the
  correct table, returns the link, audit-logs the call, and renders a
  ToolResultCard chip in Atlas. Non-tool messages preserve the full
  provider chain + retrieval behavior.
- **Email Studio** — audience picker persists on reopen (stored in
  `metadata.audience_id`, falls back to legacy `recipient_list "audience:<uuid>"`).
  AI Write button calls `/api/ai/chat`. Inbox preview rendered via
  `lib/email/render.ts` in a sandboxed iframe, debounced 250ms,
  matches the dashboard's "Latest newsletter" treatment.
- **Calendar** — server-rendered month grid with prev/next/today nav,
  All/Social/Email/Calendar filter chips, color-coded entry chips
  (orange social, gold email, gold-bordered ink calendar), "+N more"
  overflow, today cell ringed in gold. `?month=YYYY-MM` and `?filter=`
  drive state. Upcoming next 7 days flat list below the grid.
- **Premium dark gold glass shell** — `.card` / `.card-padded` have
  subtle backdrop-blur + hairline gold top edge + hover glow.
  `.btn-primary` has inset highlight + warm glow, `.btn-secondary` is
  glass with gold border, `.btn-ghost` gets a gold hover underline.
  `.chip` is uniform 24px. `.nav-item-active` has a 2px gold left rail.
  Sidebar gains an Atlas-style header with a gold rune dot + wordmark.
  TopBar is a glass band with a workspace dot. Login is a centered
  glass card with mobile wordmark + ambient gold wash.
- **Dashboard** — two new cards after Latest newsletter: "Upcoming
  content" (next 7 days merged across social/email/calendar) and
  "Recent activity" (last 10 usage events with friendly module +
  action labels). Both fall back to polished empty states.

## Verification (this pass)

- `npm run lint`        ✓ no warnings or errors
- `npx tsc --noEmit`    ✓ exit 0
- `npm run build`       ✓ 20 routes, middleware 81.6 kB
- Live `/login`         ✓ 200, new visual polish landed (Playwright
                          snapshot + full-page screenshot saved to
                          `.playwright-mcp/login-verified.png`)
- Live `/api/health`    ✓ `{ ok: true, supabaseConfigured: true }`
- Live protected routes (`/dashboard`, `/atlas`, `/social`, `/images`,
  `/email`, `/calendar`, `/knowledge`, `/admin`, `/admin/users`,
  `/admin/assets`, `/settings`) all 307-redirect to
  `/login?from=<path>` for unauthenticated GETs — middleware OK.

## Next highest value task

1. **Authenticated visual sweep.** Bring up Playwright against
   `/dashboard`, `/atlas`, `/social`, `/email`, `/calendar`,
   `/admin/users`, `/admin/assets` while signed in as
   `jeremy@mcdonald-mtg.com` and confirm the new glass treatment lands
   on every protected surface, plus exercise:
   - Atlas tool router: type a draft/social/calendar prompt and verify
     the ToolResultCard chip + the corresponding row appears in
     `social_posts` / `email_campaigns` / `calendar_items`.
   - Email AI Write: open a fresh draft, click AI Write, verify body
     populates and audience picker round-trips on reopen.
   - Calendar grid: schedule items across a week, verify chips render
     in the correct cells with correct color, and "+N more" works.
2. **Provider live test.** With `ALLOW_PAID_TEXT_GENERATION=true`,
   exercise an end-to-end Atlas chat and AI Write call against
   OpenRouter to confirm the gateway + caps behave under real load.
3. **Knowledge upload smoke.** Upload a PDF + a markdown file via
   `/knowledge` and verify Atlas retrieval surfaces the new content.

## Risks

- **Owner auto-promotion** depends on the bootstrap migration being applied before first login. If a user signs up before migration runs, run `select public.promote_owner('jeremy@mcdonald-mtg.com');` manually.
- **Daily caps** use a 24h rolling window via `usage_events`. If the table is heavily seeded with old test data, caps may misfire; truncate test data before going live.
- **Compliance line** is auto-applied in the Atlas system prompt; the social and email composers expect the user to paste it manually for now (planned for next pass via the `shared_resources` template loader).
- **Atlas tool router** uses keyword/regex heuristics for intent detection — high-precision on the patterns it knows, but unusual phrasings fall through to normal chat. Acceptable for the demo path; revisit with a small LLM classifier when traffic grows.
- **Authenticated visual verification not yet performed** for protected routes — code, types, and HTTP behavior are verified, but the new glass treatment on `/dashboard`, `/atlas`, etc. has not been visually confirmed yet (Jeremy will exercise this manually).

## Last updated

2026-05-14
