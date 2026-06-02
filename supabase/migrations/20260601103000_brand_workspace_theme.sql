-- ============================================================================
-- LegendsOS 2.0 — Brand workspace + personal theme foundation
-- ----------------------------------------------------------------------------
-- Adds:
--   * public.brand_workspace_settings
--   * public.user_theme_settings
--   * RLS policies for both tables
--   * Seeded Flo Processing workspace branding for Ashley's entry domain
--
-- Theme media stays private by default. The app serves signed URLs when a
-- logged-in user or the server-side login surface is allowed to render them.
-- ============================================================================

set search_path = public;

-- Defensive shared helper used by the new tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Brand workspace settings
-- ---------------------------------------------------------------------------
create table if not exists public.brand_workspace_settings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  workspace_slug      text not null unique,
  domain              citext not null unique,
  display_name        text not null,
  logo_path           text,
  primary_color       text,
  secondary_color     text,
  login_headline      text not null,
  login_subheadline   text,
  background_image_path text,
  background_video_path text,
  default_redirect_path text not null default '/dashboard',
  owner_user_id       uuid references public.profiles(id) on delete set null,
  status              text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists brand_workspace_settings_org_idx
  on public.brand_workspace_settings(organization_id);
create index if not exists brand_workspace_settings_owner_idx
  on public.brand_workspace_settings(owner_user_id);

comment on table public.brand_workspace_settings is
  'Tenant-branded workspace settings used for login pages, workspace shells, and owner-managed branded entry domains.';

-- ---------------------------------------------------------------------------
-- Personal theme settings
-- ---------------------------------------------------------------------------
create table if not exists public.user_theme_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  organization_id       uuid references public.organizations(id) on delete cascade,
  brand_workspace_id    uuid references public.brand_workspace_settings(id) on delete set null,
  primary_color         text,
  secondary_color       text,
  background_image_path text,
  background_video_path text,
  glass_intensity       numeric(4,2) not null default 0.80 check (glass_intensity >= 0 and glass_intensity <= 1),
  sidebar_opacity       numeric(4,2) not null default 0.78 check (sidebar_opacity >= 0 and sidebar_opacity <= 1),
  card_opacity          numeric(4,2) not null default 0.34 check (card_opacity >= 0 and card_opacity <= 1),
  text_contrast         text not null default 'high' check (text_contrast in ('high', 'normal', 'soft')),
  login_background_enabled boolean not null default true,
  desktop_background_enabled boolean not null default true,
  theme_mode            text not null default 'dark' check (theme_mode in ('dark', 'light', 'system')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id)
);

create index if not exists user_theme_settings_org_idx
  on public.user_theme_settings(organization_id);
create index if not exists user_theme_settings_brand_idx
  on public.user_theme_settings(brand_workspace_id);

comment on table public.user_theme_settings is
  'Per-user theme customization for the LegendsOS web shell and desktop shell.';

-- ---------------------------------------------------------------------------
-- Seed Ashley's Flo Processing workspace branding.
-- ---------------------------------------------------------------------------
do $$
declare
  default_org uuid;
  owner_id uuid;
begin
  select id into default_org
  from public.organizations
  where slug = 'legends-mortgage'
  limit 1;

  select id into owner_id
  from public.profiles
  where lower(email) = lower('jeremy@mcdonald-mtg.com')
  limit 1;

  if default_org is null then
    return;
  end if;

  insert into public.brand_workspace_settings (
    organization_id,
    workspace_slug,
    domain,
    display_name,
    logo_path,
    primary_color,
    secondary_color,
    login_headline,
    login_subheadline,
    background_image_path,
    background_video_path,
    default_redirect_path,
    owner_user_id,
    status
  )
  values (
    default_org,
    'flo_processing',
    'lfprocessing.net',
    'Flo Processing',
    '/assets/logos/lf-processing-logo.png',
    '#2B5D4A',
    '#C98A6A',
    'Flo Processing Command Center',
    'A smarter workspace for processing, document review, conditions, and loan flow support.',
    '/assets/backgrounds/command-center-elegant.jpg',
    null,
    '/flo-processing',
    owner_id,
    'active'
  )
  on conflict (workspace_slug) do update
    set organization_id = excluded.organization_id,
        domain = excluded.domain,
        display_name = excluded.display_name,
        logo_path = excluded.logo_path,
        primary_color = excluded.primary_color,
        secondary_color = excluded.secondary_color,
        login_headline = excluded.login_headline,
        login_subheadline = excluded.login_subheadline,
        background_image_path = excluded.background_image_path,
        background_video_path = excluded.background_video_path,
        default_redirect_path = excluded.default_redirect_path,
        owner_user_id = excluded.owner_user_id,
        status = excluded.status;
end $$;

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'brand_workspace_settings',
      'user_theme_settings'
    ])
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s;', tbl);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s for each row execute function public.set_updated_at();',
      tbl
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.brand_workspace_settings enable row level security;
alter table public.user_theme_settings enable row level security;

drop policy if exists brand_workspace_settings_select on public.brand_workspace_settings;
create policy brand_workspace_settings_select on public.brand_workspace_settings
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    or public.is_owner()
  );

drop policy if exists brand_workspace_settings_owner_all on public.brand_workspace_settings;
create policy brand_workspace_settings_owner_all on public.brand_workspace_settings
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

drop policy if exists user_theme_settings_select_self on public.user_theme_settings;
create policy user_theme_settings_select_self on public.user_theme_settings
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin_or_owner() and organization_id = public.current_org_id())
  );

drop policy if exists user_theme_settings_self_all on public.user_theme_settings;
create policy user_theme_settings_self_all on public.user_theme_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_theme_settings_admin_owner_all on public.user_theme_settings;
create policy user_theme_settings_admin_owner_all on public.user_theme_settings
  for all to authenticated
  using (public.is_admin_or_owner() and organization_id = public.current_org_id())
  with check (public.is_admin_or_owner() and organization_id = public.current_org_id());

