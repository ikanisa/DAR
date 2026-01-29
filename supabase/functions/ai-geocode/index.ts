/**
 * AI Geocode Edge Function
 * Provides geocoding and POI discovery using Gemini (primary) or OpenAI (fallback)
 * Used by the enrichment service to add location context to listings
 */

import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.21.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
    address?: string;
    lat?: number;
    lng?: number;
    action?: 'geocode' | 'nearby_pois';
    provider: 'gemini' | 'openai';
}

interface GeocodingResult {
    lat: number;
    lng: number;
    formattedAddress: string;
    locality: string | null;
    neighborhood: string | null;
    confidence: number;
}

interface POIResult {
    name: string;
    type: string;
    distance: number;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body: GeocodeRequest = await req.json();
        const { address, lat, lng, action = 'geocode', provider } = body;

        console.log(`AI Geocode request: action=${action}, provider=${provider}`);

        if (action === 'nearby_pois') {
            if (lat === undefined || lng === undefined) {
                return new Response(
                    JSON.stringify({ error: 'lat and lng are required for nearby_pois' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            return await handleNearbyPOIs(lat, lng, provider);
        }

        // Default: geocode
        if (!address) {
            return new Response(
                JSON.stringify({ error: 'address is required for geocoding' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return await handleGeocode(address, provider);

    } catch (error) {
        console.error('AI Geocode error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

/**
 * Handle geocoding request using Gemini grounded search
 */
async function handleGeocode(address: string, provider: string): Promise<Response> {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        tools: [{ googleSearch: {} }],
    });

    const prompt = `
Geocode this Malta address and return ONLY valid JSON (no markdown, no explanation):

Address: ${address}

Return this exact JSON format:
{
  "lat": <number>,
  "lng": <number>,
  "formattedAddress": "<full address string>",
  "locality": "<town/city name or null>",
  "neighborhood": "<neighborhood name or null>",
  "confidence": <number 0-100>
}

Confidence scoring:
- 100: Exact address match with building
- 80: Street-level match
- 60: Area/neighborhood match
- 40: Town/city level only
- 20: Region level only

Malta coordinates are approximately: lat 35.8-36.1, lng 14.1-14.6
`;

    console.log(`Geocoding: "${address.slice(0, 100)}..."`);

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error('No JSON in geocode response:', text.slice(0, 200));
        throw new Error('Failed to parse geocoding response');
    }

    const data: GeocodingResult = JSON.parse(jsonMatch[0]);

    // Validate Malta coordinates
    if (data.lat < 35.7 || data.lat > 36.2 || data.lng < 14.0 || data.lng > 14.7) {
        console.warn('Coordinates outside Malta bounds:', data);
        data.confidence = Math.min(data.confidence, 30);
    }

    console.log(`Geocoded to: ${data.lat}, ${data.lng} (confidence: ${data.confidence})`);

    return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

/**
 * Handle nearby POI discovery using Gemini grounded search
 */
async function handleNearbyPOIs(lat: number, lng: number, provider: string): Promise<Response> {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        tools: [{ googleSearch: {} }],
    });

    const prompt = `
Find nearby points of interest within 1km of coordinates (${lat}, ${lng}) in Malta.

Search for and return ONLY valid JSON array (no markdown, no explanation):

Focus on these categories:
- school: Schools, colleges, universities
- transit: Bus stops, ferry terminals
- supermarket: Grocery stores, supermarkets
- hospital: Hospitals, clinics, pharmacies

Return this exact JSON format (array of 3-5 most relevant POIs per category):
[
  { "name": "<POI name>", "type": "school|transit|supermarket|hospital", "distance": <meters as number> }
]

If no POIs found for a category, omit it. Return empty array [] if nothing found.
`;

    console.log(`Finding POIs near: ${lat}, ${lng}`);

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let pois: POIResult[] = [];

    if (jsonMatch) {
        try {
            pois = JSON.parse(jsonMatch[0]);
            // Validate and clean
            pois = pois.filter((p: any) =>
                p && typeof p.name === 'string' &&
                typeof p.type === 'string' &&
                ['school', 'transit', 'supermarket', 'hospital'].includes(p.type)
            ).map((p: any) => ({
                name: p.name,
                type: p.type,
                distance: typeof p.distance === 'number' ? p.distance : 500,
            }));
        } catch (e) {
            console.warn('Failed to parse POI response:', e);
            pois = [];
        }
    }

    console.log(`Found ${pois.length} POIs`);

    return new Response(
        JSON.stringify({ pois }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}
