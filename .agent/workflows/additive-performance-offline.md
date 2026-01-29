---
description: Performance and offline-first workflow for native-like PWA experience on slow networks
---

# Additive Performance & Offline-First Workflow

**Purpose**: Make the PWA feel native on Kigali networks + bar Wi-Fi (slow 3G, spotty connections).

---

## Core Requirements

### 1. App Shell Caching (Service Worker)

**Goal**: Instant shell load even offline.

- [ ] Service Worker registered and active
- [ ] App shell (HTML, CSS, critical JS) cached on install
- [ ] Navigation requests fall back to cached shell
- [ ] Verify: Kill network after first load → app shell still renders

**Implementation**:
```javascript
// sw.js or workbox config
precacheAndRoute([
  { url: '/index.html', revision: '...' },
  { url: '/assets/main.css', revision: '...' },
  { url: '/assets/main.js', revision: '...' },
]);
```

---

### 2. Image Pipeline

**Goal**: Fast, progressive image loading.

#### Upload Flow
- [ ] On upload, generate 3 sizes:
  - `thumb`: 150px width (list thumbnails)
  - `med`: 400px width (cards)
  - `full`: 1200px width (detail view)
- [ ] Store all sizes in Supabase Storage or CDN

#### Display Flow
- [ ] Lazy load images (`loading="lazy"` or Intersection Observer)
- [ ] Blur placeholder while loading (base64 tiny placeholder)
- [ ] Serve appropriate size based on context (srcset)
- [ ] WebP format preferred where supported

**Component Pattern**:
```tsx
<OptimizedImage
  src={image.url}
  placeholder={image.blurHash}
  sizes={{ thumb: 150, med: 400, full: 1200 }}
  alt={image.alt}
  loading="lazy"
/>
```

---

### 3. Route-Level Code Splitting

**Goal**: Load only what's needed for current route.

- [ ] Each major route is a separate chunk
- [ ] Lazy load routes with `React.lazy()` or framework equivalent
- [ ] Prefetch likely next routes (see below)

**Verify**:
```bash
# After build, check chunk sizes
npm run build
# Look for route-based chunks in output
```

---

### 4. Prefetch Next Likely Screen

**Goal**: Anticipate navigation, preload assets.

- [ ] On menu screen → prefetch cart/checkout JS
- [ ] On venue list → prefetch venue detail for visible items
- [ ] Use `<link rel="prefetch">` or router-level prefetching
- [ ] Do NOT prefetch everything (waste bandwidth)

**Strategy**:
```tsx
// Prefetch when component mounts or on hover
useEffect(() => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = '/assets/checkout.chunk.js';
  document.head.appendChild(link);
}, []);
```

---

### 5. Instant Back Navigation

**Goal**: Back button feels instant.

- [ ] Cache last list results in memory/state
- [ ] Restore scroll position on back navigation
- [ ] Avoid re-fetching unless data is stale (>30s or user action)

**Pattern**:
```tsx
// Use SWR, React Query, or custom cache
const { data } = useSWR('/api/venues', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 30000,
});
```

---

## Performance Budgets

| Metric              | Target          | Tool                     |
|---------------------|-----------------|--------------------------|
| Lighthouse Perf     | ≥80 (mobile)    | Chrome Lighthouse        |
| FCP                 | <2.5s           | Lighthouse / WebPageTest |
| TTI                 | <5s             | Lighthouse               |
| Bundle Size (main)  | <150KB gzipped  | Build output / Bundlephobia |

---

## Verification Steps

1. **Lighthouse Audit**:
   ```bash
   npm run build && npm run preview
   # Open Chrome DevTools → Lighthouse → Mobile → Performance
   ```

2. **Offline Test**:
   - Load app normally
   - DevTools → Network → Offline
   - Verify app shell renders, cached data shows

3. **Slow Network Test**:
   - DevTools → Network → Slow 3G
   - Navigate flows → verify no spinners >3s

4. **Bundle Analysis**:
   ```bash
   npm run build -- --analyze
   # Or use source-map-explorer
   ```

---

## Acceptance Criteria

- [ ] Lighthouse Mobile Performance ≥80
- [ ] FCP <2.5s on mid-range device simulation
- [ ] App shell loads offline
- [ ] Images lazy load with placeholders
- [ ] Route-level code splitting verified in build output
- [ ] Back navigation feels instant (no full re-fetch)
