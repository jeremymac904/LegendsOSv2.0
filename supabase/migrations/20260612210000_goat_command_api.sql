-- LegendsOS v2 — GOAT Architect Command API storage
-- ---------------------------------------------------------------------------
-- Backing tables for the /api/goat/* endpoints used by the GOAT Architect
-- Custom GPT Action:
--   goat_projects — project registry (create_project / search_projects)
--   goat_memories — append-only long-term memory (write_memory / search_memory)
--   goat_runs     — agent plan + execution runs (plan/execute/get_run_status)
--
-- Access model: SERVICE ROLE ONLY. RLS is enabled with NO policies, so anon
-- and authenticated clients are locked out entirely; the API routes reach
-- these tables exclusively through getSupabaseServiceClient() after Bearer
-- auth against GOAT_COMMAND_API_KEY.
-- ---------------------------------------------------------------------------

set search_path = public;

create table if not exists public.goat_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  repo_url    text,
  status      text not null default 'active'
              check (status in ('active', 'paused', 'done', 'idea')),
  tags        text[] not null default '{}',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.goat_projects is 'GOAT Architect project registry (service-role only).';

create table if not exists public.goat_memories (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null default 'global',
  title      text not null,
  content    text not null,
  tags       text[] not null default '{}',
  source     text not null default 'gpt-action',
  created_at timestamptz not null default now()
);
comment on table public.goat_memories is 'GOAT Architect append-only long-term memory (service-role only).';

create table if not exists public.goat_runs (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('plan', 'execute')),
  status        text not null default 'queued'
                check (status in ('planned', 'queued', 'running', 'completed', 'failed')),
  goal          text not null,
  plan          jsonb,
  result        jsonb,
  error         text,
  parent_run_id uuid references public.goat_runs(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.goat_runs is 'GOAT Architect plan/execute runs (service-role only).';

create index if not exists goat_projects_updated_idx on public.goat_projects (updated_at desc);
create index if not exists goat_memories_created_idx on public.goat_memories (created_at desc);
create index if not exists goat_memories_scope_idx   on public.goat_memories (scope);
create index if not exists goat_runs_created_idx     on public.goat_runs (created_at desc);
create index if not exists goat_runs_status_idx      on public.goat_runs (status);

-- updated_at maintenance (same trigger style as the rest of the schema).
create or replace function public.goat_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists goat_projects_touch on public.goat_projects;
create trigger goat_projects_touch
  before update on public.goat_projects
  for each row execute function public.goat_touch_updated_at();

drop trigger if exists goat_runs_touch on public.goat_runs;
create trigger goat_runs_touch
  before update on public.goat_runs
  for each row execute function public.goat_touch_updated_at();

-- Lock down: RLS on, no policies => only service_role (bypasses RLS) gets in.
alter table public.goat_projects enable row level security;
alter table public.goat_memories enable row level security;
alter table public.goat_runs     enable row level security;
