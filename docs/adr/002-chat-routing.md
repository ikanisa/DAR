# ADR-002: Multi-Agent Chat Routing

**Status:** Accepted  
**Date:** 2026-01-29  
**Author:** AI Agent  

---

## Context

The Real Estate PWA uses Moltbot as the AI gateway for user interactions. We need a routing strategy to:
- Direct user messages to appropriate specialized agents
- Handle handoffs between agents (e.g., seeker → booking)
- Maintain conversation context across agent switches
- Support multiple channels (web chat, Telegram, WhatsApp)

## Decision

We adopt a **skill-based routing** model where Moltbot routes messages to agents based on declared skills and conversation context.

### Routing Architecture

```
┌────────────┐     ┌────────────────┐     ┌──────────────────┐
│  Channels  │────▶│    Moltbot     │────▶│   Specialized    │
│  Web/TG/WA │     │    Gateway     │     │     Agents       │
└────────────┘     └────────────────┘     └──────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Router     │
                   │   Skills     │
                   └──────────────┘
```

### Agent Registry

| Agent | Skills | Responsibilities |
|-------|--------|------------------|
| `seeker` | property_search, inquiry, viewing | Help users find properties |
| `poster` | listing_create, listing_manage | Help landlords manage listings |
| `admin` | moderation, support, escalation | Handle escalations and moderation |
| `onboarding` | registration, profile_setup | Guide new users through setup |

### Routing Rules

1. **Intent Detection**: Moltbot analyzes first message for intent keywords
2. **Skill Matching**: Routes to agent with matching skill declaration
3. **Context Persistence**: `conversation_id` tracks agent assignment
4. **Explicit Handoff**: Agents can invoke `handoff` tool to transfer

### Handoff Protocol

```json
{
  "action": "handoff",
  "params": {
    "target_agent": "admin",
    "reason": "User reported scam listing",
    "context_summary": "...",
    "preserve_history": true
  }
}
```

## Consequences

### Positive
- Clear separation of concerns between agents
- Easy to add new specialized agents
- Conversation context preserved across handoffs
- Channel-agnostic routing logic

### Negative
- Requires careful skill taxonomy design
- Handoff latency adds ~500ms to response time
- Agent context limits may truncate long conversations

### Mitigation
- Define skill ontology upfront; version carefully
- Pre-warm common handoff paths
- Summarize context before handoff (reduce token count)

---

## References

- Moltbot configuration: `infra/moltbot/moltbot.json`
- Agent definitions: `infra/moltbot/agents/`
- Output contracts: `docs/moltbot/*.json`
