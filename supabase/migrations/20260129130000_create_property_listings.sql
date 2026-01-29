create table if not exists public.property_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  link text not null unique,
  summary text,
  image_url text,
  price numeric,
  currency text default 'EUR',
  location text,
  type text,
  bedrooms integer,
  bathrooms integer,
  interior_area numeric,
  outdoor_area numeric,
  epc text,
  parking text,
  view text,
  sea_distance integer,
  finish text,
  orientation text,
  source text,
  source_url text,
  published_at timestamptz,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists property_listings_published_at_idx on public.property_listings (published_at desc);

alter table public.property_listings enable row level security;

create policy "Public read listings"
  on public.property_listings
  for select
  using (true);
