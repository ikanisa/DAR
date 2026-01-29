import { useState, useRef, useEffect } from 'react';
import { ClayCard } from '../components/ui/ClayCard';
import { ClayButton } from '../components/ui/ClayButton';
import { Send, Sparkles } from 'lucide-react';
import { sendMessageToMoltbot, ChatMessage } from '../web/chatEndpoint';
import { QuickActions, TypingIndicator, ListingsCarousel } from '../components/chat/QuickActions';
import { MoltbotOutput, ShowListingsOutput } from '../lib/moltbotSchema';

interface ChatViewProps {
    sessionId: string | null;
}

export function ChatView({ sessionId }: ChatViewProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: "I'm Dar, your marketplace assistant. I can help you:\n\n• **Buy** - Find products or services\n• **Sell** - List something for sale\n• **Browse** - See verified vendors and listings\n\nHow can I help you today?",
            moltbotOutput: {
                action: 'ask_user',
                message: '',
                success: true,
                data: {
                    slotName: 'intent',
                    promptText: 'What would you like to do?',
                    suggestions: ['I want to buy', 'I want to sell', 'Show listings'],
                },
            } as MoltbotOutput,
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSend = async (messageText?: string) => {
        const text = messageText || input;
        if (!text.trim() || loading) return;

        const userMsg: ChatMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await sendMessageToMoltbot(text, [...messages, userMsg], sessionId);
            setMessages(prev => [...prev, response]);
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

    // Get last assistant message for quick actions
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    return (
        <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        <div className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
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

