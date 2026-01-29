/**
 * Matching Service
 * 
 * Core matching logic for finding relevant listings/vendors
 * that match a user's buy/sell request.
 * 
 * Per spec: ≤10 suggestions with reasons; ≤10 notifications queued.
 */

import { supabase } from './supabase';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketPost {
    id: string;
    session_id: string;
    type: 'buy' | 'sell';
    title: string;
    description?: string;
    category?: string;
    budget_min?: number;
    budget_max?: number;
    currency?: string;
    location?: string;
    status: 'draft' | 'posted' | 'closed';
    created_at: string;
}

export interface MatchCandidate {
    id: string;
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    category?: string;
    location?: string;
    vendor_id?: string;
    vendor_name?: string;
    verified?: boolean;
    source: 'internal';
}

export interface RankedMatch {
    id: string;
    title: string;
    reason: string;
    rank: number;
    score: number;
    source: 'internal' | 'external';
    url?: string;
    candidate: MatchCandidate;
}

// =============================================================================
// QUERY INTERNAL MATCHES
// =============================================================================

/**
 * Query listings that potentially match a market post.
 * Uses category, price range, and location as matching criteria.
 */
export async function queryInternalMatches(
    postId: string
): Promise<{ matches: MatchCandidate[]; post: MarketPost | null }> {
    // 1. Fetch the market post
    const { data: post, error: postError } = await supabase
        .from('market_posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (postError || !post) {
        console.error('[Matching] Failed to fetch post:', postError);
        return { matches: [], post: null };
    }

    // 2. Build query for matching listings
    let query = supabase
        .from('product_listings')
        .select(`
            *,
            vendor:vendors(id, name, verified)
        `)
        .eq('status', 'published');

    // Category match (if specified)
    if (post.category) {
        query = query.eq('category', post.category);
    }

    // Price range match (if buying, match seller prices within budget)
    if (post.type === 'buy' && post.budget_max) {
        query = query.lte('price', post.budget_max);
    }
    if (post.type === 'buy' && post.budget_min) {
        query = query.gte('price', post.budget_min);
    }

    // Location match (if specified) - optional filter
    if (post.location) {
        query = query.eq('location', post.location);
    }

    // Limit broad results
    query = query.limit(50);

    const { data: listings, error: listingsError } = await query;

    if (listingsError) {
        console.error('[Matching] Failed to fetch listings:', listingsError);
        return { matches: [], post };
    }

    // Transform to MatchCandidate format
    const matches: MatchCandidate[] = (listings || []).map((listing) => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        category: listing.category,
        location: listing.location,
        vendor_id: listing.vendor?.id,
        vendor_name: listing.vendor?.name,
        verified: listing.vendor?.verified,
        source: 'internal' as const,
    }));

    return { matches, post };
}

// =============================================================================
// RANK MATCHES
// =============================================================================

/**
 * Score and rank matches, return top 10 with reasons.
 * 
 * Scoring weights:
 * - Category exact match: +50
 * - Verified vendor: +30
 * - Price within budget: +20
 * - Location match: +10
 * - Has description: +5
 */
export function rankMatches(
    matches: MatchCandidate[],
    post: MarketPost
): RankedMatch[] {
    const scored = matches.map((candidate) => {
        let score = 0;
        const reasons: string[] = [];

        // Category match
        if (candidate.category && candidate.category === post.category) {
            score += 50;
            reasons.push(`Matches category: ${candidate.category}`);
        }

        // Verified vendor bonus
        if (candidate.verified) {
            score += 30;
            reasons.push('Verified seller');
        }

        // Price within budget
        if (post.type === 'buy' && candidate.price && post.budget_max) {
            if (candidate.price <= post.budget_max) {
                score += 20;
                if (post.budget_min && candidate.price >= post.budget_min) {
                    reasons.push('Price within your budget');
                } else {
                    reasons.push('Price under budget');
                }
            }
        }

        // Location match
        if (candidate.location && candidate.location === post.location) {
            score += 10;
            reasons.push('Same location');
        }

        // Has description
        if (candidate.description && candidate.description.length > 20) {
            score += 5;
        }

        return {
            candidate,
            score,
            reason: reasons.length > 0 ? reasons.join(' • ') : 'Potential match',
        };
    });

    // Sort by score descending, take top 10
    const ranked = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((item, index) => ({
            id: item.candidate.id,
            title: item.candidate.title,
            reason: item.reason,
            rank: index + 1,
            score: item.score,
            source: item.candidate.source,
            candidate: item.candidate,
        }));

    return ranked;
}

