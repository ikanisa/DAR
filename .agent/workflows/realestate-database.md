---
description: Postgres schema + migrations + seed + audit core for Real Estate PWA
---

# W1 — Database Workflow

Design and implement Postgres schema for listings, users, chat sessions, reviews, matches, viewings, and audit logs.

---

## Goal

Create a robust database schema with:
- All entities for real estate marketplace
- Audit logging on every write
- Idempotency tracking for webhooks
- Proper indexes for search performance

---

## Hard Rules

- Use Postgres 15+
- Use plain SQL migrations (not ORM migrations)
- Every write action must insert into `audit_log`
- `inbound_events` table for idempotency (PK = event_id text)
- No secrets in repo
- Add indexes for search + foreign keys

---

## Schema Details

### users
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('seeker', 'poster', 'admin', 'moderator')),
  name text,
  phone text,
  email text,
  telegram_id text,
  whatsapp_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### listings
```sql
CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poster_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('apartment', 'house', 'land', 'commercial')),
  price_amount numeric NOT NULL,
  price_currency text NOT NULL DEFAULT 'RWF',
  bedrooms int,
  bathrooms int,
  size_sqm numeric,
  address_text text,
  lat numeric,
  lng numeric,
  status text NOT NULL CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'published', 'archived')),
  quality_score int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### listing_media
```sql
CREATE TABLE listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'doc')),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### reviews
```sql
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id),
  agent_id text,
  result text NOT NULL CHECK (result IN ('approved', 'rejected', 'needs_changes')),
  notes text,
  flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### seeker_profiles
```sql
CREATE TABLE seeker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefs jsonb DEFAULT '{}'::jsonb,
  budget_min numeric,
  budget_max numeric,
  areas jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### matches
```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id uuid NOT NULL REFERENCES users(id),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score numeric NOT NULL,
  reasons jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### viewings
```sql
CREATE TABLE viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  seeker_id uuid NOT NULL REFERENCES users(id),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('proposed', 'confirmed', 'cancelled', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  channel text NOT NULL CHECK (channel IN ('webchat', 'telegram', 'whatsapp')),
  peer_id text NOT NULL,
  agent_id text NOT NULL,
  state jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel, peer_id)
);
```

### audit_log
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### inbound_events
```sql
CREATE TABLE inbound_events (
  id text PRIMARY KEY,
  source text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb DEFAULT '{}'::jsonb
);
```

---

## Indexes

```sql
-- Listings
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_poster_id ON listings(poster_id);
CREATE INDEX idx_listings_price_amount ON listings(price_amount);
CREATE INDEX idx_listings_bedrooms ON listings(bedrooms);
CREATE INDEX idx_listings_geo ON listings(lat, lng);

-- Related tables
CREATE INDEX idx_listing_media_listing_id ON listing_media(listing_id);
CREATE INDEX idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX idx_chat_sessions_user_channel ON chat_sessions(user_id, channel);
CREATE INDEX idx_inbound_events_received_at ON inbound_events(received_at);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, entity_id);
```

---

## Migration Files

Create in `/apps/backend/migrations/`:

| File | Purpose |
|------|---------|
| `001_extensions.sql` | Enable required extensions (uuid-ossp, etc.) |
| `002_enums.sql` | Create enum types if needed |
| `003_tables.sql` | All table definitions |
| `004_indexes.sql` | All index definitions |
| `005_seed_dev.sql` | Dev seed data (sample users, listings) |

---

## Scripts

Create in `/apps/backend/db/`:

- `runMigrations.ts` — Apply migrations in order
- `resetDev.ts` — Drop all tables, re-run migrations + seed

---

## Tests

Create `/apps/backend/test/db.test.ts`:

```typescript
// Verify tables exist
// Verify audit_log insert works
// Verify inbound_events idempotency (reject duplicates)
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "db:migrate": "tsx db/runMigrations.ts",
    "db:reset": "tsx db/resetDev.ts",
    "test": "vitest"
  }
}
```

---

## Acceptance Criteria

- [ ] All SQL is valid and migrations run
- [ ] All Node scripts execute without errors
- [ ] Audit log insert works
- [ ] Duplicate inbound_events are rejected
- [ ] Tests pass

---

## Rollback

```sql
DROP TABLE IF EXISTS inbound_events CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS viewings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS seeker_profiles CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS listing_media CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```
