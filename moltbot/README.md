# Moltbot Ops

This doc describes how Moltbot manages Dar listings end-to-end.

## Install Moltbot (recommended)
```bash
npm install -g moltbot@latest
moltbot onboard --install-daemon
```

## Use Supabase AI web search (OpenAI + Gemini)
Dar uses the Supabase `ai-router` function for search. This relies on the
OpenAI/Gemini web search tools configured in Supabase secrets. Disable Moltbot
web search to avoid external search APIs:
```json
{
  "tools": {
    "web": {
      "search": { "enabled": false },
      "fetch": { "enabled": false }
    }
  }
}
```

## Install the Dar skill
Copy this skill into your Moltbot workspace (or symlink it):
```bash
cp -R moltbot/skills/dar-marketplace ~/clawd/skills/dar-marketplace
```

## Schedule hourly sync (Moltbot cron)
Run after the Gateway is up:
```bash
pnpm moltbot cron add \
  --name dar-marketplace \
  --cron "0 * * * *" \
  --session isolated \
  --message "Run the scripted pipeline: node ~/clawd/skills/dar-marketplace/scripts/dar-sync.mjs"
```

## Local helper scripts
Set env vars before running:
```bash
export DAR_SUPABASE_URL="https://yxtpdgxaqoqsozhkysty.supabase.co"
export DAR_SUPABASE_ANON_KEY="your-anon-key"
export DAR_MOLTBOT_JOB_TOKEN="..."
export DAR_MOLTBOT_INGEST_TOKEN="..."
```

```bash
cd ~/clawd/skills/dar-marketplace
node scripts/dar-jobs.mjs list
node scripts/dar-jobs.mjs create --query "Sliema 2 bed" --sources "https://example.com"
node scripts/dar-ai-search.mjs --query "Sliema 2 bed sea view"
node scripts/dar-ingest.mjs listings.json
node scripts/dar-sync.mjs
```

## WebChat embed
Dar embeds Moltbot WebChat in the Assistant tab. Expose your Gateway WebChat safely
(loopback + SSH/Tailscale) and configure gateway auth before pointing
`MOLTBOT_CONTROL_UI_URL` at it.

## Endpoints
- Jobs queue: `https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/moltbot-jobs`
- Listings ingest: `https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/moltbot-ingest`

## Auth
Include an `x-moltbot-token` header for privileged operations.

Tokens (stored in Supabase secrets):
- `MOLTBOT_JOB_TOKEN` — required for job listing + completion
- `MOLTBOT_INGEST_TOKEN` — required for posting listings

## Workflow (hourly)
1. Pull queued jobs
2. Search the provided sources / marketplace URLs
3. Normalize listings into the schema
4. POST listings to `moltbot-ingest`
5. Mark the job complete via `moltbot-jobs`

Note: if a job is created without sources, the API auto-fills all active
`property_feed_sources` URLs.

## Example: list queued jobs
```bash
curl -X POST https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/moltbot-jobs \
  -H "x-moltbot-token: <MOLTBOT_JOB_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action":"list","limit":10}'
```

## Example: ingest listings
```bash
curl -X POST https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/moltbot-ingest \
  -H "x-moltbot-token: <MOLTBOT_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "listings": [
      {
        "title": "Sliema 2-bed Sea View Apartment",
        "link": "https://example.com/listing/123",
        "summary": "Bright 2-bed with terrace…",
        "image_url": "https://example.com/image.jpg",
        "price": 1400,
        "currency": "EUR",
        "location": "Sliema",
        "bedrooms": 2,
        "bathrooms": 2,
        "source": "Moltbot Search",
        "source_url": "https://example.com"
      }
    ]
  }'
```

## Example: mark job complete
```bash
curl -X POST https://yxtpdgxaqoqsozhkysty.supabase.co/functions/v1/moltbot-jobs \
  -H "x-moltbot-token: <MOLTBOT_JOB_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete","job_id":"<JOB_ID>","results_count":12}'
```
