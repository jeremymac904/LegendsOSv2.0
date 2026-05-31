-- LegendsOS v2 — Persistent Loan Memory Row Level Security
-- ---------------------------------------------------------------------------
-- Visibility model (mirrors the mortgage RLS):
--   owner/admin (Jeremy)  -> all loan memory + events + retrieval logs
--   loan_officer          -> memory for loans assigned to them (or where they
--                            are primary_loan_officer / owner of the memory)
--   processor             -> memory for files where they are the processor
--   coordinator           -> memory for files where they are the coordinator
--   user_ai_preferences   -> a user sees only their own row (admin sees all)
-- Retrieval logs respect the SAME loan access as the memory they reference.
-- service_role (server jobs) bypasses RLS automatically. Reuses
-- public.is_admin_or_owner() and public.can_view_loan().
-- ---------------------------------------------------------------------------

set search_path = public;

alter table public.loan_memory             enable row level security;
alter table public.loan_memory_events      enable row level security;
alter table public.loan_ai_retrieval_logs  enable row level security;
alter table public.user_ai_preferences     enable row level security;

-- Helper: may the current user VIEW this loan_memory row? -----------------
create or replace function public.can_view_loan_memory(p_memory_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.loan_memory m
    where m.id = p_memory_id
      and (
        public.is_admin_or_owner()
        or m.owner_id = auth.uid()
        or m.primary_loan_officer = auth.uid()
        or m.processor = auth.uid()
        or m.loan_coordinator = auth.uid()
        or (m.loan_id is not null and public.can_view_loan(m.loan_id))
      )
  );
$$;
comment on function public.can_view_loan_memory(uuid) is 'True if the current user may view this loan memory (admin/owner, the memory owner/assigned LO/processor/coordinator, or anyone who can view the linked loan).';

-- loan_memory: view per helper; write limited to admin/owner + the owning LO.
drop policy if exists loan_memory_select on public.loan_memory;
create policy loan_memory_select on public.loan_memory for select
  using (
    public.is_admin_or_owner()
    or owner_id = auth.uid()
    or primary_loan_officer = auth.uid()
    or processor = auth.uid()
    or loan_coordinator = auth.uid()
    or (loan_id is not null and public.can_view_loan(loan_id))
  );
drop policy if exists loan_memory_insert on public.loan_memory;
create policy loan_memory_insert on public.loan_memory for insert
  with check (public.is_admin_or_owner() or owner_id = auth.uid() or primary_loan_officer = auth.uid());
drop policy if exists loan_memory_update on public.loan_memory;
create policy loan_memory_update on public.loan_memory for update
  using (
    public.is_admin_or_owner() or owner_id = auth.uid()
    or primary_loan_officer = auth.uid() or processor = auth.uid()
    or loan_coordinator = auth.uid()
  )
  with check (
    public.is_admin_or_owner() or owner_id = auth.uid()
    or primary_loan_officer = auth.uid() or processor = auth.uid()
    or loan_coordinator = auth.uid()
  );
drop policy if exists loan_memory_delete on public.loan_memory;
create policy loan_memory_delete on public.loan_memory for delete
  using (public.is_admin_or_owner());

-- loan_memory_events: visibility inherits from the parent memory.
drop policy if exists lme_select on public.loan_memory_events;
create policy lme_select on public.loan_memory_events for select
  using (public.can_view_loan_memory(loan_memory_id));
drop policy if exists lme_insert on public.loan_memory_events;
create policy lme_insert on public.loan_memory_events for insert
  with check (public.can_view_loan_memory(loan_memory_id));
-- Events are an append-only timeline: no UPDATE/DELETE policies (only
-- admin/owner could, and we intentionally omit it to preserve history).

-- loan_ai_retrieval_logs: same loan access as the referenced memory; a user
-- also sees their own logs. Inserts are typically by service_role.
drop policy if exists lairl_select on public.loan_ai_retrieval_logs;
create policy lairl_select on public.loan_ai_retrieval_logs for select
  using (
    public.is_admin_or_owner()
    or assistant_user_id = auth.uid()
    or (loan_memory_id is not null and public.can_view_loan_memory(loan_memory_id))
  );
drop policy if exists lairl_insert on public.loan_ai_retrieval_logs;
create policy lairl_insert on public.loan_ai_retrieval_logs for insert
  with check (
    public.is_admin_or_owner() or assistant_user_id = auth.uid()
  );

-- user_ai_preferences: a user manages only their own row; admin/owner see all.
drop policy if exists uap_select on public.user_ai_preferences;
create policy uap_select on public.user_ai_preferences for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists uap_write on public.user_ai_preferences;
create policy uap_write on public.user_ai_preferences for all
  using (public.is_admin_or_owner() or user_id = auth.uid())
  with check (public.is_admin_or_owner() or user_id = auth.uid());
