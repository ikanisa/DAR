---
description: Real accessibility workflow for dark clay UI (WCAG AA, keyboard, screen readers)
---

# Additive Accessibility Workflow

**Purpose**: Dark clay UI can become unreadable fast. Ensure real a11y, not checkbox compliance.

---

## 1. Contrast Tests

### Text on Card Combos

Verify all combinations meet WCAG AA (4.5:1 normal, 3:1 large):

| Surface            | Text Color   | Target Ratio |
|--------------------|--------------|--------------|
| neutral-800 card   | white text   | ≥4.5:1       |
| neutral-900 bg     | neutral-300  | ≥4.5:1       |
| glass overlay      | white text   | ≥4.5:1       |
| primary button     | white text   | ≥4.5:1       |

**Tool**: Chrome DevTools → Elements → Accessibility, or [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 2. Keyboard Navigation (Desktop PWA)

- [ ] All interactive elements focusable via Tab
- [ ] Focus order follows visual order
- [ ] No focus traps (except modals)
- [ ] Escape closes modals/sheets

---

## 3. Focus Ring Visibility

```css
:focus-visible {
  outline: 2px solid var(--color-primary-400);
  outline-offset: 2px;
}
```

Must be visible on dark backgrounds.

---

## 4. Screen Reader Labels

```tsx
// Chat bubbles
<div role="log" aria-label="Conversation with Molty">
  <div role="article" aria-label="Molty said">...</div>
  <div role="article" aria-label="You said">...</div>
</div>

// Buttons
<button aria-label="Send message">
  <SendIcon aria-hidden="true" />
</button>
```

---

## 5. Skip Link

```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<main id="main-content">...</main>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 16px;
  top: 16px;
  z-index: 9999;
}
```

---

## Acceptance Criteria

- [ ] All text meets WCAG AA contrast
- [ ] Keyboard navigation works on all pages
- [ ] Focus ring visible on dark surfaces
- [ ] Screen reader labels on chat, cards, buttons
- [ ] Skip link functional
