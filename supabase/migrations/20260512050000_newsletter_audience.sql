-- ============================================================================
-- LegendsOS 2.0 — Newsletter Audience system
-- ----------------------------------------------------------------------------
-- Simple email-list storage for Jeremy's realtor newsletter targeting. This
-- is NOT a CRM: no pipelines, no opportunities, no portals. Just:
--   * audiences (named lists)
--   * contacts (people on those lists)
--   * imports (one row per CSV upload, for traceability)
-- ============================================================================

set check_function_bodies = off;
create extension if not exists "citext";

-- Enums -----------------------------------------------------------------------
do $$ begin
  create type public.newsletter_contact_status as enum (
    'active', 'unsubscribed', 'bounced', 'do_not_email', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.newsletter_import_status as enum (
    'queued', 'processing', 'succeeded', 'failed', 'partial'
  );
exception when duplicate_object then null; end $$;

-- newsletter_audiences --------------------------------------------------------
create table if not exists public.newsletter_audiences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_user_id   uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  metadata        jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists newsletter_audiences_owner_idx on public.newsletter_audiences(owner_user_id);
create index if not exists newsletter_audiences_org_idx on public.newsletter_audiences(organization_id);

-- newsletter_contact_imports --------------------------------------------------
create table if not exists public.newsletter_contact_imports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_user_id   uuid not null references public.profiles(id) on delete cascade,
  audience_id     uuid references public.newsletter_audiences(id) on delete set null,
  source_file_name text,
  total_rows      integer not null default 0,
  inserted_count  integer not null default 0,
  updated_count   integer not null default 0,
  duplicate_count integer not null default 0,
  missing_email_count integer not null default 0,
  error_count     integer not null default 0,
  status          public.newsletter_import_status not null default 'queued',
  errors          jsonb not null default '[]'::jsonb,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists newsletter_imports_owner_idx on public.newsletter_contact_imports(owner_user_id);
create index if not exists newsletter_imports_audience_idx on public.newsletter_contact_imports(audience_id);

-- newsletter_contacts ---------------------------------------------------------
create table if not exists public.newsletter_contacts (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid references public.organizations(id) on delete cascade,
  owner_user_id       uuid not null references public.profiles(id) on delete cascade,
  audience_id         uuid references public.newsletter_audiences(id) on delete set null,
  full_name           text,
  first_name          text,
  last_name           text,
  email               citext,
  email_2             citext,
  phone               text,
  phone_2             text,
  office_phone        text,
  office_name         text,
  city                text,
  state               text,
  state_license       text,
  facebook_url        text,
  instagram_url       text,
  linkedin_url        text,
  x_url               text,
  youtube_url         text,
  tiktok_url          text,
  zillow_url          text,
  other_links         text,
  transaction_count   numeric,
  total_volume        numeric,
  buyer_volume        numeric,
  buyer_units         numeric,
  source_file_name    text,
  source_import_id    uuid references public.newsletter_contact_imports(id) on delete set null,
  status              public.newsletter_contact_status not null default 'active',
  tags                text[] not null default '{}',
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists newsletter_contacts_owner_idx
  on public.newsletter_contacts(owner_user_id);
create index if not exists newsletter_contacts_audience_idx
  on public.newsletter_contacts(audience_id);
create index if not exists newsletter_contacts_status_idx
  on public.newsletter_contacts(status);
create index if not exists newsletter_contacts_email_idx
  on public.newsletter_contacts(email);
-- Email-based dedup is per (owner, email). Partial index avoids enforcing
-- uniqueness on rows where email is null.
create unique index if not exists newsletter_contacts_owner_email_uniq
  on public.newsletter_contacts(owner_user_id, email)
  where email is not null;

-- Convenience updated_at triggers --------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'newsletter_audiences',
    'newsletter_contact_imports',
    'newsletter_contacts'
  ])
  loop
    execute format(
      'drop trigger if exists trg_touch_%1$s on public.%1$s; '
      'create trigger trg_touch_%1$s before update on public.%1$s '
      'for each row execute function public.touch_updated_at();',
      t
    );
  end loop;
end $$;

-- RLS -------------------------------------------------------------------------
alter table public.newsletter_audiences enable row level security;
alter table public.newsletter_contact_imports enable row level security;
alter table public.newsletter_contacts enable row level security;

-- Owner: read/write everything in their org. Loan officers: read their own
-- (rare today; almost everything is created by Jeremy), no cross-user reads.

-- newsletter_audiences
drop policy if exists newsletter_audiences_self on public.newsletter_audiences;
create policy newsletter_audiences_self on public.newsletter_audiences
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists newsletter_audiences_owner_all on public.newsletter_audiences;
create policy newsletter_audiences_owner_all on public.newsletter_audiences
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

-- newsletter_contact_imports
drop policy if exists newsletter_imports_self on public.newsletter_contact_imports;
create policy newsletter_imports_self on public.newsletter_contact_imports
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists newsletter_imports_owner_all on public.newsletter_contact_imports;
create policy newsletter_imports_owner_all on public.newsletter_contact_imports
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

-- newsletter_contacts
drop policy if exists newsletter_contacts_self on public.newsletter_contacts;
create policy newsletter_contacts_self on public.newsletter_contacts
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists newsletter_contacts_owner_all on public.newsletter_contacts;
create policy newsletter_contacts_owner_all on public.newsletter_contacts
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());
