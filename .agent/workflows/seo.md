---
description: SEO workflow for PWA Community Marketplace (chat-first, additive-only)
---

# SEO Workflow — PWA Community Marketplace

**Goal**: Make the PWA indexable and rankable globally while keeping it app-like.

**Mode**: Additive only — no breaking changes.

---

## Non-Negotiables

- ✅ Index only public content (vendors, listings, requests, categories, locations)
- ✅ `noindex` all private routes (chat, inbox, me/*, drafts)
- ✅ Avoid thin pages (min content thresholds)
- ✅ Prevent spam from reaching indexable routes
- ✅ Core Web Vitals first (LCP, INP, CLS)
- ✅ SSR or prerender for all public pages

---

## Public vs Private Routes

### Index (public)
- `/` (landing)
- `/vendors` (verified directory)
- `/vendor/{slug}`
- `/listings` (published)
- `/listing/{id-or-slug}`
- `/requests` (posted feed)
- `/request/{id-or-slug}`
- `/categories/{category}`
- `/locations/{city-or-area}`
- `/search?q=...`

### NoIndex (private)
- `/chat`
- `/notifications`
- `/inbox`
- `/me/*`
- `/draft/*`
- Any session-specific view

---

## Phase SEO-1: Indexability Foundation

### Deliver
- [ ] `robots.txt` — allow public, disallow private
- [ ] Dynamic sitemap index + segmented sitemaps (vendors, listings, requests, categories)
- [ ] Canonical URLs on all public pages
- [ ] Meta title/description per route
- [ ] `<meta name="robots" content="noindex,nofollow">` on private routes

### Acceptance
- `robots.txt` reachable at `/robots.txt`
- Sitemap index at `/sitemap.xml`
- Private routes have noindex meta
- Each public page has canonical link

---

## Phase SEO-2: URL Strategy + Slugs

### Deliver
- [ ] Stable slugs for verified vendors
- [ ] Optional slugs for listings
- [ ] 301 redirects: non-canonical → canonical
- [ ] Dedupe: prevent multiple URLs for same content

### Acceptance
- Vendor pages: `/vendor/{slug}`
- Listings have one canonical URL
- UTM params don't change canonical

---

## Phase SEO-3: Structured Data (Schema.org)

### Deliver
- [ ] `LocalBusiness` on vendor pages
- [ ] `Product` schema on product listings
- [ ] `BreadcrumbList` on all public pages
- [ ] `ItemList` on category/list pages
- [ ] `WebSite` + `SearchAction` on homepage

### Acceptance
- Rich Results Test passes for Vendor, Listing, Category
- No fake ratings or availability

### Guardrails
- Do NOT emit ratings unless collected
- Do NOT emit availability unless verified

---

## Phase SEO-4: On-Page SEO Templates

### Title Templates
```
Vendor: {VendorName} — {Category} in {Area} | Marketplace
Listing: {Title} — {PriceOrNegotiable} in {Area} | Listing
Request: {Need} — Request in {Area} | Community Requests
```

### Deliver
- [ ] Unique title per page
- [ ] Meta description (value + location + trust cue)
- [ ] Open Graph + Twitter cards
- [ ] H1/H2 structure per route
- [ ] OG image (static or dynamic)

### Acceptance
- Each public page: unique title, description, H1

---

## Phase SEO-5: Internal Linking + IA

### Deliver
- [ ] Category hub pages (bento grid + latest items)
- [ ] Location hub pages (Kigali areas, etc.)
- [ ] Cross-links: listing → vendor → category → location
- [ ] Related items block (server-rendered)

### Acceptance
- Every listing links to: category + location
- Vendor pages show: latest listings + related vendors

---

## Phase SEO-6: Performance SEO (Core Web Vitals)

### Deliver
- [ ] Image optimization (thumb/med/full) + lazy loading
- [ ] Route-level code splitting
- [ ] Server caching (stale-while-revalidate)
- [ ] Font strategy (system or 1 variable font)
- [ ] Critical CSS for above-the-fold

### Acceptance
- Lighthouse Mobile Performance ≥ 80
- LCP, INP, CLS within good targets

### Notes
- Clay/glass shadows are expensive — fewer layers, avoid giant blurs

---

## Phase SEO-7: Content Quality + Anti-Thin

### Content Thresholds
- Listing min: 120 chars
- Request min: 80 chars

### Deliver
- [ ] Auto noindex for thin content until enriched
- [ ] Server-rendered context blocks (tips, FAQs, category info)

### Acceptance
- Thin pages noindexed until passing threshold
- Spam never reaches indexable routes

---

## Phase SEO-8: UGC Safety + Spam Control

### Deliver
- [ ] Moderation pipeline (block/hold suspect content)
- [ ] Report listing flow
- [ ] Rate limits for posting
- [ ] Auto-remove personal data in public fields

### Acceptance
- Spam wave doesn't generate indexable pages
- Moderation updates sitemap accordingly

---

## Phase SEO-9: Search Console + Monitoring

### Deliver
- [ ] Google Search Console verification
- [ ] Index coverage dashboard
- [ ] 404/soft-404 monitoring
- [ ] Sitemap submission automation

### KPIs to Track
- Indexed pages (vendors/listings/requests)
- Impressions/clicks by category + location
- Top queries
- CWV field data trend

---

## Implementation Instructions

1. Implement phases SEO-1 through SEO-9 **in order**
2. Public pages must be **SSR/prerendered HTML**
3. After each phase, output:
   - Files changed
   - Commands run
   - Tests (Lighthouse, Rich Results Test)
   - Rollback notes
4. Do NOT break existing PWA behavior
