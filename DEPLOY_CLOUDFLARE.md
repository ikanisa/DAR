# Cloudflare Deployment (Pages)

This app is static + PWA. Cloudflare Pages is the recommended target.

## Build configuration

1. **Framework Preset**: None / Create React App / Vite (Recommended: None, manually configure)
2. **Build command**: `pnpm build` (Runs `build:seo` + `tsc` + `vite build`)
3. **Output directory**: `dist` (Inside `apps/web`, or `apps/web/dist` if root)
4. **Root directory**: `apps/web` (Recommended) or Root with monorepo setup.

## Environment Variables

The following environment variables must be set in Cloudflare Pages > Settings > Environment variables:

- `VITE_API_URL`: URL of the backend API (e.g., https://api.yourdomain.com)
- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
- `VITE_ENV`: `production`

## Deployment

### Option A: Direct Upload (Wrangler)
Run from `apps/web`:
```bash
pnpm dlx wrangler pages deploy dist --project-name dar-web
```

### Option B: Git Integration
Connect repository to Cloudflare Pages.
- Build command: `pnpm build`
- Output directory: `dist`
- Root directory: `apps/web`

## Verify

After deploy:
```bash
curl -I https://dar.ikanisa.com/robots.txt
curl -I https://dar.ikanisa.com/sitemap.xml
```
