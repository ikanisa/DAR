# Cloudflare Pages Deployment: `dar-web`

This document outlines the configuration required to deploy the `apps/web` PWA to Cloudflare Pages.

## Project Structure
- **App Directory**: `apps/web`
- **Output Directory**: `dist` (relative to app directory)
- **Monorepo**: Yes (`pnpm` workspaces)

## Cloudflare Dashboard Configuration

1. **Create Project**:
   - Go to Cloudflare Dashboard > Pages > Create a project > Connect to Git.
   - Select this repository.
   - Project Name: `dar-web` (matches `wrangler.toml`).

2. **Build Settings**:
   > [!IMPORTANT]
   > For `pnpm` workspaces to work correctly, the build context must have access to the root `pnpm-lock.yaml`. Therefore, we use the Repo Root as the execution context but target the specific app.

   - **Production Branch**: `main`
   - **Framework Preset**: `Vite` (or `None`)
   - **Build Command**: `pnpm --filter web build`
   - **Build Output Directory**: `apps/web/dist`
   - **Root Directory**: `/` (Leave empty/default) - *Note: While simpler workflows suggest setting the Root Directory to `apps/web`, this breaks pnpm workspace dependency resolution. We keep Root at `/` and use `--filter` to build the specific app.*

3. **Environment Variables**:
   Configure these in **Settings > Environment variables**.
   
   | Variable | Description |
   |----------|-------------|
   | `VITE_API_URL` | URL of the backend API |
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key |
   | `VITE_ENV` | `production` or `staging` |
   | `NODE_VERSION` | Set to `20` (Recommended) |

## Deployment Workflow
- **Production**: Pushes to `main` trigger a production deployment.
- **Preview**: Pull Requests and non-production branches trigger preview deployments.

## `wrangler.toml`
The local `wrangler.toml` file (`apps/web/wrangler.toml`) provides defaults for local development:
```toml
name = "dar-web"
pages_build_output_dir = "dist"
compatibility_date = "2024-01-29"
```

## Security Headers
Security headers are configured in `apps/web/public/_headers`. This file is automatically included in the build output (`dist/_headers`) and applied by Cloudflare Pages.
