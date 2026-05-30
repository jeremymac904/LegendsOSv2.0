# STATUS — LegendsOS 2.0

## Current phase

Phase 0 → Phase 7 scaffold complete. Clean v2 foundation is in place.
`npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## UI/UX PowerPoint sprint — 2026-05-20

Source reviewed: `/Users/JeremyMcDonald/Downloads/LegendsOS UI_UX May 20th Audit 9pm (1).pptx`.

Completed in this pass:

- Global burnt/champagne gold brand tokens and more transparent liquid-glass
  cards, chips, buttons, active nav, shell, and login styling.
- Wider protected app shell so Dashboard, Training, Marketing Materials, LF
  Resources, and Settings use the available screen instead of feeling boxed in.
- Login page updated with larger logo, stronger command-center headline,
  centered HeyGen/video and desktop download lane, and refined gold styling.
- Training, Marketing Materials, and LF Resources now use internal detail routes
  before source links:
  - `/training/[resourceId]`
  - `/marketing-materials/[materialId]`
  - `/lf-resources/[resourceId]`
- Marketing Materials seeded with richer starter content for first-time
  homebuyer webinars, buyer guides, realtor guides, Real Estate AI seminars,
  newsletter templates, social campaign packs, open house material, handouts,
  outlines, and scripts.
- LF Resources seeded with internal guides for all required Loan Factory areas,
  with the provided Drive folder preserved as a secondary source link.
- Atlas defaults to chat focus with collapsible Projects and Resources panels,
  attachment-only send support, and clearer desktop/window capture guidance.
- Settings connection cards now open setup guidance panels with exact env names,
  owner/team actions, tutorial placeholders, and Setup Coach access.
- Owner preview mode now protects admin page guards through
  `getEffectiveProfile()`, rejects owner promotion through the user API update
  route, and audits DELETE-based impersonation stops.

Verification in this pass:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test:e2e` passed, 5/5 Playwright smoke tests.
- Authenticated Playwright pass verified `/dashboard`, `/training`,
  `/training/lf-training-folder`, `/marketing-materials`,
  `/marketing-materials/homebuyer-webinar-template`, `/lf-resources`,
  `/lf-resources/lf-training-folder`, `/settings`, `/atlas`, Settings setup
  panel click behavior, GPT help coach link target/rel attributes, and
  impersonation start/stop.
- `/login` verified locally for HTTP 200, welcome video iframe, and desktop
  download card.

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
- **Training** (`/training`) — team training, YouTube-safe embeds, training nuggets, and owner-managed shared training items.
- **Marketing Materials** (`/marketing-materials`) — templates, scripts, campaign packs, usage instructions, and owner-managed shared materials.
- **LF Resources** (`/lf-resources`) — Loan Factory resource directory seeded from Jeremy's provided Drive folder and owner-managed shared links.
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

## Desktop apps sprint — 2026-05-20

Native LegendsOS desktop shell shipped. Electron wrapper around the hosted
Next.js app (`https://legndsosv20.netlify.app`). Same login, same data —
just a native window + dock icon + Cmd-Q. Source under `electron/`,
build config in `package.json` `"build"`. See `docs/DESKTOP_APPS.md`.

- **Framework chosen:** Electron (Tauri requires Rust toolchain, not
  installed on Jeremy's machine; Electron lets us ship a working Mac DMG
  this sprint).
- **Scripts:** `desktop:dev`, `desktop:dev:local`, `desktop:build:mac`,
  `desktop:build:windows`, `desktop:rebuild-icon`.
- **Mac build:** unsigned `.dmg` produced locally for Apple Silicon + Intel.
  First-launch needs right-click → Open to clear Gatekeeper. Signing is a
  flip-the-env-vars exercise when an Apple Developer ID is provisioned.
- **Windows build:** config is platform-complete; binary requires a
  Windows host (or GitHub Actions `windows-latest`) — cross-build from Mac
  is intentionally not done.
- **Login page download UI:** three-state buttons (env URL → local
  `/downloads/*` fallback → "test build pending"). Version chip + "Web app
  also available" copy. Replaces the previous "Coming soon" placeholders.

## Legends Growth Academy + light mode sprint — 2026-05-22

First local execution of Q-003 from the master workspace queue. Three tracks shipped on branch `feat/legends-growth-academy-and-light-mode-phase-1`. Local only — no commits, no push, no PR, no deploy.

### Track A — Legends Growth Academy scaffold (shipped)

- New static data: `lib/legends/curriculum.ts` (4 tracks, 22 module entries in Legends voice).
- New routes:
  - `/training/academy` — Academy landing.
  - `/training/academy/[track]` — Sales, Marketing, AI, Mastery tracks (SSG via `generateStaticParams`).
  - `/training/academy/[track]/[module]` — module detail (SSG; 22 prerendered paths).
  - `/training/scripts`, `/training/roleplay`, `/training/audio` — catalog-only preview pages.
