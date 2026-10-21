-- Run once in Supabase SQL Editor. Safe to run again.
-- Report history records which grant each report was for and who made it.
-- The backend still saves reports without these columns until this runs.
begin;
alter table public.reports add column if not exists grant_number text;
alter table public.reports add column if not exists generated_by_email text;
create index if not exists reports_grant_number_idx on public.reports (grant_number, generated_at desc);
commit;
