-- LegendsOS v2 — Multi-Agent Runtime Row Level Security
-- ---------------------------------------------------------------------------
-- Visibility model:
--   owner/admin (Jeremy) -> ALL sessions, memories, skills, traces, handoffs
--   every user           -> only their OWN sessions/memory/skills/traces
--   team-shared skills   -> readable org-wide (promoted by owner/admin)
--   private memory       -> NEVER visible to another user (admin read for audit)
--   handoffs             -> visible to the from-user, the to-user, and admin
-- Append-only tables (messages, memory_events, skill_usage, tool_calls,
-- traces) have SELECT + INSERT only — no UPDATE/DELETE — to preserve history.
-- service_role (server runtime) bypasses RLS. Reuses public.is_admin_or_owner()
-- and public.current_org_id().
-- ---------------------------------------------------------------------------

set search_path = public;

alter table public.agent_sessions       enable row level security;
alter table public.agent_messages        enable row level security;
alter table public.agent_memories        enable row level security;
alter table public.agent_memory_events   enable row level security;
alter table public.agent_skills          enable row level security;
alter table public.agent_skill_versions  enable row level security;
alter table public.agent_skill_usage     enable row level security;
alter table public.agent_tool_calls      enable row level security;
alter table public.agent_traces          enable row level security;
alter table public.agent_handoffs        enable row level security;

-- Helper: may the current user VIEW this session? -------------------------
create or replace function public.can_view_agent_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.agent_sessions s
    where s.id = p_session_id
      and (public.is_admin_or_owner() or s.user_id = auth.uid())
  );
$$;
comment on function public.can_view_agent_session(uuid) is 'True if current user owns the session or is admin/owner.';

-- Helper: may the current user VIEW this skill? ---------------------------
create or replace function public.can_view_agent_skill(p_skill_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.agent_skills sk
    where sk.id = p_skill_id
      and (
        public.is_admin_or_owner()
        or sk.user_id = auth.uid()
        or (sk.is_shared_with_team
            and sk.organization_id is not null
            and sk.organization_id = public.current_org_id())
      )
  );
$$;
comment on function public.can_view_agent_skill(uuid) is 'True if current user owns the skill, the skill is team-shared in their org, or admin/owner.';

-- agent_sessions ----------------------------------------------------------
drop policy if exists agent_sessions_select on public.agent_sessions;
create policy agent_sessions_select on public.agent_sessions for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists agent_sessions_write on public.agent_sessions;
create policy agent_sessions_write on public.agent_sessions for all
  using (public.is_admin_or_owner() or user_id = auth.uid())
  with check (public.is_admin_or_owner() or user_id = auth.uid());

-- agent_messages (append-only) -------------------------------------------
drop policy if exists agent_messages_select on public.agent_messages;
create policy agent_messages_select on public.agent_messages for select
  using (public.can_view_agent_session(session_id));
drop policy if exists agent_messages_insert on public.agent_messages;
create policy agent_messages_insert on public.agent_messages for insert
  with check (public.can_view_agent_session(session_id));

-- agent_memories: PRIVATE. user manages own; admin/owner read-only audit +
-- delete-for-remediation. No admin content edits.
drop policy if exists agent_memories_select on public.agent_memories;
create policy agent_memories_select on public.agent_memories for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists agent_memories_write on public.agent_memories;
create policy agent_memories_write on public.agent_memories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists agent_memories_admin_delete on public.agent_memories;
create policy agent_memories_admin_delete on public.agent_memories for delete
  using (public.is_admin_or_owner());

-- agent_memory_events (append-only) --------------------------------------
drop policy if exists agent_memory_events_select on public.agent_memory_events;
create policy agent_memory_events_select on public.agent_memory_events for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists agent_memory_events_insert on public.agent_memory_events;
create policy agent_memory_events_insert on public.agent_memory_events for insert
  with check (public.is_admin_or_owner() or user_id = auth.uid());

-- agent_skills: own + team-shared(read) + owner(all). 3-policy atlas pattern.
drop policy if exists agent_skills_select on public.agent_skills;
create policy agent_skills_select on public.agent_skills for select
  using (
    public.is_admin_or_owner()
    or user_id = auth.uid()
    or (is_shared_with_team
        and organization_id is not null
        and organization_id = public.current_org_id())
  );
drop policy if exists agent_skills_modify_self on public.agent_skills;
create policy agent_skills_modify_self on public.agent_skills for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists agent_skills_owner_all on public.agent_skills;
create policy agent_skills_owner_all on public.agent_skills for all
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- agent_skill_versions: visibility + write inherit from parent skill.
drop policy if exists agent_skill_versions_select on public.agent_skill_versions;
create policy agent_skill_versions_select on public.agent_skill_versions for select
  using (public.can_view_agent_skill(skill_id));
drop policy if exists agent_skill_versions_insert on public.agent_skill_versions;
create policy agent_skill_versions_insert on public.agent_skill_versions for insert
  with check (
    public.is_admin_or_owner()
    or exists (select 1 from public.agent_skills sk
               where sk.id = skill_id and sk.user_id = auth.uid())
  );

-- agent_skill_usage (append-only): own usage, parent-visible, or admin.
drop policy if exists agent_skill_usage_select on public.agent_skill_usage;
create policy agent_skill_usage_select on public.agent_skill_usage for select
  using (public.is_admin_or_owner() or user_id = auth.uid() or public.can_view_agent_skill(skill_id));
drop policy if exists agent_skill_usage_insert on public.agent_skill_usage;
create policy agent_skill_usage_insert on public.agent_skill_usage for insert
  with check (public.is_admin_or_owner() or user_id = auth.uid());

-- agent_tool_calls (append-only): own or admin.
drop policy if exists agent_tool_calls_select on public.agent_tool_calls;
create policy agent_tool_calls_select on public.agent_tool_calls for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists agent_tool_calls_insert on public.agent_tool_calls;
create policy agent_tool_calls_insert on public.agent_tool_calls for insert
  with check (public.is_admin_or_owner() or user_id = auth.uid());

-- agent_traces (append-only): own or admin.
drop policy if exists agent_traces_select on public.agent_traces;
create policy agent_traces_select on public.agent_traces for select
  using (public.is_admin_or_owner() or user_id = auth.uid());
drop policy if exists agent_traces_insert on public.agent_traces;
create policy agent_traces_insert on public.agent_traces for insert
  with check (public.is_admin_or_owner() or user_id = auth.uid());

-- agent_handoffs: from-user, to-user, or admin.
drop policy if exists agent_handoffs_select on public.agent_handoffs;
create policy agent_handoffs_select on public.agent_handoffs for select
  using (
    public.is_admin_or_owner()
    or from_user_id = auth.uid()
    or to_user_id = auth.uid()
  );
drop policy if exists agent_handoffs_insert on public.agent_handoffs;
create policy agent_handoffs_insert on public.agent_handoffs for insert
  with check (public.is_admin_or_owner() or from_user_id = auth.uid());
drop policy if exists agent_handoffs_update on public.agent_handoffs;
create policy agent_handoffs_update on public.agent_handoffs for update
  using (public.is_admin_or_owner() or from_user_id = auth.uid() or to_user_id = auth.uid())
  with check (public.is_admin_or_owner() or from_user_id = auth.uid() or to_user_id = auth.uid());
