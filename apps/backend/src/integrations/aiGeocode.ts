/**
 * AI Geocoding Client
 * Provides geocoding and POI discovery via Supabase Edge Function
 * Implements caching to minimize API costs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { query } from '../db.js';
import { logger } from '../observability/logger.js';
import { getConfig } from '../config.js';

export interface GeocodingResult {
    lat: number;
    lng: number;
    formattedAddress: string;
    locality: string | null;
    neighborhood: string | null;
    confidence: number;
}

export interface POIResult {
    name: string;
    type: 'school' | 'transit' | 'supermarket' | 'hospital';
    distance: number;
}

export class AIGeocodeClient {
    private supabase: SupabaseClient | null = null;

    private getSupabase(): SupabaseClient {
        if (this.supabase) return this.supabase;

        const config = getConfig();
        if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for geocoding');
        }
        this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
        return this.supabase;
    }

    /**
     * Geocode an address to coordinates
     * Uses cache to avoid repeated API calls
     */
    async geocode(address: string, country = 'Malta'): Promise<GeocodingResult | null> {
        const queryText = `${address}, ${country}`;
        const queryHash = this.hashQuery(queryText);

        // Check cache first
        const cached = await this.getGeoCache(queryHash);
        if (cached) {
            logger.debug({ address, source: 'cache' }, 'Geocoding cache hit');
            return cached;
        }

        logger.info({ address }, 'Geocoding via AI');

        try {
            // Call Edge Function with Gemini
            const { data, error } = await this.getSupabase().functions.invoke('ai-geocode', {
                body: {
                    address: queryText,
                    action: 'geocode',
                    provider: 'gemini',
                },
            });

            if (error) {
                logger.warn({ error, address }, 'Gemini geocode failed, trying OpenAI');
                return this.fallbackGeocode(queryText, queryHash);
            }

            const result: GeocodingResult = {
                lat: data.lat,
                lng: data.lng,
                formattedAddress: data.formattedAddress,
                locality: data.locality,
                neighborhood: data.neighborhood,
                confidence: data.confidence || 50,
            };

            // Cache result
            await this.setGeoCache(queryHash, queryText, result, 'gemini');

            return result;

        } catch (err) {
            logger.error({ err, address }, 'Geocoding failed');
            return null;
        }
    }

    /**
     * Fallback geocoding using OpenAI
     */
    private async fallbackGeocode(queryText: string, queryHash: string): Promise<GeocodingResult | null> {
        try {
            const { data, error } = await this.getSupabase().functions.invoke('ai-geocode', {
                body: {
                    address: queryText,
                    action: 'geocode',
                    provider: 'openai',
                },
            });

            if (error) {
                logger.error({ error }, 'OpenAI geocode also failed');
                return null;
            }

            const result: GeocodingResult = {
                lat: data.lat,
                lng: data.lng,
                formattedAddress: data.formattedAddress,
                locality: data.locality,
                neighborhood: data.neighborhood,
                confidence: data.confidence || 40,
            };

            await this.setGeoCache(queryHash, queryText, result, 'openai');

            return result;

        } catch (err) {
            logger.error({ err }, 'Fallback geocoding failed');
            return null;
        }
    }

    /**
     * Get nearby POIs for a location
     */
    async getNearbyPOIs(lat: number, lng: number): Promise<POIResult[]> {
        const locationHash = this.hashLocation(lat, lng);

        // Check cache
        const cached = await this.getPOICache(locationHash);
        if (cached) {
            logger.debug({ lat, lng, source: 'cache' }, 'POI cache hit');
            return cached;
        }

        logger.info({ lat, lng }, 'Fetching POIs via AI');

        try {
            const { data, error } = await this.getSupabase().functions.invoke('ai-geocode', {
                body: {
                    lat,
                    lng,
                    action: 'nearby_pois',
                    provider: 'gemini',
                },
            });

            if (error) {
                logger.warn({ error, lat, lng }, 'POI fetch failed');
                return [];
            }

            const pois: POIResult[] = (data.pois || []).map((p: any) => ({
                name: p.name,
                type: p.type,
                distance: p.distance || 500,
            }));

            // Cache result
            await this.setPOICache(locationHash, lat, lng, pois);

            return pois;

        } catch (err) {
            logger.error({ err, lat, lng }, 'POI fetch failed');
            return [];
        }
    }

    // =========================================================================
    // Cache Management
    // =========================================================================

    private async getGeoCache(hash: string): Promise<GeocodingResult | null> {
        try {
            const result = await query<{ response: GeocodingResult }>(
                'SELECT response FROM geo_cache WHERE query_hash = $1',
                [hash]
            );
            return result.rows[0]?.response || null;
        } catch {
            return null;
        }
    }

    private async setGeoCache(
        hash: string,
        queryText: string,
        response: GeocodingResult,
        provider: string
    ): Promise<void> {
        try {
            await query(`
                INSERT INTO geo_cache (query_hash, query_text, response, provider)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (query_hash) DO UPDATE SET 
                    response = $3, 
                    provider = $4,
                    created_at = now()
            `, [hash, queryText, JSON.stringify(response), provider]);
        } catch (err) {
            logger.warn({ err }, 'Failed to cache geocoding result');
        }
    }

    private async getPOICache(hash: string): Promise<POIResult[] | null> {
        try {
            const result = await query<{ response: POIResult[] }>(
                'SELECT response FROM poi_cache WHERE location_hash = $1',
                [hash]
            );
            return result.rows[0]?.response || null;
        } catch {
            return null;
        }
    }

    private async setPOICache(
        hash: string,
        lat: number,
        lng: number,
        pois: POIResult[]
    ): Promise<void> {
        try {
            await query(`
                INSERT INTO poi_cache (location_hash, lat, lng, radius_meters, response)
                VALUES ($1, $2, $3, 1000, $4)
                ON CONFLICT (location_hash) DO UPDATE SET 
                    response = $4,
                    created_at = now()
            `, [hash, lat, lng, JSON.stringify(pois)]);
        } catch (err) {
            logger.warn({ err }, 'Failed to cache POI result');
        }
    }

    // =========================================================================
    // Hash Utilities
    // =========================================================================

    private hashQuery(text: string): string {
        return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
    }

    private hashLocation(lat: number, lng: number): string {
        // Round to 4 decimals (~11m precision)
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        return crypto.createHash('md5').update(key).digest('hex');
    }
}

// Singleton instance
export const geocodeClient = new AIGeocodeClient();
