# CHANGELOG

## Unreleased

### Added — 2026-05-20 (Atlas Hermes Workspace 2 sprint)

- **Shared Atlas type contract.** New `lib/atlas/types.ts` is the single
  source of truth for `AtlasRouter`, `AtlasPlanStep`, `AtlasToolMetaKind`,
  `AtlasToolResultMeta`, `AtlasMessageMetadata`, `AtlasConnector`,
  `AtlasConnectorStatus`, `AtlasAuditEntry`, plus per-variant payloads
  (`AtlasMortgageCalcPayload`, `AtlasLoanComparisonPayload`,
  `AtlasLeadSummaryPayload`, `AtlasTriggerAutomationPayload`). Backend
  writers (`/api/ai/chat`, tool router) and UI readers (`AtlasShell` and
  the new panels/cards) all import from this file — no inline shapes.
- **Atlas connector registry (Supabase).** New migration
  `supabase/migrations/20260520000000_atlas_connectors.sql` introduces
  `public.atlas_connectors` (id, name, type, status, config_json,
  owner_id, organization_id, created_at, updated_at). RLS: owner full
  access; org members read connectors visible to their org;
  insert/update/delete owner-only. Seeded rows: `n8n` (active),
  `zapier_mcp` (coming_soon), `telegram` (active). `config_json` carries
  ENV VAR NAMES only — never secret values.
