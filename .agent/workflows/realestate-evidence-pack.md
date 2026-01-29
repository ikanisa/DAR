---
description: UAT Evidence Pack Generator — regulator-friendly audit dossier with JSON/PDF/ZIP export
---

# Evidence Pack Generator Workflow

Generate regulator-friendly "evidence packs" for listings with audit timeline, redaction, and cryptographic integrity.

---

## Goal

Create exportable evidence bundles:
- JSON (machine readable)
- PDF (human readable)
- ZIP (complete bundle)

For compliance, audits, and dispute resolution.

---

## Hard Rules

- **Never include secrets, tokens, or API keys**
- Redact personal data:
  - Phone: show last 3 digits only
  - Email: show first 2 chars + domain
  - telegram_id/whatsapp_id/peer_id: show first 4 + last 4
- Do NOT embed images (include URL manifest only)
- Deterministic: same DB state → same pack hash
- Include cryptographic digests (SHA-256)
- Log every generation to `audit_log`

---

## Stack

- Node.js 22+
- Fastify
- pg, zod
- pdfkit for PDF generation
- archiver for ZIP

---

## New Endpoints

### GET /api/evidence/listing/:id

**Query params**:
- `format`: `json` | `pdf` | `zip` (default: json)
- `include`: `basic` | `full` (default: full)

**Auth**:
- Admin/moderator JWT OR service token
- Posters: can access only their own listings
- Seekers: cannot access

**Response**:
- `application/json` OR `application/pdf` OR `application/zip`

### GET /api/evidence/viewing/:id

Same format options; includes listing + viewing timeline

---

## JSON Structure

```typescript
interface EvidencePack {
  meta: {
    generated_at: string;          // ISO8601
    generated_by: {
      actor_type: string;
      actor_id_redacted: string;
      role: string;
    };
    format: 'json' | 'pdf' | 'zip';
    schema_version: '1.0';
    timezone: 'Africa/Kigali';
  };
  subject: {
    listing: ListingSnapshot;
    poster: RedactedUser;
    media_manifest: MediaItem[];
    reviews: Review[];
    matches: Match[];
    viewings?: Viewing[];         // if full
  };
  timeline: TimelineEntry[];
  integrity: {
    timeline_hash_chain: string;  // SHA-256
    pack_hash: string;            // SHA-256 of JSON (excluding this field)
    row_count: {
      audit_log: number;
      reviews: number;
      viewings: number;
    };
  };
}

interface TimelineEntry {
  ts: string;                     // ISO8601
  actor_type: string;
  actor_id_redacted: string;
  action: string;
  entity: string;
  entity_id: string;
  payload_redacted: object;
  source_refs: {
    inbound_event_id?: string;
    request_id?: string;
  };
  entry_hash: string;             // SHA-256
}
```

---

## Files to Create

```
/apps/backend/src/evidence/
├── canonical.ts      # Stable JSON stringify
├── redact.ts         # Redaction helpers
├── buildEvidence.ts  # Main builder
├── renderPdf.ts      # PDF generation
├── renderZip.ts      # ZIP bundling
└── index.ts

/apps/backend/src/routes/evidence.ts
/apps/backend/src/test/evidence.test.ts
```

---

## Implementation

### Redaction (redact.ts)

```typescript
export function redactPhone(phone: string | null): string {
  if (!phone) return '[none]';
  return `***-***-${phone.slice(-3)}`;
}

export function redactEmail(email: string | null): string {
  if (!email) return '[none]';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

export function redactPeerId(id: string | null): string {
  if (!id) return '[none]';
  if (id.length < 8) return '****';
  return `${id.slice(0, 4)}****${id.slice(-4)}`;
}

export function redactPayload(payload: object): object {
  const sensitiveKeys = ['phone', 'email', 'password', 'token', 'secret'];
  const redacted = { ...payload };
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
  }
  return redacted;
}
```

### Canonical Stringify (canonical.ts)

