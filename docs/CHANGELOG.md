# CHANGELOG

## Unreleased

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
