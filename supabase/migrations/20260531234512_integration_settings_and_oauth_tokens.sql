-- LegendsOS v2 — integration_settings + oauth_token_grants
-- ---------------------------------------------------------------------------
-- RECONCILIATION: these two tables were applied directly to the production
-- Supabase project (migration history entry "integration_settings_and_oauth_tokens",
-- version 20260531234512) but had NO committed migration file. This file
-- reconstructs them EXACTLY as they exist in prod so the repo and the database
-- agree and a fresh deploy is reproducible. Idempotent (CREATE ... IF NOT EXISTS)
-- so re-applying over the existing prod tables is a safe no-op.
--
-- integration_settings — the in-app, owner/user-controllable live-action toggles
--   (scope 'global' per org + scope 'user' per profile). safe_mode is a master
--   kill switch. Enforced server-side by lib/integrations/liveSettings.ts.
-- oauth_token_grants — SERVER-ONLY OAuth token store. RLS enabled with NO client
--   policies + privileges revoked from anon/authenticated => only the service
--   role can touch it. Access/refresh tokens NEVER reach a browser.
-- ---------------------------------------------------------------------------

set search_path = public;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =======================================================================
-- integration_settings — live-action toggles (global + per-user)
-- =======================================================================
create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('global','user')),
  live_email boolean not null default false,
  live_social boolean not null default false,
  live_calendar boolean not null default false,
  live_drive_write boolean not null default false,
  safe_mode boolean not null default false,
  provider_flags jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.integration_settings is 'In-app live-action toggles: scope=global (per org) carries org defaults + safe_mode master kill; scope=user (per profile) overrides. Enforced server-side. Safe defaults: all live_* false.';

drop trigger if exists trg_integration_settings_updated on public.integration_settings;
create trigger trg_integration_settings_updated
  before update on public.integration_settings
  for each row execute function public.set_updated_at();

create index if not exists idx_integration_settings_org on public.integration_settings(organization_id) where scope = 'global';
create index if not exists idx_integration_settings_user on public.integration_settings(user_id) where scope = 'user';

alter table public.integration_settings enable row level security;

drop policy if exists integration_settings_select on public.integration_settings;
create policy integration_settings_select on public.integration_settings
  for select using (
    ((scope = 'global') and (is_admin_or_owner() or (organization_id = current_org_id())))
    or ((scope = 'user') and (is_admin_or_owner() or (user_id = auth.uid())))
  );

drop policy if exists integration_settings_global_write on public.integration_settings;
create policy integration_settings_global_write on public.integration_settings
  for all
  using ((scope = 'global') and is_admin_or_owner())
  with check ((scope = 'global') and is_admin_or_owner());

drop policy if exists integration_settings_user_write on public.integration_settings;
create policy integration_settings_user_write on public.integration_settings
  for all
  using ((scope = 'user') and (is_admin_or_owner() or (user_id = auth.uid())))
  with check ((scope = 'user') and (is_admin_or_owner() or (user_id = auth.uid())));

-- =======================================================================
-- oauth_token_grants — SERVER-ONLY token store (no client access ever)
-- =======================================================================
create table if not exists public.oauth_token_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  token_type text default 'Bearer',
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
comment on table public.oauth_token_grants is 'SERVER-ONLY OAuth token store. RLS enabled with NO client policies + grants revoked => only service_role can access. Tokens NEVER reach a browser.';

drop trigger if exists trg_oauth_token_grants_updated on public.oauth_token_grants;
create trigger trg_oauth_token_grants_updated
  before update on public.oauth_token_grants
  for each row execute function public.set_updated_at();

-- Lock the table down: RLS on, NO policies (so no client role can read/write),
-- and explicitly revoke privileges from the client roles. Only service_role
-- (which bypasses RLS) can touch it.
alter table public.oauth_token_grants enable row level security;
revoke all on public.oauth_token_grants from anon, authenticated;
