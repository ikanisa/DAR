create table if not exists public.moltbot_jobs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  sources text[] default '{}',
  notes text,
  status text default 'queued',
  results_count integer,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.moltbot_jobs enable row level security;

create policy "Public insert jobs"
  on public.moltbot_jobs
  for insert
  with check (true);

create policy "Public read jobs"
  on public.moltbot_jobs
  for select
  using (true);
