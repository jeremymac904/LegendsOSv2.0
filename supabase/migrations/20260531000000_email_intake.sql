-- LegendsOS v2 — Gmail AI Intake data model (Phase 1)
-- ---------------------------------------------------------------------------
-- LegendsOS is the brain; n8n is the outside runner. This migration creates
-- the NATIVE LegendsOS side: intake DB, classification queue, attachment
-- review queue, loan-match review, alert + human-approval queue, team routing,
-- notification preferences, and an audit log.
--
-- SAFETY (Phase 1):
--   * No customer-facing sends. No deletes. No auto-marking-read. No auto
--     writes to borrower folders. This schema only RECORDS + QUEUES for human
--     review.
--   * NO real PII / borrower data / team emails are seeded here. Team member
--     Gmail addresses are entered by the owner in /email-intake/settings.
--   * Sample/demo rows are flagged is_sample = true at the app layer only.
--
-- snake_case tables; timestamptz UTC. Idempotent (create ... if not exists).
-- This migration is NOT auto-applied — the owner applies it in the Supabase
-- SQL editor / CLI. RLS lives in the companion *_email_intake_rls.sql file.
-- ---------------------------------------------------------------------------

set search_path = public;

create extension if not exists "pgcrypto";

-- Defensive updated_at trigger fn (also defined by earlier migrations).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =======================================================================
-- email_intake_team — which mailbox owners LegendsOS watches + how they
-- want to be notified. profile_id links to an app user when one exists;
-- gmail_address is filled in by the owner (admin setup). No emails seeded.
-- =======================================================================
create table if not exists public.email_intake_team (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  -- The watched Gmail/Workspace address. NULL = "admin setup needed".
  gmail_address text,
  role_label text not null default 'loan_officer' check (role_label in (
    'owner','loan_officer','processor','coordinator','assistant','other'
  )),
  -- Intake is OFF for a member until the owner enables it (Phase 1: all off).
  intake_enabled boolean not null default false,
  -- Per-user notification preferences (channels, severities, quiet hours).
  notify_preferences jsonb not null default '{}'::jsonb,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gmail_address)
);
comment on table public.email_intake_team is 'Mailboxes LegendsOS watches via n8n Gmail triggers. gmail_address is entered by the owner; intake_enabled stays false until activation.';

-- =======================================================================
-- email_intake_messages — one row per ingested email (metadata only).
-- The body/snippet is stored for triage; full content stays in Gmail.
-- =======================================================================
create table if not exists public.email_intake_messages (
  id uuid primary key default gen_random_uuid(),
  -- Which watched mailbox this arrived in.
  source_account text not null,
  team_member_id uuid references public.email_intake_team(id) on delete set null,
  -- Gmail identifiers (idempotency: dedupe on gmail_message_id).
  gmail_message_id text not null,
  gmail_thread_id text,
  from_address text,
  from_name text,
  to_address text,
  subject text,
  snippet text,
  received_at timestamptz,
  has_attachments boolean not null default false,
  -- Classification (one of the 13 categories; see lib/emailIntake/types.ts).
  classification text check (classification in (
    'customer_document_returned','customer_question','underwriting_condition',
    'lender_update','title_update','insurance_update','realtor_update',
    'processor_internal','new_lead','promotional','spam','phishing_risk',
    'unknown_needs_review'
  )),
  classification_confidence numeric(4,3),
  -- How it was classified: rule (cheap), ai (DeepSeek hard case), or none.
  classified_by text not null default 'none' check (classified_by in ('rule','ai','none')),
  -- Triage status. needs_review is the safe default for anything uncertain.
  status text not null default 'needs_review' check (status in (
    'needs_review','classified','loan_matched','alert_pending',
    'awaiting_approval','approved','archived'
  )),
  -- Loan match review (never auto-files; human approves first).
  loan_match_id uuid references public.loans(id) on delete set null,
  loan_match_confidence numeric(4,3),
  loan_match_status text not null default 'unmatched' check (loan_match_status in (
    'unmatched','suggested','confirmed','rejected'
  )),
  -- Internal alert decision (does a human need to be pinged?).
  internal_alert_decision text not null default 'undecided' check (internal_alert_decision in (
    'undecided','no_alert','alert_suggested','alert_approved'
  )),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  is_sample boolean not null default false,
  raw_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_account, gmail_message_id)
);
comment on table public.email_intake_messages is 'Ingested email metadata + classification/loan-match/alert review state. Default status needs_review. No customer replies are ever sent from here.';

