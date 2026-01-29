create table if not exists public.property_feed_sources (
  id uuid primary key default gen_random_uuid(),
  name text,
  url text not null unique,
  category text,
  active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.property_feed_sources enable row level security;

create policy "Public read feed sources"
  on public.property_feed_sources
  for select
  using (true);
