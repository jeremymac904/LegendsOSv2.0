-- ============================================================================
-- LegendsOS 2.0 — Scheduler + retry queue for scheduled posts & campaigns
-- ----------------------------------------------------------------------------
-- ADDITIVE + IDEMPOTENT. Adds retry-tracking columns to social_posts and
-- email_campaigns so a cron processor (app/api/cron/process-scheduled) can:
--   * find rows that are due (scheduled_at <= now)
--   * attempt dispatch and record the attempt
--   * back off and retry on failure (exponential: 5, 15, 60 min)
--   * give up after a bounded number of attempts and mark the row failed
--
-- This migration does NOT touch RLS (already defined elsewhere) and does NOT
-- alter the status enums destructively. The processor only uses status values
-- that already exist on each enum:
--   * social_post_status   : 'draft','scheduled','publishing','published',
--                            'failed','cancelled'  (uses scheduled->published/
--                            failed; 'publishing' is available if needed)
--   * email_campaign_status: 'draft','approved','sending','sent','failed',
--                            'cancelled' (a scheduled campaign is 'approved'
--                            with a future scheduled_at; uses ->sent/failed)
-- Because every value the processor needs is already in the enum, NO enum
-- change is required. State is tracked via the new columns below.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- social_posts: retry/backoff tracking columns
-- ---------------------------------------------------------------------------
alter table public.social_posts
  add column if not exists publish_attempts_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists publish_error text;

-- Partial index: only the rows the processor actually scans (status='scheduled').
create index if not exists idx_social_posts_due
  on public.social_posts(scheduled_at)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- email_campaigns: retry/backoff tracking columns
-- ---------------------------------------------------------------------------
alter table public.email_campaigns
  add column if not exists publish_attempts_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists publish_error text;

-- email_campaigns has scheduled_at. A "scheduled" campaign is one that has
-- been approved (status='approved') with a future scheduled_at. The processor
-- treats approved+due rows as ready-to-send; the partial index covers that.
create index if not exists idx_email_campaigns_due
  on public.email_campaigns(scheduled_at)
  where status = 'approved';
