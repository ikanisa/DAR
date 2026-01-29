---
name: dar-marketplace
description: Sync Malta property listings into Dar via Moltbot (OpenAI/Gemini web search + ingest).
version: 1.0.0
requires:
  env:
    - DAR_SUPABASE_URL
    - DAR_MOLTBOT_JOB_TOKEN
    - DAR_MOLTBOT_INGEST_TOKEN
tools:
  - exec
---

# Dar Marketplace Sync

Goal: process queued jobs, discover listings across Malta sources, and push structured
listings into Supabase so the Dar PWA updates automatically.

## Primary script (scripted job)
Run the full pipeline with:
```
node scripts/dar-sync.mjs
```

## Inputs
- Job queue endpoint: `${DAR_SUPABASE_URL}/functions/v1/moltbot-jobs`
- Ingest endpoint: `${DAR_SUPABASE_URL}/functions/v1/moltbot-ingest`
- Tokens: `DAR_MOLTBOT_JOB_TOKEN`, `DAR_MOLTBOT_INGEST_TOKEN`

## Workflow
1) List queued jobs
2) For each job:
   - Use the `sources` array and `query` to build targeted searches.
   - Call the Supabase `ai-router` with `use_web_search=true` (Gemini → OpenAI fallback).
   - Parse/normalize listings
3) Normalize to this schema (required fields in **bold**):
   - **title**, **link**
   - summary, image_url, price, currency
   - location, type, bedrooms, bathrooms
   - interior_area, outdoor_area, epc, parking, view, sea_distance, finish, orientation
   - source, source_url, published_at, raw
4) Ingest listings into Supabase
5) Mark job complete

## Quality Rules
- Do not invent data. If unknown, leave `null`.
- Ensure `link` is a real listing URL, not a homepage.
- Prefer the listing page as `link` and the source domain as `source_url`.
- Keep summaries under 700 characters.

## Suggested Search Patterns
- `site:{sourceDomain} Malta property rent {location} {beds}`
- `{sourceName} Malta "for rent" {price}`
- `{sourceName} "sea view" Malta apartment`

## Tooling
- Use `node scripts/dar-sync.mjs` for the scripted pipeline.
- `node scripts/dar-ai-search.mjs --query "..."` can be used for ad‑hoc searches.
