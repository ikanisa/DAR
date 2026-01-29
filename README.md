# DAR — Malta AI Real Estate Concierge (PWA)

## 1) Project Overview
**What it is**: DAR is a production-ready, mobile-first PWA designed specifically for discovering consolidated real estate listings in Malta. It aggregates listings from various sources, enriches them with AI, and provides a "Soft Liquid Glass" UI for a premium user experience.

**Who it's for**:
- **Seekers**: Individuals looking for property in Malta (rent/buy) who want a unified, high-quality search experience without duplicates.
- **Admin/Staff**: Internal team members managing the platform, moderating listings, and overseeing the Moltbot automation.

**Key Capabilities**:
- **Unified Discovery**: Aggregates listings from multiple fragmented sources across Malta.
- **AI Enrichment**: Uses Gemini/OpenAI to extract structured data (EPC, sea view, parking) from unstructured descriptions.
- **Automated Ingestion**: "Moltbot" autonomous agents discover and update listings hourly.
- **Premium UX**: Mobile-first PWA with offline support, smooth transitions, and a "Soft Liquid Glass" aesthetic.
- **Dual-Mode Backend**: Hybrid architecture using Supabase (Edge Functions) for lightweight tasks and a dedicated Node.js backend for complex logic.

**High-Level Architecture**:
```ascii
+-------------------+       +-----------------------+
|   Cloudflare Pages|       |  Dedicated Backend    |
|   (Front-end PWA) |<----->|   (Node.js/Fastify)   |
+-------------------+       +-----------------------+
        ^                           ^
        |                           |
        v                           v
+---------------------------------------------------+
|               Supabase (Postgres DB)              |
|          Auth / RLS / Realtime / Storage          |
+---------------------------------------------------+
        ^                           ^
        |                           |
        v                           v
+-------------------+       +-----------------------+
|  Edge Functions   |       |       Moltbot         |
| (AI/Search Proxy) |       |   (Ingestion Agents)  |
+-------------------+       +-----------------------+
```

## 2) Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion.
- **Backend (API)**: Node.js (v22), Fastify, Zod validation.
- **Backend (Edge)**: Supabase Edge Functions (Deno).
- **Database**: PostgreSQL (via Supabase).
- **Auth**: Supabase Auth (Staff/Admin/User roles).
- **Deployment**:
  - Frontend: Cloudflare Pages.
  - Backend: Dockerized Node.js service.

## 3) Monorepo Structure
The repository is a Turborepo-managed monorepo.

```text
.
├── apps/
│   ├── web/        # The main PWA (React/Vite)
│   └── backend/    # The dedicated API service (Fastify)
├── packages/
│   ├── core/       # Shared business logic, types, and constants
│   ├── ui/         # Shared design system and React components
│   └── db/         # Shared database helpers and types
├── supabase/       # Migrations, Edge Functions, and config
├── moltbot/        # Automation agent instructions and skills
└── infra/          # Infrastructure handling (Docker, etc.)
```

- **apps/web**: The client-facing application.
- **apps/backend**: The server-side logic handling complex operations not suitable for Edge Functions.
- **packages/core**: Single source of truth for types (e.g., `Listing`, `ListingStatus`) and constants.
- **packages/ui**: The "Soft Liquid Glass" design system components.

## 4) Environments & Configuration

### Required Environment Variables

#### Local Development (`.env`)
Create a `.env` file in the root (or specific app folders) based on `.env.example`.

**Shared / Root**:
- `OPENAI_API_KEY`: For AI enrichment fallback.
- `GEMINI_API_KEY`: Primary AI Service.
- `SUPABASE_SERVICE_ROLE_KEY`: For admin tasks.

**apps/web (.env)**:
- `VITE_SUPABASE_URL`: Public Supabase URL.
- `VITE_SUPABASE_ANON_KEY`: Public Anon Key.
- `VITE_API_URL`: URL of the local or prod backend (e.g., `http://localhost:3001`).

