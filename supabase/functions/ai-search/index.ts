/**
 * AI Search Edge Function
 * Provides grounded web search using Gemini (primary) or OpenAI (fallback)
 * Used by the discovery service to find Malta property listings
 */

import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.21.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
    query: string;
    provider: 'gemini' | 'openai';
    searchType?: string;
    region?: string;
}

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { query, provider, searchType, region }: SearchRequest = await req.json();

        if (!query) {
            return new Response(
                JSON.stringify({ error: 'Query is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`AI Search request: provider=${provider}, query="${query.slice(0, 100)}..."`);

        if (provider === 'gemini') {
            return await handleGeminiSearch(query, searchType, region);
        }

        if (provider === 'openai') {
            return await handleOpenAISearch(query);
        }

        return new Response(
            JSON.stringify({ error: `Unknown provider: ${provider}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('AI Search error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

/**
 * Handle Gemini grounded search
 * Uses Gemini 2.0 Flash with Google Search grounding
 */
async function handleGeminiSearch(
    query: string,
    searchType?: string,
    region?: string
): Promise<Response> {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Create model with grounded search capability
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        tools: [{
            googleSearch: {},
        }],
    });

    // Build the search prompt
    const regionContext = region === 'mt' ? 'Malta' : '';
    const typeContext = searchType === 'property' ? 'property listings' : '';
    const prompt = `Search for ${typeContext} in ${regionContext}: ${query}. 
    Return the top 10 most relevant property listing URLs from established Malta real estate websites.
    Focus on actual property listings, not general articles or news.`;

    console.log(`Gemini search prompt: ${prompt.slice(0, 200)}...`);

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Extract grounding metadata (contains search results)
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    console.log(`Gemini returned ${groundingChunks.length} grounding chunks`);

    // Transform grounding chunks to our format
    const results: SearchResult[] = groundingChunks
        .filter((chunk: any) => chunk.web?.uri)
        .map((chunk: any) => ({
            title: chunk.web?.title || 'Property Listing',
            url: chunk.web?.uri || '',
            snippet: chunk.retrievedContext?.text || '',
        }));

    // Also check for inline citations in the text
    const supportingSearchResults = groundingMetadata?.webSearchQueries || [];
    console.log(`Gemini search queries used: ${supportingSearchResults.join(', ')}`);

    return new Response(
        JSON.stringify({
            results,
            provider: 'gemini',
            queriesUsed: supportingSearchResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}

/**
 * Handle OpenAI web search (fallback)
 * Uses GPT-4o with web search capability
 */
async function handleOpenAISearch(query: string): Promise<Response> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    // Use OpenAI's responses API with web search
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            tools: [{ type: 'web_search_preview' }],
            input: `Search for Malta property listings: ${query}. Return URLs from major Malta real estate websites.`,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract URLs from the response
    const results: SearchResult[] = [];

    // Parse tool results for URLs
    if (data.output) {
        for (const item of data.output) {
            if (item.type === 'web_search_call' && item.results) {
                for (const result of item.results) {
                    results.push({
                        title: result.title || 'Property Listing',
                        url: result.url || '',
                        snippet: result.snippet || '',
                    });
                }
            }
        }
    }

    console.log(`OpenAI returned ${results.length} results`);

    return new Response(
        JSON.stringify({
            results,
            provider: 'openai',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}
