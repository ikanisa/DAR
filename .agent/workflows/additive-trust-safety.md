---
description: Trust and safety workflow for marketplace-grade spam and abuse prevention
---

# Additive Trust & Safety Workflow

**Purpose**: Anonymous marketplaces need guardrails or they become spam soup. Implement reputation signals, abuse handling, and prohibited content enforcement.

---

## 1. Seller/Vendor Reputation Signals

Even anonymous sellers need trust signals:

### Signals to Display

| Signal              | Description                                    | Display Location       |
|---------------------|------------------------------------------------|------------------------|
| Listing Age         | "Selling since Jan 2024"                       | Vendor profile, cards  |
| Response Rate       | "Responds within 2 hours (95%)"                | Vendor profile         |
| Verification Status | Badge: Unverified / Email / Phone / ID         | Everywhere             |
| Active Listings     | Count of current active listings               | Vendor profile         |
| Completion Rate     | Orders/inquiries fulfilled                     | Vendor profile         |

### Verification Levels

```typescript
enum VerificationLevel {
  NONE = 'none',           // No verification
  EMAIL = 'email',         // Email confirmed
  PHONE = 'phone',         // Phone confirmed
  IDENTITY = 'identity',   // ID document verified
}

interface VendorTrustSignals {
  verificationLevel: VerificationLevel;
  memberSince: Date;
  responseRate: number;      // 0-100
  avgResponseTime: number;   // minutes
  totalListings: number;
  activeListings: number;
}
```

### UI Components

```tsx
<VendorBadge level={vendor.verificationLevel} />
<ResponseRateBadge rate={vendor.responseRate} time={vendor.avgResponseTime} />
<MemberSinceBadge date={vendor.memberSince} />
```

---

## 2. Abuse Handling System

### Report Listing

Users can report any listing:

```typescript
interface ReportPayload {
  reporterId: string;       // Anonymous session ID or user ID
  targetType: 'listing' | 'vendor' | 'message';
  targetId: string;
  reason: ReportReason;
  details?: string;
}

enum ReportReason {
  SPAM = 'spam',
  PROHIBITED = 'prohibited',
  SCAM = 'scam',
  HARASSMENT = 'harassment',
  DUPLICATE = 'duplicate',
  WRONG_CATEGORY = 'wrong_category',
  OTHER = 'other',
}
```

**UI Flow**:
1. User taps "Report" on listing/vendor
2. Modal with reason selection
3. Optional details text
4. "Report Submitted" confirmation
5. Logged for moderation queue

---

### Block Seller Session

Users can block vendors from their view:

```typescript
interface BlockAction {
  blockerId: string;
  blockedVendorId: string;
  reason?: string;
}
```

**Effects**:
- Blocked vendor's listings hidden from blocker
- Blocked vendor cannot message blocker
- Block is reversible in settings

---

### Shadow-Ban Patterns

For repeat offenders (admin-only):

```typescript
interface ShadowBan {
  vendorId: string;
  reason: string;
  appliedBy: string;       // Admin ID
  appliedAt: Date;
  expiresAt?: Date;        // Optional expiry
}
```

**Effects**:
- Vendor can still post (thinks they're live)
- Listings not visible to other users
- Vendor not notified of shadow-ban
- Logged for audit trail

---

## 3. Prohibited Categories Enforcement

### Prohibited Content List

Define prohibited categories in config:

```typescript
const PROHIBITED_CATEGORIES = [
  'weapons',
  'drugs',
  'adult_services',
  'counterfeit',
  'stolen_goods',
  'endangered_species',
  'human_trafficking',
  'financial_fraud',
];

const PROHIBITED_KEYWORDS = [
  // Populate carefully with moderation team
];
```

### Enforcement Points

1. **Pre-publish check**: Moltbot scans before listing goes live
2. **Post-publish scan**: Background job re-scans periodically
3. **User reports**: Manual review queue

### Moltbot Integration

```typescript
// In Moltbot system prompt
const SAFETY_RULES = `
You MUST NOT help users create listings for:
- Weapons or ammunition
- Illegal drugs or controlled substances
- Adult or sexual services
- Counterfeit or stolen goods
- Anything illegal in Rwanda/Malta

If a user attempts to list prohibited content:
1. Politely decline
2. Explain why it's not allowed
3. Suggest alternatives if applicable
4. Do NOT create the listing
`;
```

---

## 4. Database Schema Additions

```sql
-- Vendor trust signals
ALTER TABLE vendors ADD COLUMN verification_level TEXT DEFAULT 'none';
ALTER TABLE vendors ADD COLUMN member_since TIMESTAMP DEFAULT NOW();
ALTER TABLE vendors ADD COLUMN response_rate INTEGER DEFAULT 0;
ALTER TABLE vendors ADD COLUMN avg_response_time INTEGER DEFAULT 0;

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Blocks
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL,
  blocked_vendor_id UUID NOT NULL REFERENCES vendors(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_vendor_id)
);

-- Shadow bans (admin only)
CREATE TABLE shadow_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  reason TEXT NOT NULL,
  applied_by UUID NOT NULL REFERENCES auth.users(id),
  applied_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT true
);
```

---

## 5. Moderation Queue (Admin Portal)

### Queue Views

1. **Pending Reports**: Newest first, filterable by reason
2. **Flagged Listings**: Auto-flagged by content scan
3. **Shadow-banned Vendors**: Active bans with expiry

### Admin Actions

```typescript
type ModerationAction = 
  | 'approve'          // Report dismissed
  | 'remove_listing'   // Listing deleted
  | 'warn_vendor'      // Warning sent
  | 'suspend_vendor'   // Temporary suspension
  | 'shadow_ban'       // Shadow ban
  | 'permanent_ban';   // Account terminated
```

---

## Verification Steps

### Spam Scenario Test

1. Create test vendor
2. Attempt to post prohibited content via Moltbot
3. Verify: Moltbot refuses
4. Attempt to post via direct API (if exposed)
5. Verify: Rejected or auto-flagged
6. Report a listing
7. Verify: Report appears in admin queue
8. Apply shadow-ban
9. Verify: Vendor's listings invisible to others

---

## Acceptance Criteria

- [ ] Verification badges displayed on vendor cards
- [ ] Response rate and member-since visible
- [ ] "Report" button on all listings and vendors
- [ ] Report modal with reason selection
- [ ] Block vendor functionality in settings
- [ ] Moltbot refuses prohibited content
- [ ] Admin moderation queue functional
- [ ] Shadow-ban hides content without notification
- [ ] Spam scenario results in: blocked + logged + clean UI feedback
