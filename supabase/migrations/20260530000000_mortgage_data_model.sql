-- LegendsOS v2 — Mortgage Loan Brain data model
-- Phase 1 of the mortgage operations foundation (feature/loan-brain-drive-browser).
-- Tables use snake_case; timestamps are timestamptz with UTC defaults.
-- NOTE: No borrower PII is seeded here. Sample/demo records live in the app layer
--       (lib/loanbrain/sampleData.ts) and are flagged is_sample at runtime only.
-- Status vocabulary borrows the herdr model: blocked / working / done / seen.

set search_path = public;

create extension if not exists "pgcrypto";

-- Self-contained updated_at trigger fn (defensive create-or-replace so this
-- migration does not depend on ordering relative to 005/init).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Add the coordinator role (Geraldine) to the existing user_role enum.
-- Mirrors the idempotent pattern from 20260513000000_extend_user_roles.sql.
-- Not used as a value inside this same migration, so it is transaction-safe.
do $$
begin
  alter type public.user_role add value if not exists 'coordinator';
exception when others then
  null;
end$$;

-- =======================================================================
-- loans  (one row per loan file; owner_id = the loan officer who owns it)
-- =======================================================================
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  assigned_processor_id uuid references public.profiles(id) on delete set null,
  assigned_coordinator_id uuid references public.profiles(id) on delete set null,
  loan_number text,
  loan_program text,
  loan_purpose text check (loan_purpose in (
    'purchase','rate_term_refinance','cash_out_refinance','heloc','construction','other'
  )),
  property_address text,
  lender text,
  stage text not null default 'lead' check (stage in (
    'lead','prospect','application','processing','underwriting',
    'approved','clear_to_close','funded','closed','past_client','withdrawn'
  )),
  stage_status text not null default 'working' check (stage_status in (
    'blocked','working','done','seen'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  drive_folder_id text,
  drive_url text,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loans is 'Mortgage loan files. owner_id = loan officer; assigned_processor_id = Ashley; assigned_coordinator_id = Geraldine. stage_status uses the blocked/working/done/seen model.';

-- =======================================================================
-- borrowers  (a loan has one or more borrowers)
-- =======================================================================
create table if not exists public.borrowers (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  is_primary boolean not null default true,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.borrowers is 'Borrowers linked to a loan. PII is access-scoped via RLS; never committed to the repo.';

-- =======================================================================
-- loan_documents  (received / missing tracker)
-- =======================================================================
create table if not exists public.loan_documents (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other' check (category in (
    'application','income','assets','credit','property','title','hoi',
    'aus','conditions','disclosures','correspondence','other'
  )),
  name text not null,
  drive_file_id text,
  drive_url text,
  status text not null default 'missing' check (status in ('received','missing','pending','waived')),
  received_at timestamptz,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loan_documents is 'Per-loan document tracker. status drives the received/missing list. drive_* are read-only references to Google Drive — LegendsOS never writes to Drive.';

-- =======================================================================
-- loan_conditions  (UW / AUS / lender conditions + response plan)
-- =======================================================================
create table if not exists public.loan_conditions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'uw' check (source in ('aus','uw','lender','other')),
  description text not null,
  status text not null default 'open' check (status in ('open','in_progress','submitted','cleared','waived')),
  response_plan text,
  citation_source text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loan_conditions is 'Underwriting/AUS/lender conditions. citation_source must reference a real guideline source; agency (AUS) findings are NOT lender approval.';

-- =======================================================================
-- loan_contacts  (AE, account manager, title, HOI, realtor, etc.)
-- =======================================================================
create table if not exists public.loan_contacts (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_type text not null default 'other' check (contact_type in (
    'ae','account_manager','support_desk','realtor','title','hoi','processor','other'
  )),
  name text,
  email text,
  phone text,
  company text,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loan_contacts is 'Contacts attached to a loan (AE, account manager, support desk, realtor, title, HOI).';

-- =======================================================================
-- loan_status_events  (append-only stage/status history)
-- =======================================================================
create table if not exists public.loan_status_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  from_stage text,
  to_stage text,
  from_status text,
  to_status text,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.loan_status_events is 'Append-only history of loan stage/status changes for pipeline tracking and audit.';

-- =======================================================================
-- loan_tasks  (todo / doing / blocked / done)
-- =======================================================================
create table if not exists public.loan_tasks (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  detail text,
  assignee_role text not null default 'any' check (assignee_role in (
    'owner','processor','coordinator','loan_officer','any'
  )),
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loan_tasks is 'Per-loan tasks for the processor/coordinator boards. status uses todo/doing/blocked/done.';

-- =======================================================================
-- loan_approvals  (surgical human-in-the-loop queue for consequential actions)
-- =======================================================================
create table if not exists public.loan_approvals (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null default 'other' check (action_type in (
    'send_email','send_sms','move_file','pipeline_push','social_publish','other'
  )),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid references public.profiles(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loan_approvals is 'Approval queue for consequential actions (send/move/push). Nothing leaves the system until a human approves. Default status pending.';

-- =======================================================================
-- loan_activity_log  (append-only audit trail)
-- =======================================================================
create table if not exists public.loan_activity_log (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.loan_activity_log is 'Append-only audit log of consequential actions per loan (reviewable by leadership).';

-- =======================================================================
-- drive_folder_links  (read-only references to Google Drive folders)
-- =======================================================================
create table if not exists public.drive_folder_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete set null,
  folder_kind text not null default 'other' check (folder_kind in (
    'root','active_loans','leads','prospects','past_clients','loan_brain','uw_guides','borrower','other'
  )),
  label text not null,
  drive_folder_id text,
  drive_url text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.drive_folder_links is 'Read-only references to Google Drive folders (root pipeline sections + per-borrower folders). LegendsOS never writes/moves/renames/deletes in Drive.';

-- =======================================================================
-- updated_at triggers
-- =======================================================================
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'loans','borrowers','loan_documents','loan_conditions','loan_contacts',
      'loan_tasks','loan_approvals','drive_folder_links'
    ])
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I;', tbl, tbl);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at();', tbl, tbl);
  end loop;
end;
$$;

-- =======================================================================
-- Indexes
-- =======================================================================
create index if not exists idx_loans_owner on public.loans(owner_id);
create index if not exists idx_loans_processor on public.loans(assigned_processor_id);
create index if not exists idx_loans_coordinator on public.loans(assigned_coordinator_id);
create index if not exists idx_loans_stage on public.loans(stage);
create index if not exists idx_borrowers_loan on public.borrowers(loan_id);
create index if not exists idx_loan_documents_loan on public.loan_documents(loan_id);
create index if not exists idx_loan_documents_status on public.loan_documents(status);
create index if not exists idx_loan_conditions_loan on public.loan_conditions(loan_id);
create index if not exists idx_loan_contacts_loan on public.loan_contacts(loan_id);
create index if not exists idx_loan_status_events_loan on public.loan_status_events(loan_id);
create index if not exists idx_loan_tasks_loan on public.loan_tasks(loan_id);
create index if not exists idx_loan_tasks_assignee on public.loan_tasks(assignee_id);
create index if not exists idx_loan_approvals_loan on public.loan_approvals(loan_id);
create index if not exists idx_loan_approvals_status on public.loan_approvals(status);
create index if not exists idx_loan_activity_loan on public.loan_activity_log(loan_id);
create index if not exists idx_drive_folder_links_owner on public.drive_folder_links(owner_id);
create index if not exists idx_drive_folder_links_loan on public.drive_folder_links(loan_id);
