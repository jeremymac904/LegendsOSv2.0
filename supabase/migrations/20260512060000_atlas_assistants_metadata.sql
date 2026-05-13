-- ============================================================================
-- LegendsOS 2.0 — atlas_assistants.metadata column
-- ----------------------------------------------------------------------------
-- The seed scripts (and future tooling) attach `metadata` to assistants so we
-- can trace where each one came from (source kit folder, seed timestamp,
-- original assistant_config.json, etc.) without polluting other columns.
-- ============================================================================

alter table public.atlas_assistants
  add column if not exists metadata jsonb not null default '{}'::jsonb;
