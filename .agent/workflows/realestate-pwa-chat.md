---
description: PWA WebChat + backend proxy (no gateway token in browser) for Real Estate PWA
---

# W6 — PWA Chat Workflow

Implement PWA chat UI that talks ONLY to backend, never directly to Moltbot gateway.

---

## Goal

Create WebChat experience with:
- Backend proxy (gateway token stays server-side)
- Session persistence
- Streaming responses
- Rich listing card rendering

---

## Stack

- Next.js app in `/apps/pwa`
- Chat UI component
- API route proxy
- SSE or WebSocket for streaming

---

## Hard Rules

- **Browser must NEVER receive Moltbot gateway token**
- Chat session persistence in backend
- Render listing cards with photos, price, location, CTA
- Offline-safe PWA basics (cache shell, not private messages)

---

## Files to Create

```
/apps/pwa/src/
├── components/
│   └── ChatWidget.tsx          # Main chat component
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── send/route.ts   # Proxy to backend
│   └── chat/
│       └── page.tsx            # Chat page
└── styles/
    └── chat.css                # Chat styles
```

---

## ChatWidget Component

```tsx
// components/ChatWidget.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  listings?: Listing[];
  timestamp: Date;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  currency: string;
  address: string;
  bedrooms?: number;
  imageUrl?: string;
}

export function ChatWidget({ initialSessionId }: { initialSessionId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chat_session');
    if (saved) {
      const { sessionId: savedId, messages: savedMessages } = JSON.parse(saved);
      setSessionId(savedId);
      setMessages(savedMessages);
    }
  }, []);
  
  // Save session on change
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('chat_session', JSON.stringify({ sessionId, messages }));
    }
  }, [sessionId, messages]);
  
  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          session_id: sessionId,
        }),
      });
      
      const data = await response.json();
      
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        listings: data.listings,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
            {msg.listings && (
              <div className="listings-grid">
                {msg.listings.map(listing => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className="message assistant loading">Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div className="listing-card">
      {listing.imageUrl && (
        <img src={listing.imageUrl} alt={listing.title} />
      )}
      <div className="listing-info">
        <h4>{listing.title}</h4>
        <p className="price">
          {listing.currency} {listing.price.toLocaleString()}
        </p>
        <p className="address">{listing.address}</p>
        {listing.bedrooms && <p className="beds">{listing.bedrooms} bedrooms</p>}
        <button className="cta">Schedule Viewing</button>
      </div>
    </div>
  );
}
```

---

## API Route Proxy

```typescript
// app/api/chat/send/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Call backend (not Moltbot directly!)
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  
  const response = await fetch(`${backendUrl}/api/flows/seeker/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Use server-side token
      'Authorization': `Bearer ${process.env.BACKEND_SERVICE_TOKEN}`,
    },
    body: JSON.stringify({
      user_id: body.user_id || 'anonymous',
      channel: 'webchat',
      peer_id: body.session_id || 'new',
      text: body.message,
    }),
  });
  
  const data = await response.json();
  
  return NextResponse.json({
    message: data.message,
    listings: data.listings,
    session_id: data.session_id,
  });
}
```

---

## Chat Page

```tsx
// app/chat/page.tsx
import { ChatWidget } from '@/components/ChatWidget';

export default function ChatPage() {
  return (
    <main className="chat-page">
      <header>
        <h1>Find Your Property</h1>
        <p>Tell me what you're looking for</p>
      </header>
      <ChatWidget />
    </main>
  );
}
```

---

## Admin Chat Page

```tsx
// app/admin/chat/page.tsx
'use client';

import { ChatWidget } from '@/components/ChatWidget';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function AdminChatPage() {
  const { data: session } = useSession();
  
  if (!session || session.user.role !== 'admin') {
    redirect('/login');
  }
  
  return (
    <main className="admin-chat-page">
      <header>
        <h1>Admin Review Chat</h1>
      </header>
      <ChatWidget 
        initialSessionId={`admin-${session.user.id}`}
      />
    </main>
  );
}
```

---

## Styles

```css
/* styles/chat.css */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 80vh;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message {
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
}

.message.user {
  align-self: flex-end;
  background: var(--clay-action);
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background: var(--glass-bg);
  color: var(--text-primary);
}

.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 0.75rem;
}

.listing-card {
  background: var(--clay-card);
  border-radius: 0.75rem;
  overflow: hidden;
}

.listing-card img {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.listing-info {
  padding: 0.75rem;
}

.listing-info h4 {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
}

.listing-info .price {
  color: var(--clay-action);
  font-weight: bold;
}

.listing-info .cta {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--clay-action);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--glass-bg);
}

.chat-input input {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 1.5rem;
  border: 1px solid var(--glass-bg);
  background: var(--midnight);
  color: var(--text-primary);
}

.chat-input button {
  padding: 0.75rem 1.5rem;
  border-radius: 1.5rem;
  background: var(--clay-action);
  color: white;
  border: none;
  cursor: pointer;
}
```

---

## Acceptance Criteria

- [ ] Browser never receives Moltbot gateway token
- [ ] Chat messages persist across page reload
- [ ] Listing cards render with photos, price, location
- [ ] Schedule viewing CTA works
- [ ] Works on mobile and desktop
- [ ] Admin can chat from admin panel

---

## Rollback

```bash
git checkout HEAD~1 -- apps/pwa/src/components/ChatWidget.tsx
git checkout HEAD~1 -- apps/pwa/src/app/api/chat/
git checkout HEAD~1 -- apps/pwa/src/app/chat/
```
