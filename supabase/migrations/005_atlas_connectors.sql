-- Migration 005: Atlas Connector Registry legacy placeholder
-- ---------------------------------------------------------------------------
-- This early migration filename sorts before the base timestamped schema, so it
-- cannot safely create tables that reference organizations/profiles or helper
-- functions. The actual connector table now lives in the timestamped migration
-- 20260601101900_atlas_connectors_foundation.sql.
--
-- Keep this file as a dependency-free placeholder so fresh Supabase previews do
-- not fail while preserving the historical migration slot.

set search_path = public;

do $$ begin
  create type public.connector_tier as enum (
    'owner_global',
    'lo_personal',
    'future'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.connector_status as enum (
    'active',
    'inactive',
    'error',
    'coming_soon'
  );
exception when duplicate_object then null; end $$;
