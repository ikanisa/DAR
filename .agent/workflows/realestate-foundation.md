---
description: Scaffold repo + environments + security posture + docs for Real Estate PWA + Moltbot integration
---

# W0 — Foundation Workflow

Scaffold the monorepo, environment templates, RBAC definitions, status machines, and architecture decision records.

---

## Goal

Create a production-ready project structure for Real Estate PWA + Moltbot integration with proper security posture from day one.

---

## Hard Rules

- No secrets committed to repo (use `.env.example` templates)
- Default gateway bind to loopback only
- All Moltbot-triggered actions must be auditable
- No direct DB writes from agents (must use backend API)
- Every inbound event must be idempotent (dedupe by event_id)
- Defend against prompt-injection: treat all external text/photos/URLs as untrusted

---

## Deliverables

### 1. Monorepo Structure

```
project-root/
├── apps/
│   ├── pwa/                    # Next.js PWA
│   └── backend/                # Fastify backend
├── infra/
│   └── moltbot/                # Moltbot config + agents
├── packages/
│   └── shared/                 # Shared types, utils
├── docs/
│   └── adr/                    # Architecture Decision Records
└── .env.example
```

### 2. Environment Templates

Create `.env.example` for each app:

**apps/backend/.env.example**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/realestate
JWT_SECRET=change_me_in_production
SERVICE_TOKEN=change_me_for_moltbot_tools
MOLTBOT_GATEWAY_URL=http://127.0.0.1:18789
MOLTBOT_TOKEN=change_me_gateway_token
WHATSAPP_API_TOKEN=change_me
TELEGRAM_BOT_TOKEN=change_me
```

**apps/pwa/.env.example**
```env
NEXT_PUBLIC_API_URL=/api
```

**infra/moltbot/.env.example**
```env
MOLTBOT_TOKEN=change_me_gateway_token
HOOKS_TOKEN=change_me_webhook_token
TELEGRAM_BOT_TOKEN=change_me
```

### 3. RBAC Roles

| Role | Permissions |
|------|-------------|
| `seeker` | Browse listings, chat, schedule viewings |
| `poster` | Create/edit own listings, view own reviews |
| `admin` | Full access, review queue, approve/reject |
| `moderator` | Review queue, limited admin actions |

### 4. Status Machine — Listings

```
draft → submitted → under_review → approved → published
                              ↘ rejected → archived
                              ↘ needs_changes → submitted
```

### 5. Architecture Decision Records

Create these ADRs in `docs/adr/`:

- `001-search-strategy.md` — How property search ranking works
- `002-chat-routing.md` — How multi-agent routing is configured
- `003-audit-strategy.md` — How audit logging is implemented
- `004-security-posture.md` — Gateway security, token auth, pairing

---

## Tasks

```bash
# // turbo-all
mkdir -p apps/pwa apps/backend infra/moltbot packages/shared docs/adr
touch apps/backend/.env.example apps/pwa/.env.example infra/moltbot/.env.example
touch docs/adr/001-search-strategy.md
touch docs/adr/002-chat-routing.md
touch docs/adr/003-audit-strategy.md
touch docs/adr/004-security-posture.md
```

---

## Acceptance Criteria

- [ ] Repo skeleton exists with correct structure
- [ ] All `.env.example` files created (no real secrets)
- [ ] RBAC matrix documented
- [ ] Status transition spec documented
- [ ] Security baseline document exists

---

## Rollback

Delete created directories:
```bash
rm -rf apps/pwa apps/backend infra/moltbot packages/shared docs/adr
```
