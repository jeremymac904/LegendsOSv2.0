-- LegendsOS v2 — Gmail AI Intake Row Level Security (Phase 1)
-- ---------------------------------------------------------------------------
-- Visibility model:
--   owner/admin (Jeremy)  -> all intake rows (read + manage)
--   team member           -> read only the messages/attachments routed to
--                            their own mailbox (email_intake_team.profile_id
--                            = auth.uid())
--   service_role (n8n webhooks + server jobs) -> bypasses RLS automatically;
--                            this is how intake rows are written in Phase 1.
-- Reuses public.is_admin_or_owner() from the mortgage RLS migration.
-- ---------------------------------------------------------------------------

set search_path = public;

alter table public.email_intake_team        enable row level security;
alter table public.email_intake_messages    enable row level security;
alter table public.email_intake_attachments enable row level security;
alter table public.email_intake_alerts      enable row level security;
alter table public.email_intake_audit       enable row level security;

-- Helper: is the current user the team member who owns this intake message?
create or replace function public.owns_intake_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.email_intake_messages m
    join public.email_intake_team t on t.id = m.team_member_id
    where m.id = p_message_id
      and (public.is_admin_or_owner() or t.profile_id = auth.uid())
  );
$$;
comment on function public.owns_intake_message(uuid) is 'True if the current user is admin/owner or the team member whose mailbox received this intake message.';

-- email_intake_team: admin/owner manage; members can read their own row.
drop policy if exists eit_select on public.email_intake_team;
create policy eit_select on public.email_intake_team for select
  using (public.is_admin_or_owner() or profile_id = auth.uid());
drop policy if exists eit_write on public.email_intake_team;
create policy eit_write on public.email_intake_team for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- email_intake_messages: admin/owner all; member reads their routed mail.
drop policy if exists eim_select on public.email_intake_messages;
create policy eim_select on public.email_intake_messages for select
  using (
    public.is_admin_or_owner()
    or exists (
      select 1 from public.email_intake_team t
      where t.id = email_intake_messages.team_member_id
        and t.profile_id = auth.uid()
    )
  );
drop policy if exists eim_write on public.email_intake_messages;
create policy eim_write on public.email_intake_messages for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- email_intake_attachments: visibility inherits from the parent message.
drop policy if exists eia_select on public.email_intake_attachments;
create policy eia_select on public.email_intake_attachments for select
  using (public.owns_intake_message(message_id));
drop policy if exists eia_write on public.email_intake_attachments;
create policy eia_write on public.email_intake_attachments for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- email_intake_alerts: admin/owner manage; member reads alerts on their mail.
drop policy if exists eial_select on public.email_intake_alerts;
create policy eial_select on public.email_intake_alerts for select
  using (public.is_admin_or_owner() or public.owns_intake_message(message_id));
drop policy if exists eial_write on public.email_intake_alerts;
create policy eial_write on public.email_intake_alerts for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- email_intake_audit: admin/owner read; inserts come from service_role only.
drop policy if exists eiaudit_select on public.email_intake_audit;
create policy eiaudit_select on public.email_intake_audit for select
  using (public.is_admin_or_owner());
