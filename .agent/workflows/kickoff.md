---
description: Universal kickoff for our AI-first Staff/Admin monorepo PWAs — execution contract, plan, tasks, gates, and next-best workflow chain
---

# Kickoff Workflow — Dar Monorepo PWA

**Purpose**: Start any non-trivial work with a clear contract, plan, and workflow chain.

---

## 0. Pre-Flight Checklist

Before starting work, verify:

- [ ] **Repo is clean**: `git status` shows no uncommitted changes
- [ ] **Dependencies installed**: `pnpm install` ran successfully
- [ ] **Build passes**: `pnpm build` (from root or `apps/web`)
- [ ] **Env configured**: `.env` exists with required keys (see `.env.example`)
- [ ] **Supabase reachable**: Can connect to project

```bash
# Quick preflight
cd /Users/jeanbosco/workspace/dar
git status
pnpm install
pnpm build
```

---

## 1. Scope Lock (Mandatory)

**Before any implementation**, write a Scope Lock:

```markdown
## Scope Lock

**Objective**: [What we're building/fixing]

**In Scope**:
- [ ] ...

**Out of Scope / Exclusions**:
- [ ] No delivery features
- [ ] No payment API integration
- [ ] No maps/geolocation
- [ ] No QR scanner UI
- [ ] [Add specific exclusions]

**Acceptance Criteria**:
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
```

---

## 2. Repo Structure Reference

```
dar-monorepo/
├── apps/
│   └── web/                  # Customer PWA (React + Vite + Tailwind + Framer)
│       ├── src/
│       │   ├── App.tsx       # Main app, session bootstrap, tab nav
│       │   ├── components/ui/ # ClayCard, ClayButton, GlassNavBar
│       │   ├── pages/        # ChatView, etc.
│       │   ├── tools/        # web.create_or_get_session, etc.
│       │   └── web/          # chatEndpoint.ts (Moltbot interface)
│       ├── tailwind.config.js # Midnight Savory tokens
│       ├── sw.js             # Service worker
│       └── manifest.json     # PWA manifest
├── packages/
│   ├── core/                 # Shared types, constants (TO BUILD)
│   ├── db/                   # Supabase types, helpers (TO BUILD)
│   └── ui/                   # Shared UI primitives (TO BUILD)
├── supabase/
│   ├── functions/            # ai-router, moltbot-jobs, moltbot-ingest, rss-sync
│   └── migrations/           # 9 migrations (core + RLS + listings)
├── moltbot/                  # Moltbot skills and config
├── skills/                   # community-marketplace-web skill
└── .agent/workflows/         # 11 workflows
```

---

## 3. Design System: Midnight Savory

| Token           | Value                     |
|-----------------|---------------------------|
| `bg-midnight`   | `#1A1A2E`                 |
| `glass-bg`      | `rgba(0,0,0,0.40)`        |
| `clay-card`     | `#16213E`                 |
| `clay-action`   | `#FF6B6B`                 |
| `text-primary`  | `#F8F8F8`                 |
| `text-muted`    | `rgba(248,248,248,0.72)`  |
| `status-pending`| `#FFCC00`                 |
| `status-ready`  | `#00E676`                 |
| `radius-3xl`    | `28px`                    |
| `shadow-clay`   | `0 18px 40px rgba(0,0,0,0.55)` |

---

## 4. Implementation Phases

Use these phases for any feature work:

| Phase | Name               | What                                    |
|-------|--------------------|-----------------------------------------|
| **F1**| DB + RLS           | Migrations, RLS policies                |
| **F2**| Session Bootstrap  | Anon auth, feature flags                |
| **F3**| Moltbot Skill      | AI skill + output schema                |
| **F4**| Chat Endpoint      | Tool execution, chat interface          |
| **F5**| PWA UI             | Components, tabs, badges                |
| **F6**| Matching + Notify  | Suggestions, notifications              |
| **G1**| External Feeds     | Discovery (links only)                  |
| **H1**| Moderation         | Abuse controls, rate limits             |
| **I1**| E2E + CI           | Tests, runbooks                         |

