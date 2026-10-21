-- Compare existing tables with this schema before deployment.
-- IF NOT EXISTS preserves existing tables; it does not migrate missing columns.
create table if not exists public.reports (
    id uuid primary key default gen_random_uuid(),
    generated_by uuid not null references auth.users(id),
    generated_at timestamptz not null default now(),
    report_url text,
    format text not null check (format in ('PDF', 'Word')),
    row_count integer not null,
    total_received numeric not null,
    total_beneficiaries integer not null
);
create table if not exists public.sheet_cache (
    id uuid primary key default gen_random_uuid(),
    cached_at timestamptz not null default now(),
    data jsonb not null,
    row_count integer not null
);
alter table public.reports enable row level security;
alter table public.sheet_cache enable row level security;
-- Access is through the authenticated API's backend service-role client.
revoke all on public.reports from anon, authenticated;
revoke all on public.sheet_cache from anon, authenticated;
grant all on public.reports to service_role;
grant all on public.sheet_cache to service_role;
create index if not exists reports_generated_at_idx on public.reports (generated_at desc);
create index if not exists sheet_cache_cached_at_idx on public.sheet_cache (cached_at desc);
