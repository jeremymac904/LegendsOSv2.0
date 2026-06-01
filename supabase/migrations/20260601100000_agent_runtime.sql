-- LegendsOS v2 — Multi-Agent Runtime data model (Hermes-style, native)
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY. Creates the shared runtime that powers every role-based
-- agent (Atlas / FLO / Coordinator / Builder / Marketing / ...). Does NOT
-- duplicate existing tables:
--   - per-loan memory  -> reuse public.loan_memory + loan_memory_events
--   - per-user voice    -> reuse public.user_ai_preferences
--   - knowledge / RAG   -> reuse public.knowledge_collections / knowledge_items
-- This layer adds AGENT identity, sessions, per-agent private memory, reusable
-- skills, a permissioned tool-call log, execution traces and handoffs.
--
-- SAFETY:
--   * No secrets, OAuth tokens, passwords or raw borrower PII are stored by the
--     runtime — trace/tool rows carry SUMMARIES only (see app layer guards).
--   * This migration is NOT auto-applied; the owner applies it. Until applied,
--     the app degrades to "memory setup needed" (42P01 handled in code) and
--     agents still make real model calls statelessly.
--   * RLS lives in the companion 20260601100100_agent_runtime_rls.sql.
-- ---------------------------------------------------------------------------

set search_path = public;
create extension if not exists "pgcrypto";

-- Defensive shared updated_at trigger fn (also defined by earlier migrations).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Valid agent types. A future agent is a one-line additive ALTER ... DROP/ADD
-- of this constraint; the app registry (lib/agents/registry.ts) is the source
-- of truth for behaviour.
-- owner_atlas | lo_atlas | processor_flo | coordinator_agent | builder_agent
-- marketing_agent | academy_agent | media_agent | social_agent | docs_agent | ux_agent

-- =======================================================================
-- agent_sessions — one conversation between a user and a specific agent.
-- =======================================================================
create table if not exists public.agent_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  agent_type      text not null,
  title           text,
  status          text not null default 'active'
                    check (status in ('active','archived','handed_off')),
  -- SOFT links to existing context (plain uuid, no FK) so this migration
  -- applies regardless of whether the dormant mortgage/loan_memory migrations
  -- have run. The runtime resolves these degrade-safe at read time.
  loan_id         uuid,
  loan_memory_id  uuid,
  origin          text not null default 'web'
                    check (origin in ('web','browser_companion','handoff','api')),
  context_summary text,
  last_message_at timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint agent_sessions_agent_type_chk check (agent_type in (
    'owner_atlas','lo_atlas','processor_flo','coordinator_agent','builder_agent',
    'marketing_agent','academy_agent','media_agent','social_agent','docs_agent','ux_agent'
  ))
);

