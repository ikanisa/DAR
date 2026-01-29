/**
 * Core Types for PWA Marketplace
 */

// Session types
export interface Session {
    id: string;
    anon_user_id: string;
    language: string;
    user_agent?: string;
    ip_hash?: string;
    created_at: string;
    last_seen_at: string;
    metadata: Record<string, unknown>;
}

// Vendor types
export interface Vendor {
    id: string;
    name: string;
    slug: string;
    description?: string;
    category?: string;
    location?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    logo_url?: string;
    verified: boolean;
    verification_date?: string;
    response_rate: number;
    avg_response_time: number;
    created_at: string;
    updated_at: string;
}

// Listing types
export type ListingType = 'product' | 'service';
export type ListingStatus = 'draft' | 'published' | 'archived';

export interface ProductListing {
    id: string;
    session_id: string;
    vendor_id?: string;
    title: string;
    description?: string;
    price?: number;
    currency: string;
    category?: string;
    images?: string[];
    status: ListingStatus;
    listing_type: ListingType;
    location?: string;
    verified: boolean;
    created_at: string;
    updated_at: string;
    // Computed fields (from joins)
    vendor?: Vendor;
    is_verified_vendor?: boolean;
}

// Post types (buy/sell requests)
export type PostType = 'buy' | 'sell';
export type PostStatus = 'draft' | 'posted' | 'matched' | 'closed';

export interface MarketPost {
    id: string;
    session_id: string;
    type: PostType;
    status: PostStatus;
    title?: string;
    description?: string;
    budget_min?: number;
    budget_max?: number;
    currency: string;
    location?: string;
    created_at: string;
    updated_at: string;
}

// Notification types
export interface WebNotification {
    id: string;
    session_id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
    updated_at?: string; // Optional field sometimes present
}

// External feed items (links only, not inventory)
export interface ExternalFeedItem {
    id: string;
    url: string;
    title?: string;
    source?: string;
    image_url?: string;
    published_at?: string;
    crawled_at: string;
}

// Verification request
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ListingVerificationRequest {
    id: string;
    listing_id: string;
    session_id: string;
    requested_vendor_name?: string;
    status: VerificationStatus;
    admin_notes?: string;
    created_at: string;
}

// Chat message types (for Moltbot)
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCall?: string;
    toolParams?: Record<string, unknown>;
}

// =============================================================================
// ACTION TYPES
// =============================================================================

export type MoltbotAction =
    | 'ask_user'
    | 'update_post'
    | 'post_now'
    | 'create_or_update_listing'
    | 'publish_listing'
    | 'show_listings'
    | 'inquire_listing'
    | 'suggest_matches'
    | 'notify_top_targets'
    | 'error'
    | 'fallback';

// =============================================================================
// BASE OUTPUT INTERFACE
// =============================================================================

export interface MoltbotOutputBase {
    action: MoltbotAction;
    message: string;  // Human-readable message to display
    success: boolean;
}

// =============================================================================
// ACTION-SPECIFIC OUTPUTS
// =============================================================================

export interface AskUserOutput extends MoltbotOutputBase {
    action: 'ask_user';
    data: {
        slotName: string;      // e.g., 'budget', 'location', 'category'
        promptText: string;    // The question to ask
        suggestions?: string[]; // Optional quick-reply suggestions
    };
}

export interface UpdatePostOutput extends MoltbotOutputBase {
    action: 'update_post';
    data: {
        postId: string;
        updates: {
            title?: string;
            description?: string;
            budget_min?: number;
            budget_max?: number;
            currency?: string;
            location?: string;
        };
    };
}

export interface PostNowOutput extends MoltbotOutputBase {
    action: 'post_now';
    data: {
        postId: string;
        type: 'buy' | 'sell';
    };
}

export interface CreateOrUpdateListingOutput extends MoltbotOutputBase {
    action: 'create_or_update_listing';
    data: {
        listingId?: string;     // Null for new listings
        updates: {
            title?: string;
            description?: string;
            price?: number;
            currency?: string;
            category?: string;
            listing_type?: 'product' | 'service';
            location?: string;
        };
    };
}

export interface PublishListingOutput extends MoltbotOutputBase {
    action: 'publish_listing';
    data: {
        listingId: string;
    };
}

export interface ShowListingsOutput extends MoltbotOutputBase {
    action: 'show_listings';
    data: {
        listings: Array<{
            id: string;
            title: string;
            price?: number;
            currency?: string;
            verified: boolean;
            thumbnail?: string;
        }>;
        query?: string;
    };
}

