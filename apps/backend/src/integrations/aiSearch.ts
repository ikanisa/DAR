/**
 * AI Search Integration
 * Unified search client with Gemini grounded search (primary) and OpenAI fallback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { query } from '../db.js';
import { logger } from '../observability/logger.js';
import { getConfig } from '../config.js';

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    displayLink: string;
}

export interface SearchProvider {
    search(searchQuery: string): Promise<SearchResult[]>;
    getName(): string;
}

/**
 * Gemini Grounded Search Provider
 * Uses Supabase Edge Function that wraps Gemini 2.0 with grounded search
 */
export class GeminiSearchProvider implements SearchProvider {
    private supabase: SupabaseClient | null = null;

    private getSupabase(): SupabaseClient {
        if (this.supabase) return this.supabase;

        const config = getConfig();
        if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for AI search');
        }
        this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
        return this.supabase;
    }

    getName(): string {
        return 'gemini_grounded';
    }

    async search(searchQuery: string): Promise<SearchResult[]> {
        // Check daily quota
        const usage = await this.checkQuota();
        if (usage >= 100) {
            logger.warn({ usage }, 'Daily AI search quota exceeded');
            throw new Error('Daily search quota exceeded (100 calls/day)');
        }

        logger.info({ query: searchQuery, provider: 'gemini' }, 'Executing AI search');

        // Call Supabase Edge Function
        const { data, error } = await this.getSupabase().functions.invoke('ai-search', {
            body: {
                query: searchQuery,
                provider: 'gemini',
                searchType: 'property',
                region: 'mt', // Malta
            },
        });

        if (error) {
            logger.warn({ error, query: searchQuery }, 'Gemini search failed, trying OpenAI fallback');
            return this.fallbackSearch(searchQuery);
        }

        await this.incrementUsage();

        return (data.results || []).map((r: { title?: string; url?: string; snippet?: string }) => ({
            title: r.title || 'Property Listing',
            link: r.url || '',
            snippet: r.snippet || '',
            displayLink: r.url ? new URL(r.url).hostname : '',
        }));
    }

    private async fallbackSearch(searchQuery: string): Promise<SearchResult[]> {
        logger.info({ query: searchQuery, provider: 'openai' }, 'Using OpenAI fallback search');

        const { data, error } = await this.getSupabase().functions.invoke('ai-search', {
            body: {
                query: searchQuery,
                provider: 'openai',
                searchType: 'property',
            },
        });

        if (error) {
            logger.error({ error }, 'All search providers failed');
            throw new Error(`All search providers failed: ${error.message}`);
        }

        await this.incrementUsage();

        return (data.results || []).map((r: { title?: string; url?: string; snippet?: string }) => ({
            title: r.title || 'Property Listing',
            link: r.url || '',
            snippet: r.snippet || '',
            displayLink: r.url ? new URL(r.url).hostname : '',
        }));
    }

    private async checkQuota(): Promise<number> {
        const today = new Date().toISOString().split('T')[0];
        const result = await query<{ calls_count: number }>(
            `SELECT calls_count FROM api_usage 
             WHERE api_name = 'ai_search' AND date = $1`,
            [today]
        );
        return result.rows[0]?.calls_count || 0;
    }

    private async incrementUsage(): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        await query(`
            INSERT INTO api_usage (api_name, date, calls_count, quota_limit)
            VALUES ('ai_search', $1, 1, 100)
            ON CONFLICT (api_name, date) 
            DO UPDATE SET calls_count = api_usage.calls_count + 1
        `, [today]);
    }
}

/**
 * Factory function for creating search providers
 * Allows easy swapping of providers in the future
 */
export function createSearchProvider(): SearchProvider {
    return new GeminiSearchProvider();
}

/**
 * Get current API usage stats
 */
export async function getApiUsage(apiName: string = 'ai_search'): Promise<{
    today: number;
    limit: number;
    remaining: number;
}> {
    const today = new Date().toISOString().split('T')[0];
    const result = await query<{ calls_count: number; quota_limit: number }>(
        `SELECT calls_count, quota_limit FROM api_usage 
         WHERE api_name = $1 AND date = $2`,
        [apiName, today]
    );

    const usage = result.rows[0];
    const limit = usage?.quota_limit || 100;
    const todayCount = usage?.calls_count || 0;

    return {
        today: todayCount,
        limit,
        remaining: Math.max(0, limit - todayCount),
    };
}