-- =======================================================================
-- agent_messages — append-only transcript for a session.
-- =======================================================================
create table if not exists public.agent_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.agent_sessions(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  agent_type  text not null,
  role        text not null check (role in ('user','assistant','system','tool')),
  content     text not null default '',
  provider    text,
  model       text,
  trace_id    uuid,
  token_count integer,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =======================================================================
-- agent_memories — per-user, per-agent PRIVATE memory.
-- Scoped strictly by user_id + agent_type. Atlas-for-Scott != Atlas-for-Eric.
-- =======================================================================
create table if not exists public.agent_memories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  agent_type      text not null,
  category        text not null default 'assistant_note' check (category in (
    'profile_preference','tone_preference','workflow_preference','borrower_workflow',
    'document_workflow','email_workflow','social_workflow','loan_condition_workflow',
    'drive_folder_workflow','prompt_pattern','saved_instruction','personal_rule','assistant_note'
  )),
  title           text not null,
  body            text not null default '',
  tags            jsonb not null default '[]'::jsonb,
  confidence      text not null default 'medium' check (confidence in ('high','medium','low')),
  priority        text not null default 'medium'
                    check (priority in ('highest','high','medium','low','lowest')),
  source_summary  text,
  is_active       boolean not null default true,
  is_sample       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =======================================================================
-- agent_memory_events — append-only audit of memory writes (who/why/when).
-- =======================================================================
create table if not exists public.agent_memory_events (
  id          uuid primary key default gen_random_uuid(),
  memory_id   uuid references public.agent_memories(id) on delete set null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  agent_type  text not null,
  event_type  text not null default 'memory_write' check (event_type in (
    'memory_write','memory_update','memory_correction','memory_deactivate',
    'preference_set','rule_added'
  )),
  event_summary text,
  source_type   text,
  source_name   text,
  confidence    text not null default 'medium' check (confidence in ('high','medium','low')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- =======================================================================
-- agent_skills — reusable per-user workflows; can be promoted to team shared.
-- =======================================================================
create table if not exists public.agent_skills (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  organization_id      uuid references public.organizations(id) on delete set null,
  agent_type           text not null,
  skill_name           text not null,
  skill_slug           text not null,
  description          text,
  trigger_phrases      jsonb not null default '[]'::jsonb,
  input_schema         jsonb not null default '{}'::jsonb,
  output_format        text,
  steps                jsonb not null default '[]'::jsonb,
  source_examples      jsonb not null default '[]'::jsonb,
  confidence           text not null default 'medium' check (confidence in ('high','medium','low')),
  usage_count          integer not null default 0,
  last_used_at         timestamptz,
  created_by           uuid references public.profiles(id) on delete set null,
  visibility           public.assistant_visibility not null default 'assigned_user',
  is_active            boolean not null default true,
  is_shared_with_team  boolean not null default false,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, agent_type, skill_slug)
);

-- =======================================================================
-- agent_skill_versions — immutable version history for a skill.
-- =======================================================================
create table if not exists public.agent_skill_versions (
  id             uuid primary key default gen_random_uuid(),
  skill_id       uuid not null references public.agent_skills(id) on delete cascade,
  version        integer not null default 1,
  snapshot       jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (skill_id, version)
);

-- =======================================================================
-- agent_skill_usage — append-only usage log (for usage_count + history).
-- =======================================================================
create table if not exists public.agent_skill_usage (
  id          uuid primary key default gen_random_uuid(),
  skill_id    uuid not null references public.agent_skills(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  session_id  uuid references public.agent_sessions(id) on delete set null,
  agent_type  text not null,
  outcome     text not null default 'used' check (outcome in ('used','succeeded','failed','dismissed')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =======================================================================
-- agent_tool_calls — permissioned, audited tool invocations (SUMMARIES only).
-- =======================================================================
create table if not exists public.agent_tool_calls (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references public.agent_sessions(id) on delete set null,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  agent_type     text not null,
  tool_name      text not null,
  input_summary  text,
  output_summary text,
  status         text not null default 'ok'
                   check (status in ('ok','blocked','error','needs_confirmation','skipped')),
  permissioned   boolean not null default true,
  audited        boolean not null default true,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- =======================================================================
-- agent_traces — Hermes-style execution trace (NO secrets, NO raw PII).
-- =======================================================================
create table if not exists public.agent_traces (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references public.agent_sessions(id) on delete set null,
  message_id     uuid references public.agent_messages(id) on delete set null,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  agent_type     text not null,
  input_summary  text,
  context_loaded jsonb not null default '[]'::jsonb,  -- list of source LABELS only
  skills_used    jsonb not null default '[]'::jsonb,
  tools_called   jsonb not null default '[]'::jsonb,
  provider       text,
  model_used     text,
  output_type    text,
  duration_ms    integer,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- =======================================================================
-- agent_handoffs — pass a session/context from one agent (or user) to another.
-- =======================================================================
create table if not exists public.agent_handoffs (
  id              uuid primary key default gen_random_uuid(),
  from_session_id uuid references public.agent_sessions(id) on delete set null,
  to_session_id   uuid references public.agent_sessions(id) on delete set null,
  from_user_id    uuid not null references public.profiles(id) on delete cascade,
  to_user_id      uuid references public.profiles(id) on delete set null,
  from_agent_type text not null,
  to_agent_type   text not null,
  reason          text,
  context_summary text,
  status          text not null default 'pending'
                    check (status in ('pending','accepted','declined','completed')),
  metadata        jsonb not null default '{}'::jsonb,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------
drop trigger if exists trg_agent_sessions_updated on public.agent_sessions;
create trigger trg_agent_sessions_updated before update on public.agent_sessions
  for each row execute function public.set_updated_at();
drop trigger if exists trg_agent_memories_updated on public.agent_memories;
create trigger trg_agent_memories_updated before update on public.agent_memories
  for each row execute function public.set_updated_at();
drop trigger if exists trg_agent_skills_updated on public.agent_skills;
create trigger trg_agent_skills_updated before update on public.agent_skills
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------
create index if not exists idx_agent_sessions_user      on public.agent_sessions(user_id, agent_type);
create index if not exists idx_agent_sessions_loan       on public.agent_sessions(loan_id);
create index if not exists idx_agent_messages_session    on public.agent_messages(session_id, created_at);
create index if not exists idx_agent_memories_user_agent on public.agent_memories(user_id, agent_type) where is_active;
create index if not exists idx_agent_memories_category   on public.agent_memories(category);
create index if not exists idx_agent_memories_title      on public.agent_memories(lower(title));
create index if not exists idx_agent_memory_events_user  on public.agent_memory_events(user_id, created_at desc);
create index if not exists idx_agent_skills_user_agent   on public.agent_skills(user_id, agent_type) where is_active;
create index if not exists idx_agent_skills_slug         on public.agent_skills(lower(skill_slug));
create index if not exists idx_agent_skills_shared       on public.agent_skills(organization_id) where is_shared_with_team;
create index if not exists idx_agent_skill_versions_skill on public.agent_skill_versions(skill_id, version desc);
create index if not exists idx_agent_skill_usage_skill   on public.agent_skill_usage(skill_id, created_at desc);
create index if not exists idx_agent_tool_calls_user     on public.agent_tool_calls(user_id, created_at desc);
create index if not exists idx_agent_traces_user         on public.agent_traces(user_id, created_at desc);
create index if not exists idx_agent_traces_session      on public.agent_traces(session_id, created_at desc);
create index if not exists idx_agent_handoffs_to_user    on public.agent_handoffs(to_user_id) where status = 'pending';
create index if not exists idx_agent_handoffs_from_user  on public.agent_handoffs(from_user_id, created_at desc);
