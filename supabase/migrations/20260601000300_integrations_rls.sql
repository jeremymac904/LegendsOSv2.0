-- LegendsOS v2 — Live Integration Connections Row Level Security (Sprint 4)
-- ---------------------------------------------------------------------------
-- NOT auto-applied — owner applies via Supabase after review.
-- ---------------------------------------------------------------------------
-- Visibility model:
--   user_integration_connections
--     user        -> full self access to their OWN connection rows.
--     owner/admin -> SELECT all (status oversight) — write only their own.
--   integration_audit_log
--     owner/admin -> SELECT only. INSERT via service_role only (NO client
--                    insert policy — so client inserts are denied by RLS).
--   social_account_connections
--     owner/admin -> full access (connect/manage/enable publishing).
--   publish_attempts
--     owner/admin -> SELECT only. INSERT via service_role only (no client
--                    insert policy).
-- service_role bypasses RLS automatically. Reuses public.is_admin_or_owner().
-- ---------------------------------------------------------------------------

set search_path = public;

alter table public.user_integration_connections enable row level security;
alter table public.integration_audit_log        enable row level security;
alter table public.social_account_connections   enable row level security;
alter table public.publish_attempts             enable row level security;

-- user_integration_connections: self manages own rows; admin/owner read all.
drop policy if exists uic_select on public.user_integration_connections;
create policy uic_select on public.user_integration_connections for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists uic_insert on public.user_integration_connections;
create policy uic_insert on public.user_integration_connections for insert
  with check (user_id = auth.uid());
drop policy if exists uic_update on public.user_integration_connections;
create policy uic_update on public.user_integration_connections for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists uic_delete on public.user_integration_connections;
create policy uic_delete on public.user_integration_connections for delete
  using (public.is_admin_or_owner() or user_id = auth.uid());

-- integration_audit_log: owner/admin SELECT only. Inserts come from
-- service_role (which bypasses RLS) — no client insert policy is defined, so
-- client inserts are denied.
drop policy if exists ial_select on public.integration_audit_log;
create policy ial_select on public.integration_audit_log for select
  using (public.is_admin_or_owner());

-- social_account_connections: owner/admin manage everything (incl. the
-- is_publish_enabled approval switch).
drop policy if exists sac_select on public.social_account_connections;
create policy sac_select on public.social_account_connections for select
  using (public.is_admin_or_owner());
drop policy if exists sac_write on public.social_account_connections;
create policy sac_write on public.social_account_connections for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- publish_attempts: owner/admin SELECT only. Inserts come from service_role
-- (no client insert policy -> client inserts denied).
drop policy if exists pa_select on public.publish_attempts;
create policy pa_select on public.publish_attempts for select
  using (public.is_admin_or_owner());
