---
description: Design token workflow for single source of truth (Midnight Savory palette)
---

# Additive Design Token Workflow

**Purpose**: Keep "Midnight Savory" consistent everywhere. All UI components must read from tokens only.

---

## Token Categories

### 1. Color Palette

```typescript
// tokens/colors.ts
export const colors = {
  // Primary palette
  primary: {
    50: '#f0f4ff',
    100: '#e0e8ff',
    200: '#c1d0ff',
    300: '#93abff',
    400: '#637dff',
    500: '#4a5cff',   // Main brand
    600: '#3a42f0',
    700: '#2f32d6',
    800: '#272aad',
    900: '#252889',
  },
  
  // Neutral (clay/dark mode base)
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',   // Dark surface
    900: '#0f172a',   // Darkest
    950: '#020617',   // Near black
  },
  
  // Semantic colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Glass/frost overlays
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    heavy: 'rgba(255, 255, 255, 0.2)',
  },
};
```

---

### 2. Spacing Scale

```typescript
// tokens/spacing.ts
export const spacing = {
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px (min touch target)
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
};
```

---

### 3. Border Radius Scale

```typescript
// tokens/radius.ts
export const radius = {
  none: '0',
  sm: '0.25rem',     // 4px - subtle
  default: '0.5rem', // 8px - standard
  md: '0.75rem',     // 12px - medium
  lg: '1rem',        // 16px - large
  xl: '1.25rem',     // 20px - extra large
  '2xl': '1.5rem',   // 24px - very large
  '3xl': '2rem',     // 32px - huge
  full: '9999px',    // Pill shape
};
```

---

### 4. Shadow Recipes (Clay + Glass)

```typescript
// tokens/shadows.ts
export const shadows = {
  // Standard elevation
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  
  // Clay-specific (inner glow + outer shadow)
  clay: {
    base: `
      inset 0 1px 1px rgba(255, 255, 255, 0.1),
      0 4px 8px rgba(0, 0, 0, 0.2)
    `,
    pressed: `
      inset 0 2px 4px rgba(0, 0, 0, 0.2),
      0 1px 2px rgba(0, 0, 0, 0.1)
    `,
    lifted: `
      inset 0 1px 1px rgba(255, 255, 255, 0.15),
      0 8px 24px rgba(0, 0, 0, 0.25)
    `,
  },
  
  // Glass-specific
  glass: {
    subtle: '0 8px 32px rgba(0, 0, 0, 0.12)',
    glow: '0 0 40px rgba(74, 92, 255, 0.15)',
  },
  
  // Focus ring (a11y)
  focusRing: '0 0 0 3px rgba(74, 92, 255, 0.5)',
};
```

---

### 5. Typography Scale

```typescript
// tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'monospace'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],        // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],       // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],     // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
```

---

## Token File Structure

```
packages/ui/
├── tokens/
│   ├── index.ts        # Re-exports all tokens
│   ├── colors.ts
│   ├── spacing.ts
│   ├── radius.ts
│   ├── shadows.ts
│   ├── typography.ts
│   └── motion.ts       # If using motion tokens
├── styles/
│   └── tokens.css      # CSS custom properties version
```

---

## CSS Custom Properties Export

```css
/* packages/ui/styles/tokens.css */
:root {
  /* Colors */
  --color-primary-500: #4a5cff;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;
  
  /* Spacing */
  --spacing-4: 1rem;
  --spacing-11: 2.75rem;
  
  /* Radius */
  --radius-lg: 1rem;
  
  /* Shadows */
  --shadow-clay-base: inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.2);
  
  /* Focus */
  --shadow-focus-ring: 0 0 0 3px rgba(74, 92, 255, 0.5);
}
```

---

## Usage Enforcement

### Do ✅

```tsx
// Use tokens
<div className="bg-neutral-800 rounded-lg p-4 shadow-clay-base">
  <Text size="lg" weight="semibold">Title</Text>
</div>
```

### Don't ❌

```tsx
// No inline colors
<div style={{ backgroundColor: '#1e293b', borderRadius: '16px' }}>
  <span style={{ fontSize: '18px' }}>Title</span>
</div>
```

---

## Verification Steps

1. **Grep for hardcoded values**:
   ```bash
   # Find hardcoded hex colors
   grep -r '#[0-9a-fA-F]\{6\}' --include='*.tsx' --include='*.css' apps/
   
   # Find inline px values
   grep -r 'px' --include='*.tsx' apps/ | grep -v 'className'
   ```

2. **Token coverage check**:
   - All colors reference tokens
   - All spacing uses scale values
   - All shadows use defined recipes

3. **Global change test**:
   - Modify a token value
   - Rebuild
   - Verify change reflects across all components

---

## Acceptance Criteria

- [ ] All token categories defined in `/packages/ui/tokens/`
- [ ] CSS custom properties exported for non-JS usage
- [ ] No hardcoded hex colors in component files
- [ ] No hardcoded px spacing (except borders)
- [ ] Changing a token updates UI globally
- [ ] Dark mode uses appropriate token mappings
- [ ] Focus ring uses token shadow
