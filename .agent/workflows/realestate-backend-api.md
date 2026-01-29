---
description: Backend API (Fastify) + RBAC + validation + audit logging for Real Estate PWA
---

# W2 — Backend API Workflow

Build a Node.js backend (Fastify) providing APIs for the PWA and Moltbot tools.

---

## Goal

Create a secure, auditable backend with:
- RBAC middleware (JWT + role claims)
- Input validation (zod)
- Idempotency for webhooks
- Audit logging on every write

---

## Stack

- Node.js 22+
- Fastify
- zod for validation
- pg (node-postgres) for DB
- pino for logging

---

## Hard Rules

- No direct DB access from browser
- Every write endpoint must also write an `audit_log` row
- Implement RBAC middleware with JWT (dev mode accepts static token)
- All endpoints must validate input with zod
- Idempotency: store `inbound_events(id)` and reject duplicates

---

## Files to Create

```
/apps/backend/src/
├── server.ts           # Fastify app entry
├── config.ts           # Environment config
├── db.ts               # Database connection pool
├── rbac.ts             # RBAC middleware
├── audit.ts            # Audit logging helper
├── routes/
│   ├── listings.ts     # Listing CRUD
│   ├── search.ts       # Search endpoint
│   ├── reviews.ts      # Review endpoints
│   ├── viewings.ts     # Viewing scheduling
│   ├── chat.ts         # Chat ingestion
│   ├── notifications.ts # Notification senders
│   └── tools.ts        # Moltbot tool endpoints
└── test/
    └── api.test.ts     # API tests
```

---

## Endpoints

### Listings

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/api/listings` | poster | Create draft, set status=submitted |
| GET | `/api/listings/:id` | public | Return listing + media |
| GET | `/api/listings/search` | public | Filtered + ranked search |
| POST | `/api/listings/:id/review` | admin/moderator/agent | Insert review, update status |

### Viewings

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/api/viewings` | seeker | Create viewing, status=proposed |

### Chat

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/api/chat/ingest` | system/service | Store event, upsert session |
| GET | `/api/chat/session/:id` | auth | Load conversation context |

### Notifications

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/api/notifications/whatsapp` | system | Send WhatsApp (mock) |
| POST | `/api/notifications/telegram` | system | Send Telegram (mock) |

### Tools (for Moltbot)

| Method | Path | Role | Action |
|--------|------|------|--------|
| POST | `/api/tools/listing/validate` | service | Validate listing completeness |
| POST | `/api/tools/listing/dedupe` | service | Check for duplicates |
| GET | `/api/tools/admin/review-queue` | admin/agent | Get pending reviews |
| POST | `/api/tools/admin/decision` | admin/agent | Submit review decision |

---

## Cross-Cutting Concerns

### RBAC Middleware

```typescript
// rbac.ts
export async function verifyRole(request, reply, roles: string[]) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  // Verify JWT, extract role
  // If SERVICE_TOKEN, treat as system/agent
  // Check role against allowed roles
}
```

### Audit Helper

```typescript
// audit.ts
export async function writeAudit(params: {
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: object;
}) {
  await db.query(`
    INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [params.actorType, params.actorId, params.action, params.entity, params.entityId, params.payload]);
}
```

### Idempotency

```typescript
// Check before processing
const existing = await db.query('SELECT id FROM inbound_events WHERE id = $1', [eventId]);
if (existing.rows.length > 0) {
  reply.code(409).send({ error: 'Duplicate event' });
  return;
}
await db.query('INSERT INTO inbound_events (id, source, payload) VALUES ($1, $2, $3)', [eventId, source, payload]);
```

---

## Validation (zod)

```typescript
import { z } from 'zod';

export const ListingCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(100),
  type: z.enum(['apartment', 'house', 'land', 'commercial']),
  price_amount: z.number().positive(),
  price_currency: z.string().default('RWF'),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  address_text: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
```

---

## Tests

```typescript
// api.test.ts
describe('Listings API', () => {
  it('poster can submit listing', async () => {});
  it('admin can review listing and change status', async () => {});
});

describe('Chat API', () => {
  it('idempotency: duplicate event rejected', async () => {});
});

describe('Search API', () => {
  it('returns ranked results', async () => {});
});
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "tsc",
    "test": "vitest"
  }
}
```

---

## .env.example

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/realestate
JWT_SECRET=dev_secret_change_in_production
SERVICE_TOKEN=dev_service_token_change_in_production
PORT=3001
```

---

## Acceptance Criteria

- [ ] Poster can submit listing with media references
- [ ] Admin sees listing in review queue
- [ ] Admin review changes listing status
- [ ] Seeker search returns deterministic ranking
- [ ] Duplicate `event_id` returns 409
- [ ] Every write creates audit log entry

---

## Rollback

```bash
# Revert to previous version
git checkout HEAD~1 -- apps/backend/
pnpm install
```
