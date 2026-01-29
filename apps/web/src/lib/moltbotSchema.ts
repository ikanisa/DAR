/**
 * Moltbot Output Schema
 * 
 * Strict schema for all Moltbot responses.
 * Invalid output is rejected and logged, then fallback.
 * Per spec: Moltbot outputs ONE JSON object that must validate.
 */

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
