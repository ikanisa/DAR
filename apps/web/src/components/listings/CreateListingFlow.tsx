/**
 * CreateListingFlow Component
 * 
 * AI-guided listing creation flow with step-by-step prompts.
 * Works with Moltbot to collect listing details progressively.
 */

import { useState, useRef, useEffect } from 'react';
import { ClayCard } from '../ui/ClayCard';
import { ClayButton } from '../ui/ClayButton';
import {
    Send, ArrowLeft, Package, Wrench, Check, Loader2
} from 'lucide-react';
import { sendMessageToMoltbot, ChatMessage } from '../../web/chatEndpoint';
import { QuickActions, TypingIndicator } from '../chat/QuickActions';


interface CreateListingFlowProps {
    sessionId: string | null;
    onClose: () => void;
    onComplete?: (listingId: string) => void;
}

type ListingType = 'product' | 'service' | null;

interface DraftListing {
    type: ListingType;
    title?: string;
    description?: string;
    price?: number;
    currency: string;
    category?: string;
    location?: string;
    images?: string[];
}



export function CreateListingFlow({
    sessionId,
    onClose,
    onComplete
}: CreateListingFlowProps) {
    const [step, setStep] = useState<'type' | 'chat' | 'preview' | 'done'>('type');
    const [draft, setDraft] = useState<DraftListing>({ type: null, currency: '€' });
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Start chat after type selection
    const handleTypeSelect = (type: ListingType) => {
        setDraft(prev => ({ ...prev, type }));
        setStep('chat');

        // Start conversation with Moltbot
        const typeLabel = type === 'product' ? 'product' : 'service';
        startConversation(`I want to sell a ${typeLabel}`);
    };

    const startConversation = async (initialMessage: string) => {
        setLoading(true);

        const userMsg: ChatMessage = { role: 'user', content: initialMessage };
        setMessages([userMsg]);

        try {
            const response = await sendMessageToMoltbot(initialMessage, [userMsg], sessionId);
            setMessages(prev => [...prev, response]);

            // Check if listing was created
            if (response.moltbotOutput?.action === 'create_or_update_listing') {
                // Update draft with returned data
                const data = response.moltbotOutput.data;
                if (data?.updates) {
                    setDraft(prev => ({ ...prev, ...data.updates }));
                }
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I had trouble starting. Let me try again...'
            }]);
        } finally {
            setLoading(false);
        }
    };

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

            // Check for completed listing actions
            if (response.moltbotOutput?.action === 'publish_listing') {
                const listingId = response.moltbotOutput.data?.listingId;
                setStep('done');
                if (listingId && onComplete) {
                    onComplete(listingId);
                }
            } else if (response.moltbotOutput?.action === 'create_or_update_listing') {
                const data = response.moltbotOutput.data;
                if (data?.updates) {
                    setDraft(prev => ({ ...prev, ...data.updates }));
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

    // Get last assistant message for quick actions
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    // Type selection step
    if (step === 'type') {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)]">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold">Create Listing</h2>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-sm">
                        <p className="text-text-muted mb-8">What are you selling?</p>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleTypeSelect('product')}
                                className="p-6 bg-clay-card border border-white/10 rounded-2xl hover:border-clay-action/50 transition-all group"
                            >
                                <Package size={32} className="mx-auto mb-3 text-clay-action group-hover:scale-110 transition-transform" />
                                <p className="font-medium">Product</p>
                                <p className="text-xs text-text-muted mt-1">Physical items for sale</p>
                            </button>

                            <button
                                onClick={() => handleTypeSelect('service')}
                                className="p-6 bg-clay-card border border-white/10 rounded-2xl hover:border-clay-action/50 transition-all group"
                            >
                                <Wrench size={32} className="mx-auto mb-3 text-purple-400 group-hover:scale-110 transition-transform" />
                                <p className="font-medium">Service</p>
                                <p className="text-xs text-text-muted mt-1">Skills or expertise</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Done step
    if (step === 'done') {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)] items-center justify-center">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={32} className="text-green-400" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Listing Published!</h2>
                    <p className="text-text-muted mb-6">
                        Your {draft.type === 'product' ? 'product' : 'service'} is now live on the marketplace.
                    </p>
                    <ClayButton onClick={onClose} className="w-full">
                        Done
                    </ClayButton>
                </div>
            </div>
        );
    }

    // Chat step
    return (
        <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={() => setStep('type')}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-lg font-bold">
                        {draft.type === 'product' ? 'Sell a Product' : 'Offer a Service'}
                    </h2>
                    <p className="text-xs text-text-muted">Chat with Dar to create your listing</p>
                </div>
            </div>

            {/* Draft preview (compact) */}
            {draft.title && (
                <div className="bg-clay-card border border-white/10 rounded-xl p-3 mb-4 flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-clay-action/30 to-purple-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        {draft.type === 'product' ? <Package size={20} /> : <Wrench size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{draft.title}</p>
                        {draft.price && (
                            <p className="text-sm text-clay-action">{draft.currency}{draft.price}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        <div className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                            <ClayCard
                                variant={msg.role === 'user' ? 'primary' : 'secondary'}
                                className={`max-w-[85%] ${msg.role === 'user' ? '!bg-clay-action !text-white' : ''}`}
                            >
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                            </ClayCard>
                        </div>

                        {/* Quick actions */}
                        {msg === lastAssistantMsg && msg.moltbotOutput && !loading && (
                            <QuickActions
                                output={msg.moltbotOutput}
                                onSelect={handleQuickAction}
                                disabled={loading}
                            />
                        )}
                    </div>
                ))}

                {loading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="mt-4 relative">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Describe your listing..."
                    className="
            w-full h-12 pl-4 pr-12 
            rounded-full 
            bg-clay-card border border-white/10 
            text-white placeholder-text-muted 
            focus:outline-none focus:border-clay-action 
            transition-colors
          "
                    disabled={loading}
                />
                <ClayButton
                    variant="icon"
                    className={`!absolute right-1 top-1/2 -translate-y-1/2 ${loading ? 'opacity-50' : ''}`}
                    onClick={() => handleSend()}
                    disabled={loading || !input.trim()}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </ClayButton>
            </div>
        </div>
    );
}

export default CreateListingFlow;
