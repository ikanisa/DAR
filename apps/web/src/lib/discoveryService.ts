/**
 * Discovery Service
 * 
 * Functions to fetch and format external feed items.
 * All outputs are link-only (no inventory claims per spec).
 */

import { supabase } from './supabase';
import { isFeatureEnabled } from './featureFlags';

// =============================================================================
// TYPES
// =============================================================================

export interface ExternalFeedItem {
    id: string;
    url: string;
    title: string;
    source: 'web' | 'maps' | 'social' | 'news' | 'other';
    description?: string;
    image_url?: string;
    published_at?: string;
    crawled_at?: string;
}

export interface DiscoveryResult {
    items: ExternalFeedItem[];
    source: string;
    query?: string;
}

// =============================================================================
// WEB SEARCH ITEMS
// =============================================================================

/**
 * Fetch link cards from web search results.
 * Requires WEB_EXTERNAL_DISCOVERY_ENABLED flag.
 */
export async function webSearchItems(
    query?: string,
    limit: number = 10
): Promise<DiscoveryResult> {
    // Gate check
    if (!isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED')) {
        return { items: [], source: 'web', query };
    }

    let dbQuery = supabase
        .from('external_feed_items')
        .select('*')
        .eq('source', 'web')
        .order('published_at', { ascending: false })
        .limit(limit);

    // Text search if query provided
    if (query) {
        dbQuery = dbQuery.ilike('title', `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
        console.error('[Discovery] Web search failed:', error);
        return { items: [], source: 'web', query };
    }

    return {
        items: formatItems(data || [], 'web'),
        source: 'web',
        query,
    };
}

// =============================================================================
// MAPS PLACES ITEMS
// =============================================================================

/**
 * Fetch link cards from maps/places results.
 * Requires WEB_MAPS_ENABLED flag.
 */
export async function mapsPlacesItems(
    query?: string,
    limit: number = 10
): Promise<DiscoveryResult> {
    // Gate check
    if (!isFeatureEnabled('WEB_MAPS_ENABLED')) {
        return { items: [], source: 'maps', query };
    }

    let dbQuery = supabase
        .from('external_feed_items')
        .select('*')
        .eq('source', 'maps')
        .order('crawled_at', { ascending: false })
        .limit(limit);

    if (query) {
        dbQuery = dbQuery.ilike('title', `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
        console.error('[Discovery] Maps places failed:', error);
        return { items: [], source: 'maps', query };
    }

    return {
        items: formatItems(data || [], 'maps'),
        source: 'maps',
        query,
    };
}

// =============================================================================
// SOCIAL PROFILE ITEMS
// =============================================================================

/**
 * Fetch link cards from social profiles.
 * Requires WEB_SOCIAL_ENABLED flag.
 */
export async function socialProfileItems(
    handle?: string,
    limit: number = 10
): Promise<DiscoveryResult> {
    // Gate check
    if (!isFeatureEnabled('WEB_SOCIAL_ENABLED')) {
        return { items: [], source: 'social', query: handle };
    }

    let dbQuery = supabase
        .from('external_feed_items')
        .select('*')
        .eq('source', 'social')
        .order('published_at', { ascending: false })
        .limit(limit);

    if (handle) {
        dbQuery = dbQuery.ilike('title', `%${handle}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
        console.error('[Discovery] Social profiles failed:', error);
        return { items: [], source: 'social', query: handle };
    }

    return {
        items: formatItems(data || [], 'social'),
        source: 'social',
        query: handle,
    };
}

// =============================================================================
// FETCH ALL FEED ITEMS
// =============================================================================

/**
 * Fetch all external feed items respecting feature flags.
 */
export async function fetchAllFeedItems(
    limit: number = 20
): Promise<ExternalFeedItem[]> {
    // Gate check
    if (!isFeatureEnabled('WEB_EXTERNAL_DISCOVERY_ENABLED')) {
        return [];
    }

    // Build sources array based on enabled flags
    const sources: string[] = ['web', 'news', 'other'];

    if (isFeatureEnabled('WEB_MAPS_ENABLED')) {
        sources.push('maps');
    }
    if (isFeatureEnabled('WEB_SOCIAL_ENABLED')) {
        sources.push('social');
    }

    const { data, error } = await supabase
        .from('external_feed_items')
        .select('*')
        .in('source', sources)
        .order('published_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[Discovery] Fetch all failed:', error);
        return [];
    }

    return formatItems(data || []);
}

// =============================================================================
// HELPERS
// =============================================================================

function formatItems(
    data: unknown[],
    defaultSource?: ExternalFeedItem['source']
): ExternalFeedItem[] {
    return (data as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        url: String(row.url || ''),
        title: String(row.title || 'Untitled'),
        source: (row.source as ExternalFeedItem['source']) || defaultSource || 'other',
        description: row.description ? String(row.description) : undefined,
        image_url: row.image_url ? String(row.image_url) : undefined,
        published_at: row.published_at ? String(row.published_at) : undefined,
        crawled_at: row.crawled_at ? String(row.crawled_at) : undefined,
    }));
}

/**
 * Get source icon name for display
 */
export function getSourceIcon(source: ExternalFeedItem['source']): string {
    switch (source) {
        case 'web': return 'Globe';
        case 'maps': return 'MapPin';
        case 'social': return 'Users';
        case 'news': return 'Newspaper';
        default: return 'Link';
    }
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