---

## 5. Workflow Chain (Recommended Order)

For any major feature, follow this workflow sequence:

### A) Planning Phase
1. `/kickoff` — This workflow (scope lock, structure review)
2. `/apply-standards` — Verify design system, RBAC, PWA standards

### B) Design Phase
3. `/additive-design-tokens` — Ensure Midnight Savory consistency
4. `/additive-info-architecture` — 3-lane UX (Browse/Chat/Inbox)
5. `/additive-content-copy` — Moltbot prompts, tone

### C) Implementation Phase
6. `/db-migration` — Safe DB changes
7. `/supabase-rls` — RLS policies
8. `/pwa-uiux-frontend-worldclass` — UI implementation

### D) Quality Phase
9. `/additive-ux-quality-gate` — Touch targets, contrast, states
10. `/additive-a11y-gate` — WCAG AA, keyboard nav
11. `/additive-motion-system` — Animation tokens
12. `/additive-performance-offline` — Service worker, code splitting

### E) Trust & Safety Phase
13. `/additive-trust-safety` — Reputation, abuse handling
14. `/additive-observability` — Debug panel, correlation IDs

### F) SEO Phase (if public-facing)
15. `/seo` — 9-phase SEO implementation

### G) Verification Phase
16. `/qa-comprehensive` — Full QA review
17. `/deploy-check` — Deployment readiness
18. `/go-live-readiness` — Production gate

---

## 6. Definition of Done (Global)

A feature is **DONE** only when:

- [ ] **Scope lock respected** — No out-of-scope additions
- [ ] **Mobile works E2E** — Tested on mobile viewport
- [ ] **Tap budget preserved** — ≤4 taps for core flows
- [ ] **States handled** — Loading, empty, error, offline
- [ ] **Contrast OK** — WCAG AA on dark surfaces
- [ ] **Build passes** — `pnpm build` succeeds
- [ ] **Tests pass** — Existing tests still green
- [ ] **Rollback documented** — How to revert if needed

---

## 7. Non-Negotiable Constraints

From global rules, **NEVER**:

- ❌ Add delivery/driver tracking
- ❌ Add payment API integration (MoMo/Revolut = handoff only)
- ❌ Add maps/geolocation
- ❌ Add in-app QR scanner
- ❌ Break existing flows
- ❌ Use more than 4 taps for ordering
- ❌ Print secrets or env contents

---

## 8. Commands Reference

```bash
# Root commands
pnpm install        # Install all deps
pnpm build          # Build all workspaces
pnpm dev            # Dev server for all
pnpm lint           # Lint all

# Web app
cd apps/web
pnpm dev            # Vite dev server
pnpm build          # tsc + vite build
pnpm preview        # Preview build

# Supabase
supabase functions deploy ai-router rss-sync moltbot-jobs moltbot-ingest --use-api
supabase db push    # Apply migrations

# SEO
node scripts/seo-generate.mjs  # Generate static SEO pages
```

---

## 9. Artifact Requirements

For every task, produce:

1. **Scope Lock** — What + exclusions
2. **Implementation Plan** — design/approach
3. **Task List** — Small verifiable steps
4. **Verification Evidence** — Tests run, screenshots
5. **Rollback Notes** — How to revert

---

## 10. Quick Start Template

```markdown
# [Feature Name]

## Scope Lock

**Objective**: ...

**In Scope**:
- [ ] ...

**Out of Scope**:
- [ ] ...

**Acceptance**:
- [ ] ...

---

## Implementation Plan

### Phase 1: ...
- [ ] Step 1
- [ ] Step 2

### Phase 2: ...
- [ ] Step 3

---

## Verification

- [ ] Build: `pnpm build`
- [ ] Manual: [test steps]
- [ ] Screenshot: [if UI]

---

## Rollback

To revert: ...
```

---

## Next Steps

After running `/kickoff`:

1. **If DB changes needed** → `/db-migration`
2. **If UI changes needed** → `/pwa-uiux-frontend-worldclass`
3. **If both** → Start with DB, then UI
4. **If unsure** → `/fullstack-audit` first
