# Cloudflare Pages Environment Variables

This document defines the required environment variables for the Web application across different environments.

## Required Variables

These must be set in the Cloudflare Pages project settings ("Settings" -> "Environment variables").

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL of the backend API. |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key. |
| `VITE_ENV` | Environment name (`development`, `staging`, `production`). |

## Environment Configurations

### Preview (Staging / Pull Requests)
**Context:** Non-production branches (e.g., `feature/*`, `staging`)

- `VITE_API_URL`: `https://staging-api.dar.com` (Example)
- `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `[Retrieve from Supabase Dashboard]`
- `VITE_ENV`: `staging`

### Production
**Context:** `main` branch

- `VITE_API_URL`: `https://api.dar.com` (Example)
- `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `[Retrieve from Supabase Dashboard]`
- `VITE_ENV`: `production`

## Branch Gating

The build process uses `CF_PAGES_BRANCH` to determine context if needed, but we explicitly rely on the `VITE_ENV` variable which you should set for the "Production" environment in Cloudflare (for prod) and "Preview" environment (for staging).