```typescript
import crypto from 'crypto';

export function canonicalStringify(obj: object): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

### Build Evidence (buildEvidence.ts)

```typescript
import { db } from '../db';
import { canonicalStringify, sha256 } from './canonical';
import { redactPhone, redactEmail, redactPeerId, redactPayload } from './redact';
import { writeAudit } from '../audit';

export async function buildEvidencePack(
  listingId: string,
  requester: { type: string; id: string; role: string },
  includeViewings: boolean = true
): Promise<EvidencePack> {
  // Fetch listing
  const listing = await db.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  if (!listing.rows[0]) throw new Error('Listing not found');
  
  // Fetch poster
  const poster = await db.query('SELECT * FROM users WHERE id = $1', [listing.rows[0].poster_id]);
  
  // Fetch media
  const media = await db.query(
    'SELECT kind, url, meta FROM listing_media WHERE listing_id = $1',
    [listingId]
  );
  
  // Fetch reviews
  const reviews = await db.query(
    'SELECT * FROM reviews WHERE listing_id = $1 ORDER BY created_at',
    [listingId]
  );
  
  // Fetch timeline from audit_log
  const timeline = await db.query(`
    SELECT * FROM audit_log 
    WHERE (entity = 'listing' AND entity_id = $1)
       OR (payload->>'listing_id' = $1)
    ORDER BY created_at, action, entity_id
  `, [listingId]);
  
  // Build timeline entries with hashes
  const timelineEntries: TimelineEntry[] = [];
  const entryHashes: string[] = [];
  
  for (const row of timeline.rows) {
    const entry: TimelineEntry = {
      ts: row.created_at.toISOString(),
      actor_type: row.actor_type,
      actor_id_redacted: redactPeerId(row.actor_id),
      action: row.action,
      entity: row.entity,
      entity_id: row.entity_id || '',
      payload_redacted: redactPayload(row.payload || {}),
      source_refs: row.payload?.inbound_event_id 
        ? { inbound_event_id: row.payload.inbound_event_id }
        : {},
      entry_hash: '', // Computed below
    };
    
    // Hash this entry
    entry.entry_hash = sha256(canonicalStringify(entry));
    entryHashes.push(entry.entry_hash);
    timelineEntries.push(entry);
  }
  
  // Chain hash
  const chainHash = sha256(entryHashes.join(''));
  
  // Build pack (without pack_hash)
  const pack: Omit<EvidencePack, 'integrity'> & { integrity: Partial<EvidencePack['integrity']> } = {
    meta: {
      generated_at: new Date().toISOString(),
      generated_by: {
        actor_type: requester.type,
        actor_id_redacted: redactPeerId(requester.id),
        role: requester.role,
      },
      format: 'json',
      schema_version: '1.0',
      timezone: 'Africa/Kigali',
    },
    subject: {
      listing: listing.rows[0],
      poster: {
        id: poster.rows[0]?.id,
        name: poster.rows[0]?.name,
        phone: redactPhone(poster.rows[0]?.phone),
        email: redactEmail(poster.rows[0]?.email),
      },
      media_manifest: media.rows.map(m => ({
        kind: m.kind,
        url: m.url,
        meta: m.meta,
      })),
      reviews: reviews.rows,
      matches: [],
      viewings: includeViewings 
        ? (await db.query('SELECT * FROM viewings WHERE listing_id = $1', [listingId])).rows
        : undefined,
    },
    timeline: timelineEntries,
    integrity: {
      timeline_hash_chain: chainHash,
      row_count: {
        audit_log: timelineEntries.length,
        reviews: reviews.rows.length,
        viewings: includeViewings 
          ? (await db.query('SELECT COUNT(*) FROM viewings WHERE listing_id = $1', [listingId])).rows[0].count 
          : 0,
      },
    },
  };
  
  // Compute pack hash
  const packHash = sha256(canonicalStringify(pack));
  (pack.integrity as EvidencePack['integrity']).pack_hash = packHash;
  
  // Audit this generation
  await writeAudit({
    actorType: requester.type as 'user' | 'agent' | 'system',
    actorId: requester.id,
    action: 'evidence.generate',
    entity: 'listing',
    entityId: listingId,
    payload: { format: 'json', pack_hash: packHash },
  });
  
  return pack as EvidencePack;
}
```

### PDF Renderer (renderPdf.ts)

```typescript
import PDFDocument from 'pdfkit';

