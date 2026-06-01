-- LegendsOS v2 — Marketing lead intake foundation (Phase 2)
-- ---------------------------------------------------------------------------
-- ADDITIVE ONLY. Creates the native LegendsOS lead intake layer for FHBN,
-- AI Realtor Pro, mortgage sites, social/newsletter replies, and manual
-- imports.
--
-- SAFETY:
--   * No external sends.
--   * No CRM/FUB writes.
--   * No production webhook fan-out.
--   * Follow-up is stored as draft tasks requiring human approval.
-- ---------------------------------------------------------------------------

set search_path = public;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.lead_intake_events (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'unknown' check (source_system in (
    'fhbn','ai_realtor_pro','jeremy_mortgage_site','legends_team_site',
    'legendsos','social','email_newsletter','manual_import','follow_up_boss',
    'google_business_profile','unknown'
  )),
  source_product text,
  source_channel text,
  source_page text,
  source_component text,
  source_url text,
  utm jsonb not null default '{}'::jsonb,
  lead_type text not null default 'unknown_needs_review' check (lead_type in (
    'mortgage','buyer','investor','seller','realtor_partner',
    'provider_partner','referral_partner','recruiting','past_client',
    'idx_notify','chat','content_reply','unknown_needs_review'
  )),
  intent text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  person jsonb not null default '{}'::jsonb,
  market jsonb not null default '{}'::jsonb,
  relationship jsonb not null default '{}'::jsonb,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'new' check (status in (
    'new','needs_review','qualified','assigned','contact_drafted',
    'contact_approved','contacted','nurture','appointment_set',
    'application_started','converted','lost','spam'
  )),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.lead_intake_events is 'Append-only normalized lead events from public marketing surfaces. External sends and CRM writes remain approval-gated outside this table.';

create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  contact_type text not null default 'unknown_needs_review' check (contact_type in (
    'mortgage','buyer','investor','seller','realtor_partner',
    'provider_partner','referral_partner','recruiting','past_client',
    'idx_notify','chat','content_reply','unknown_needs_review'
  )),
  source_first text,
  source_last text,
  metro_slug text,
  state text,
  tags jsonb not null default '[]'::jsonb,
  consent jsonb not null default '{}'::jsonb,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.marketing_contacts is 'Cross-product marketing contact record for non-borrower and pre-borrower relationships.';

create table if not exists public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_event_id uuid not null references public.lead_intake_events(id) on delete cascade,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  assigned_owner_id uuid references public.profiles(id) on delete set null,
  assigned_agent_type text not null default 'owner_atlas' check (assigned_agent_type in (
    'owner_atlas','lo_atlas','processor_flo','coordinator_agent','builder_agent',
    'marketing_agent','academy_agent','media_agent','social_agent','docs_agent','ux_agent'
  )),
  assignment_reason text,
  status text not null default 'assigned' check (status in (
    'pending','assigned','accepted','needs_review','completed','dismissed'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.lead_assignments is 'Internal routing from a lead event/contact to a team member and Atlas workflow. No external CRM write is implied.';

create table if not exists public.lead_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_event_id uuid not null references public.lead_intake_events(id) on delete cascade,
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  task_type text not null default 'first_follow_up' check (task_type in (
    'lead_summary','first_follow_up','call_script','sms_draft',
    'email_draft','social_reply_draft','crm_action_draft','nurture_plan',
    'co_marketing_follow_up','provider_onboarding_review'
  )),
  title text not null,
  draft_body text,
  channel text not null default 'internal' check (channel in (
    'internal','email','sms','phone','social','crm','other'
  )),
  status text not null default 'draft' check (status in (
    'draft','needs_review','pending_approval','approved','completed','dismissed'
  )),
  requires_approval boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.lead_followup_tasks is 'Atlas-generated lead follow-up drafts and next actions. Human approval is required before any external send or CRM action.';

create table if not exists public.marketing_attribution_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  lead_event_id uuid references public.lead_intake_events(id) on delete cascade,
  event_type text not null,
  source_system text not null default 'unknown',
  source_url text,
  campaign_id text,
  utm jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.marketing_attribution_events is 'Marketing attribution stream connecting source pages, campaigns, UTM, content, and lead conversion events.';

drop trigger if exists trg_lead_intake_events_updated on public.lead_intake_events;
create trigger trg_lead_intake_events_updated before update on public.lead_intake_events
  for each row execute function public.set_updated_at();

drop trigger if exists trg_marketing_contacts_updated on public.marketing_contacts;
create trigger trg_marketing_contacts_updated before update on public.marketing_contacts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_lead_assignments_updated on public.lead_assignments;
create trigger trg_lead_assignments_updated before update on public.lead_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_lead_followup_tasks_updated on public.lead_followup_tasks;
create trigger trg_lead_followup_tasks_updated before update on public.lead_followup_tasks
  for each row execute function public.set_updated_at();

create index if not exists idx_lie_status on public.lead_intake_events(status);
create index if not exists idx_lie_source_system on public.lead_intake_events(source_system);
create index if not exists idx_lie_lead_type on public.lead_intake_events(lead_type);
create index if not exists idx_lie_created_at on public.lead_intake_events(created_at desc);
create index if not exists idx_lie_dedupe_key on public.lead_intake_events(dedupe_key);
create index if not exists idx_mc_owner on public.marketing_contacts(owner_id);
create index if not exists idx_mc_contact_type on public.marketing_contacts(contact_type);
create unique index if not exists idx_mc_email_unique on public.marketing_contacts (lower(email)) where email is not null;
create unique index if not exists idx_mc_phone_unique on public.marketing_contacts (phone) where phone is not null and email is null;
create index if not exists idx_la_lead_event on public.lead_assignments(lead_event_id);
create index if not exists idx_la_owner on public.lead_assignments(assigned_owner_id);
create index if not exists idx_lft_lead_event on public.lead_followup_tasks(lead_event_id);
create index if not exists idx_lft_status on public.lead_followup_tasks(status);
create index if not exists idx_lft_due_at on public.lead_followup_tasks(due_at);
create index if not exists idx_mae_contact on public.marketing_attribution_events(contact_id);
create index if not exists idx_mae_lead_event on public.marketing_attribution_events(lead_event_id);
create index if not exists idx_mae_campaign on public.marketing_attribution_events(campaign_id);

alter table public.lead_intake_events enable row level security;
alter table public.marketing_contacts enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_followup_tasks enable row level security;
alter table public.marketing_attribution_events enable row level security;

create or replace function public.can_view_lead_event(p_lead_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or exists (
      select 1
      from public.lead_assignments la
      where la.lead_event_id = p_lead_event_id
        and la.assigned_owner_id = auth.uid()
    );
$$;
comment on function public.can_view_lead_event(uuid) is 'True if current user is admin/owner or is assigned to the lead event.';

create or replace function public.can_view_marketing_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or exists (
      select 1
      from public.marketing_contacts mc
      where mc.id = p_contact_id
        and mc.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.lead_assignments la
      where la.contact_id = p_contact_id
        and la.assigned_owner_id = auth.uid()
    );
$$;
comment on function public.can_view_marketing_contact(uuid) is 'True if current user is admin/owner, owns the marketing contact, or is assigned to one of its leads.';

drop policy if exists lie_select on public.lead_intake_events;
create policy lie_select on public.lead_intake_events for select
  using (public.can_view_lead_event(id));
drop policy if exists lie_write on public.lead_intake_events;
create policy lie_write on public.lead_intake_events for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

drop policy if exists mc_select on public.marketing_contacts;
create policy mc_select on public.marketing_contacts for select
  using (public.can_view_marketing_contact(id));
drop policy if exists mc_owner_write on public.marketing_contacts;
create policy mc_owner_write on public.marketing_contacts for all
  using (public.is_admin_or_owner() or owner_id = auth.uid())
  with check (public.is_admin_or_owner() or owner_id = auth.uid());

drop policy if exists la_select on public.lead_assignments;
create policy la_select on public.lead_assignments for select
  using (public.is_admin_or_owner() or assigned_owner_id = auth.uid());
drop policy if exists la_write on public.lead_assignments;
create policy la_write on public.lead_assignments for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

drop policy if exists lft_select on public.lead_followup_tasks;
create policy lft_select on public.lead_followup_tasks for select
  using (
    public.is_admin_or_owner()
    or public.can_view_lead_event(lead_event_id)
    or (contact_id is not null and public.can_view_marketing_contact(contact_id))
  );
drop policy if exists lft_assignee_update on public.lead_followup_tasks;
create policy lft_assignee_update on public.lead_followup_tasks for update
  using (public.is_admin_or_owner() or public.can_view_lead_event(lead_event_id))
  with check (public.is_admin_or_owner() or public.can_view_lead_event(lead_event_id));
drop policy if exists lft_admin_insert_delete on public.lead_followup_tasks;
create policy lft_admin_insert_delete on public.lead_followup_tasks for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

drop policy if exists mae_select on public.marketing_attribution_events;
create policy mae_select on public.marketing_attribution_events for select
  using (
    public.is_admin_or_owner()
    or (lead_event_id is not null and public.can_view_lead_event(lead_event_id))
    or (contact_id is not null and public.can_view_marketing_contact(contact_id))
  );
drop policy if exists mae_write on public.marketing_attribution_events;
create policy mae_write on public.marketing_attribution_events for all
  using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());
