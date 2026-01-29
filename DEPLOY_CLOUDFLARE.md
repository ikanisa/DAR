# Cloudflare Deployment (Pages)

This app is static + PWA. Cloudflare Pages is the recommended target.

## Build command
Generate SEO pages before each deploy:
```bash
node scripts/seo-generate.mjs
```

## Build output
Use the repository root as the output directory (`.`).

## Environment
No secrets required for build. The SEO generator reads `SUPABASE_URL` and
`SUPABASE_ANON_KEY` from `index.html` (public) or from env vars if provided.

## Pages settings
1. Create a new Pages project from this repo.
2. Build command: `node scripts/seo-generate.mjs`
3. Output directory: `.`
4. Set the custom domain: `dar.ikanisa.com`
5. Ensure `_headers` and `_redirects` are deployed (they are in repo root).

## Verify
After deploy:
```bash
curl -I https://dar.ikanisa.com/robots.txt
curl -I https://dar.ikanisa.com/sitemap.xml
```
