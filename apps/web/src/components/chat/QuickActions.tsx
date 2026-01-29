/**
 * QuickActions Component
 * 
 * Renders quick action chips/suggestions from Moltbot output.
 * These appear after assistant messages with ask_user actions.
 */

import { MoltbotOutput, AskUserOutput } from '@dar/core';

interface QuickActionsProps {
    output?: MoltbotOutput;
    onSelect: (suggestion: string) => void;
    disabled?: boolean;
}

export function QuickActions({ output, onSelect, disabled }: QuickActionsProps) {
    // Only show for ask_user actions with suggestions
    if (!output || output.action !== 'ask_user') {
        return null;
    }

    const askUserOutput = output as AskUserOutput;
    const suggestions = askUserOutput.data?.suggestions;

    if (!suggestions || suggestions.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
            {suggestions.map((suggestion, idx) => (
                <button
                    key={idx}
                    onClick={() => onSelect(suggestion)}
                    disabled={disabled}
                    className="
            px-4 py-2 
            rounded-full 
            bg-white/5 
            border border-white/10 
            text-sm text-text-secondary
            hover:bg-clay-action/20 
            hover:border-clay-action/50
            hover:text-text-primary
            transition-all duration-200
            disabled:opacity-50 
            disabled:cursor-not-allowed
            active:scale-95
          "
                >
                    {suggestion}
                </button>
            ))}
        </div>
    );
}

/**
 * TypingIndicator Component
 * 
 * Shows animated dots when Moltbot is "thinking"
 */
export function TypingIndicator() {
    return (
        <div className="flex justify-start" role="status" aria-label="Dar is typing">
            <div className="bg-clay-card border border-white/10 rounded-2xl px-4 py-3 shadow-clay">
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-clay-action rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-clay-action rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-clay-action rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}

/**
 * ListingsCarousel Component
 * 
 * Renders a horizontal scrollable list of listings from show_listings action
 */
interface Listing {
    id: string;
    title: string;
    price?: number;
    currency?: string;
    verified: boolean;
    thumbnail?: string;
}

interface ListingsCarouselProps {
    listings: Listing[];
    onSelect: (listing: Listing) => void;
}

export function ListingsCarousel({ listings, onSelect }: ListingsCarouselProps) {
    if (!listings || listings.length === 0) {
        return (
            <div className="text-center py-8 text-text-muted">
                <p>No listings found</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto -mx-2 px-2 py-2 custom-scrollbar">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
                {listings.map((listing) => (
                    <button
                        key={listing.id}
                        onClick={() => onSelect(listing)}
                        className="
              flex-shrink-0 w-48 
              bg-clay-card border border-white/10 
              rounded-xl overflow-hidden
              hover:border-clay-action/50
              transition-all duration-200
              active:scale-95
              text-left
            "
                    >
                        {/* Thumbnail or placeholder */}
                        <div className="h-24 bg-gradient-to-br from-clay-action/20 to-purple-500/20 flex items-center justify-center">
                            {listing.thumbnail ? (
                                <img
                                    src={listing.thumbnail}
                                    alt={listing.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-3xl">📦</span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="p-3">
                            <div className="flex items-center gap-1 mb-1">
                                {listing.verified && (
                                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">✓</span>
                                )}
                                <span className="text-xs text-text-muted truncate">{listing.id.slice(0, 8)}</span>
                            </div>
                            <p className="font-medium text-sm text-text-primary truncate">{listing.title}</p>
                            {listing.price && (
                                <p className="text-clay-action font-bold mt-1">
                                    {listing.currency || '€'}{listing.price.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default QuickActions;
