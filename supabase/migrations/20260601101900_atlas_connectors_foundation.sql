-- LegendsOS v2 — Atlas Connector Registry foundation
-- ---------------------------------------------------------------------------
-- Timestamped replacement for the historical 005_atlas_connectors.sql file.
-- Runs after the base schema so organizations, profiles, RLS helpers, and
-- touch_updated_at() exist.
-- ---------------------------------------------------------------------------

set search_path = public;

do $$ begin
  create type public.connector_tier as enum (
    'owner_global',
    'lo_personal',
    'future'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.connector_status as enum (
    'active',
    'inactive',
    'error',
    'coming_soon'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.atlas_connectors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null,
  display_name    text not null,
  description     text,
  tier            public.connector_tier not null default 'owner_global',
  status          public.connector_status not null default 'inactive',
  provider        text not null,
  config_json     jsonb not null default '{}',
  metadata        jsonb not null default '{}',
  last_ping_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists atlas_connectors_updated_at on public.atlas_connectors;
create trigger atlas_connectors_updated_at
  before update on public.atlas_connectors
  for each row execute function public.touch_updated_at();

alter table public.atlas_connectors enable row level security;

drop policy if exists atlas_connectors_owner_all on public.atlas_connectors;
create policy atlas_connectors_owner_all
  on public.atlas_connectors
  for all
  using (public.is_owner() or public.is_admin_or_owner())
  with check (public.is_owner() or public.is_admin_or_owner());

drop policy if exists atlas_connectors_team_read on public.atlas_connectors;
create policy atlas_connectors_team_read
  on public.atlas_connectors
  for select
  using (
    organization_id = public.current_org_id()
    and tier = 'owner_global'
    and status = 'active'
  );

insert into public.atlas_connectors
  (name, display_name, description, tier, status, provider, config_json, metadata)
values
  (
    'n8n',
    'n8n Automation',
    'Workflow automation bridge. Triggers n8n workflows from Atlas.',
    'owner_global',
    'inactive',
    'n8n',
    '{}',
    '{"icon":"zap","color":"#EA4B71"}'
  ),
  (
    'zapier_mcp',
    'Zapier MCP',
    'Zapier MCP connector. Coming soon - connect 7,000+ apps.',
    'owner_global',
    'coming_soon',
    'zapier_mcp',
    '{}',
    '{"icon":"lightning","color":"#FF4A00"}'
  ),
  (
    'telegram',
    'Telegram',
    'Hermes Telegram gateway. Real-time notifications + commands.',
    'owner_global',
    'inactive',
    'telegram',
    '{}',
    '{"icon":"send","color":"#229ED9"}'
  )
on conflict do nothing;
