-- LegendsOS v2 — Browser Companion data model (Sprint 4)
-- ---------------------------------------------------------------------------
-- NOT auto-applied — owner applies via Supabase after review.
-- ---------------------------------------------------------------------------
-- The Browser Companion is a Chrome extension + a /browser-companion web page
-- that let the user capture page context (URL, title, selected text, a small
-- structured context blob) and route it to an Atlas assistant. The extension
-- stores NO token — it authenticates via the user's existing LegendsOS web
-- session cookie. These tables are the NATIVE LegendsOS side: paired devices
-- (sessions) + captures.
--
-- SAFETY:
--   * browser_companion_captures may hold borrower context -> STRICT org+self
--     RLS, never public, never service-role-writable from clients.
--   * No PII / borrower data is seeded here. The app never logs capture
--     contents.
--   * snake_case tables; timestamptz UTC. Idempotent (create ... if not
--     exists). RLS lives in the companion *_browser_companion_rls.sql file.
-- ---------------------------------------------------------------------------

set search_path = public;

create extension if not exists "pgcrypto";

-- Defensive shared updated_at trigger fn (also defined by earlier migrations).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =======================================================================
-- browser_companion_sessions — one row per paired browser/device. The
-- extension does NOT store a token; this row just records that a device
-- paired against the user's web session, so the owner can see/revoke it.
-- =======================================================================
create table if not exists public.browser_companion_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  -- Human label for the device ("Jeremy's MacBook — Chrome"). User-entered.
  device_label text,
  -- Captured for diagnostics only; never a secret.
  user_agent text,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.browser_companion_sessions is 'Paired browser/device records for the Browser Companion. No tokens are stored — the extension uses the existing LegendsOS web-session cookie. Owner/admin can see all; users see their own.';

-- =======================================================================
-- browser_companion_captures — one row per captured page context routed to
-- an assistant. HOLDS BORROWER CONTEXT -> strict org+self RLS, never public.
-- structured_context is a small jsonb blob (extracted fields the extension
-- recognized). selected_text is the user's highlighted text.
-- =======================================================================
create table if not exists public.browser_companion_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  session_id uuid references public.browser_companion_sessions(id) on delete set null,
  source_url text,
  source_title text,
  selected_text text,
  structured_context jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  -- Which assistant the capture was routed to (e.g. 'atlas'). Free text so
  -- new assistants don't require a migration.
  routed_assistant text,
  status text not null default 'captured' check (status in (
    'captured','routed','dismissed','error'
  )),
  -- Set true once sensitive fields have been redacted before any wider use.
  is_redacted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.browser_companion_captures is 'Captured page context (url/title/selected text/structured context) routed to an Atlas assistant. May contain borrower context: strict self+org RLS, never public, never client-deletable by other users.';

-- ---- updated_at triggers ----------------------------------------------
drop trigger if exists trg_browser_companion_sessions_updated on public.browser_companion_sessions;
create trigger trg_browser_companion_sessions_updated before update on public.browser_companion_sessions
  for each row execute function public.set_updated_at();
drop trigger if exists trg_browser_companion_captures_updated on public.browser_companion_captures;
create trigger trg_browser_companion_captures_updated before update on public.browser_companion_captures
  for each row execute function public.set_updated_at();

-- ---- indexes ----------------------------------------------------------
create index if not exists idx_bcs_user on public.browser_companion_sessions(user_id);
create index if not exists idx_bcs_org on public.browser_companion_sessions(organization_id);
create index if not exists idx_bcs_active on public.browser_companion_sessions(is_active);
create index if not exists idx_bcc_user on public.browser_companion_captures(user_id);
create index if not exists idx_bcc_org on public.browser_companion_captures(organization_id);
create index if not exists idx_bcc_session on public.browser_companion_captures(session_id);
create index if not exists idx_bcc_status on public.browser_companion_captures(status);
create index if not exists idx_bcc_captured_at on public.browser_companion_captures(captured_at desc);
