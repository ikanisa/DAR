/**
 * Moltbot Action Handlers
 * 
 * Execute actions based on validated Moltbot output.
 * Each handler performs the database/UI operation for its action.
 */

import { supabase } from './supabase';
import {
    MoltbotOutput,
    AskUserOutput as _AskUserOutput,
    UpdatePostOutput,
    PostNowOutput,
    CreateOrUpdateListingOutput,
    PublishListingOutput,
    ShowListingsOutput,
    InquireListingOutput,
    createErrorOutput as _createErrorOutput,
} from './moltbotSchema';
import { ProductListing } from './types';

// =============================================================================
// ACTION HANDLERS
// =============================================================================

export async function handleMoltbotAction(
    output: MoltbotOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {

    switch (output.action) {
        case 'ask_user':
            // No DB action needed, just display the prompt
            return { success: true, result: output.data };

        case 'update_post':
            return handleUpdatePost(output as UpdatePostOutput, sessionId);

        case 'post_now':
            return handlePostNow(output as PostNowOutput, sessionId);

        case 'create_or_update_listing':
            return handleCreateOrUpdateListing(output as CreateOrUpdateListingOutput, sessionId);

        case 'publish_listing':
            return handlePublishListing(output as PublishListingOutput, sessionId);

        case 'show_listings':
            return handleShowListings(output as ShowListingsOutput);

        case 'inquire_listing':
            return handleInquireListing(output as InquireListingOutput, sessionId);

        case 'suggest_matches':
        case 'notify_top_targets':
            // These are internal/backend actions, not executed from frontend
            console.warn('[Moltbot] Internal action received on frontend:', output.action);
            return { success: true };

        case 'error':
        case 'fallback':
            return { success: false, error: output.message };

        default:
            return { success: false, error: 'Unknown action' };
    }
}

// =============================================================================
// INDIVIDUAL HANDLERS
// =============================================================================

async function handleUpdatePost(
    output: UpdatePostOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { postId, updates } = output.data;

    const { data, error } = await supabase
        .from('market_posts')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('session_id', sessionId) // Security: only update own posts
        .select()
        .single();

    if (error) {
        console.error('[Moltbot] Update post failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true, result: data };
}

async function handlePostNow(
    output: PostNowOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { postId } = output.data;

    const { data, error } = await supabase
        .from('market_posts')
        .update({
            status: 'posted',
            updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .eq('session_id', sessionId)
        .select()
        .single();

    if (error) {
        console.error('[Moltbot] Post now failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true, result: data };
}

async function handleCreateOrUpdateListing(
    output: CreateOrUpdateListingOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { listingId, updates } = output.data;

    if (listingId) {
        // Update existing
        const { data, error } = await supabase
            .from('product_listings')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', listingId)
            .eq('session_id', sessionId)
            .select()
            .single();

        if (error) {
            console.error('[Moltbot] Update listing failed:', error);
            return { success: false, error: error.message };
        }

        return { success: true, result: data };
    } else {
        // Create new
        const { data, error } = await supabase
            .from('product_listings')
            .insert({
                session_id: sessionId,
                ...updates,
                status: 'draft',
            })
            .select()
            .single();

        if (error) {
            console.error('[Moltbot] Create listing failed:', error);
            return { success: false, error: error.message };
        }

        return { success: true, result: data };
    }
}

async function handlePublishListing(
    output: PublishListingOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { listingId } = output.data;

    const { data, error } = await supabase
        .from('product_listings')
        .update({
            status: 'published',
            updated_at: new Date().toISOString(),
        })
        .eq('id', listingId)
        .eq('session_id', sessionId)
        .select()
        .single();

    if (error) {
        console.error('[Moltbot] Publish listing failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true, result: data };
}

async function handleShowListings(
    output: ShowListingsOutput
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // Listings are already in the output data (from backend)
    // Just return them for display
    return { success: true, result: output.data.listings };
}

async function handleInquireListing(
    output: InquireListingOutput,
    sessionId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { listingId, message } = output.data;

    const { data, error } = await supabase
        .from('listing_inquiries')
        .insert({
            listing_id: listingId,
            buyer_session_id: sessionId,
            message,
        })
        .select()
        .single();

    if (error) {
        console.error('[Moltbot] Inquire listing failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true, result: data };
}

// =============================================================================
// FETCH LISTINGS (for UI)
// =============================================================================

export async function fetchPublishedListings(
    options?: {
        category?: string;
        location?: string;
        listingType?: 'product' | 'service';
        limit?: number;
    }
): Promise<ProductListing[]> {
    let query = supabase
        .from('product_listings')
        .select(`
      *,
      vendor:vendors(id, name, slug, verified)
    `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

    if (options?.category) {
        query = query.eq('category', options.category);
    }
    if (options?.location) {
        query = query.eq('location', options.location);
    }
    if (options?.listingType) {
        query = query.eq('listing_type', options.listingType);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Moltbot] Fetch listings failed:', error);
        return [];
    }

    // Add verified vendor badge flag
    return (data || []).map(listing => ({
        ...listing,
        is_verified_vendor: listing.vendor?.verified === true,
    }));
}

export async function fetchVerifiedVendors(
    options?: {
        category?: string;
        limit?: number;
    }
): Promise<unknown[]> {
    let query = supabase
        .from('vendors')
        .select('*')
        .eq('verified', true)
        .order('name', { ascending: true });

    if (options?.category) {
        query = query.eq('category', options.category);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Moltbot] Fetch vendors failed:', error);
        return [];
    }

    return data || [];
}

// =============================================================================
// MARKET POSTS (Requests)
// =============================================================================

export interface MarketPostData {
    type: 'buy' | 'sell';
    title: string;
    description?: string;
    category?: string;
    budget_min?: number;
    budget_max?: number;
    currency?: string;
    location?: string;
}

export async function fetchMarketPosts(
    sessionId: string,
    options?: {
        status?: 'draft' | 'posted' | 'closed';
        type?: 'buy' | 'sell';
        limit?: number;
    }
): Promise<unknown[]> {
    let query = supabase
        .from('market_posts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (options?.status) {
        query = query.eq('status', options.status);
    }
    if (options?.type) {
        query = query.eq('type', options.type);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Moltbot] Fetch market posts failed:', error);
        return [];
    }

    return data || [];
}

export async function createMarketPost(
    sessionId: string,
    postData: MarketPostData
): Promise<{ success: boolean; post?: unknown; error?: string }> {
    // Rate limit check
    const { checkAndRecord } = await import('./rateLimiter');
    const limitResult = checkAndRecord(sessionId, 'post');

    if (!limitResult.allowed) {
        const waitTime = Math.ceil((limitResult.retryAfterMs || 60000) / 1000);
        return {
            success: false,
            error: `Rate limit exceeded. Please wait ${waitTime}s before posting again.`
        };
    }

    const { data, error } = await supabase
        .from('market_posts')
        .insert({
            session_id: sessionId,
            ...postData,
            status: 'draft',
        })
        .select()
        .single();

    if (error) {
        console.error('[Moltbot] Create market post failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true, post: data };
}

export async function postMarketPost(
    postId: string,
    sessionId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('market_posts')
        .update({ status: 'posted', updated_at: new Date().toISOString() })
        .eq('id', postId)
        .eq('session_id', sessionId);

    if (error) {
        console.error('[Moltbot] Post market post failed:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

// =============================================================================
// FETCH NOTIFICATIONS
// =============================================================================

export async function fetchNotifications(
    sessionId: string,
    options?: {
        unreadOnly?: boolean;
        limit?: number;
    }
): Promise<unknown[]> {
    let query = supabase
        .from('web_notifications')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
        query = query.eq('read', false);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Moltbot] Fetch notifications failed:', error);
        return [];
    }

    return data || [];
}

export async function markNotificationRead(
    notificationId: string,
    sessionId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('web_notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('session_id', sessionId);

    if (error) {
        console.error('[Moltbot] Mark notification read failed:', error);
        return false;
    }

    return true;
}

export async function markAllNotificationsRead(
    sessionId: string
): Promise<boolean> {
    const { error } = await supabase
        .from('web_notifications')
        .update({ read: true })
        .eq('session_id', sessionId)
        .eq('read', false);

    if (error) {
        console.error('[Moltbot] Mark all notifications read failed:', error);
        return false;
    }

    return true;
}

// =============================================================================
// FETCH EXTERNAL FEED ITEMS
// =============================================================================

export async function fetchExternalFeedItems(
    options?: {
        source?: string;
        limit?: number;
    }
): Promise<unknown[]> {
    let query = supabase
        .from('external_feed_items')
        .select('*')
        .order('published_at', { ascending: false });

    if (options?.source) {
        query = query.eq('source', options.source);
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Moltbot] Fetch external feed failed:', error);
        return [];
    }

    return data || [];
}

