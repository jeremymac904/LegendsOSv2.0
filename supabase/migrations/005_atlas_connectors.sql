-- Migration 005: Atlas Connector Registry
-- Tracks MCP connectors and automation bridges available to Atlas.
-- Three tiers: owner_global, lo_personal, future

do $$ begin
  create type connector_tier as enum (
    'owner_global',
    'lo_personal',
    'future'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type connector_status as enum (
    'active',
    'inactive',
    'error',
    'coming_soon'
  );
exception when duplicate_object then null; end $$;

create table if not exists atlas_connectors (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null,
  display_name    text not null,
  description     text,
  tier            connector_tier not null default 'owner_global',
  status          connector_status not null default 'inactive',
  provider        text not null,  -- 'n8n' | 'zapier_mcp' | 'telegram' | 'custom'
  config_json     jsonb not null default '{}',
  metadata        jsonb not null default '{}',
  last_ping_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at trigger
drop trigger if exists atlas_connectors_updated_at on atlas_connectors;
create trigger atlas_connectors_updated_at
  before update on atlas_connectors
  for each row execute function public.touch_updated_at();

-- RLS
alter table atlas_connectors enable row level security;

create policy "atlas_connectors_owner_all"
  on atlas_connectors
  for all
  using (is_owner() or is_admin_or_owner())
  with check (is_owner() or is_admin_or_owner());

create policy "atlas_connectors_team_read"
  on atlas_connectors
  for select
  using (
    organization_id = current_org_id()
    and tier = 'owner_global'
    and status = 'active'
  );

-- Seed default connectors for Legends org (idempotent)
insert into atlas_connectors (name, display_name, description, tier, status, provider, config_json, metadata)
values
  ('n8n',         'n8n Automation',  'Workflow automation bridge. Triggers n8n workflows from Atlas.', 'owner_global', 'inactive', 'n8n',        '{}', '{"icon":"zap","color":"#EA4B71"}'),
  ('zapier_mcp',  'Zapier MCP',      'Zapier MCP connector. Coming soon — connect 7,000+ apps.',      'owner_global', 'coming_soon', 'zapier_mcp', '{}', '{"icon":"lightning","color":"#FF4A00"}'),
  ('telegram',    'Telegram',        'Hermes Telegram gateway. Real-time notifications + commands.',   'owner_global', 'inactive', 'telegram',   '{}', '{"icon":"send","color":"#229ED9"}')
on conflict do nothing;
