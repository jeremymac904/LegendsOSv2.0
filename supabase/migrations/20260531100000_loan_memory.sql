-- LegendsOS v2 — Persistent Loan Memory & Source Retrieval data model
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY. Builds the memory layer on top of the existing mortgage data
-- model (loans, borrowers, loan_documents, loan_conditions, loan_tasks,
-- loan_status_events, ...). Does NOT duplicate existing tables — loan_documents
-- is EXTENDED in place (add column if not exists), never recreated.
--
-- New tables: loan_memory, loan_memory_events, loan_ai_retrieval_logs,
--             user_ai_preferences.
--
-- SAFETY: No PII / real borrower data is seeded here (sample rows live in the
-- app layer, is_sample=true). drive_* fields are READ-ONLY references — the app
-- never writes to Google Drive. This migration is NOT auto-applied; the owner
-- applies it. RLS is in the companion *_loan_memory_rls.sql.
-- ---------------------------------------------------------------------------

set search_path = public;
create extension if not exists "pgcrypto";

-- Defensive shared updated_at trigger fn (also defined by earlier migrations).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =======================================================================
-- loan_memory — persistent structured memory for a borrower / loan.
-- Linked to public.loans when a loan row exists (loan_id), else stands alone
-- for an early lead/prospect. owner_id scopes RLS when loan_id is null.
-- =======================================================================
create table if not exists public.loan_memory (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  borrower_name text,
  co_borrower_name text,
  property_address text,
  loan_purpose text,
  loan_type text,
  lender text,
  loan_number text,
  primary_loan_officer uuid references public.profiles(id) on delete set null,
  processor uuid references public.profiles(id) on delete set null,
  loan_coordinator uuid references public.profiles(id) on delete set null,
  referral_source text,
  current_stage text,
  -- Status fields. Use 'unknown' rather than guessing (memory quality rule).
  approval_status text not null default 'unknown',
  appraisal_status text not null default 'unknown',
  title_status text not null default 'unknown',
  insurance_status text not null default 'unknown',
  main_blocker text,
  next_action text,
  priority text not null default 'medium' check (priority in (
    'highest','high','medium','low','lowest'
  )),
  -- Confidence the memory snapshot is current/correct: high/medium/low.
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  closing_date date,
  last_known_activity timestamptz,
  source_summary text,
  source_file text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.loan_memory is 'Persistent structured memory per borrower/loan. Verified data must not be overwritten by weaker chat notes; missing values stay "unknown"/null. Status fields never claim clear_to_close/closed/denied/suspended/dead without source evidence.';

-- =======================================================================
-- loan_memory_events — chronological memory timeline (complements the
-- existing append-only loan_status_events; this one is broader: email
-- summaries, ai notes, document received, etc.).
-- =======================================================================
create table if not exists public.loan_memory_events (
  id uuid primary key default gen_random_uuid(),
  loan_memory_id uuid not null references public.loan_memory(id) on delete cascade,
  event_type text not null check (event_type in (
    'borrower_update','email_summary','document_received','condition_update',
    'approval_update','appraisal_update','title_update','insurance_update',
    'pricing_update','lender_update','processor_note','ai_note',
    'task_update','closing_update'
  )),
  event_title text,
  event_summary text,
  source_type text,   -- e.g. email, drive, sheet, chat, document, manual
  source_name text,
  source_url_or_path text,
  source_timestamp timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  confidence text not null default 'medium' check (confidence in ('high','medium','low')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.loan_memory_events is 'Append-style chronological memory events. source_summary is always preserved; events are never silently rewritten.';

-- =======================================================================
-- loan_ai_retrieval_logs — audit trail of what context an assistant loaded
-- BEFORE answering a loan question. Distinct from retrieval_references
-- (which logs knowledge-base hits for chat messages).
-- =======================================================================
create table if not exists public.loan_ai_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  loan_memory_id uuid references public.loan_memory(id) on delete set null,
  assistant_user_id uuid references public.profiles(id) on delete set null,
  query_text text,
  match_status text,  -- matched / multiple_matches / no_match / low_confidence / not_loan_related
  retrieved_sources jsonb not null default '[]'::jsonb,
  retrieval_summary text,
  response_id text,
  created_at timestamptz not null default now()
);
comment on table public.loan_ai_retrieval_logs is 'Audit log of loan-memory retrieval before an AI answer. Respects the same loan access as loan_memory via RLS.';

-- =======================================================================
-- user_ai_preferences — per-user memory + communication preferences.
-- =======================================================================
create table if not exists public.user_ai_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tone_profile text not null default 'jeremy',
  communication_rules text,
  approval_required boolean not null default true,
  default_signature text,
  preferred_response_format text not null default 'status_blocker_next',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);
comment on table public.user_ai_preferences is 'Per-user AI voice/communication preferences (Jeremy operator voice, Scott operator, Eric straight-shooter, future LOs).';

-- ---- EXTEND existing loan_documents (additive; never recreate) ----------
-- Map the existing per-loan document tracker to the memory layer + the active
-- loan folder structure. add column if not exists is safe + idempotent.
alter table public.loan_documents add column if not exists loan_memory_id uuid references public.loan_memory(id) on delete set null;
alter table public.loan_documents add column if not exists folder_category text;  -- 00_LOAN_OVERVIEW ... 06_FINAL / Customer Team Uploads
alter table public.loan_documents add column if not exists received_from text;
alter table public.loan_documents add column if not exists submitted_to_lender boolean not null default false;
alter table public.loan_documents add column if not exists submitted_date timestamptz;
alter table public.loan_documents add column if not exists review_status text not null default 'unreviewed';

-- ---- triggers ----------------------------------------------------------
drop trigger if exists trg_loan_memory_updated on public.loan_memory;
create trigger trg_loan_memory_updated before update on public.loan_memory
  for each row execute function public.set_updated_at();
drop trigger if exists trg_user_ai_prefs_updated on public.user_ai_preferences;
create trigger trg_user_ai_prefs_updated before update on public.user_ai_preferences
  for each row execute function public.set_updated_at();

-- ---- indexes -----------------------------------------------------------
create index if not exists idx_loan_memory_loan on public.loan_memory(loan_id);
create index if not exists idx_loan_memory_owner on public.loan_memory(owner_id);
create index if not exists idx_loan_memory_borrower on public.loan_memory(lower(borrower_name));
create index if not exists idx_loan_memory_loan_number on public.loan_memory(lower(loan_number));
create index if not exists idx_loan_memory_address on public.loan_memory(lower(property_address));
create index if not exists idx_lme_memory on public.loan_memory_events(loan_memory_id, created_at desc);
create index if not exists idx_lairl_memory on public.loan_ai_retrieval_logs(loan_memory_id);
create index if not exists idx_lairl_user on public.loan_ai_retrieval_logs(assistant_user_id);
create index if not exists idx_loan_documents_memory on public.loan_documents(loan_memory_id);
