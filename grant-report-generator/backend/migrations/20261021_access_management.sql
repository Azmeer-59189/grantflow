-- Apply AFTER 20261021_roles_audit.sql, BEFORE deploying access management.
begin;
create table if not exists public.access_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid not null,
  target_id uuid not null,
  actor_email text,
  target_email text,
  previous_role text not null,
  new_role text not null
);
alter table public.access_audit enable row level security;
revoke all on public.access_audit from anon, authenticated;
grant select on public.access_audit to service_role;
create index if not exists access_audit_date_idx on public.access_audit(created_at desc);

create or replace function public.grantflow_change_role(actor uuid, target uuid, new_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
  old_role text;
  actor_mail text;
  target_mail text;
begin
  -- Serialize role changes to protect the last-owner invariant across requests.
  perform pg_catalog.pg_advisory_xact_lock(72102101);
  select coalesce(raw_app_meta_data->>'grantflow_role', 'viewer'), email
    into actor_role, actor_mail from auth.users where id = actor;
  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('owner', 'admin', 'editor', 'viewer', 'disabled') then
    raise exception 'Invalid role' using errcode = '42501';
  end if;
  select coalesce(raw_app_meta_data->>'grantflow_role', 'viewer'), email
    into old_role, target_mail from auth.users where id = target for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if actor_role = 'admin' and (old_role in ('owner', 'admin') or new_role in ('owner', 'admin')) then
    raise exception 'Owner required' using errcode = '42501';
  end if;
  if old_role = 'owner' and new_role <> 'owner' and
    (select count(*) from auth.users where raw_app_meta_data->>'grantflow_role' = 'owner') <= 1 then
    raise exception 'Last owner cannot be removed' using errcode = '23514';
  end if;
  if old_role <> new_role then
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || pg_catalog.jsonb_build_object('grantflow_role', new_role), updated_at = now() where id = target;
    insert into public.access_audit(actor_id, target_id, actor_email, target_email, previous_role, new_role)
      values (actor, target, actor_mail, target_mail, old_role, new_role);
  end if;
  return pg_catalog.jsonb_build_object('id', target, 'role', new_role);
end;
$$;
revoke all on function public.grantflow_change_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.grantflow_change_role(uuid, uuid, text) to service_role;

create or replace function public.grantflow_can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid()
    and raw_app_meta_data->>'grantflow_role' in ('editor', 'admin', 'owner'));
$$;
revoke all on function public.grantflow_can_edit() from public;
grant execute on function public.grantflow_can_edit() to anon, authenticated;

-- Bootstrap exactly the account authorized by the project owner.
-- No password or new account is created. Refuse missing/unconfirmed accounts
-- and refuse to silently overwrite ownership established by someone else.
do $$
declare initial_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(72102101);
  select id into initial_id from auth.users
    where lower(email) = 'syedazmeer2222@gmail.com' and email_confirmed_at is not null;
  if initial_id is null then
    raise exception 'The confirmed syedazmeer2222@gmail.com account must already exist in Authentication > Users';
  end if;
  if exists (select 1 from auth.users where raw_app_meta_data->>'grantflow_role' = 'owner') then
    -- A repeated migration must never restore a previous owner after a transfer.
    raise notice 'An owner already exists; bootstrap skipped.';
  else
    insert into public.access_audit(actor_id, target_id, actor_email, target_email, previous_role, new_role)
      select initial_id, initial_id, email, email, coalesce(raw_app_meta_data->>'grantflow_role', 'viewer'), 'owner'
      from auth.users where id = initial_id;
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || '{"grantflow_role":"owner"}'::jsonb, updated_at = now() where id = initial_id;
  end if;
end;
$$;
commit;
