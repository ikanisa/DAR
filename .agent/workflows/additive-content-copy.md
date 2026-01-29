---
description: Content and copy workflow for consistent microcopy in chat-first apps
---

# Additive Content & Copy Workflow

**Purpose**: Reduce confusion in a chat-first app. Define consistent prompts, tone, and fallback phrasing.

---

## 1. Moltbot Prompt Consistency

### First Question: Intent Classification

Always start with intent:

```
What would you like to do?

1. 🛒 Buy something
2. 💰 Sell something
3. 🔍 Find a service
4. 📢 Request something specific
```

**Rationale**: Before asking details, know the user's goal.

---

### Standard Question Flow

After intent, follow this order:

| Order | Question         | Required? | Example Prompt                                    |
|-------|------------------|-----------|---------------------------------------------------|
| 1     | Category         | Yes       | "What type of item or service?"                   |
| 2     | Title/Name       | Yes       | "Give it a short title (e.g., 'iPhone 13 Pro')"   |
| 3     | Description      | Yes       | "Describe it briefly (condition, features)"       |
| 4     | Price/Budget     | Optional  | "What's your price? (skip if flexible)"           |
| 5     | Location         | Yes       | "Where are you located? (neighborhood or area)"   |
| 6     | Time Urgency     | Services  | "When do you need this? (today, this week, etc.)" |
| 7     | Photos           | Optional  | "Add photos? (tap to upload or skip)"             |

---

### Question Phrasing Rules

- **Max length**: ≤120 characters per question (unless absolutely necessary)
- **Tone**: Short, confident, not robotic
- **Action-oriented**: Tell user what to do, not what system needs
- **One question at a time**: No compound questions

#### Do ✅

```
"What's your budget? (or skip if flexible)"
"Where should buyers meet you?"
"When do you need this done?"
```

#### Don't ❌

```
"Please enter the price you would like to list this item for, or if you prefer to negotiate, you can leave this field blank and buyers will contact you to discuss pricing."
```

---

## 2. Tone Guidelines

### Voice Attributes

| Attribute    | Description                              |
|--------------|------------------------------------------|
| Friendly     | Not corporate, not overly casual         |
| Confident    | Knows what it's doing, no hedging        |
| Helpful      | Anticipates needs, offers guidance       |
| Concise      | Every word earns its place               |
| Human        | Natural phrasing, not template-y         |

### Tone Examples

| Situation           | Robotic ❌                                      | Human ✅                          |
|---------------------|------------------------------------------------|----------------------------------|
| Greeting            | "Welcome to the platform. How may I assist?"   | "Hey! What can I help with?"     |
| Asking for details  | "Please provide additional information about"  | "Tell me more about it"          |
| Confirmation        | "Your listing has been successfully created"   | "Done! Your listing is live 🎉"   |
| Error               | "An error has occurred. Please try again."     | "Oops, that didn't work. Retry?" |

---

## 3. Fallback Phrasing

### Low Confidence / Unclear Input

```
"I didn't quite get that. Could you rephrase?"
"Hmm, I'm not sure what you mean. Try again?"
"Can you be more specific?"
```

### Error States

```
"Something went wrong. Let's try that again."
"Couldn't save that. Tap to retry."
"We hit a snag. Your data is safe—just retry."
```

### Empty States

```
"No results yet. Try a different search?"
"Nothing here. You could be the first!"
"No listings match. Broaden your filters?"
```

### Offline Fallback

```
"You're offline. Some features might not work."
"No connection. Cached data shown."
"Back online! Refreshing now..."
```

---

## 4. Confirmation Messages

### Success Patterns

```
"✅ Listing posted!"
"🎉 Done! Check it out in your listings."
"Saved successfully."
```

### Action Required

```
"Almost there! Add a photo to finish."
"One more thing: confirm your location."
"Ready to post? Tap confirm."
```

---

## 5. Button & CTA Labels

### Primary Actions

| Action          | Label        | Avoid                  |
|-----------------|--------------|------------------------|
| Create listing  | "Post it"    | "Submit Listing"       |
| Send message    | "Send"       | "Send Message"         |
| Confirm         | "Confirm"    | "Confirm Action"       |
| Next step       | "Next"       | "Continue to Next"     |
| Search          | "Search"     | "Search Listings"      |

### Secondary Actions

| Action          | Label        | Avoid                  |
|-----------------|--------------|------------------------|
| Cancel          | "Cancel"     | "Cancel Action"        |
| Skip            | "Skip"       | "Skip This Step"       |
| Go back         | "Back"       | "Go Back"              |
| Edit            | "Edit"       | "Edit This Item"       |

---

## 6. Copy Review Checklist

Before shipping any Moltbot prompt or UI copy:

- [ ] Question is ≤120 characters
- [ ] No jargon or technical terms
- [ ] Action is clear (what user should do)
- [ ] Tone matches voice guidelines
- [ ] Fallback exists for edge cases
- [ ] No double questions in one message
- [ ] Tested with real user mental model

---

## 7. Content Constants File

Centralize all copy in a constants file:

```typescript
// constants/copy.ts

export const MOLTBOT_PROMPTS = {
  greeting: "Hey! What can I help with today?",
  intentQuestion: "What would you like to do?",
  categoryQuestion: "What type of item or service?",
  titleQuestion: "Give it a short title",
  descriptionQuestion: "Describe it briefly",
  priceQuestion: "What's your price? (skip if flexible)",
  locationQuestion: "Where are you located?",
  urgencyQuestion: "When do you need this?",
  photoQuestion: "Add photos? (tap to upload or skip)",
  confirmation: "Done! Your listing is live 🎉",
};

export const ERROR_MESSAGES = {
  generic: "Something went wrong. Let's try that again.",
  offline: "You're offline. Some features might not work.",
  retry: "Couldn't save that. Tap to retry.",
  unclear: "I didn't quite get that. Could you rephrase?",
};

export const EMPTY_STATES = {
  noResults: "No results yet. Try a different search?",
  noListings: "Nothing here. You could be the first!",
  noMessages: "No messages yet. Start a conversation!",
};

export const BUTTON_LABELS = {
  post: "Post it",
  send: "Send",
  confirm: "Confirm",
  next: "Next",
  skip: "Skip",
  back: "Back",
  edit: "Edit",
  cancel: "Cancel",
  retry: "Retry",
};
```

---

## Acceptance Criteria

- [ ] All Moltbot questions ≤120 chars (unless necessary)
- [ ] Intent classification is first question
- [ ] Question order follows standard flow
- [ ] Tone matches voice guidelines
- [ ] Fallback phrasing defined for all edge cases
- [ ] Copy constants file created
- [ ] UI buttons use consistent labels
- [ ] No robotic or corporate language
