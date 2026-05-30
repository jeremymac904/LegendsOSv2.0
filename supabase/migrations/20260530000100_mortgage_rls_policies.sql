-- LegendsOS v2 — Mortgage Loan Brain Row Level Security
-- Phase 1 RLS for the mortgage data model.
--
-- Visibility model:
--   owner/admin (Jeremy)      -> all loans + all children
--   loan_officer (LO)         -> only loans where owner_id = auth.uid()
--   processor (Ashley)        -> only loans where assigned_processor_id = auth.uid()
--   coordinator (Geraldine)   -> only loans where assigned_coordinator_id = auth.uid()
-- Child tables inherit visibility from their parent loan via can_view_loan().
-- Append-only tables (loan_status_events, loan_activity_log) allow select+insert only.
-- service_role (server jobs) bypasses RLS automatically.

set search_path = public;

-- Helper: can the current user VIEW this loan? --------------------------
-- SECURITY DEFINER so it can evaluate the loan row without triggering
-- recursive RLS on public.loans.
create or replace function public.can_view_loan(p_loan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.loans l
    where l.id = p_loan_id
      and (
        public.is_admin_or_owner()
        or l.owner_id = auth.uid()
        or l.assigned_processor_id = auth.uid()
        or l.assigned_coordinator_id = auth.uid()
      )
  );
$$;

comment on function public.can_view_loan(uuid) is 'True if the current user may view the loan (admin, owner LO, assigned processor, or assigned coordinator).';

-- Helper: does the current user OWN this loan (LO or admin)? ------------
create or replace function public.owns_loan(p_loan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.loans l
    where l.id = p_loan_id
      and (public.is_admin_or_owner() or l.owner_id = auth.uid())
  );
$$;

comment on function public.owns_loan(uuid) is 'True if the current user is the loan owner (LO) or an admin. Used for delete/ownership-gated writes.';

-- =======================================================================
-- loans
-- =======================================================================
alter table public.loans enable row level security;

create policy "loans_select_visible" on public.loans
  for select using (
    public.is_admin_or_owner()
    or owner_id = auth.uid()
    or assigned_processor_id = auth.uid()
    or assigned_coordinator_id = auth.uid()
  );

create policy "loans_insert_owner" on public.loans
  for insert with check (owner_id = auth.uid() or public.is_admin_or_owner());

create policy "loans_update_visible" on public.loans
  for update using (
    public.is_admin_or_owner()
    or owner_id = auth.uid()
    or assigned_processor_id = auth.uid()
    or assigned_coordinator_id = auth.uid()
  );

create policy "loans_delete_owner" on public.loans
  for delete using (public.is_admin_or_owner() or owner_id = auth.uid());

-- =======================================================================
-- borrowers
-- =======================================================================
alter table public.borrowers enable row level security;

create policy "borrowers_select" on public.borrowers
  for select using (public.can_view_loan(loan_id));
create policy "borrowers_insert" on public.borrowers
  for insert with check (public.can_view_loan(loan_id));
create policy "borrowers_update" on public.borrowers
  for update using (public.can_view_loan(loan_id));
create policy "borrowers_delete" on public.borrowers
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- loan_documents
-- =======================================================================
alter table public.loan_documents enable row level security;

create policy "loan_documents_select" on public.loan_documents
  for select using (public.can_view_loan(loan_id));
create policy "loan_documents_insert" on public.loan_documents
  for insert with check (public.can_view_loan(loan_id));
create policy "loan_documents_update" on public.loan_documents
  for update using (public.can_view_loan(loan_id));
create policy "loan_documents_delete" on public.loan_documents
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- loan_conditions
-- =======================================================================
alter table public.loan_conditions enable row level security;

create policy "loan_conditions_select" on public.loan_conditions
  for select using (public.can_view_loan(loan_id));
create policy "loan_conditions_insert" on public.loan_conditions
  for insert with check (public.can_view_loan(loan_id));
create policy "loan_conditions_update" on public.loan_conditions
  for update using (public.can_view_loan(loan_id));
create policy "loan_conditions_delete" on public.loan_conditions
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- loan_contacts
-- =======================================================================
alter table public.loan_contacts enable row level security;

create policy "loan_contacts_select" on public.loan_contacts
  for select using (public.can_view_loan(loan_id));
create policy "loan_contacts_insert" on public.loan_contacts
  for insert with check (public.can_view_loan(loan_id));
create policy "loan_contacts_update" on public.loan_contacts
  for update using (public.can_view_loan(loan_id));
create policy "loan_contacts_delete" on public.loan_contacts
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- loan_tasks
-- =======================================================================
alter table public.loan_tasks enable row level security;

create policy "loan_tasks_select" on public.loan_tasks
  for select using (public.can_view_loan(loan_id));
create policy "loan_tasks_insert" on public.loan_tasks
  for insert with check (public.can_view_loan(loan_id));
create policy "loan_tasks_update" on public.loan_tasks
  for update using (public.can_view_loan(loan_id));
create policy "loan_tasks_delete" on public.loan_tasks
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- loan_approvals  (HITL queue — approve/reject is a consequential action;
--                  the app restricts who may APPROVE; RLS allows assignees to read/queue)
-- =======================================================================
alter table public.loan_approvals enable row level security;

create policy "loan_approvals_select" on public.loan_approvals
  for select using (public.can_view_loan(loan_id));
create policy "loan_approvals_insert" on public.loan_approvals
  for insert with check (public.can_view_loan(loan_id));
create policy "loan_approvals_update" on public.loan_approvals
  for update using (public.can_view_loan(loan_id));
create policy "loan_approvals_delete" on public.loan_approvals
  for delete using (public.owns_loan(loan_id));

-- =======================================================================
-- drive_folder_links  (root links have loan_id = null and are owner-scoped)
-- =======================================================================
alter table public.drive_folder_links enable row level security;

create policy "drive_folder_links_select" on public.drive_folder_links
  for select using (
    owner_id = auth.uid()
    or public.is_admin_or_owner()
    or (loan_id is not null and public.can_view_loan(loan_id))
  );
create policy "drive_folder_links_insert" on public.drive_folder_links
  for insert with check (owner_id = auth.uid() or public.is_admin_or_owner());
create policy "drive_folder_links_update" on public.drive_folder_links
  for update using (owner_id = auth.uid() or public.is_admin_or_owner());
create policy "drive_folder_links_delete" on public.drive_folder_links
  for delete using (owner_id = auth.uid() or public.is_admin_or_owner());

-- =======================================================================
-- loan_status_events  (append-only: select + insert only)
-- =======================================================================
alter table public.loan_status_events enable row level security;

create policy "loan_status_events_select" on public.loan_status_events
  for select using (public.can_view_loan(loan_id));
create policy "loan_status_events_insert" on public.loan_status_events
  for insert with check (public.can_view_loan(loan_id));

-- =======================================================================
-- loan_activity_log  (append-only: select + insert only)
-- =======================================================================
alter table public.loan_activity_log enable row level security;

create policy "loan_activity_log_select" on public.loan_activity_log
  for select using (public.can_view_loan(loan_id));
create policy "loan_activity_log_insert" on public.loan_activity_log
  for insert with check (public.can_view_loan(loan_id));
