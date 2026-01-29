
import { createClient } from '@supabase/supabase-js';
// Environment variables provided by server process or Docker

// Ensure environment variables are loaded
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY, AIResearchClient may fail.');
}

export interface Citation {
    title: string;
    url: string;
    snippet: string;
    accessedAt: string;
}

export interface ResearchResult {
    content: string;
    citations: Citation[];
    tokensUsed: number;
    model: string;
}

export class AIResearchClient {
    private supabase;

    constructor() {
        this.supabase = createClient(
            SUPABASE_URL!,
            SUPABASE_SERVICE_KEY!
        );
    }

    // Web Search with citations (Gemini primary, OpenAI fallback)
    async webSearch(query: string): Promise<ResearchResult> {
        const { data, error } = await this.supabase.functions.invoke('ai-research', {
            body: {
                query,
                action: 'web_search',
                provider: 'gemini', // Will fallback to openai if needed
            },
        });

        if (error) {
            console.error('AI Research Error:', error);
            throw new Error(`Research failed: ${error.message || JSON.stringify(error)}`);
        }

        return {
            content: data.content,
            citations: data.citations || [],
            tokensUsed: data.tokensUsed || 0,
            model: data.model,
        };
    }

    // Deep Research for comprehensive reports
    async deepResearch(topic: string): Promise<ResearchResult> {
        const { data, error } = await this.supabase.functions.invoke('ai-research', {
            body: {
                query: topic,
                action: 'deep_research',
                provider: 'gemini',
            },
        });

        if (error) {
            console.error('Deep Research Error:', error);
            throw new Error(`Deep research failed: ${error.message || JSON.stringify(error)}`);
        }

        return {
            content: data.content,
            citations: data.citations || [],
            tokensUsed: data.tokensUsed || 0,
            model: data.model,
        };
    }
}

export const researchClient = new AIResearchClient();
