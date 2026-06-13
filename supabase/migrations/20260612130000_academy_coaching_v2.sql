-- LegendsOS v2 — Legends Mortgage Academy coaching persistence, pass 2
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY. The academy_* tables already exist (feed posts/comments/
-- likes, today entries, scorecard, progress) with RLS. This migration extends
-- them in place for the full coaching loop:
--
--   academy_feed_posts  + kind/ref_key (seeded coach content: welcome, daily,
--                         weekly, announcement, pick) + attachment_url
--   academy_scorecard   + submit-to-coach + coach review fields
--   academy_progress    + graduated_at (graduation timestamp)
--
-- No table is dropped or recreated; no existing column changes.
-- ---------------------------------------------------------------------------

set search_path = public;

-- Feed: seeded coach content + attachments -----------------------------------
alter table public.academy_feed_posts
  add column if not exists kind text not null default 'member',
  add column if not exists ref_key text,
  add column if not exists attachment_url text;

-- One row per seeded slot (e.g. kind='daily', ref_key='monday') so reseeding
-- is an upsert, never a duplicate.
create unique index if not exists academy_feed_posts_seed_key
  on public.academy_feed_posts (kind, ref_key) where kind <> 'member';
create index if not exists academy_feed_posts_created
  on public.academy_feed_posts (created_at desc);

-- Scorecard: weekly submit-to-coach + review ----------------------------------
alter table public.academy_scorecard
  add column if not exists submitted boolean not null default false,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed boolean not null default false,
  add column if not exists coach_note text;

-- Progress: graduation timestamp ----------------------------------------------
alter table public.academy_progress
  add column if not exists graduated_at timestamptz;
