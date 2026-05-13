# CHANGELOG

## Unreleased

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