export interface InquireListingOutput extends MoltbotOutputBase {
    action: 'inquire_listing';
    data: {
        listingId: string;
        message: string;
    };
}

export interface SuggestMatchesOutput extends MoltbotOutputBase {
    action: 'suggest_matches';
    data: {
        postId: string;
        matches: Array<{
            id: string;
            title: string;
            reason: string;
            rank: number;
            source: 'internal' | 'external';
            url?: string;  // For external, links only
        }>;
    };
}

export interface NotifyTopTargetsOutput extends MoltbotOutputBase {
    action: 'notify_top_targets';
    data: {
        postId: string;
        notifiedCount: number;
    };
}

export interface ErrorOutput extends MoltbotOutputBase {
    action: 'error';
    data: {
        code: string;
        details?: string;
    };
}

export interface FallbackOutput extends MoltbotOutputBase {
    action: 'fallback';
    data: null;
}

// =============================================================================
// UNION TYPE
// =============================================================================

export type MoltbotOutput =
    | AskUserOutput
    | UpdatePostOutput
    | PostNowOutput
    | CreateOrUpdateListingOutput
    | PublishListingOutput
    | ShowListingsOutput
    | InquireListingOutput
    | SuggestMatchesOutput
    | NotifyTopTargetsOutput
    | ErrorOutput
    | FallbackOutput;

// =============================================================================
// VALIDATION
// =============================================================================

const VALID_ACTIONS: Set<MoltbotAction> = new Set([
    'ask_user',
    'update_post',
    'post_now',
    'create_or_update_listing',
    'publish_listing',
    'show_listings',
    'inquire_listing',
    'suggest_matches',
    'notify_top_targets',
    'error',
    'fallback',
]);

export function isValidMoltbotOutput(output: unknown): output is MoltbotOutput {
    if (!output || typeof output !== 'object') {
        return false;
    }

    const obj = output as Record<string, unknown>;

    // Must have action, message, success
    if (typeof obj.action !== 'string') return false;
    if (typeof obj.message !== 'string') return false;
    if (typeof obj.success !== 'boolean') return false;

    // Action must be valid
    if (!VALID_ACTIONS.has(obj.action as MoltbotAction)) return false;

    return true;
}

export function parseMoltbotOutput(raw: string): MoltbotOutput {
    try {
        const parsed = JSON.parse(raw);

        if (isValidMoltbotOutput(parsed)) {
            return parsed;
        }

        // Invalid structure, return fallback
        console.error('[Moltbot] Invalid output structure:', parsed);
        return createFallbackOutput('Invalid output structure from AI');

    } catch (e) {
        // JSON parse error
        console.error('[Moltbot] Failed to parse JSON:', e);
        return createFallbackOutput('AI response was not valid JSON');
    }
}

export function createFallbackOutput(_reason: string): FallbackOutput {
    return {
        action: 'fallback',
        message: "I'm sorry, I had trouble understanding that. Could you try rephrasing?",
        success: false,
        data: null,
    };
}

export function createErrorOutput(code: string, message: string, details?: string): ErrorOutput {
    return {
        action: 'error',
        message,
        success: false,
        data: {
            code,
            details,
        },
    };
}

// =============================================================================
// HELPER TO CREATE OUTPUTS
// =============================================================================

export function createAskUserOutput(
    slotName: string,
    promptText: string,
    suggestions?: string[]
): AskUserOutput {
    return {
        action: 'ask_user',
        message: promptText,
        success: true,
        data: {
            slotName,
            promptText,
            suggestions,
        },
    };
}

export function createShowListingsOutput(
    listings: ShowListingsOutput['data']['listings'],
    query?: string
): ShowListingsOutput {
    return {
        action: 'show_listings',
        message: listings.length > 0
            ? `Found ${listings.length} listings${query ? ` for "${query}"` : ''}`
            : 'No listings found matching your criteria',
        success: true,
        data: {
            listings,
            query,
        },
    };
}

// Viewing types (P6B)
export interface ViewingTimeOption {
    id: string;
    viewing_request_id: string;
    start_at: string;
    end_at: string;
    timezone?: string;
    is_selected: boolean;
    created_at: string;
}

export interface ViewingRequest {
    id: string;
    listing_id: string;
    seeker_id: string | null;
    poster_id: string | null;
    status: 'proposed' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
    scheduled_at: string | null;
    notes: string | null;
    created_at: string;
    // Computed fields
    listing_title?: string;
    poster_name?: string;
    seeker_name?: string;
}
