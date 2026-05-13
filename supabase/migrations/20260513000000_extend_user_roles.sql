-- ============================================================================
-- LegendsOS 2.0 — Extend user_role enum with new operational roles
-- ----------------------------------------------------------------------------
-- Adds processor, marketing, viewer to the existing enum so the admin Users
-- screen can assign them. `loan_officer` stays as the canonical name; the UI
-- shows it as "LO". `admin` keeps full app access without being able to
-- modify roles or providers (that stays owner-only).
--
-- IMPORTANT: `ALTER TYPE … ADD VALUE` can't run inside a transaction in
-- Postgres < 12. We're on 15+, so it's safe, but each addition must be
-- idempotent. We pass IF NOT EXISTS so re-running this migration is a no-op.
-- ============================================================================

do $$
begin
  -- Each ADD VALUE is its own statement and idempotent.
  alter type public.user_role add value if not exists 'processor';
exception when others then
  -- IF NOT EXISTS was added in 9.6; older clusters might raise — swallow.
  null;
end$$;

do $$
begin
  alter type public.user_role add value if not exists 'marketing';
exception when others then
  null;
end$$;

do $$
begin
  alter type public.user_role add value if not exists 'viewer';
exception when others then
  null;
end$$;

-- Add a helper to update a profile's role idempotently. Owner-only. Bypasses
-- RLS because it runs as security definer; we still check the caller's role
-- inside the function.
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Only owners can change roles.';
  end if;
  update public.profiles
     set role = p_role,
         updated_at = now()
   where id = p_user_id;
end;
$$;

-- Helper to deactivate (soft delete) a user. Sets profile.is_active=false.
-- We don't delete the auth.users row here — the API route handles that via
-- the Auth Admin API when the owner clicks "Permanently delete".
create or replace function public.set_user_active(
  p_user_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Only owners can change active state.';
  end if;
  update public.profiles
     set is_active = p_active,
         updated_at = now()
   where id = p_user_id;
end;
$$;

grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