- New components:
  - `components/training/AcademyTrackCard.tsx`
  - `components/training/ModuleListItem.tsx`
  - `components/training/LegendsAssistantsCatalog.tsx`
- Nav: single `Legends Academy` row added under the Team section. Sub-routes are reached from the Academy landing, not the sidebar — keeps nav simple.
- Existing `/training` page is unchanged.

### Track B — Light mode tokens + toggle (shipped)

- `app/globals.css` extended with a `.light` token block (atmospheric values flip; brand accents stay constant) and component-level `.light` overrides for `.card`, `.btn-*`, `.input`, `.textarea`, `.chip*`, `.nav-item*`, `.divider`, `.section-title`.
- `app/layout.tsx`: removed the hardcoded `bg-ink-950 text-ink-100` on `<body>` (replaced with `dark:` variants so dark mode is bit-identical). Added FOUC-safe boot script in `<head>` that applies `light` or `dark` to `<html>` before paint.
- New `lib/theme.ts` exports `THEME_STORAGE_KEY`, `THEME_BOOT_SCRIPT`, `resolveInitialTheme`, `isLegendsTheme`.
- New `components/ui/ThemeProvider.tsx` (client context, keeps `<html>` class in sync, persists to localStorage).
- New `components/ui/ThemeToggle.tsx` — Sun/Moon icon button.
- `components/shell/TopBar.tsx` mounts `<ThemeToggle />` left of the bell.

### Track C — Three Legends Atlas assistants (catalog only)

- New `lib/legends/assistants.ts` — typed catalog of:
  - `legends-coach` (default)
  - `legends-lo-support`
  - `legends-marketing`
  Each entry carries display copy, scope, refuses list, grounding-source list, and a draft system prompt with the standard Legends compliance footer baked in.
- New `supabase/seeds/legends_assistants.sql` — manual seed for the day Jeremy approves wiring. Intentionally NOT referenced by `supabase/migrations/`. Inserts `is_active = false` rows.
- `LegendsAssistantsCatalog` card surfaces the three on `/training/academy` with a clear "Not yet wired" badge. No edits to `AtlasWorkspace`, no live model calls, no Supabase writes from app code.

### Validation

- `npm install`     ✓ 744 packages
- `npm run lint`    ✓ no warnings or errors
- `npm run typecheck` ✓ exit 0
- `npm run build`   ✓ all routes built; new SSG prerendered 4 track pages + 22 module pages
- HTTP probe with `curl` (dev server on `:3030`):
  - `/api/health` 200 ✓
  - `/login`, `/setup` 200 ✓
  - `/training/academy`, `/training/academy/sales`, `/training/academy/sales/sales-101`, `/training/scripts`, `/training/roleplay`, `/training/audio`, `/atlas`, `/dashboard` all 307 → `/setup` (Supabase not configured in this clean clone) ✓
- Browser screenshots in `.playwright-mcp/legends-sprint-2026-05-22/`:
  - `login-dark.png`, `login-light.png`
  - `setup-dark.png`, `setup-light.png`
- Theme runtime check: `localStorage.legendsTheme` persists across reloads; `<html>` class switches between `dark` and `light`; `getComputedStyle(body).backgroundColor` returns `rgb(5, 6, 10)` in dark and `rgb(248, 249, 252)` in light.
- Smoke tests extended (`tests/e2e/smoke.spec.ts`) — 9 new academy route checks + 2 theme checks added. Existing 5 tests untouched. Playwright browsers not installed in this clean clone, so Playwright suite not executed in this pass; existing 5 + new 11 tests are static-analyzed (lint + typecheck) only.

### Known issues / acceptable visual debt

- `/login` hero card has its own bg-image styling that still leans dark in light mode. Not a blocker — the body, surrounding cards, and login form all render correctly in both themes.
- Pages outside the Academy still use raw `text-ink-XXX` / `bg-ink-XXX` Tailwind classes inline. Components inside `.card`, `.btn-*`, `.chip*`, `.nav-item*` flip cleanly; pages with raw ink classes may look dark-leaning in light mode. Per the Phase 1 plan, this is acceptable visual debt for the toggle landing — Phase 2 will rewrite those route-by-route.
- Full Academy UI cannot be visually verified inside this clean clone without a Supabase env. Build, types, lint, route resolution, and theme infrastructure are all verified. Live Academy UI walkthrough requires Jeremy to supply `NEXT_PUBLIC_SUPABASE_URL` and a test user; this is intentional — no `.env` files were created.

### Production safety

- No commits, no push, no PR, no Netlify trigger.
- No `.env` writes; the new clone has no `.env.local`.
- No live AI calls (provider gate `ALLOW_PAID_TEXT_GENERATION` still false).
- No n8n triggers.
- No live email, social, or calendar sends.
- No live Supabase writes — `legends_assistants.sql` is a manual seed only.

## Last updated

2026-05-22
