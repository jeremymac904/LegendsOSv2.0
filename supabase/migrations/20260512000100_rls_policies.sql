-- ============================================================================
-- LegendsOS 2.0 — Row Level Security policies
-- ----------------------------------------------------------------------------
-- Rules:
--   * Owner can see and manage everything in their organization.
--   * Loan officers see only their own rows, plus team_shared content
--     (assistants, knowledge collections marked team_shared, shared_resources).
--   * Nobody can read raw provider secrets. The `provider_credentials_public`
--     view is the only client-readable surface.
--   * The service role bypasses RLS automatically — server routes that need
--     to act across users (n8n callbacks, owner admin actions) must use the
--     service role explicitly.
-- ============================================================================

-- Enable RLS everywhere.
alter table public.organizations          enable row level security;
alter table public.profiles               enable row level security;
alter table public.organization_members   enable row level security;
alter table public.atlas_assistants       enable row level security;
alter table public.chat_threads           enable row level security;
alter table public.chat_messages          enable row level security;
alter table public.uploaded_files         enable row level security;
alter table public.knowledge_collections  enable row level security;
alter table public.knowledge_items        enable row level security;
alter table public.retrieval_references   enable row level security;
alter table public.assistant_knowledge_access enable row level security;
alter table public.shared_resources       enable row level security;
alter table public.generated_media        enable row level security;
alter table public.social_posts           enable row level security;
alter table public.email_campaigns        enable row level security;
alter table public.calendar_items         enable row level security;
alter table public.automation_jobs        enable row level security;
alter table public.usage_events           enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.provider_credentials   enable row level security;

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================
drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select to authenticated
  using (
    id = public.current_org_id()
  );

drop policy if exists organizations_owner_all on public.organizations;
create policy organizations_owner_all on public.organizations
  for all to authenticated
  using (public.is_owner() and id = public.current_org_id())
  with check (public.is_owner() and id = public.current_org_id());

-- ============================================================================
-- PROFILES
-- ============================================================================
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles
  for select to authenticated
  using (
    public.is_owner()
    and organization_id = public.current_org_id()
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());
  -- Critically: a user cannot change their own role through this policy.

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles
  for insert to authenticated
  with check (public.is_owner());

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================
drop policy if exists org_members_self_select on public.organization_members;
create policy org_members_self_select on public.organization_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists org_members_owner_all on public.organization_members;
create policy org_members_owner_all on public.organization_members
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- ATLAS ASSISTANTS
-- ============================================================================
drop policy if exists atlas_assistants_select on public.atlas_assistants;
create policy atlas_assistants_select on public.atlas_assistants
  for select to authenticated
  using (
    -- Owner sees everything in their org.
    (public.is_owner() and organization_id = public.current_org_id())
    -- Or you own this assistant.
    or owner_user_id = auth.uid()
    -- Or it is team_shared inside your org.
    or (visibility = 'team_shared' and organization_id = public.current_org_id())
  );

drop policy if exists atlas_assistants_modify_self on public.atlas_assistants;
create policy atlas_assistants_modify_self on public.atlas_assistants
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists atlas_assistants_owner_all on public.atlas_assistants;
create policy atlas_assistants_owner_all on public.atlas_assistants
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- CHAT THREADS & MESSAGES
-- ============================================================================
drop policy if exists chat_threads_self on public.chat_threads;
create policy chat_threads_self on public.chat_threads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists chat_threads_owner_select on public.chat_threads;
create policy chat_threads_owner_select on public.chat_threads
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

drop policy if exists chat_messages_self on public.chat_messages;
create policy chat_messages_self on public.chat_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists chat_messages_owner_select on public.chat_messages;
create policy chat_messages_owner_select on public.chat_messages
  for select to authenticated
  using (
    public.is_owner()
    and exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id
        and t.organization_id = public.current_org_id()
    )
  );

-- ============================================================================
-- UPLOADED FILES
-- ============================================================================
drop policy if exists uploaded_files_self on public.uploaded_files;
create policy uploaded_files_self on public.uploaded_files
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists uploaded_files_owner_select on public.uploaded_files;
create policy uploaded_files_owner_select on public.uploaded_files
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- KNOWLEDGE COLLECTIONS / ITEMS / RETRIEVAL
-- ============================================================================
drop policy if exists knowledge_collections_select on public.knowledge_collections;
create policy knowledge_collections_select on public.knowledge_collections
  for select to authenticated
  using (
    user_id = auth.uid()
    or (visibility = 'team_shared' and organization_id = public.current_org_id())
    or (public.is_owner() and organization_id = public.current_org_id())
  );

drop policy if exists knowledge_collections_modify_self on public.knowledge_collections;
create policy knowledge_collections_modify_self on public.knowledge_collections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists knowledge_collections_owner_all on public.knowledge_collections;
create policy knowledge_collections_owner_all on public.knowledge_collections
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

drop policy if exists knowledge_items_select on public.knowledge_items;
create policy knowledge_items_select on public.knowledge_items
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.knowledge_collections c
      where c.id = knowledge_items.collection_id
        and (
          c.visibility = 'team_shared' and c.organization_id = public.current_org_id()
        )
    )
    or (public.is_owner() and organization_id = public.current_org_id())
  );

