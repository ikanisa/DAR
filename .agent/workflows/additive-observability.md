---
description: UX observability workflow with debug panel and correlation IDs for rapid diagnosis
---

# Additive Observability Workflow

**Purpose**: Diagnose "it didn't work" quickly.

---

## 1. Admin/Dev Debug Panel

Hidden panel (Ctrl+Shift+D or 3-finger long press):

| Section          | Contents                          |
|------------------|-----------------------------------|
| Last Tool Calls  | Recent Moltbot invocations        |
| Moltbot Plan     | Current conversation state        |
| Caps/Budget      | Token usage, rate limits          |
| Feature Flags    | A/B test assignments              |

### Access Control

```typescript
const canAccessDebug = 
  user?.role === 'admin' || 
  user?.role === 'dev' ||
  import.meta.env.DEV;
```

---

## 2. Tool Call Logging

```typescript
interface ToolCallLog {
  id: string;
  correlationId: string;
  tool: string;
  duration: number;
  status: 'success' | 'error';
}

// Keep last 50 in memory
const toolCallBuffer: ToolCallLog[] = [];
```

**Redact PII**: User IDs, phones, emails before display.

---

## 3. User-Facing Errors

```tsx
<ErrorMessage>
  Something went wrong.
  <Button onClick={handleRetry}>Retry</Button>
  <Text size="xs">Error ID: {correlationId}</Text>
</ErrorMessage>
```

Include correlation ID so support can trace in <2 minutes.

---

## Acceptance Criteria

- [ ] Debug panel shows tool calls, plan, usage, flags
- [ ] Errors include correlation ID
- [ ] Retry action on errors
- [ ] Any complaint traceable in <2 minutes
