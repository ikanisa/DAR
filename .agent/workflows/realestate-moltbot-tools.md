---
description: Safe tool ecosystem for Moltbot agents via backend proxy APIs
---

# W4 — Moltbot Tools Workflow

Implement backend "tools" layer that Moltbot agents call. Tools validate, enforce RBAC, log audit entries, and never expose secrets.

---

## Goal

Create safe, auditable tools for agents:
- Listing validation and deduplication
- Admin review queue and decisions
- All calls logged to audit_log

---

## Hard Rules

- Tools require SERVICE_TOKEN auth OR admin JWT
- Every tool call writes audit_log with `actor_type='agent'` or `'system'`
- Tools never expose secrets, tokens, or raw SQL
- Input validation using zod
- Injection defense: block tool calls for secrets/privileged actions

---

## Files to Create

```
/apps/backend/src/tools/
├── validateListing.ts
├── dedupeListing.ts
├── reviewQueue.ts
├── adminDecision.ts
└── index.ts

/apps/backend/src/routes/tools.ts
/apps/backend/src/test/tools.test.ts
```

---

## Tool Specifications

### 1. POST /api/tools/listing/validate

**Purpose**: Check listing completeness and quality

**Input**:
```typescript
{
  listing_id?: string;
  listing_payload?: {
    title: string;
    description: string;
    price_amount: number;
    address_text: string;
    bedrooms?: number;
    bathrooms?: number;
  };
}
```

**Output**:
```typescript
{
  ok: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}
```

**Rules**:
- Title non-empty
- Description ≥100 characters
- At least 5 photos in listing_media (if listing_id)
- price_amount > 0
- address_text required
- bedrooms/bathrooms sanity check
- Score = completeness percentage

### 2. POST /api/tools/listing/dedupe

**Purpose**: Detect duplicate listings

**Input**:
```typescript
{
  listing_id: string;
}
```

**Output**:
```typescript
{
  duplicates: string[]; // listing IDs
  reason?: string;
}
```

**Rules**:
- Same poster_id + similar address_text → duplicate
- Distance <200m AND price within 10% → potential duplicate
- Simple heuristic, no ML required

### 3. GET /api/tools/admin/review-queue

**Purpose**: Get listings pending review

**Output**:
```typescript
{
  listings: Array<{
    id: string;
    title: string;
    poster_name: string;
    status: string;
    created_at: string;
  }>;
}
```

**Rules**:
- Filter: `status IN ('submitted', 'under_review')`
- Order: `created_at ASC`

### 4. POST /api/tools/admin/decision

**Purpose**: Submit review decision

**Input**:
```typescript
{
  listing_id: string;
  result: 'approved' | 'rejected' | 'needs_changes';
  notes?: string;
  nextStatus: string;
}
```

**Output**:
```typescript
{
  listing: { id: string; status: string; };
}
```

**Rules**:
- Validate nextStatus is consistent:
  - approved → 'approved' or 'published'
  - rejected → 'rejected'
  - needs_changes → 'submitted'
- Insert reviews row
- Update listings.status
- Write audit_log

---

## Implementation

### validateListing.ts

```typescript
import { z } from 'zod';
import { db } from '../db';
import { writeAudit } from '../audit';

const InputSchema = z.object({
  listing_id: z.string().uuid().optional(),
  listing_payload: z.object({
    title: z.string(),
    description: z.string(),
    price_amount: z.number(),
    address_text: z.string(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
  }).optional(),
});

export async function validateListing(input: unknown, actorId: string) {
  const data = InputSchema.parse(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let listing = data.listing_payload;
  
  if (data.listing_id) {
    const result = await db.query('SELECT * FROM listings WHERE id = $1', [data.listing_id]);
    listing = result.rows[0];
    
    // Check photo count
    const mediaResult = await db.query(
      'SELECT COUNT(*) FROM listing_media WHERE listing_id = $1 AND kind = $2',
      [data.listing_id, 'photo']
    );
    if (parseInt(mediaResult.rows[0].count) < 5) {
      errors.push('Minimum 5 photos required');
    }
  }
  
  if (!listing) {
    return { ok: false, errors: ['Listing not found'], warnings: [], score: 0 };
  }
  
  if (!listing.title || listing.title.length < 1) {
    errors.push('Title is required');
  }
  
  if (!listing.description || listing.description.length < 100) {
    errors.push('Description must be at least 100 characters');
  }
  
  if (!listing.price_amount || listing.price_amount <= 0) {
    errors.push('Price must be positive');
  }
  
  if (!listing.address_text) {
    errors.push('Address is required');
  }
  
  // Calculate score
  let score = 100 - (errors.length * 20);
  score = Math.max(0, Math.min(100, score));
  
  await writeAudit({
    actorType: 'agent',
    actorId,
    action: 'tool.listing.validate',
    entity: 'listing',
    entityId: data.listing_id,
    payload: { ok: errors.length === 0, score },
  });
  
  return { ok: errors.length === 0, errors, warnings, score };
}
```

---

## Security

### Authorization Check

```typescript
// routes/tools.ts
fastify.addHook('preHandler', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  
  // Check SERVICE_TOKEN
  if (token === process.env.SERVICE_TOKEN) {
    request.actor = { type: 'agent', id: 'moltbot' };
    return;
  }
  
  // Check admin JWT
  try {
    const decoded = verifyJwt(token);
    if (decoded.role === 'admin' || decoded.role === 'moderator') {
      request.actor = { type: 'user', id: decoded.sub };
      return;
    }
  } catch {}
  
  reply.code(403).send({ error: 'Forbidden' });
});
```

### Injection Defense

```typescript
// Block suspicious requests
const BLOCKED_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api.?key/i,
  /drop\s+table/i,
  /delete\s+from/i,
];

function checkInjection(payload: string): boolean {
  return BLOCKED_PATTERNS.some(p => p.test(payload));
}
```

---

## Tests

```typescript
// tools.test.ts
describe('listing.validate', () => {
  it('detects missing photos', async () => {});
  it('detects short description', async () => {});
  it('returns high score for complete listing', async () => {});
});

describe('listing.dedupe', () => {
  it('returns empty for unique listing', async () => {});
  it('detects duplicate by address', async () => {});
});

describe('admin.decision', () => {
  it('updates listing status on approve', async () => {});
  it('writes review row', async () => {});
  it('writes audit log', async () => {});
});
```

---

## Acceptance Criteria

- [ ] Validate detects missing photos
- [ ] Validate detects short description
- [ ] Dedupe returns empty for unique listing
- [ ] Decision updates status correctly
- [ ] All tool calls write audit_log
- [ ] Unauthorized requests return 403

---

## Rollback

```bash
git checkout HEAD~1 -- apps/backend/src/tools/
git checkout HEAD~1 -- apps/backend/src/routes/tools.ts
```
