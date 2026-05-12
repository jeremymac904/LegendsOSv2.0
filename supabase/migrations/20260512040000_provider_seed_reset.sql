-- ============================================================================
-- LegendsOS 2.0 — Provider seed reconciliation
-- ----------------------------------------------------------------------------
-- Drops the placeholder row for Postiz (not part of the v2 build) and adds
-- Hugging Face. Idempotent — re-running is a no-op.
-- ============================================================================

-- Remove postiz placeholder rows (any org). Postiz is not part of v2 scope.
delete from public.provider_credentials
 where provider = 'postiz';

-- Add huggingface placeholder rows for any org that doesn't already have one.
insert into public.provider_credentials (organization_id, provider, status, env_var_name)
select o.id, 'huggingface', 'missing', 'HF_TOKEN'
  from public.organizations o
 where not exists (
   select 1 from public.provider_credentials pc
    where pc.organization_id = o.id
      and pc.provider = 'huggingface'
 );
