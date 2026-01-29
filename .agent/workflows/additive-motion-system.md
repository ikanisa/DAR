---
description: Motion and micro-interaction system for consistent, safe animations
---

# Additive Motion & Micro-Interaction System Workflow

**Purpose**: Clay/glass UI needs motion to feel alive, but too much causes nausea. Define and enforce consistent motion tokens.

---

## Motion Token Definitions

### 1. Timing Tokens

Define in `tokens.ts` or CSS variables:

```typescript
export const motionTokens = {
  // Durations
  durationFast: '150ms',      // Micro-interactions (button press, toggle)
  durationNormal: '250ms',    // Standard transitions (card hover, menu)
  durationSlow: '400ms',      // Complex animations (modal, page transition)
  
  // Easings
  easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',      // Natural deceleration
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',    // Smooth in-out
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy spring
  
  // Physics
  squishScale: 0.95,          // Press-in scale
  liftScale: 1.02,            // Hover lift scale
  liftShadow: '0 8px 24px rgba(0,0,0,0.15)', // Lifted shadow
};
```

---

### 2. Interaction Patterns

#### Card Hover (Desktop)
```css
.card {
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}
.card:hover {
  transform: translateY(-4px) scale(var(--lift-scale));
  box-shadow: var(--lift-shadow);
}
```

#### Card Press (Mobile)
```css
.card:active {
  transform: scale(var(--squish-scale));
  transition-duration: var(--duration-fast);
}
```

#### Button States
```css
.button {
  transition: transform var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast);
}
.button:hover {
  background-color: var(--color-primary-hover);
}
.button:active {
  transform: scale(0.97);
}
```

#### Bottom Sheet Physics
```css
.bottom-sheet {
  transition: transform var(--duration-slow) var(--ease-spring);
}
.bottom-sheet.open {
  transform: translateY(0);
}
.bottom-sheet.closed {
  transform: translateY(100%);
}
```

---

### 3. Reduce Motion Support

**Respect user preferences**:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**React Hook**:
```typescript
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  return prefersReduced;
}
```

---

### 4. Haptics (Future Native Wrapper)

If shipping native wrapper later, prepare haptic hooks:

```typescript
export function useHapticFeedback() {
  const trigger = useCallback((type: 'light' | 'medium' | 'heavy') => {
    // Placeholder for native bridge
    if ('vibrate' in navigator) {
      const durations = { light: 10, medium: 20, heavy: 30 };
      navigator.vibrate(durations[type]);
    }
  }, []);
  
  return { trigger };
}
```

---

## Motion Checklist

For every interactive component:

- [ ] Has hover state (desktop)
- [ ] Has press/active state (mobile)
- [ ] Uses motion tokens (not hardcoded values)
- [ ] Respects reduce-motion preference
- [ ] Animation is subtle (not distracting)
- [ ] No animation >500ms (unless page transition)

---

## Verification Steps

1. **Token Consistency**:
   - Grep for hardcoded duration/easing values
   - All should reference tokens

2. **Reduce Motion Test**:
   - System Preferences → Accessibility → Reduce Motion
   - Verify all animations are disabled

3. **Motion Feel**:
   - Navigate through app
   - Interactions should feel consistent
   - Nothing should feel jarring or slow

---

## Acceptance Criteria

- [ ] Motion tokens defined in single source of truth
- [ ] All interactive elements use tokens
- [ ] Reduce motion preference respected
- [ ] Card hover/press feels natural
- [ ] Bottom sheet has physics-based easing
- [ ] No animation causes discomfort
