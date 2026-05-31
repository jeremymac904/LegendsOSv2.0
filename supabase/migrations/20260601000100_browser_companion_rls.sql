-- LegendsOS v2 — Browser Companion Row Level Security (Sprint 4)
-- ---------------------------------------------------------------------------
-- NOT auto-applied — owner applies via Supabase after review.
-- ---------------------------------------------------------------------------
-- Visibility model:
--   owner/admin (Jeremy)  -> SELECT all sessions + captures (oversight).
--   user                  -> full self access to their OWN sessions + captures
--                            (select/insert/update/delete their own rows only).
--   captures hold borrower context -> strict self+org RLS, never public. No
--   cross-user access except owner/admin SELECT. service_role bypasses RLS.
-- Reuses public.is_admin_or_owner() from the init/mortgage RLS migrations.
-- ---------------------------------------------------------------------------

set search_path = public;

alter table public.browser_companion_sessions enable row level security;
alter table public.browser_companion_captures enable row level security;

-- browser_companion_sessions: a user manages their own; admin/owner read all.
drop policy if exists bcs_select on public.browser_companion_sessions;
create policy bcs_select on public.browser_companion_sessions for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists bcs_insert on public.browser_companion_sessions;
create policy bcs_insert on public.browser_companion_sessions for insert
  with check (user_id = auth.uid());
drop policy if exists bcs_update on public.browser_companion_sessions;
create policy bcs_update on public.browser_companion_sessions for update
  using (public.is_admin_or_owner() or user_id = auth.uid())
  with check (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists bcs_delete on public.browser_companion_sessions;
create policy bcs_delete on public.browser_companion_sessions for delete
  using (public.is_admin_or_owner() or user_id = auth.uid());

-- browser_companion_captures: STRICT self access (holds borrower context);
-- admin/owner may SELECT for oversight but only the owning user may write.
drop policy if exists bcc_select on public.browser_companion_captures;
create policy bcc_select on public.browser_companion_captures for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists bcc_insert on public.browser_companion_captures;
create policy bcc_insert on public.browser_companion_captures for insert
  with check (user_id = auth.uid());
drop policy if exists bcc_update on public.browser_companion_captures;
create policy bcc_update on public.browser_companion_captures for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists bcc_delete on public.browser_companion_captures;
create policy bcc_delete on public.browser_companion_captures for delete
  using (user_id = auth.uid());
