-- Run once in Supabase SQL Editor BEFORE deploying the updated backend.
create table if not exists public.grant_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id),
  actor_email text,
  action text not null check (action in ('create', 'update')),
  grant_number text not null,
  changes jsonb not null,
  status text not null check (status in ('pending', 'completed', 'unconfirmed'))
);
create index if not exists grant_audit_grant_date_idx on public.grant_audit(grant_number, created_at desc);
create index if not exists grant_audit_date_idx on public.grant_audit(created_at desc);
alter table public.grant_audit enable row level security;
revoke all on public.grant_audit from anon, authenticated;
grant select, insert, update on public.grant_audit to service_role;

-- Roles live in app_metadata, which ordinary users cannot edit.
-- Provision editors/admins explicitly using Supabase's admin tools, or adapt:
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--     || '{"grantflow_role":"editor"}'::jsonb
-- where id = 'REPLACE-WITH-EXACT-USER-UUID'::uuid;
-- Supported roles: viewer (default), editor, admin.
-- Users should sign out/in after a role change. Backend checks current Auth
-- user metadata on every request, including immediately after revocation.

-- Supabase Storage also needs write enforcement; UI guards alone are insufficient.
-- Restrictive policies combine with existing permissive upload policies.
create or replace function public.grantflow_can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid()
    and raw_app_meta_data->>'grantflow_role' in ('editor', 'admin'));
$$;
revoke all on function public.grantflow_can_edit() from public;
grant execute on function public.grantflow_can_edit() to anon, authenticated;

drop policy if exists grantflow_editor_insert on storage.objects;
create policy grantflow_editor_insert on storage.objects as restrictive for insert to public
with check (bucket_id <> 'grant-pictures' or public.grantflow_can_edit());
drop policy if exists grantflow_editor_update on storage.objects;
create policy grantflow_editor_update on storage.objects as restrictive for update to public
using (bucket_id <> 'grant-pictures' or public.grantflow_can_edit())
with check (bucket_id <> 'grant-pictures' or public.grantflow_can_edit());
drop policy if exists grantflow_editor_delete on storage.objects;
create policy grantflow_editor_delete on storage.objects as restrictive for delete to public
using (bucket_id <> 'grant-pictures' or public.grantflow_can_edit());