export function renderPdf(pack: EvidencePack): Buffer {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  
  doc.on('data', chunks.push.bind(chunks));
  
  // Title
  doc.fontSize(20).text('Listing Evidence Pack', { align: 'center' });
  doc.moveDown();
  
  // Summary
  doc.fontSize(12);
  doc.text(`Listing ID: ${pack.subject.listing.id}`);
  doc.text(`Title: ${pack.subject.listing.title}`);
  doc.text(`Type: ${pack.subject.listing.type}`);
  doc.text(`Price: ${pack.subject.listing.price_currency} ${pack.subject.listing.price_amount}`);
  doc.text(`Status: ${pack.subject.listing.status}`);
  doc.text(`Generated: ${pack.meta.generated_at}`);
  doc.moveDown();
  
  // Timeline table
  doc.fontSize(14).text('Timeline', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  
  for (const entry of pack.timeline) {
    doc.text(`${entry.ts} | ${entry.actor_type} | ${entry.action}`);
  }
  
  doc.moveDown();
  
  // Footer with hash
  doc.fontSize(8).text(`Pack Hash: ${pack.integrity.pack_hash}`, { align: 'center' });
  
  doc.end();
  
  return Buffer.concat(chunks);
}
```

### Routes (routes/evidence.ts)

```typescript
import { FastifyInstance } from 'fastify';
import { buildEvidencePack } from '../evidence/buildEvidence';
import { renderPdf } from '../evidence/renderPdf';
import archiver from 'archiver';

export async function evidenceRoutes(fastify: FastifyInstance) {
  fastify.get('/api/evidence/listing/:id', async (request, reply) => {
    const { id } = request.params;
    const format = request.query.format || 'json';
    
    // Auth check
    if (!canAccessEvidence(request.user, id)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    
    const pack = await buildEvidencePack(id, {
      type: request.user?.type || 'user',
      id: request.user?.id || 'anonymous',
      role: request.user?.role || 'unknown',
    });
    
    if (format === 'json') {
      return pack;
    }
    
    if (format === 'pdf') {
      const pdf = renderPdf(pack);
      reply.header('Content-Type', 'application/pdf');
      return pdf;
    }
    
    if (format === 'zip') {
      const archive = archiver('zip');
      archive.append(JSON.stringify(pack, null, 2), { name: 'evidence.json' });
      archive.append(renderPdf(pack), { name: 'evidence.pdf' });
      archive.append(
        `Pack Hash: ${pack.integrity.pack_hash}\nGenerated: ${pack.meta.generated_at}`,
        { name: 'manifest.txt' }
      );
      archive.finalize();
      
      reply.header('Content-Type', 'application/zip');
      return archive;
    }
    
    return reply.code(400).send({ error: 'Invalid format' });
  });
}
```

---

## Tests

```typescript
describe('Evidence Pack', () => {
  it('admin can export JSON for listing', async () => {});
  it('poster can export only their own listing', async () => {});
  it('seeker cannot export (403)', async () => {});
  it('redaction masks phone/email', async () => {});
  it('deterministic hash: same DB → same pack_hash', async () => {});
  it('PDF returns application/pdf', async () => {});
  it('ZIP contains evidence.json and evidence.pdf', async () => {});
});
```

---

## Acceptance Criteria

- [ ] Admin can generate evidence pack
- [ ] Poster can generate for own listings only
- [ ] Seeker blocked (403)
- [ ] Personal data redacted
- [ ] Same input → same pack_hash
- [ ] PDF renders correctly
- [ ] ZIP contains all files
- [ ] Generation logged to audit_log

---

## Rollback

```bash
git checkout HEAD~1 -- apps/backend/src/evidence/
git checkout HEAD~1 -- apps/backend/src/routes/evidence.ts
```