-- =======================================================================
-- email_intake_attachments — attachment review queue. Unknown/suspicious
-- attachments go to a Google Drive "Needs Review" folder ONLY (never the
-- borrower file) until a human approves a confident loan match.
-- =======================================================================
create table if not exists public.email_intake_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.email_intake_messages(id) on delete cascade,
  file_name text,
  mime_type text,
  size_bytes bigint,
  gmail_attachment_id text,
  -- Where it currently lives. Phase 1 only ever targets the Needs Review folder.
  drive_location text not null default 'pending' check (drive_location in (
    'pending','needs_review_folder','borrower_folder','not_uploaded'
  )),
  drive_file_id text,
  drive_url text,
  status text not null default 'pending_review' check (status in (
    'pending_review','needs_review','suspicious','approved','filed','rejected'
  )),
  suspicious_reason text,
  loan_match_id uuid references public.loans(id) on delete set null,
  loan_match_confidence numeric(4,3),
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.email_intake_attachments is 'Attachment review queue. Unknown/suspicious files route to the Drive Needs Review folder only; borrower-folder filing requires a confident match + human approval (later phase).';

-- =======================================================================
-- email_intake_alerts — internal alert decision + HUMAN APPROVAL queue.
-- An approved alert is an INTERNAL notification only (never a customer reply).
-- =======================================================================
create table if not exists public.email_intake_alerts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.email_intake_messages(id) on delete cascade,
  alert_type text not null default 'review' check (alert_type in (
    'review','urgent_condition','phishing_risk','new_lead','lender_update','other'
  )),
  severity text not null default 'normal' check (severity in ('low','normal','high','urgent')),
  -- Who should be notified (internal team member).
  target_team_member_id uuid references public.email_intake_team(id) on delete set null,
  -- Human approval gate: nothing is sent until approved.
  decision text not null default 'pending' check (decision in ('pending','approved','dismissed')),
  channel text not null default 'in_app' check (channel in ('in_app','email_internal','telegram','none')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  -- Set by the alert-intake webhook AFTER n8n confirms an approved internal send.
  dispatched_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.email_intake_alerts is 'Internal alert decisions + human approval queue. Approved alerts are internal notifications only — never external customer replies.';

-- =======================================================================
-- email_intake_audit — append-only audit log for every intake action.
-- =======================================================================
create table if not exists public.email_intake_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  -- 'system' for webhook/automation actions with no human actor.
  actor_label text not null default 'system',
  action text not null,
  entity_type text not null check (entity_type in (
    'message','attachment','alert','team_member','settings','webhook'
  )),
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.email_intake_audit is 'Append-only audit log for Gmail AI Intake. Records webhook receipts, classifications, approvals, and routing decisions.';

-- ---- updated_at triggers ----------------------------------------------
drop trigger if exists trg_email_intake_team_updated on public.email_intake_team;
create trigger trg_email_intake_team_updated before update on public.email_intake_team
  for each row execute function public.set_updated_at();
drop trigger if exists trg_email_intake_messages_updated on public.email_intake_messages;
create trigger trg_email_intake_messages_updated before update on public.email_intake_messages
  for each row execute function public.set_updated_at();
drop trigger if exists trg_email_intake_attachments_updated on public.email_intake_attachments;
create trigger trg_email_intake_attachments_updated before update on public.email_intake_attachments
  for each row execute function public.set_updated_at();
drop trigger if exists trg_email_intake_alerts_updated on public.email_intake_alerts;
create trigger trg_email_intake_alerts_updated before update on public.email_intake_alerts
  for each row execute function public.set_updated_at();

-- ---- indexes ----------------------------------------------------------
create index if not exists idx_eim_status on public.email_intake_messages(status);
create index if not exists idx_eim_classification on public.email_intake_messages(classification);
create index if not exists idx_eim_team_member on public.email_intake_messages(team_member_id);
create index if not exists idx_eim_received_at on public.email_intake_messages(received_at desc);
create index if not exists idx_eia_message on public.email_intake_attachments(message_id);
create index if not exists idx_eia_status on public.email_intake_attachments(status);
create index if not exists idx_eial_message on public.email_intake_alerts(message_id);
create index if not exists idx_eial_decision on public.email_intake_alerts(decision);
create index if not exists idx_eiaudit_entity on public.email_intake_audit(entity_type, entity_id);
