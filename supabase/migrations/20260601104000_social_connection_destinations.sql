-- ============================================================================
-- LegendsOS 2.0 — Per-user social destinations + secret vault
-- ----------------------------------------------------------------------------
-- Adds:
--   * user-owned social_account_connections rows
--   * service-role-only social_connection_secrets vault
--   * RLS updates so owners can see team status but never token material
--
-- This migration replaces the old org-global destination assumption with a
-- per-user destination model. The base auth grant still lives in
-- user_integration_connections; these rows store the user-selected publishing
-- destinations only.
-- ============================================================================

set search_path = public;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Make social_account_connections user-scoped destinations.
-- ---------------------------------------------------------------------------
alter table public.social_account_connections
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists user_integration_connection_id uuid references public.user_integration_connections(id) on delete cascade,
  add column if not exists destination_type text,
  add column if not exists destination_ref text,
  add column if not exists destination_label text,
  add column if not exists last_tested_at timestamptz;

update public.social_account_connections
set user_id = coalesce(user_id, connected_by)
where user_id is null and connected_by is not null;

update public.social_account_connections
set
  destination_type = coalesce(
    destination_type,
    case platform
      when 'facebook' then 'facebook_page'
      when 'instagram' then 'instagram_account'
      when 'google_business_profile' then 'google_business_location'
      when 'youtube' then 'youtube_channel'
      else 'destination'
    end
  ),
  destination_ref = coalesce(destination_ref, page_id, account_ref, id::text),
  destination_label = coalesce(destination_label, account_ref, page_id, platform),
  page_id = coalesce(page_id, account_ref, id::text),
  connected_by = coalesce(connected_by, user_id)
where destination_ref is null
   or destination_label is null
   or page_id is null
   or connected_by is null;

alter table public.social_account_connections
  alter column status set default 'not_connected';

alter table public.social_account_connections
  drop constraint if exists social_account_connections_organization_id_platform_page_id_key;

create unique index if not exists social_account_connections_user_destination_uidx
  on public.social_account_connections(user_id, platform, destination_type, destination_ref);

drop index if exists idx_sac_org;
drop index if exists idx_sac_platform;
drop index if exists idx_sac_publish_enabled;
create index if not exists idx_sac_user on public.social_account_connections(user_id);
create index if not exists idx_sac_org on public.social_account_connections(organization_id);
create index if not exists idx_sac_platform on public.social_account_connections(platform);
create index if not exists idx_sac_destination_type on public.social_account_connections(destination_type);
create index if not exists idx_sac_destination_ref on public.social_account_connections(destination_ref);
create index if not exists idx_sac_publish_enabled on public.social_account_connections(is_publish_enabled);
create index if not exists idx_sac_user_publish on public.social_account_connections(user_id, is_publish_enabled);
create index if not exists idx_sac_connection on public.social_account_connections(user_integration_connection_id);

comment on table public.social_account_connections is
  'Per-user connected social destinations (Facebook pages, Instagram business accounts, GBP locations, YouTube channels). No raw tokens stored here. is_publish_enabled defaults FALSE — users must explicitly enable publishing for each destination.';

-- ---------------------------------------------------------------------------
-- Service-role-only secret vault for OAuth material.
-- ---------------------------------------------------------------------------
create table if not exists public.social_connection_secrets (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references public.profiles(id) on delete cascade,
  organization_id                 uuid references public.organizations(id) on delete cascade,
  user_integration_connection_id   uuid not null references public.user_integration_connections(id) on delete cascade,
  provider                        text not null,
  encrypted_secret                text not null,
  token_type                      text,
  scopes                          text[] not null default '{}'::text[],
  expires_at                      timestamptz,
  metadata                        jsonb not null default '{}'::jsonb,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (user_integration_connection_id)
);

create index if not exists idx_scs_user on public.social_connection_secrets(user_id);
create index if not exists idx_scs_org on public.social_connection_secrets(organization_id);
create index if not exists idx_scs_provider on public.social_connection_secrets(provider);
create index if not exists idx_scs_conn on public.social_connection_secrets(user_integration_connection_id);

comment on table public.social_connection_secrets is
  'Service-role-only OAuth secret vault for per-user social integrations. Authenticated users never read this table.';

drop trigger if exists trg_social_connection_secrets_updated on public.social_connection_secrets;
create trigger trg_social_connection_secrets_updated
  before update on public.social_connection_secrets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- updated_at trigger for social_account_connections already exists, but the
-- new columns need a fresh touch trigger in case the old migration never ran.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_social_account_connections_updated on public.social_account_connections;
create trigger trg_social_account_connections_updated before update on public.social_account_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.social_account_connections enable row level security;
alter table public.social_connection_secrets enable row level security;

drop policy if exists sac_select on public.social_account_connections;
create policy sac_select on public.social_account_connections
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_or_owner()
  );

drop policy if exists sac_self_write on public.social_account_connections;
create policy sac_self_write on public.social_account_connections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No authenticated policies on social_connection_secrets. Service role bypasses
-- RLS and is the only actor that should touch token material.