- **Atlas connector APIs.** New routes:
  - `GET /api/atlas/connectors` — RLS-scoped list.
  - `POST /api/atlas/connectors` — owner-only register (audited).
  - `PATCH /api/atlas/connectors/[id]` — owner-only status/config update
    (audited, 404 when missing).
  - `GET /api/atlas/audit` — last 25 audit entries (owner sees all, others
    see their own actions). Returns the `AtlasAuditEntry` shape.
  All routes are `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  auth-checked, JSON-only.
- **n8n MCP bridge.** New `lib/automation/n8n-bridge.ts` exposes
  `triggerWorkflow(workflowId, payload)`, `getWorkflowStatus(executionId)`,
  `listAvailableWorkflows()` plus a typed `WORKFLOW_CATALOG` with
  `is_live_action` markers + matching `ALLOW_LIVE_*` gates. Returns
  `TriggerResult` shaped `{ status, workflow_id, workflow_label,
  execution_id, message }`. No HMAC (n8n accepts plain JSON). Missing
  env → `not_configured`; live-action with gate off → `stub`; fetch
  failure → `failed`. Never logs env values.
- **Zapier MCP placeholder.** New `lib/automation/zapier-mcp.ts` exports
  typed stubs `triggerZap` / `getZapStatus` that always return
  `{ status: 'not_configured', message: 'Zapier MCP not yet connected' }`.
  Registered in the connector seed as `zapier_mcp` (`coming_soon`).
- **Atlas runtime extensions.** `lib/atlas/intentDetection.ts` gains a
  `trigger_automation` intent (matches "run/trigger/fire/kick off/execute
  the X automation/workflow/webhook/job"). `lib/atlas/toolRouter.ts`
  extends `AtlasToolKind` with `trigger_automation` and a branch that
  calls `n8n-bridge.triggerWorkflow`, audits every dispatch (including
  `stub` and `not_configured`), and returns the structured
  `AtlasTriggerAutomationPayload`. `/api/ai/chat` now stamps
  `metadata.router` (`provider` | `tool` | `n8n` | `zapier` | `knowledge`),
  `metadata.knowledge_used`, `metadata.knowledge_hits`, and
  `metadata.knowledge_sources` on every persisted assistant message.
- **Atlas Workspace 2 UI (3-column command surface).** `AtlasShell.tsx`
  is rewrapped in a responsive 3-column layout:
  - **Left rail (lg+):** `ConnectorPanel` (fetches `/api/atlas/connectors`,
    status pills + tier badge, "Coming soon" toast for placeholders),
    `ToolManifestPanel` (static inventory of every Atlas tool with
    tooltips), `PipelineWidget` / `RateSheetWidget` / `LeadActivityFeed`
    (clearly labeled sample data with `data-mock="true"`),
    `CalculatorShortcut` (inline collapsible mortgage-calc form that
    fills or sends the canned prompt).
  - **Center:** `QuickActionsBar` (Rate Sheet, Lead Status, Draft Email
    → `/email?new=1`, Trigger Automation) above the existing thread +
    composer.
  - **Right rail (lg+, collapsible):** `PlannerPanel` (renders
    `metadata.plan_steps` with status icons), `AuditPanel` (lazy fetch
    of `/api/atlas/audit`, collapsed by default).
  - **Mobile:** rails collapse to drawer toggles in the topbar; Quick
    Actions bar always visible.
- **Atlas message chrome.** Every assistant message now displays a
  `RouterChip` ("via AI" / "via tool" / "via n8n" / "via Zapier" / "via
  knowledge"), a `KnowledgeBadge` when grounded in retrieval, and the
  extracted `ToolResultCard` with variant rendering for every
  `AtlasToolMetaKind` — including new variants:
  - `mortgage_calc` → 4-stat grid (principal / rate / term / payment)
  - `loan_comparison` → comparison table with highlights
  - `lead_summary` → avatar + detail rows
  - `trigger_automation` → status pill + execution id + message
- **Premium dark-glass styling preserved.** Workspace 2 reuses existing
  tokens (`.card`, `.btn-*`, `.chip`, `text-gold-gradient`,
  `shadow-glow-sm`, `shadow-glass`, ink/accent palette). No new globals,
  no new fonts, no new deps. Gold (#C8960C-equivalent) reserved for
  primary headers, router/knowledge chips, and CTAs.

### Verification (this sprint)

- `npx tsc --noEmit`   ✓ exit 0
- `npm run lint`       ✓ exit 0 (no warnings or errors)
- `npm run build`      ✓ 44 routes (3 new: `/api/atlas/audit`,
  `/api/atlas/connectors`, `/api/atlas/connectors/[id]`); middleware
  81.5 kB; static + dynamic generation clean.

### Out-of-scope / next pass

- Authenticated visual verification (Playwright against `/atlas` with
  the new 3-column layout) — pending Jeremy's sign-in pass.
- Provider-side OpenAI-style tool-calling for `trigger_automation`
  (today it fires via the deterministic intent router; can graduate to
  a provider tool-call later without breaking the contract).
- Real `leads` table wiring for `PipelineWidget` /
  `LeadActivityFeed` (today they render labeled sample data).
- The `atlas_connectors` migration must be applied to the Supabase
  project before the connector panel and its APIs return live data.

### Added — 2026-05-14 (premium command-center sprint, commit `2b93c40`)

- **Atlas Hermes-style tool router.** New `lib/atlas/intentDetection.ts`
  + `lib/atlas/toolRouter.ts`. `/api/ai/chat` now detects intents
  (`create_social`, `create_email`, `create_calendar`) before calling
  the provider chain. On a hit, the router inserts a draft into
  `social_posts` / `email_campaigns` / `calendar_items` via the
  user-scoped Supabase client, logs a `tool_call` usage event +
  `recordAudit` entry, and persists an assistant chat message with
  `metadata.tool_result`. `AtlasShell` renders a `ToolResultCard` chip
  with an "Open →" link to the new item. Viewers blocked; non-tool
  messages preserve full retrieval / caps / persistence behavior.
- **Email Studio polish.** Audience picker now persists across
  reopen (stored in `metadata.audience_id`, legacy
  `recipient_list "audience:<uuid>"` honored as a fallback). New AI
  Write button calls `/api/ai/chat` with a newsletter prompt,
  defensive Content-Type parse, friendly inline notes for
  `cap_exceeded` / `provider_disabled`. Inbox preview rendered through
  `lib/email/render.ts` in a sandboxed iframe (max-w 600px, debounced
  250ms) matching the dashboard's "Latest newsletter" treatment.
- **Calendar campaign planning.** `app/(app)/calendar/page.tsx` is
  now an async server component reading `?month=YYYY-MM` and
  `?filter=all|social|email|cal`. New `CalendarMonthGrid` (color-
  coded chips per source, today cell ringed in gold, "+N more"
  overflow, prev/next/today nav) and `CalendarFilters` (chip
  toggles). Upcoming next 7 days flat list below the grid.
  `CreateCalendarItem` spacing tightened to match polished surfaces.
- **Premium dark gold glass shell.** `app/globals.css`,
  `tailwind.config.ts`, every `components/ui/*` primitive and shell
  surface refined: glass cards with backdrop-blur + hairline gold
  top edge + hover glow; tightened `.btn-primary` / `.btn-secondary`
  / `.btn-ghost`; uniform `.chip` height; `.nav-item-active` 2px
  gold left rail; sidebar Atlas-style header with gold rune dot;
  TopBar glass band; MobileNav gold-gradient FAB; login is a centered
  glass card with ambient gold wash. New `shadow-glow-sm` +
  `shadow-glass` tokens. All semantic class names preserved.
- **Dashboard expansion.** Two new side-by-side cards after the
  Latest newsletter section: "Upcoming content" merges next-7-day
  scheduled rows across social / email / calendar with color-coded
  source chips, sorted ascending, capped at 6. "Recent activity"
  surfaces the last 10 usage events from the existing 24h read with
  friendly module + action labels. Both fall back to polished empty
  states.

### Verification (this commit)

- `npm run lint`     ✓ no warnings or errors
- `npx tsc --noEmit` ✓ exit 0
- `npm run build`    ✓ 20 routes, middleware 81.6 kB
- Live `/login`      ✓ 200, new polish landed (Playwright snapshot +
                       full-page PNG saved to
                       `.playwright-mcp/login-verified.png`)
- Live `/api/health` ✓ `{ ok: true, supabaseConfigured: true }`
- All 11 protected routes return 307 → `/login?from=<path>`
  (middleware OK).

### Added — 2026-05-13 (completion sprint)

- **Atlas JSON parse fix.** `lib/supabase/middleware.ts` now returns a JSON
  401 for `/api/*` and any `Accept: application/json` request when the user
  isn't signed in, instead of redirecting to `/login` HTML. Atlas (and any
  other JSON client) no longer trips over `Unexpected token '<'`.
- **Atlas defensive client parsing.** `components/atlas/AtlasShell.tsx`
  checks `Content-Type` before calling `.json()` and surfaces a plain
  English error otherwise. Friendly error mapping for `unauthenticated`,
  `cap_exceeded`, `provider_disabled`. Same defensive parse added to
  `components/social/SocialComposer.tsx`.
- **Social Studio live preview.** New `components/social/PostPreview.tsx`
  renders Facebook / Instagram / GBP / YouTube channel-specific cards next
  to the composer as you type. Character count chip flips red when over
  the tightest selected channel's limit. Status chip shows Draft /
  Scheduled (+ time) / Posted. See `docs/SOCIAL_STUDIO_PREVIEW.md`.
- **YouTube title field.** Conditional field that appears only when
  YouTube is in the selected channels. Required for submission. Max 100
  chars (YouTube's hard cap). Stored in `social_posts.metadata.youtube_title`
  + forwarded to n8n's `social_publish` payload.
- **Asset Library upload.** New `/admin/assets` upload card +
  `POST /api/admin/assets`. Files land in the `shared_resources` Storage
  bucket; metadata rows in `shared_resources` table (`resource_type` =
  `asset_image|asset_document|asset_video`). Supports png/jpg/jpeg/webp,
  pdf/docx/pptx/md/txt/csv/json, mp4/mov/webm. Up to 50 MB.
- **Asset Library + Studios cross-wiring.** `lib/admin/orgAssets.ts`
  exposes `loadOrgUploadedAssets()` / `loadOrgUploadedImageAssets()`.
  Image Studio + Social Studio pickers now surface uploaded assets
  alongside the static `public/assets/manifest.json` entries.
- **Knowledge upload polish.** `KnowledgeUploadCard` now accepts pptx +
  json. Plain-text formats (md / txt / csv / json) are extracted in the
  browser and stored in `knowledge_items.content` so Atlas retrieval
  matches them via keyword. New `QuickUploadPicker` on `/knowledge` lets
  you drop files into any writable collection without navigating in.
- **User management.** `/admin/users` becomes a fully working manager.
  Add user (Auth Admin API), change role, deactivate (with auth-level
  ban), reset password (returns recovery link to copy/share). All writes
  via `app/api/admin/users/route.ts` server-side; service-role key never
  reaches the browser. See `docs/USER_MANAGEMENT.md`.
- **Role expansion.** Migration `20260513000000_extend_user_roles.sql`
  adds `processor`, `marketing`, `viewer` to the `user_role` enum. Two
  new SECURITY DEFINER helpers (`set_user_role`, `set_user_active`) for
  programmatic role + active state changes.
- **Owner preview-as-user.** UI-only impersonation via an HttpOnly
  cookie (`legendsos-impersonate`). `lib/impersonation.ts` resolves the
  effective profile; protected layout renders a sticky orange banner
  while active. Audit-logged on start + stop. Database reads still run
  as the real owner — this is for verifying role-gated views, not RLS
  enforcement.

### Added — 2026-05-12

- Clean Next.js 14 (App Router) + TypeScript + Tailwind scaffold.
- Supabase migration set (init_schema, rls_policies, storage_buckets, bootstrap).
  - 19 application tables, 1 public view (`provider_credentials_public`).
  - 11 enums, helper functions (`current_role`, `is_owner`, `is_admin_or_owner`,
    `current_org_id`).
  - RLS enabled on every table; per-row owner/self policies.
  - Column-level revoke on `provider_credentials.encrypted_secret`.
  - 4 storage buckets with per-user folder policies.
  - Default Legends organization, signup trigger, owner auto-promotion,
    `promote_owner(email)` helper.
- Supabase client/server/middleware helpers respecting RLS.
- Brand-aligned Tailwind theme (ink + accent palette, card / chip / button
  primitives, ember-radial backgrounds).
- Protected `(app)` route group with Sidebar + TopBar + MobileNav.
- Role-aware navigation gated by `lib/permissions.ts`.
- All eight in-scope modules scaffolded with working data wiring:
  Command Center, Atlas Chat, Source Knowledge, Shared Resources,
  Social Studio, Image Studio, Email Studio, Calendar, Admin Center, Settings.
- AI Provider Gateway with OpenRouter / DeepSeek / NVIDIA chat and Fal.ai
  image routes. Server-only, normalized error shape, daily caps, usage logging.
- n8n automation layer (`lib/automation/n8n.ts`) with HMAC-signed dispatch,
  queue-by-default behavior, HMAC-verified `/api/automation/callback`.
- Safety env flags hard-blocking all paid / live external actions until
  explicitly enabled.
- Audit log helper (`recordAudit`) wired into social publish and email send
  request paths.
- Netlify configuration with Next.js plugin and security headers.
- Documentation: README, SETUP, ARCHITECTURE, SECURITY, AUTOMATION, STATUS,
  HANDOFF, NEXT_ACTIONS, CHANGELOG.
- Playwright smoke test scaffold (`tests/e2e/smoke.spec.ts`).

### Security

- Provider secrets never exposed to the browser. Clients read the
  `provider_credentials_public` view only.
- `profiles_self_update` policy prevents self-promotion (role forced to match
  the existing role).
- Owner-only RLS on `audit_logs` and base `provider_credentials` table.
- HMAC-SHA256 signing on all outbound n8n webhooks; same scheme verified on
  inbound callbacks.

### Removed (versus v1)

- All Docker, Cloudflare, Onyx, Hermes-injected-shell, subdomain-studio
  patterns. None of those concepts exist in this repo.
- No Blog Studio, LoanFlow, Mortgage Ops, Borrower Portal, Realtor Portal,
  or Public Intake modules.
- No approval queue table, compliance review layer, feature flags table,
  quota table, or contact-list system (per the source-of-truth pack).
