-- ============================================================================
-- LegendsOS 2.0 — Storage buckets and policies
-- ----------------------------------------------------------------------------
-- Buckets:
--   uploads          — general user uploads (Atlas chat attachments, etc.)
--   knowledge        — knowledge base sources
--   generated_media  — Fal.ai outputs
--   shared_resources — owner-curated team assets
--
-- Storage objects are private by default. The app generates signed URLs from
-- the server when a user is allowed to view a file.
-- ============================================================================

-- Buckets ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('uploads',          'uploads',          false),
  ('knowledge',        'knowledge',        false),
  ('generated_media',  'generated_media',  false),
  ('shared_resources', 'shared_resources', false)
on conflict (id) do nothing;

-- Helper: extract the owning user id from a storage object's path.
-- Convention: paths start with `<user_id>/...`.
-- (Service role bypasses these, so server code can write anywhere.)
-- ============================================================================

-- uploads ---------------------------------------------------------------------
drop policy if exists uploads_read_own on storage.objects;
create policy uploads_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
    )
  );

drop policy if exists uploads_write_own on storage.objects;
create policy uploads_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists uploads_update_own on storage.objects;
create policy uploads_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists uploads_delete_own on storage.objects;
create policy uploads_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
    )
  );

-- knowledge -------------------------------------------------------------------
drop policy if exists knowledge_read_own on storage.objects;
create policy knowledge_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'knowledge'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
      or (storage.foldername(name))[1] = 'team_shared'
    )
  );

drop policy if exists knowledge_write_own on storage.objects;
create policy knowledge_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'knowledge'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or (public.is_owner() and (storage.foldername(name))[1] = 'team_shared')
    )
  );

drop policy if exists knowledge_delete_own on storage.objects;
create policy knowledge_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'knowledge'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
    )
  );

-- generated_media -------------------------------------------------------------
drop policy if exists media_read_own on storage.objects;
create policy media_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generated_media'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
    )
  );

drop policy if exists media_write_own on storage.objects;
create policy media_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated_media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated_media'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_owner()
    )
  );

-- shared_resources ------------------------------------------------------------
-- Read: anyone in the org. Write: owner only.
drop policy if exists shared_resources_read_all on storage.objects;
create policy shared_resources_read_all on storage.objects
  for select to authenticated
  using (bucket_id = 'shared_resources');

drop policy if exists shared_resources_write_owner on storage.objects;
create policy shared_resources_write_owner on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shared_resources' and public.is_owner());

drop policy if exists shared_resources_delete_owner on storage.objects;
create policy shared_resources_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id = 'shared_resources' and public.is_owner());
