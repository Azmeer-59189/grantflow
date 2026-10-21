-- Run once in Supabase SQL Editor BEFORE deploying the updated backend.
begin;

-- Writes refused before reaching the Sheet (duplicate grant, edit conflict,
-- unexpected sheet layout) are recorded as 'rejected', not 'unconfirmed'.
alter table public.grant_audit drop constraint if exists grant_audit_status_check;
alter table public.grant_audit add constraint grant_audit_status_check
  check (status in ('pending', 'completed', 'unconfirmed', 'rejected'));

-- The bucket stays public so chapter reports can link to files, but Storage
-- itself now enforces size and type. SVG is excluded: it can carry scripts.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'grant-pictures';

-- Editors may delete only files they uploaded themselves, so the form can
-- clean up uploads that were replaced, removed or never saved. The existing
-- restrictive grantflow_editor_delete policy still requires editor access.
drop policy if exists grantflow_delete_own_upload on storage.objects;
create policy grantflow_delete_own_upload on storage.objects for delete to authenticated
using (bucket_id = 'grant-pictures' and owner_id = (select auth.uid()::text));

commit;
