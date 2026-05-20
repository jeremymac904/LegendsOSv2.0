-- ============================================================================
-- LegendsOS 2.0 — Atlas Hermes Workspace 2 connector registry
-- ----------------------------------------------------------------------------
-- This migration introduces a first-class table for Atlas connectors: the
-- automation backends, MCP integrations, and messaging surfaces that Atlas
-- can drive. The connector panel in the Atlas workspace renders one card per
-- row, and the /api/atlas/connectors endpoints read/write through this table.
--
-- Hard rules baked into this schema:
--   * Owner can read/write everything.
--   * Non-owner members of the org can READ connectors visible to their org.
--   * INSERT / UPDATE / DELETE are owner-only.
--   * `config_json` only ever stores ENV VAR NAMES + tier labels — never any
--     secret values. The seed below references env var names by string.
-- ============================================================================

-- 1) Table ------------------------------------------------------------------
create table if not exists public.atlas_connectors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 128),
  type text not null check (
    type in ('automation', 'messaging', 'mcp', 'other')
  ),
  status text not null default 'inactive' check (
    status in ('active', 'inactive', 'error', 'coming_soon')
  ),
  config_json jsonb not null default '{}'::jsonb,
  owner_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unique by (org, name) so the seed can re-run idempotently without
  -- collisions, and so owners can't accidentally register two "n8n" rows.
  unique (organization_id, name)
);

create index if not exists idx_atlas_connectors_org
  on public.atlas_connectors(organization_id);
create index if not exists idx_atlas_connectors_status
  on public.atlas_connectors(status);

-- 2) updated_at trigger -----------------------------------------------------
-- Reuse the existing helper if present, otherwise define a local one.
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  ) then
    create function public.set_updated_at() returns trigger
    language plpgsql as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

drop trigger if exists trg_atlas_connectors_updated_at on public.atlas_connectors;
create trigger trg_atlas_connectors_updated_at
  before update on public.atlas_connectors
  for each row execute function public.set_updated_at();

-- 3) RLS --------------------------------------------------------------------
alter table public.atlas_connectors enable row level security;

-- Owner: full access.
drop policy if exists atlas_connectors_owner_all on public.atlas_connectors;
create policy atlas_connectors_owner_all on public.atlas_connectors
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Non-owner members of the same org: read-only. We treat NULL organization_id
-- as "owner-global" — also visible to members.
drop policy if exists atlas_connectors_member_select on public.atlas_connectors;
create policy atlas_connectors_member_select on public.atlas_connectors
  for select to authenticated
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

grant select on public.atlas_connectors to authenticated;
grant all on public.atlas_connectors to service_role;

-- 4) Seed rows --------------------------------------------------------------
-- We attach each seed row to the default Legends org so they show up in the
-- member-read policy. Owners can re-parent / archive later via the API.
do $$
declare
  legends_org uuid;
begin
  select id into legends_org
    from public.organizations
    where slug = 'legends-mortgage'
    limit 1;

  -- n8n — automation backbone. Active by default. Status reflects the
  -- presence of the N8N_BASE_URL env var at runtime — we surface the env
  -- VAR NAME here so the UI can render "Set N8N_BASE_URL in Netlify env".
  insert into public.atlas_connectors (name, type, status, config_json, organization_id)
  values (
    'n8n',
    'automation',
    'active',
    jsonb_build_object(
      'webhook_base', 'env:N8N_BASE_URL',
      'tier', 'owner_global',
      'description', 'Outbound automation hub for social, email, and scheduled jobs.'
    ),
    legends_org
  )
  on conflict (organization_id, name) do nothing;

  -- Zapier MCP — placeholder. Coming soon, no live wiring yet.
  insert into public.atlas_connectors (name, type, status, config_json, organization_id)
  values (
    'zapier_mcp',
    'mcp',
    'coming_soon',
    jsonb_build_object(
      'tier', 'owner_global',
      'placeholder', true,
      'description', 'Zapier MCP bridge. Not yet connected.'
    ),
    legends_org
  )
  on conflict (organization_id, name) do nothing;

  -- Telegram — owner messaging. Status defaults to active so the panel shows
  -- it as a connected tool when env wiring lands; until then it's safe to
  -- list since we never expose secrets through this row.
  insert into public.atlas_connectors (name, type, status, config_json, organization_id)
  values (
    'telegram',
    'messaging',
    'active',
    jsonb_build_object(
      'tier', 'owner_global',
      'description', 'Owner Telegram bridge for ops messaging.'
    ),
    legends_org
  )
  on conflict (organization_id, name) do nothing;
end $$;