**apps/backend (.env)**:
- `DATABASE_URL`: Connection string to postgres.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`: For auth verification.

### Fail-fast checks
The application is configured to fail build or startup if critical environment variables (like `VITE_SUPABASE_URL`) are missing. Ensure these are set in your CI/CD and local environment.

## 5) Local Development
We use `pnpm` and `turbo`.

**1. Install dependencies**
```bash
pnpm install
```

**2. Start Development Server (All Apps)**
```bash
pnpm dev
# Starts web on localhost:5173 and backend on localhost:3001
```

**3. Linting**
```bash
pnpm lint
```

**4. Type Checking**
```bash
pnpm -r exec tsc --noEmit
```

**5. Testing**
```bash
pnpm test
```

## 6) Database & Supabase
**Project Setup**: Managed via Supabase Dashboard.
- **URL**: `https://yxtpdgxaqoqsozhkysty.supabase.co`

**Migrations**:
- Located in `supabase/migrations`.
- Apply locally: `supabase db reset` (Caution: wipes local DB).
- Apply to remote: `supabase db push`.

**Seeding**:
- Seed data is located in `supabase/seed.sql`.
- Applied automatically on `db reset`.

**Row Level Security (RLS)**:
- **Enabled** on all tables.
- **Staff/Admin**: Have expanded write access.
- **Public**: Read-only access to approved listings.

## 7) RBAC: Staff vs Admin
**Roles**:
- **User**: Standard public access (search, favorites).
- **Staff**: Content moderation, basic management.
- **Admin**: Full system access, Moltbot control, user management.

**Enforcement**:
- **Front-end**: `RequireAuth` and `RequireRole` route wrappers.
- **Backend**: Fastify middleware verifying JWT claims.
- **Database**: RLS policies checking `auth.jwt()`.

**Verification**:
- Log in as a user and attempt to access `/admin`. Should redirect or 403.
- Attempt to curl an admin API endpoint with a user token. Should 403.

## 8) UI/UX Standards
**"Soft Liquid Glass"**:
- **Depth**: Use subtle shadows and blurs, not heavy borders.
- **Motion**: All route transitions and interactions must be animated.
- **Feedback**: Loading skeletons (never spinners), toast notifications for actions.

**Mobile-First**:
- Design for touch targets (44px min).
- Sidebar hidden on mobile (bottom nav or hamburger).

## 9) PWA Notes
- **Manifest**: Located in `apps/web/public/manifest.json`.
- **Service Worker**: `sw.js` handles caching strategies (Stale-While-Revalidate for API, Cache-First for assets).
- **Offline**: The app must render the "You are offline" state gracefully or show cached content.

## 10) Testing & QA
- **Unit Tests**: `vitest` for utility functions in `packages/core`.
- **E2E Smoke Tests**: Manual or scripted flows:
  1. Login -> Dashboard load.
  2. Search -> Result click -> Details view.
  3. (Admin) Risk Override -> Update status.

## 11) Deployment

### Cloudflare Pages (Frontend)
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Production Branch**: `main`

**Env Vars (Cloudflare Dashboard)**:
- `VITE_ENV`: `production`
- `VITE_API_URL`: `https://api.dar.ikanisa.com` (Example)
- Same `VITE_SUPABASE_*` keys as local.

### Docker (Backend)
The backend is Dockerized.
- **Dockerfile**: `apps/backend/Dockerfile`.
- **Port**: 3001.

## 12) Operations / Runbook
**Common Issues**:
- **Endless Loading**: Check `VITE_API_URL` availability and CORS settings.
- **Auth Loops**: Clear application storage/cookies. Token might be expired but not refreshing.
- **Stale Assets**: Cloudflare caching. redeploy or purge cache if critical header changes were made.

**Logs**:
- **Frontend**: Browser console (Datadog/Sentry if configured).
- **Backend**: Logs to stdout (JSON format via Pino).
- **Supabase**: Dashboard > Logs > Edge Functions.

## 13) Contributing
- **Branch Strategy**: `feature/xyz` -> `main`.
- **Commits**: Conventional Commits (e.g., `feat(web): add login`).
- **Style**: Prettier + ESLint auto-fix on save.
- **PRs**: Must pass lint/build checks.

## 14) License
Private / Proprietary.
