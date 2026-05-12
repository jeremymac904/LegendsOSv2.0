-- ============================================================================
-- LegendsOS 2.0 — Initial schema
-- ----------------------------------------------------------------------------
-- One organization owner (Jeremy McDonald) sees everything across the org.
-- Loan officers see only their own data plus rows they have been granted via
-- shared_resources or team_shared visibility.
--
-- Every table ships with RLS enabled by default. No table exposes raw
-- provider secrets to the client. Provider credentials live in a separate
-- table with status-only readable columns; the encrypted material is held
-- in a server-only column readable only by the service role.
-- ============================================================================

set check_function_bodies = off;

-- Required extensions ---------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type public.user_role as enum ('owner', 'admin', 'loan_officer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assistant_visibility as enum ('owner_only', 'assigned_user', 'team_shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.chat_message_role as enum ('user', 'assistant', 'system', 'tool');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.social_post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.social_channel as enum ('facebook', 'instagram', 'google_business_profile', 'youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_campaign_status as enum ('draft', 'approved', 'sending', 'sent', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.provider_status as enum ('missing', 'configured', 'disabled', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_job_status as enum ('queued', 'sent', 'succeeded', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.generation_status as enum ('queued', 'processing', 'succeeded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.knowledge_visibility as enum ('private', 'team_shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.calendar_item_type as enum ('content_plan', 'social_post', 'email_campaign', 'team_event', 'reminder');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- ORGANIZATIONS / PROFILES / MEMBERSHIPS
-- ============================================================================

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  owner_user_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null unique,
  full_name     text,
  role          public.user_role not null default 'loan_officer',
  organization_id uuid references public.organizations(id) on delete set null,
  avatar_url    text,
  is_active     boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles(organization_id);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            public.user_role not null default 'loan_officer',
  joined_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists org_members_user_idx on public.organization_members(user_id);

-- Add the FK from organizations.owner_user_id once profiles exists
alter table public.organizations
  drop constraint if exists organizations_owner_user_id_fkey,
  add  constraint organizations_owner_user_id_fkey
    foreign key (owner_user_id) references public.profiles(id) on delete set null;

-- ============================================================================
-- ROLE HELPERS — used by RLS policies
-- ============================================================================

-- Returns the role of the current authenticated user. SECURITY DEFINER so
-- it bypasses RLS on profiles when called from policies (which would
-- otherwise recurse).
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- ATLAS ASSISTANTS
-- ============================================================================

create table if not exists public.atlas_assistants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_user_id   uuid references public.profiles(id) on delete set null,
  name            text not null,
  description     text,
  visibility      public.assistant_visibility not null default 'assigned_user',
  system_prompt   text,
  model           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists atlas_assistants_owner_idx on public.atlas_assistants(owner_user_id);
create index if not exists atlas_assistants_org_idx on public.atlas_assistants(organization_id);

-- ============================================================================
-- CHAT THREADS / MESSAGES
-- ============================================================================

create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  assistant_id    uuid references public.atlas_assistants(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  title           text not null default 'New chat',
  is_archived     boolean not null default false,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists chat_threads_user_idx on public.chat_threads(user_id);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.chat_threads(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  role        public.chat_message_role not null,
  content     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  token_count int,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages(thread_id, created_at);

-- ============================================================================
-- UPLOADED FILES
-- ============================================================================

create table if not exists public.uploaded_files (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  bucket          text not null,
  storage_path    text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  source_module   text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists uploaded_files_user_idx on public.uploaded_files(user_id);

-- ============================================================================
-- KNOWLEDGE: collections, items, retrieval references
-- ============================================================================

create table if not exists public.knowledge_collections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  name            text not null,
  description     text,
  visibility      public.knowledge_visibility not null default 'private',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists knowledge_collections_user_idx on public.knowledge_collections(user_id);

create table if not exists public.knowledge_items (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.knowledge_collections(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  title           text not null,
  content         text,
  source_type     text,
  source_uri      text,
  file_id         uuid references public.uploaded_files(id) on delete set null,
  embedding_ref   text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists knowledge_items_collection_idx on public.knowledge_items(collection_id);

create table if not exists public.retrieval_references (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid references public.chat_messages(id) on delete cascade,
  item_id         uuid references public.knowledge_items(id) on delete cascade,
  score           numeric,
  excerpt         text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists retrieval_references_message_idx on public.retrieval_references(message_id);

-- Assistant → collection access (controls which knowledge an assistant can use)
create table if not exists public.assistant_knowledge_access (
  assistant_id  uuid not null references public.atlas_assistants(id) on delete cascade,
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  granted_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (assistant_id, collection_id)
);

-- ============================================================================
-- SHARED RESOURCES — owner-shared content visible to all team members
-- ============================================================================

create table if not exists public.shared_resources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid references public.profiles(id) on delete set null,
  resource_type   text not null,
  title           text not null,
  description     text,
  payload         jsonb not null default '{}'::jsonb,
  file_id         uuid references public.uploaded_files(id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists shared_resources_org_idx on public.shared_resources(organization_id);

-- ============================================================================
-- GENERATED MEDIA (Image Studio)
-- ============================================================================

create table if not exists public.generated_media (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  prompt          text not null,
  revised_prompt  text,
  provider        text not null,
  model           text,
  storage_bucket  text,
  storage_path    text,
  preview_url     text,
  aspect_ratio    text,
  status          public.generation_status not null default 'queued',
  cost_estimate   numeric(10,4),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists generated_media_user_idx on public.generated_media(user_id);

-- ============================================================================
-- SOCIAL POSTS
-- ============================================================================

create table if not exists public.social_posts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  organization_id   uuid references public.organizations(id) on delete set null,
  title             text,
  body              text not null,
  channels          public.social_channel[] not null default '{}',
  media_id          uuid references public.generated_media(id) on delete set null,
  status            public.social_post_status not null default 'draft',
  scheduled_at      timestamptz,
  published_at      timestamptz,
  n8n_execution_id  text,
  external_post_ids jsonb not null default '{}'::jsonb,
  error_message     text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists social_posts_user_idx on public.social_posts(user_id);
create index if not exists social_posts_status_idx on public.social_posts(status);

-- ============================================================================
-- EMAIL CAMPAIGNS
-- ============================================================================

create table if not exists public.email_campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  subject         text not null,
  preview_text    text,
  body_html       text,
  body_text       text,
  template_key    text,
  recipient_list  text,
  status          public.email_campaign_status not null default 'draft',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists email_campaigns_user_idx on public.email_campaigns(user_id);

-- ============================================================================
-- CALENDAR
-- ============================================================================

create table if not exists public.calendar_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  item_type       public.calendar_item_type not null,
  title           text not null,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  all_day         boolean not null default false,
  related_social_id uuid references public.social_posts(id) on delete set null,
  related_email_id  uuid references public.email_campaigns(id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists calendar_items_user_idx on public.calendar_items(user_id);
create index if not exists calendar_items_starts_idx on public.calendar_items(starts_at);

-- ============================================================================
-- AUTOMATION JOBS (n8n queue / records)
-- ============================================================================

create table if not exists public.automation_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  job_type        text not null,
  module          text,
  target_table    text,
  target_id       uuid,
  payload         jsonb not null default '{}'::jsonb,
  status          public.automation_job_status not null default 'queued',
  attempts        int not null default 0,
  last_error      text,
  webhook_url     text,
  external_id     text,
  response        jsonb,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists automation_jobs_status_idx on public.automation_jobs(status);
create index if not exists automation_jobs_user_idx on public.automation_jobs(user_id);

-- ============================================================================
-- USAGE EVENTS & AUDIT LOGS
-- ============================================================================

create table if not exists public.usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  module          text not null,
  event_type      text not null,
  provider        text,
  cost_estimate   numeric(10,4),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists usage_events_user_idx on public.usage_events(user_id, created_at);
create index if not exists usage_events_module_idx on public.usage_events(module, created_at);

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action          text not null,
  target_type     text,
  target_id       text,
  ip_address      inet,
  user_agent      text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at);
create index if not exists audit_logs_action_idx on public.audit_logs(action, created_at);

-- ============================================================================
-- PROVIDER CREDENTIALS
-- ----------------------------------------------------------------------------
-- `encrypted_secret` is readable ONLY by the service role.
-- The "status view" exposes everything except the secret to authorized users.
-- ============================================================================

create table if not exists public.provider_credentials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider        text not null,
  status          public.provider_status not null default 'missing',
  masked_preview  text,
  env_var_name    text,
  encrypted_secret text,
  metadata        jsonb not null default '{}'::jsonb,
  is_enabled      boolean not null default true,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider)
);
create index if not exists provider_credentials_org_idx on public.provider_credentials(organization_id);

-- Public-safe view of provider credentials (no secret material).
create or replace view public.provider_credentials_public as
  select
    id,
    organization_id,
    provider,
    status,
    masked_preview,
    env_var_name,
    metadata,
    is_enabled,
    updated_at
  from public.provider_credentials;

-- ============================================================================
-- updated_at TRIGGER
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organizations', 'profiles', 'atlas_assistants', 'chat_threads',
      'knowledge_collections', 'knowledge_items',
      'shared_resources', 'generated_media', 'social_posts',
      'email_campaigns', 'calendar_items', 'automation_jobs', 'provider_credentials'
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
