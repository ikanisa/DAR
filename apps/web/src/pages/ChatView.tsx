import { useState, useRef, useEffect } from 'react';
import { ClayCard } from '@dar/ui';
import { ClayButton } from '@dar/ui';
import { Send, Sparkles } from 'lucide-react';
import { sendMessageToMoltbot, ChatMessage } from '../web/chatEndpoint';
import { QuickActions, TypingIndicator, ListingsCarousel } from '../components/chat/QuickActions';
import { MoltbotOutput, ShowListingsOutput } from '@dar/core';
import { fetchWithAuth } from '../lib/api';
import { useSession } from '../lib/SessionContext';

interface ChatViewProps {
    sessionId?: string | null;
    initialMessage?: string;
    onMessageHandled?: () => void;
}

export function ChatView({ sessionId: _propSessionId, initialMessage, onMessageHandled }: ChatViewProps = {}) {
    // We import useSession to ensure we re-render on auth changes, even if we don't use the ID directly here yet
    useSession();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatId, setChatId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialMessageSent = useRef(false);

    // Initial greeting
    const greeting: ChatMessage = {
        role: 'assistant',
        content: "I'm Dar, your marketplace assistant. I can help you:\n\n• **Buy** - Find products or services\n• **Sell** - List something for sale\n• **Browse** - See verified vendors and listings\n\nHow can I help you today?",
        moltbotOutput: {
            action: 'ask_user',
            message: '',
            data: {
                slotName: 'intent',
                promptText: 'What would you like to do?',
                suggestions: ['I want to buy', 'I want to sell', 'Show listings'],
            },
        } as MoltbotOutput,
    };

    // Load active session on mount
    useEffect(() => {
        async function loadSession() {
            try {
                // Check for existing backend session
                const res = await fetchWithAuth('/api/webchat/session').catch(() => null);

                if (res && res.ok) {
                    const data = await res.json();
                    if (data.session) {
                        setChatId(data.session.id);

                        // Load history
                        const historyRes = await fetchWithAuth(`/api/webchat/history/${data.session.id}`);
                        if (historyRes.ok) {
                            const historyData = await historyRes.json();
                            if (historyData.messages && historyData.messages.length > 0) {
                                setMessages(historyData.messages);
                            } else {
                                setMessages([greeting]);
                            }
                        }
                        setInitializing(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to load chat session', e);
            }

            // Default: New session, show greeting
            setMessages([greeting]);
            setInitializing(false);
        }

        loadSession();
    }, []);

    // Handle initial message (e.g. from Schedule Viewing button)
    useEffect(() => {
        if (!initializing && initialMessage && !initialMessageSent.current && !loading) {
            initialMessageSent.current = true;
            handleSend(initialMessage);
            if (onMessageHandled) onMessageHandled();
        }
    }, [initializing, initialMessage, loading]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, initializing]);

    const handleSend = async (messageText?: string) => {
        const text = messageText || input;
        if (!text.trim() || loading) return;

        const userMsg: ChatMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Send to backend (it manages history automatically)
            const response = await sendMessageToMoltbot(text, chatId);

            setMessages(prev => [...prev, response]);

            // If we got a session ID back (new session started), save it
            // Note: sendMessageToMoltbot implementation might need to return sessionId to be perfect,
            // but for now we rely on the backend being stateless or us fetching session again if needed.
            // Actually, let's just re-fetch session ID if we don't have one?
            // Or better, let's assume if we sent a message, a session now exists.
            if (!chatId) {
                const res = await fetchWithAuth('/api/webchat/session');
                if (res.ok) {
                    const data = await res.json();
                    if (data.session) setChatId(data.session.id);
                }
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = (suggestion: string) => {
        handleSend(suggestion);
    };

    const handleListingSelect = (listing: { id: string; title: string }) => {
        handleSend(`Tell me more about ${listing.title}`);
    };

    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    if (initializing) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
                <TypingIndicator />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar" role="log" aria-label="Chat conversation" aria-live="polite">
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        <div
                            className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                            role="article"
                            aria-label={msg.role === 'user' ? 'You said' : 'Dar said'}
                        >
                            <div className={msg.role === 'user' ? 'max-w-[80%]' : 'max-w-[90%]'}>
                                <ClayCard
                                    variant={msg.role === 'user' ? 'primary' : 'secondary'}
                                    className={msg.role === 'user' ? '!bg-clay-action !text-white' : ''}
                                >
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                </ClayCard>

                                {/* Tool indicator */}
                                {msg.toolCall && (
                                    <div className="flex items-center gap-1 text-xs text-text-muted mt-1 ml-2">
                                        <Sparkles size={12} className="text-clay-action" />
                                        <span>{msg.toolCall}</span>
                                    </div>
                                )}

                                {/* Listings carousel for show_listings action */}
                                {msg.moltbotOutput?.action === 'show_listings' && (
                                    <div className="mt-3">
                                        <ListingsCarousel
                                            listings={(msg.moltbotOutput as ShowListingsOutput).data.listings}
                                            onSelect={handleListingSelect}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick actions after last assistant message */}
                        {msg === lastAssistantMsg && msg.moltbotOutput && !loading && (
                            <QuickActions
                                output={msg.moltbotOutput}
                                onSelect={handleQuickAction}
                                disabled={loading}
                            />
                        )}
                    </div>
                ))}

                {/* Typing indicator */}
                {loading && <TypingIndicator />}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-4 relative">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask Dar..."
                    className="
            w-full h-14 pl-6 pr-14 
            rounded-full 
            bg-clay-card border border-white/10 
            text-white placeholder-text-muted 
            focus:outline-none focus:border-clay-action 
            transition-colors shadow-clay
          "
                    aria-label="Message input"
                    disabled={loading}
                />
                <ClayButton
                    variant="icon"
                    className={`
            !absolute right-2 top-1/2 -translate-y-1/2
            ${loading ? 'opacity-50' : 'bg-clay-action text-white'}
          `}
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                >
                    <Send size={18} />
                </ClayButton>
            </div>
        </div>
    );
}

