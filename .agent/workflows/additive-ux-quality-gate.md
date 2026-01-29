---
description: UX quality gate checklist to prevent "pretty but annoying" UI before merging
---

# Additive UX Quality Gate Workflow

**Purpose**: Ensure every UI change meets mobile-first PWA quality standards before merge.

---

## Pre-Merge Checklist

Run this checklist for every PR that touches UI components, pages, or styles.

### 1. Touch Targets (≥44px)
- [ ] All interactive elements (buttons, links, icons) have a minimum tap target of 44×44px
- [ ] Spacing between adjacent targets is sufficient to prevent mis-taps
- Verify with: Browser DevTools → Element → Computed → box-sizing

### 2. Text Contrast Checks
- [ ] All text meets WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- [ ] Dark mode surfaces verified separately (dark clay is tricky)
- [ ] Text-on-card and text-on-glass combinations tested
- Tool: Use Chrome DevTools → Lighthouse → Accessibility, or https://webaim.org/resources/contrastchecker/

### 3. One-Thumb Navigation
- [ ] Primary nav is at the bottom (not top)
- [ ] Critical actions reachable without stretching (bottom sheet pattern)
- [ ] No important CTAs in the "hard to reach" zone (top corners on tall phones)

### 4. Empty States
- [ ] Every list/grid has a designed empty state (not blank)
- [ ] Empty state includes helpful guidance (what to do next)
- [ ] Verify: filter results to zero, simulate no data

### 5. Skeleton Loaders
- [ ] Every async list/card grid has skeleton placeholders
- [ ] Skeleton matches the actual content layout
- [ ] No layout shift when real content loads

### 6. Error States
- [ ] Every network call has an error state
- [ ] Error message is user-friendly (no raw stack traces)
- [ ] Retry action is available where appropriate
- [ ] Verify: simulate network failure (DevTools → Network → Offline)

### 7. Offline Fallback
- [ ] App shows a meaningful offline message (not blank or browser error)
- [ ] Critical cached content remains accessible
- [ ] Verify: disable network and navigate

---

## Output Requirements

For each PR, produce a **UX Quality Report**:

```markdown
## UX Quality Gate Report

| Check                 | Status | Notes / Screenshot |
|-----------------------|--------|--------------------|
| Touch Targets ≥44px   | ✅/❌   |                    |
| Text Contrast         | ✅/❌   |                    |
| One-Thumb Navigation  | ✅/❌   |                    |
| Empty States          | ✅/❌   |                    |
| Skeleton Loaders      | ✅/❌   |                    |
| Error States          | ✅/❌   |                    |
| Offline Fallback      | ✅/❌   |                    |

**Overall**: PASS / FAIL
```

Attach screenshots for any failing items and remediation notes.

---

## Acceptance Criteria

- All 7 checks must pass before merge
- Screenshots required for visual verification
- Any FAIL requires a follow-up fix PR before the feature ships
