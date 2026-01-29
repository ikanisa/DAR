# ADR-001: Property Search Strategy

**Status:** Accepted  
**Date:** 2026-01-29  
**Author:** AI Agent  

---

## Context

The Real Estate PWA needs a robust property search system that can:
- Handle full-text search across listing titles, descriptions, and locations
- Support filtering by price, bedrooms, property type, and location
- Rank results by relevance and recency
- Scale to thousands of listings without performance degradation

## Decision

We adopt **PostgreSQL full-text search** with `tsvector` columns and GIN indexes, combined with a multi-factor relevance scoring algorithm.

### Search Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   PWA Client    │────▶│  Backend API     │────▶│   PostgreSQL    │
│   (search UI)   │     │  /api/search     │     │   (full-text)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Relevance Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Text Match | 40% | `ts_rank()` score on title + description |
| Recency | 25% | Listings < 7 days get boost |
| Completeness | 20% | Listings with photos, full description |
| Engagement | 15% | View count, inquiry count |

### Indexing Strategy

```sql
-- Full-text search index
CREATE INDEX idx_listings_search 
ON listings USING GIN (to_tsvector('english', title || ' ' || description));

-- Composite filter index
CREATE INDEX idx_listings_filter 
ON listings (status, property_type, bedrooms, price);

-- Location-based index (for future geospatial queries)
CREATE INDEX idx_listings_location 
ON listings (locality);
```

## Consequences

### Positive
- No external search service dependency (Elasticsearch/Algolia)
- Transactions ensure search consistency with data writes
- Built-in PostgreSQL features reduce complexity

### Negative
- Less sophisticated than dedicated search engines
- Limited fuzzy matching and typo tolerance
- May need migration to external service at scale (>100k listings)

### Mitigation
- Implement query normalization for common typos
- Add synonym mapping for property terms
- Monitor query latency; plan external service migration trigger at P95 > 200ms

---

## References

- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- Existing implementation: `apps/backend/src/services/searchService.ts`
