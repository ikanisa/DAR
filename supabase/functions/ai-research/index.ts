
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';
import OpenAI from 'npm:openai';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const { query, action, provider } = await req.json();

    try {
        // Try Gemini first if requested or default
        if (provider === 'gemini' || !provider) {
            try {
                return await handleGeminiResearch(query, action);
            } catch (geminiError) {
                console.error('Gemini failed, falling back to OpenAI:', geminiError);
                return await handleOpenAIResearch(query, action);
            }
        }

        return await handleOpenAIResearch(query, action);

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

async function handleGeminiResearch(query: string, action: string) {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: action === 'deep_research' ? 'gemini-2.0-flash-thinking-exp-1219' : 'gemini-2.0-flash-exp',
        tools: [{ googleSearch: {} }],
    });

    const systemPrompt = action === 'deep_research'
        ? `You are a Malta real estate market researcher. Produce a comprehensive report with citations.`
        : `You are researching Malta real estate. Always cite sources with URLs.`;

    const result = await model.generateContent(`${systemPrompt}\n\n${query}`);
    const text = result.response.text();

    // Extract citations from grounding metadata
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    const citations = (groundingMetadata?.groundingChunks || []).map((chunk: any) => ({
        title: chunk.web?.title || 'Source',
        url: chunk.web?.uri || '',
        snippet: chunk.text || '',
        accessedAt: new Date().toISOString(),
    }));

    return new Response(JSON.stringify({
        content: text,
        citations,
        tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
        model: 'gemini-2.0-flash',
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

async function handleOpenAIResearch(query: string, action: string) {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');

    const openai = new OpenAI({ apiKey });

    // Note: 'o3-deep-research' is hypothetical/placeholder. Using gpt-4o as fallback for now.
    const modelName = action === 'deep_research' ? 'gpt-4o' : 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
            {
                role: 'system',
                content: 'You are a Malta real estate researcher. Always cite sources.'
            },
            { role: 'user', content: query },
        ],
        // OpenAI doesn't have native Google Search tool in API yet without plugins, 
        // but assuming we might have a custom tool or just relying on model knowledge/browsing if available.
        // tailored for standard API usage:
    });

    const content = completion.choices[0].message.content || '';
    const citations = extractCitationsFromContent(content);

    return new Response(JSON.stringify({
        content,
        citations,
        tokensUsed: completion.usage?.total_tokens || 0,
        model: modelName,
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function extractCitationsFromContent(content: string) {
    const citations: any[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        citations.push({
            title: match[1],
            url: match[2],
            snippet: '',
            accessedAt: new Date().toISOString(),
        });
    }

    return citations;
}
