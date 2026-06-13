-- LegendsOS v2 — Legends Mortgage Academy base schema + RLS (reproducibility)
-- ---------------------------------------------------------------------------
-- The academy_* tables and policies were originally created directly in the
-- live database; this migration captures that exact DDL so a fresh database
-- can be rebuilt from the repo. Every statement is idempotent: on the live
-- project (where everything already exists) this is a no-op.
--
-- Ordering note: timestamped 125900 so it sorts BEFORE
-- 20260612130000_academy_coaching_v2.sql, whose ALTER TABLEs require these
-- tables to exist.
--
-- Visibility model:
--   Feed posts/comments/likes — org-scoped reads for all team members;
--     authors write their own rows; owner moderates (update/delete any).
--   Today / scorecard / progress — user_id = auth.uid() owns rows;
--     owner can read all (coach review).
-- ---------------------------------------------------------------------------

set search_path = public;
create extension if not exists "pgcrypto";

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.academy_feed_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  role text not null default 'Loan Officer',
  category text not null default 'Wins',
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  video_embed_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.academy_feed_posts(id) on delete cascade,
  organization_id uuid not null,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_feed_likes (
  post_id uuid not null references public.academy_feed_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.academy_today_entries (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day_key text not null,
  fields jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  primary key (user_id, day_key)
);

create table if not exists public.academy_scorecard (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  cells jsonb not null default '{}'::jsonb,
  reflection jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_progress (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  weeks_done integer[] not null default '{}'::integer[],
  graduated boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.academy_feed_posts    enable row level security;
alter table public.academy_feed_comments enable row level security;
alter table public.academy_feed_likes    enable row level security;
alter table public.academy_today_entries enable row level security;
alter table public.academy_scorecard     enable row level security;
alter table public.academy_progress      enable row level security;

-- Feed posts -----------------------------------------------------------------
drop policy if exists afp_select on public.academy_feed_posts;
create policy afp_select on public.academy_feed_posts
  for select to authenticated
  using (organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid()));

drop policy if exists afp_insert on public.academy_feed_posts;
create policy afp_insert on public.academy_feed_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists afp_update on public.academy_feed_posts;
create policy afp_update on public.academy_feed_posts
  for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role::text = 'owner')
  )
  with check (organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid()));

drop policy if exists afp_delete on public.academy_feed_posts;
create policy afp_delete on public.academy_feed_posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role::text = 'owner')
  );

-- Feed comments ---------------------------------------------------------------
drop policy if exists afc_select on public.academy_feed_comments;
create policy afc_select on public.academy_feed_comments
  for select to authenticated
  using (organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid()));

drop policy if exists afc_insert on public.academy_feed_comments;
create policy afc_insert on public.academy_feed_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists afc_delete on public.academy_feed_comments;
create policy afc_delete on public.academy_feed_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role::text = 'owner')
  );

-- Feed likes -------------------------------------------------------------------
drop policy if exists afl_select on public.academy_feed_likes;
create policy afl_select on public.academy_feed_likes
  for select to authenticated
  using (organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid()));

drop policy if exists afl_insert on public.academy_feed_likes;
create policy afl_insert on public.academy_feed_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid())
  );

drop policy if exists afl_delete on public.academy_feed_likes;
create policy afl_delete on public.academy_feed_likes
  for delete to authenticated using (user_id = auth.uid());

-- Personal coaching data --------------------------------------------------------
drop policy if exists ate_all on public.academy_today_entries;
create policy ate_all on public.academy_today_entries
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists asc_all on public.academy_scorecard;
create policy asc_all on public.academy_scorecard
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists asc_owner_select on public.academy_scorecard;
create policy asc_owner_select on public.academy_scorecard
  for select to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role::text = 'owner'));

drop policy if exists apr_all on public.academy_progress;
create policy apr_all on public.academy_progress
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists apr_owner_select on public.academy_progress;
create policy apr_owner_select on public.academy_progress
  for select to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role::text = 'owner'));
