-- ============================================================================
-- LegendsOS 2.0 — newsletter_contacts dedupe target fix
-- ----------------------------------------------------------------------------
-- The initial migration created a *partial* unique index on
-- (owner_user_id, email) WHERE email IS NOT NULL. PostgreSQL's
-- `ON CONFLICT (col, col)` clause does not match partial indexes unless the
-- index predicate is duplicated in the conflict target, which PostgREST/
-- supabase-js does not support.
--
-- Replace it with a regular UNIQUE constraint. NULL values are distinct in
-- a unique constraint, so contacts without an email still don't collide
-- with each other or with non-NULL rows — the behaviour we want.
-- ============================================================================

drop index if exists public.newsletter_contacts_owner_email_uniq;

alter table public.newsletter_contacts
  drop constraint if exists newsletter_contacts_owner_email_key;
alter table public.newsletter_contacts
  add  constraint newsletter_contacts_owner_email_key
       unique (owner_user_id, email);