drop policy if exists knowledge_items_modify_self on public.knowledge_items;
create policy knowledge_items_modify_self on public.knowledge_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists retrieval_references_select on public.retrieval_references;
create policy retrieval_references_select on public.retrieval_references
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id
      where m.id = retrieval_references.message_id
        and (t.user_id = auth.uid() or (public.is_owner() and t.organization_id = public.current_org_id()))
    )
  );

drop policy if exists retrieval_references_insert_self on public.retrieval_references;
create policy retrieval_references_insert_self on public.retrieval_references
  for insert to authenticated
  with check (
    exists (
      select 1 from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id
      where m.id = retrieval_references.message_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists assistant_knowledge_access_select on public.assistant_knowledge_access;
create policy assistant_knowledge_access_select on public.assistant_knowledge_access
  for select to authenticated
  using (
    exists (
      select 1 from public.atlas_assistants a
      where a.id = assistant_knowledge_access.assistant_id
        and (a.owner_user_id = auth.uid() or (public.is_owner() and a.organization_id = public.current_org_id()))
    )
  );

drop policy if exists assistant_knowledge_access_modify on public.assistant_knowledge_access;
create policy assistant_knowledge_access_modify on public.assistant_knowledge_access
  for all to authenticated
  using (
    exists (
      select 1 from public.atlas_assistants a
      where a.id = assistant_knowledge_access.assistant_id
        and a.owner_user_id = auth.uid()
    )
    or public.is_owner()
  )
  with check (
    exists (
      select 1 from public.atlas_assistants a
      where a.id = assistant_knowledge_access.assistant_id
        and a.owner_user_id = auth.uid()
    )
    or public.is_owner()
  );

-- ============================================================================
-- SHARED RESOURCES
-- ============================================================================
drop policy if exists shared_resources_select on public.shared_resources;
create policy shared_resources_select on public.shared_resources
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and is_active = true
  );

drop policy if exists shared_resources_owner_modify on public.shared_resources;
create policy shared_resources_owner_modify on public.shared_resources
  for all to authenticated
  using (public.is_owner() and organization_id = public.current_org_id())
  with check (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- GENERATED MEDIA
-- ============================================================================
drop policy if exists generated_media_self on public.generated_media;
create policy generated_media_self on public.generated_media
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists generated_media_owner_select on public.generated_media;
create policy generated_media_owner_select on public.generated_media
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- SOCIAL POSTS
-- ============================================================================
drop policy if exists social_posts_self on public.social_posts;
create policy social_posts_self on public.social_posts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists social_posts_owner_select on public.social_posts;
create policy social_posts_owner_select on public.social_posts
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- EMAIL CAMPAIGNS
-- ============================================================================
drop policy if exists email_campaigns_self on public.email_campaigns;
create policy email_campaigns_self on public.email_campaigns
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists email_campaigns_owner_select on public.email_campaigns;
create policy email_campaigns_owner_select on public.email_campaigns
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- CALENDAR
-- ============================================================================
drop policy if exists calendar_items_self on public.calendar_items;
create policy calendar_items_self on public.calendar_items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists calendar_items_owner_select on public.calendar_items;
create policy calendar_items_owner_select on public.calendar_items
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- AUTOMATION JOBS — owner read everything; users read their own
-- ============================================================================
drop policy if exists automation_jobs_self_select on public.automation_jobs;
create policy automation_jobs_self_select on public.automation_jobs
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists automation_jobs_owner_select on public.automation_jobs;
create policy automation_jobs_owner_select on public.automation_jobs
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- Inserts/updates from the app must go through the service role.
-- No client-side insert policy.

-- ============================================================================
-- USAGE EVENTS — owner read all; user read own
-- ============================================================================
drop policy if exists usage_events_self_select on public.usage_events;
create policy usage_events_self_select on public.usage_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists usage_events_owner_select on public.usage_events;
create policy usage_events_owner_select on public.usage_events
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- AUDIT LOGS — owner only
-- ============================================================================
drop policy if exists audit_logs_owner_select on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- ============================================================================
-- PROVIDER CREDENTIALS — owner read all; nobody reads encrypted_secret
-- ----------------------------------------------------------------------------
-- The base table has no public client access. Clients use the
-- provider_credentials_public view, which omits the encrypted secret.
-- ============================================================================
drop policy if exists provider_credentials_owner_select on public.provider_credentials;
create policy provider_credentials_owner_select on public.provider_credentials
  for select to authenticated
  using (public.is_owner() and organization_id = public.current_org_id());

-- Revoke column-level access to encrypted_secret from authenticated.
revoke select on public.provider_credentials from authenticated;
grant  select (id, organization_id, provider, status, masked_preview, env_var_name, metadata, is_enabled, created_at, updated_at)
  on public.provider_credentials
  to authenticated;

-- Allow the public view to authenticated.
grant select on public.provider_credentials_public to authenticated;
