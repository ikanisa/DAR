import {
    MoltbotOutput,
    isValidMoltbotOutput,
} from '@dar/core';
import { fetchWithAuth } from '../lib/api';

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
    // history: ChatMessage[], -- Managed by backend now
    sessionId?: string | null
): Promise<ChatMessage> {
    console.log('[Moltbot] Sending message:', message);

    // Use Backend API
    try {
        const response = await fetchWithAuth('/api/webchat/send', {
            method: 'POST',
            body: JSON.stringify({
                message,
                sessionId, // Chat Thread ID (optional, if continuing a thread)
            }),
        });

        if (response.ok) {
            const data = await response.json();

            // Validate output structure if needed, but backend should guarantee it
            // Backend returns { success, sessionId, response: { message, action, data } }

            if (data.success && data.response) {
                const output = data.response;

                return {
                    role: 'assistant',
                    content: output.message,
                    toolCall: output.action,
                    toolParams: 'data' in output ? output.data : undefined,
                    moltbotOutput: output as MoltbotOutput,
                    // Return the chat session ID so the UI can update state
                    // We'll attach it to the message object temporarily or handle it in UI
                };
            }
        } else {
            console.error('[WebChat] Backend error:', await response.text());
        }
    } catch (e) {
        console.warn('[WebChat] Backend unavailable, using fallback:', e);
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
        // Note: tool call might not work in offline mode without backend
        // const postId = await createDraftPost(type); 
        const postId = 'offline-draft';

        const output: MoltbotOutput = {
            action: 'ask_user',
            message: `[OFFLINE MODE] I've started a ${type} post for you. What would you like to ${type === 'sell' ? 'sell' : 'buy'}?`,
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
            message: '[OFFLINE MODE] Here are some listings that might interest you:',
            success: true,
            data: {
                listings: [],
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
        message: "[OFFLINE MODE] I'm Dar, your marketplace assistant. I can help you:\n\n• **Buy** - Find products or services\n• **Sell** - List something for sale\n• **Browse** - See verified vendors and listings\n\nHow can I help you today?",
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

