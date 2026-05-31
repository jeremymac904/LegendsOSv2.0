-- LegendsOS v2 — Live Integration Connections data model (Sprint 4)
-- ---------------------------------------------------------------------------
-- NOT auto-applied — owner applies via Supabase after review.
-- ---------------------------------------------------------------------------
-- Tracks the HONEST status of each external integration (Gmail, Drive,
-- Calendar, social platforms, ...) without ever storing raw secrets in a
-- client-readable column. Every status is real: 'not_connected' until the
-- user actually authorizes; social publishing stays DISABLED (owner switch
-- default false) until explicitly turned on.
--
-- TOKEN POLICY (hard rule):
--   * NO raw OAuth token / API key / refresh token is stored in any column a
--     client can read. The metadata jsonb here is for NON-secret display data
--     only (account email shown to the user, scope labels, last sync time).
--   * If a real token must be persisted later, it goes in a SEPARATE
--     service-role-only table/column (e.g. *_secrets with RLS denying all
--     client access) — NOT added here. Do not add a client-readable token
--     column to these tables.
--
-- SAFETY: No live sends/publishes are enabled by this schema. No PII seeded.
-- snake_case tables; timestamptz UTC. Idempotent. RLS in the companion
-- *_integrations_rls.sql file.
-- ---------------------------------------------------------------------------

set search_path = public;

create extension if not exists "pgcrypto";

-- Defensive shared updated_at trigger fn (also defined by earlier migrations).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =======================================================================
-- user_integration_connections — per-user connection status for a provider.
-- NO raw token column readable by clients. status is honest: defaults to
-- 'not_connected' until the user actually authorizes.
-- =======================================================================
create table if not exists public.user_integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  -- Free text so new providers don't require a migration
  -- (e.g. 'gmail','google_drive','google_calendar','facebook','instagram').
  provider text not null,
  status text not null default 'not_connected' check (status in (
    'not_connected','connected','needs_setup','error','revoked','disabled'
  )),
  -- Granted OAuth scope labels (NON-secret display data only).
  scopes text[] not null default '{}'::text[],
  connected_at timestamptz,
  last_checked_at timestamptz,
  -- NON-secret display metadata ONLY (e.g. connected account email, sync
  -- timestamps). NEVER store tokens/keys here.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
comment on table public.user_integration_connections is 'Per-user integration connection STATUS only (honest: not_connected until authorized). metadata holds NON-secret display data; raw tokens/keys are NEVER stored here — a future token store is a separate service-role-only table.';

-- =======================================================================
-- integration_audit_log — owner/admin-readable audit of integration actions
-- (connect, disconnect, status-check, publish-enable, ...). INSERTS are
-- service_role only (no client insert policy).
-- =======================================================================
create table if not exists public.integration_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  provider text,
  target_type text,
  target_id uuid,
  source_url text,
  -- NON-secret detail only.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.integration_audit_log is 'Append-only audit log of integration actions. owner/admin read; inserts via service_role only (no client insert policy). NON-secret detail only.';

-- =======================================================================
-- social_account_connections — org-level connected social accounts/pages.
-- is_publish_enabled is the owner-approval switch: DEFAULT FALSE. Live
-- publishing stays disabled until the owner explicitly turns it on.
-- =======================================================================
create table if not exists public.social_account_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  -- Free text platform (e.g. 'facebook','instagram','google_business_profile',
  -- 'youtube') so a new platform doesn't require a migration.
  platform text not null,
  -- Display ref for the connected account (handle / name). NON-secret.
  account_ref text,
  page_id text,
  status text not null default 'not_connected' check (status in (
    'not_connected','connected','needs_setup','error','revoked','disabled'
  )),
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz,
  -- Owner-approval gate. DEFAULT FALSE: no live publishing until enabled.
  is_publish_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, page_id)
);
comment on table public.social_account_connections is 'Org-level connected social accounts/pages. is_publish_enabled defaults FALSE — live publishing stays disabled until the owner explicitly approves. No tokens stored here.';

-- =======================================================================
-- publish_attempts — record of each attempt to publish a social post.
-- owner/admin read; service_role insert. Honest status: 'queued' default,
-- never claims 'published' unless a real route confirmed it.
-- =======================================================================
create table if not exists public.publish_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  social_post_id uuid references public.social_posts(id) on delete set null,
  platform text,
  -- Which route was used / would be used (e.g. 'n8n','direct','manual').
  route text,
  status text not null default 'queued' check (status in (
    'queued','disabled','sending','published','failed','cancelled'
  )),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.publish_attempts is 'Append-only record of social publish attempts. owner/admin read; service_role insert. status is honest — never published unless a real route confirmed it.';

-- ---- updated_at triggers ----------------------------------------------
drop trigger if exists trg_user_integration_connections_updated on public.user_integration_connections;
create trigger trg_user_integration_connections_updated before update on public.user_integration_connections
  for each row execute function public.set_updated_at();
drop trigger if exists trg_social_account_connections_updated on public.social_account_connections;
create trigger trg_social_account_connections_updated before update on public.social_account_connections
  for each row execute function public.set_updated_at();

-- ---- indexes ----------------------------------------------------------
create index if not exists idx_uic_user on public.user_integration_connections(user_id);
create index if not exists idx_uic_org on public.user_integration_connections(organization_id);
create index if not exists idx_uic_provider on public.user_integration_connections(provider);
create index if not exists idx_uic_status on public.user_integration_connections(status);
create index if not exists idx_ial_org on public.integration_audit_log(organization_id);
create index if not exists idx_ial_actor on public.integration_audit_log(actor_id);
create index if not exists idx_ial_provider on public.integration_audit_log(provider);
create index if not exists idx_ial_created_at on public.integration_audit_log(created_at desc);
create index if not exists idx_sac_org on public.social_account_connections(organization_id);
create index if not exists idx_sac_platform on public.social_account_connections(platform);
create index if not exists idx_sac_publish_enabled on public.social_account_connections(is_publish_enabled);
create index if not exists idx_pa_org on public.publish_attempts(organization_id);
create index if not exists idx_pa_post on public.publish_attempts(social_post_id);
create index if not exists idx_pa_status on public.publish_attempts(status);
create index if not exists idx_pa_created_at on public.publish_attempts(created_at desc);
