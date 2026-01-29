---
description: Setup and verify Cloudflare Pages deployment for the web app
---

This workflow prepares the `apps/web` PWA for deployment to Cloudflare Pages.

# 1. Environment & Structure Check

Ensure the project follows the Hybrid PWA structure:

- [ ] `apps/web/public` directory exists.
- [ ] Static assets (`sw.js`, `manifest.json`, `robots.txt`, `_headers`, `_redirects`, `icons/`) are in `apps/web/public`, NOT in `apps/web` root.
- [ ] `apps/web/wrangler.toml` exists and points to `dist`.

# 2. Build Configuration

- [ ] `apps/web/package.json` must have a `build:seo` script:
  ```json
  "build:seo": "SEO_OUTPUT_DIR=./public node ../../scripts/seo-generate.mjs"
  ```
- [ ] `apps/web/package.json` build script must include SEO generation:
  ```json
  "build": "pnpm build:seo && tsc && vite build"
  ```

# 3. SEO Script Configuration

- [ ] `scripts/seo-generate.mjs` (in root) must support `SEO_OUTPUT_DIR` environment variable to avoid polluting the root directory.

# 4. Manual Verification

Run a local build to verify structure:

```bash
cd apps/web
pnpm build
ls -F dist/
# Check for sitemap.xml, sw.js, assets/, index.html
```

# 5. Deployment

Deploy via Cloudflare Dashboard (Git) or CLI:

```bash
# From apps/web
pnpm dlx wrangler pages deploy dist --project-name dar-web
```
