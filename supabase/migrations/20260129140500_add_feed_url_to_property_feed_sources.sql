alter table if exists public.property_feed_sources
  add column if not exists feed_url text,
  add column if not exists last_error text;
