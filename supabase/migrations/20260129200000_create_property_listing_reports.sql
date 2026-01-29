create table if not exists public.property_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.property_listings(id) on delete cascade,
  reason text,
  reporter_id uuid default auth.uid(),
  created_at timestamptz default now()
);

create index if not exists property_listing_reports_listing_id_idx on public.property_listing_reports (listing_id);

alter table public.property_listing_reports enable row level security;

create policy "Public insert reports"
  on public.property_listing_reports
  for insert
  with check (auth.uid() is not null);
