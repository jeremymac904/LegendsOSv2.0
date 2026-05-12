-- ============================================================================
-- LegendsOS 2.0 — Bootstrap: organization, owner provisioning, auto profile
-- ----------------------------------------------------------------------------
-- This migration:
--   * Creates the default "Legends" organization if it does not exist.
--   * Adds a trigger on auth.users so that new signups get a profile row
--     and are placed in the Legends org.
--   * Promotes the owner email (jeremy@mcdonald-mtg.com by default) to the
--     owner role and links the organization owner_user_id.
--   * Seeds rows in provider_credentials so the Settings UI has something to
--     render even before keys are added (all statuses default to 'missing').
-- ============================================================================

-- 1) Default organization ----------------------------------------------------
insert into public.organizations (name, slug)
values ('The Legends Mortgage Team', 'legends-mortgage')
on conflict (slug) do nothing;

-- 2) Auto-profile trigger ----------------------------------------------------
-- When a new auth.user is created, insert a matching profile in the default
-- org. The owner email is promoted to 'owner'; everyone else starts as
-- 'loan_officer' and Jeremy can promote later.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_org uuid;
  is_owner_email boolean;
  owner_email text;
begin
  select id into default_org
    from public.organizations
    where slug = 'legends-mortgage'
    limit 1;

  -- Owner email lookup. Use the env-style table when present, else fall back.
  begin
    owner_email := current_setting('app.owner_email', true);
  exception when others then
    owner_email := null;
  end;

  if owner_email is null or owner_email = '' then
    owner_email := 'jeremy@mcdonald-mtg.com';
  end if;

  is_owner_email := lower(coalesce(new.email, '')) = lower(owner_email);

  insert into public.profiles (id, email, role, organization_id, full_name)
  values (
    new.id,
    new.email,
    case when is_owner_email then 'owner'::public.user_role else 'loan_officer'::public.user_role end,
    default_org,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  -- Membership row.
  if default_org is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (
      default_org,
      new.id,
      case when is_owner_email then 'owner'::public.user_role else 'loan_officer'::public.user_role end
    )
    on conflict do nothing;

    if is_owner_email then
      update public.organizations
        set owner_user_id = new.id
        where id = default_org and (owner_user_id is null or owner_user_id <> new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 3) Owner promotion helper (idempotent) -------------------------------------
-- Useful if the owner signs up before this migration runs, or to promote
-- a different user later. Run it with `select public.promote_owner('email');`
create or replace function public.promote_owner(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  default_org uuid;
begin
  select id into v_user from public.profiles where lower(email) = lower(p_email) limit 1;
  if v_user is null then
    raise notice 'No profile for %', p_email;
    return;
  end if;

  select id into default_org from public.organizations where slug = 'legends-mortgage' limit 1;

  update public.profiles set role = 'owner', organization_id = default_org where id = v_user;
  update public.organization_members set role = 'owner' where user_id = v_user;
  update public.organizations set owner_user_id = v_user where id = default_org;
end;
$$;

-- 4) Seed provider_credentials placeholders ----------------------------------
do $$
declare
  default_org uuid;
  p text;
begin
  select id into default_org from public.organizations where slug = 'legends-mortgage' limit 1;
  if default_org is null then return; end if;

  for p in select unnest(array[
    'openrouter', 'deepseek', 'nvidia', 'fal', 'n8n', 'postiz'
  ])
  loop
    insert into public.provider_credentials (organization_id, provider, status, env_var_name)
    values (
      default_org,
      p,
      'missing',
      case p
        when 'openrouter' then 'OPENROUTER_API_KEY'
        when 'deepseek'   then 'DEEPSEEK_API_KEY'
        when 'nvidia'     then 'NVIDIA_API_KEY'
        when 'fal'        then 'FAL_KEY'
        when 'n8n'        then 'N8N_WEBHOOK_SECRET'
        when 'postiz'     then 'POSTIZ_API_KEY'
      end
    )
    on conflict (organization_id, provider) do nothing;
  end loop;
end $$;