// =============================================================================
// QUEUE NOTIFICATIONS
// =============================================================================

/**
 * Create notification records for matched sellers/buyers.
 * Per spec: ≤10 notifications queued.
 */
export async function queueNotifications(
    _postId: string,
    matches: RankedMatch[],
    requesterSessionId: string
): Promise<{ queued: number; errors: number }> {
    let queued = 0;
    let errors = 0;

    // Limit to 10 notifications
    const toNotify = matches.slice(0, 10);

    for (const match of toNotify) {
        // Get the listing owner's session (if available)
        const { data: listing } = await supabase
            .from('product_listings')
            .select('session_id')
            .eq('id', match.id)
            .single();

        if (!listing?.session_id) {
            continue; // No session to notify
        }

        // Don't notify the requester about their own listings
        if (listing.session_id === requesterSessionId) {
            continue;
        }

        // Create notification
        const { error } = await supabase.from('web_notifications').insert({
            session_id: listing.session_id,
            type: 'match_alert',
            title: 'New match for your listing!',
            message: `Someone is interested in "${match.title}"`,
            link: `/listings/${match.id}`,
            read: false,
        });

        if (error) {
            console.error('[Matching] Failed to queue notification:', error);
            errors++;
        } else {
            queued++;
        }
    }

    // Also create a notification for the requester that matches were found
    if (matches.length > 0) {
        await supabase.from('web_notifications').insert({
            session_id: requesterSessionId,
            type: 'matches_found',
            title: `Found ${matches.length} matches!`,
            message: `We found ${matches.length} listings matching your request`,
            link: `/requests`,
            read: false,
        });
    }

    return { queued, errors };
}

// =============================================================================
// SAVE MATCH SUGGESTIONS
// =============================================================================

/**
 * Persist match suggestions to DB for later retrieval.
 */
export async function saveMatchSuggestions(
    postId: string,
    matches: RankedMatch[]
): Promise<boolean> {
    // Clear existing suggestions for this post
    await supabase
        .from('match_suggestions')
        .delete()
        .eq('post_id', postId);

    // Insert new suggestions
    const toInsert = matches.map((match) => ({
        post_id: postId,
        candidate_data: match.candidate,
        rank: match.rank,
        reason: match.reason,
    }));

    const { error } = await supabase
        .from('match_suggestions')
        .insert(toInsert);

    if (error) {
        console.error('[Matching] Failed to save suggestions:', error);
        return false;
    }

    return true;
}

// =============================================================================
// FETCH SAVED MATCHES
// =============================================================================

/**
 * Retrieve previously computed match suggestions for a post.
 */
export async function fetchMatchSuggestions(
    postId: string
): Promise<RankedMatch[]> {
    const { data, error } = await supabase
        .from('match_suggestions')
        .select('*')
        .eq('post_id', postId)
        .order('rank', { ascending: true });

    if (error) {
        console.error('[Matching] Failed to fetch suggestions:', error);
        return [];
    }

    return (data || []).map((row) => ({
        id: row.candidate_data.id,
        title: row.candidate_data.title,
        reason: row.reason,
        rank: row.rank,
        score: 0, // Not stored
        source: 'internal' as const,
        candidate: row.candidate_data,
    }));
}

// =============================================================================
// FULL MATCHING PIPELINE
// =============================================================================

/**
 * Run the complete matching pipeline:
 * 1. Query internal matches
 * 2. Rank matches (top 10)
 * 3. Save suggestions
 * 4. Queue notifications
 */
export async function runMatchingPipeline(
    postId: string,
    sessionId: string
): Promise<{
    success: boolean;
    matches: RankedMatch[];
    notificationsQueued: number;
}> {
    // 1. Query
    const { matches: candidates, post } = await queryInternalMatches(postId);

    if (!post) {
        return { success: false, matches: [], notificationsQueued: 0 };
    }

    // 2. Rank
    const rankedMatches = rankMatches(candidates, post);

    // 3. Save
    await saveMatchSuggestions(postId, rankedMatches);

    // 4. Notify
    const { queued } = await queueNotifications(postId, rankedMatches, sessionId);

    return {
        success: true,
        matches: rankedMatches,
        notificationsQueued: queued,
    };
}
