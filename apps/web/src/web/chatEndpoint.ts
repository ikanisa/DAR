/**
 * chatEndpoint.ts
 * 
 * Handles interaction with the Moltbot AI.
 * Uses strict JSON schema validation per spec.
 * Invalid output is rejected and logged, then fallback.
 */

import { supabase } from '../lib/supabase';
import { createDraftPost } from '../tools/web.create_draft_post';
import {
    MoltbotOutput,
    parseMoltbotOutput,
    isValidMoltbotOutput,
} from '../lib/moltbotSchema';
import { handleMoltbotAction } from '../lib/moltbotActions';

export type ChatMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolParams?: unknown;
    toolCall?: string;
    moltbotOutput?: MoltbotOutput;
};

/**
 * Send message to Moltbot and get validated response
 */
export async function sendMessageToMoltbot(
    message: string,
    history: ChatMessage[],
    sessionId?: string | null
): Promise<ChatMessage> {
    console.log('[Moltbot] Sending message:', message);

    // Try real backend first
    try {
        const { data, error } = await supabase.functions.invoke('moltbot-chat', {
            body: { message, history, sessionId },
        });

        if (!error && data?.output) {
            // Parse and validate the output
            const output = parseMoltbotOutput(
                typeof data.output === 'string' ? data.output : JSON.stringify(data.output)
            );

            // Execute the action if we have a session
            if (sessionId && output.success) {
                await handleMoltbotAction(output, sessionId);
            }

            return {
                role: 'assistant',
                content: output.message,
                toolCall: output.action,
                toolParams: 'data' in output ? output.data : undefined,
                moltbotOutput: output,
            };
        }
    } catch (e) {
        console.warn('[Moltbot] Backend unavailable, using fallback:', e);
    }

    // FALLBACK: Mock response logic for demo/offline
    return handleMockResponse(message, sessionId);
}

/**
 * Mock response handler for demo/offline mode
 */
async function handleMockResponse(
    message: string,
    _sessionId?: string | null
): Promise<ChatMessage> {
    const lower = message.toLowerCase();

    // Buy/Sell intent detection
    if (lower.includes('sell') || lower.includes('buy')) {
        const type = lower.includes('sell') ? 'sell' : 'buy';
        const postId = await createDraftPost(type);

        const output: MoltbotOutput = {
            action: 'ask_user',
            message: `I've started a ${type} post for you. What would you like to ${type === 'sell' ? 'sell' : 'buy'}?`,
            success: true,
            data: {
                slotName: 'item',
                promptText: `What would you like to ${type === 'sell' ? 'sell' : 'buy'}?`,
                suggestions: type === 'sell'
                    ? ['Electronics', 'Furniture', 'Services', 'Other']
                    : ['Looking for...', 'Need help with...'],
            },
        };

        return {
            role: 'assistant',
            content: output.message,
            toolCall: 'web.create_draft_post',
            toolParams: { postId, type },
            moltbotOutput: output,
        };
    }

    // Listing search intent
    if (lower.includes('show') || lower.includes('find') || lower.includes('search')) {
        const output: MoltbotOutput = {
            action: 'show_listings',
            message: 'Here are some listings that might interest you:',
            success: true,
            data: {
                listings: [], // Would be populated from DB
                query: message,
            },
        };

        return {
            role: 'assistant',
            content: output.message,
            toolCall: 'show_listings',
            moltbotOutput: output,
        };
    }

    // Default greeting/help
    const output: MoltbotOutput = {
        action: 'ask_user',
        message: "I'm Dar, your marketplace assistant. I can help you:\n\n• **Buy** - Find products or services\n• **Sell** - List something for sale\n• **Browse** - See verified vendors and listings\n\nHow can I help you today?",
        success: true,
        data: {
            slotName: 'intent',
            promptText: 'What would you like to do?',
            suggestions: ['I want to buy', 'I want to sell', 'Show listings'],
        },
    };

    return {
        role: 'assistant',
        content: output.message,
        moltbotOutput: output,
    };
}

/**
 * Validate raw JSON from Moltbot (for logging/debugging)
 */
export function validateMoltbotResponse(raw: unknown): boolean {
    return isValidMoltbotOutput(raw);
}

